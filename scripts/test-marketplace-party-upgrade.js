const { spawn, spawnSync } = require('node:child_process');
const {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { createServer } = require('node:net');
const { tmpdir } = require('node:os');
const { basename, join, resolve } = require('node:path');

const ROOT = resolve(__dirname, '..');
const SUPABASE_DB_EXCLUSIONS = 'gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor';

class UpgradeTestError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

function run(command, args, label) {
  process.stdout.write(`\n[party-upgrade] ${label}\n`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw new UpgradeTestError(`${label} could not start.`);
  if (result.status !== 0) {
    throw new UpgradeTestError(`${label} failed.`, result.status ?? 1);
  }
}

function capture(command, args, label) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
  });
  if (result.error || result.status !== 0) {
    throw new UpgradeTestError(`${label} failed.`, result.status ?? 1);
  }
  return result.stdout;
}

function isolatedDatabaseUrl(workspacePath) {
  const status = capture(
    'supabase',
    withWorkdir(['status', '-o', 'env'], workspacePath),
    'Read the isolated database connection',
  );
  const match = status.match(/^DB_URL="?([^"\n]+)"?$/m);
  if (!match) throw new UpgradeTestError('The isolated database URL was unavailable.');
  return match[1];
}

function psql(databaseUrl, sql, label) {
  run('psql', [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], label);
}

function concurrentQuery(databaseUrl, sql) {
  return new Promise((resolveQuery) => {
    const child = spawn(
      'psql',
      [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql],
      { shell: false },
    );
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => resolveQuery({ code: 1, stderr: error.message }));
    child.on('close', (code) => resolveQuery({ code: code ?? 1, stderr }));
  });
}

async function verifyDeletionWriteFence(databaseUrl) {
  psql(
    databaseUrl,
    `
      insert into auth.users (id, email)
      values ('00000000-0000-4000-8000-000000000023', 'deletion-race@example.com');
    `,
    'Create the committed deletion-fence fixture',
  );

  const writer = spawn(
    'psql',
    [databaseUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-qAt'],
    { shell: false },
  );
  let writerStderr = '';
  writer.stderr.on('data', (chunk) => { writerStderr += chunk.toString(); });
  const writerClosed = new Promise((resolveClose) => {
    writer.on('error', (error) => resolveClose({ code: 1, error }));
    writer.on('close', (code) => resolveClose({ code: code ?? 1 }));
  });
  const writerReady = new Promise((resolveReady, rejectReady) => {
    const timeout = setTimeout(
      () => rejectReady(new UpgradeTestError('Timed out waiting for the held storage write.')),
      5000,
    );
    writer.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('WRITE_LOCKED')) {
        clearTimeout(timeout);
        resolveReady();
      }
    });
  });
  writer.stdin.write(`
    begin;
    insert into storage.objects (id, bucket_id, name) values (
      '60000000-0000-4000-8000-000000000023',
      'garments',
      '00000000-0000-4000-8000-000000000023/racing.jpg'
    );
    select 'WRITE_LOCKED';
  `);
  await writerReady;

  let deletionSettled = false;
  const deletion = concurrentQuery(
    databaseUrl,
    `select * from public.account_deletion_start(
      '00000000-0000-4000-8000-000000000023'
    );`,
  ).then((result) => {
    deletionSettled = true;
    return result;
  });
  await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  if (deletionSettled) {
    writer.stdin.end('rollback;\n\\q\n');
    await writerClosed;
    throw new UpgradeTestError(
      'Account deletion crossed an in-flight storage write instead of waiting for its transaction.',
    );
  }

  writer.stdin.end('commit;\n\\q\n');
  const [writerResult, deletionResult] = await Promise.all([writerClosed, deletion]);
  if (writerResult.code !== 0) {
    throw new UpgradeTestError(`Held storage write failed: ${writerStderr}`);
  }
  if (deletionResult.code !== 0) {
    throw new UpgradeTestError(`Deletion fence failed: ${deletionResult.stderr}`);
  }

  const lateWrite = await concurrentQuery(
    databaseUrl,
    `insert into storage.objects (id, bucket_id, name) values (
      '60000000-0000-4000-8000-000000000123',
      'garments',
      '00000000-0000-4000-8000-000000000023/late.jpg'
    );`,
  );
  if (!lateWrite.stderr.includes('Account deletion in progress')) {
    throw new UpgradeTestError('A storage write crossed the committed deletion tombstone.');
  }
}

async function verifyCommittedAuthDeletion(databaseUrl) {
  psql(
    databaseUrl,
    `
      insert into auth.users (id, email)
      values ('00000000-0000-4000-8000-000000000024', 'deletion-auth-commit@example.com');
      insert into public.marketplace_credit_accounts (user_id, available_balance)
      values ('00000000-0000-4000-8000-000000000024', 5);
      insert into public.marketplace_credit_ledger (
        user_id, kind, delta_available, idempotency_key, description
      ) values (
        '00000000-0000-4000-8000-000000000024',
        'adjustment', 5, 'deletion-auth-commit-opening', 'Committed Auth deletion fixture'
      );
      create temporary table committed_deletion_request as
      select * from public.account_deletion_start(
        '00000000-0000-4000-8000-000000000024'
      );
      select public.account_deletion_mark_storage_step(request_id, step)
      from committed_deletion_request,
        unnest(array['body', 'garments', 'results']) step;
      select public.account_deletion_purge_database(request_id)
      from committed_deletion_request;
    `,
    'Commit database purge before Auth deletion',
  );

  const authDeletion = await concurrentQuery(
    databaseUrl,
    `delete from auth.users
     where id = '00000000-0000-4000-8000-000000000024';`,
  );
  if (authDeletion.code !== 0) {
    throw new UpgradeTestError(
      `Auth deletion could not complete after a committed purge: ${authDeletion.stderr}`,
    );
  }
}

async function verifyConcurrentOfferAcceptance(databaseUrl) {
  psql(
    databaseUrl,
    `
      insert into auth.users (id, email) values
        ('00000000-0000-4000-8000-000000000035', 'accept-race-seller@example.com'),
        ('00000000-0000-4000-8000-000000000036', 'accept-race-one@example.com'),
        ('00000000-0000-4000-8000-000000000037', 'accept-race-two@example.com');
      insert into public.marketplace_memberships (user_id, expires_at) values
        ('00000000-0000-4000-8000-000000000035', now() + interval '1 year'),
        ('00000000-0000-4000-8000-000000000036', now() + interval '1 year'),
        ('00000000-0000-4000-8000-000000000037', now() + interval '1 year');
      insert into public.garments (
        id, user_id, original_path, image_hash, name, category, status
      ) values (
        '20000000-0000-4000-8000-000000000035',
        '00000000-0000-4000-8000-000000000035',
        '00000000-0000-4000-8000-000000000035/race.jpg',
        'accept-race', 'Acceptance race', 'top', 'ready'
      );
      insert into public.marketplace_listings (
        id, garment_id, seller_id, accepts_credits, accepts_swap,
        is_giveaway, pickup_area
      ) values (
        '40000000-0000-4000-8000-000000000035',
        '20000000-0000-4000-8000-000000000035',
        '00000000-0000-4000-8000-000000000035',
        false, false, true, 'Race area'
      );
      insert into public.marketplace_offers (
        id, listing_id, buyer_id, seller_id, mode
      ) values
        ('50000000-0000-4000-8000-000000000036',
         '40000000-0000-4000-8000-000000000035',
         '00000000-0000-4000-8000-000000000036',
         '00000000-0000-4000-8000-000000000035', 'giveaway'),
        ('50000000-0000-4000-8000-000000000037',
         '40000000-0000-4000-8000-000000000035',
         '00000000-0000-4000-8000-000000000037',
         '00000000-0000-4000-8000-000000000035', 'giveaway');
    `,
    'Create the committed competing-acceptance fixture',
  );

  const accept = (offerId) => `
    begin;
    set local role authenticated;
    select set_config(
      'request.jwt.claim.sub',
      '00000000-0000-4000-8000-000000000035',
      true
    );
    select public.marketplace_respond_to_offer('${offerId}', true);
    commit;
  `;
  const results = await Promise.all([
    concurrentQuery(databaseUrl, accept('50000000-0000-4000-8000-000000000036')),
    concurrentQuery(databaseUrl, accept('50000000-0000-4000-8000-000000000037')),
  ]);
  const successes = results.filter((result) => result.code === 0);
  const unavailable = results.filter((result) =>
    result.stderr.includes('Listing is no longer available')
      || result.stderr.includes('duplicate key value'),
  );
  if (successes.length !== 1 || unavailable.length !== 1) {
    throw new UpgradeTestError(
      'Concurrent offer acceptance did not produce one winner and one unavailable loser.',
    );
  }
}

async function verifyAcceptanceDeletionLockOrder(databaseUrl) {
  psql(
    databaseUrl,
    `
      insert into auth.users (id, email) values
        ('00000000-0000-4000-8000-000000000042', 'accept-delete-seller@example.com'),
        ('00000000-0000-4000-8000-000000000043', 'accept-delete-buyer@example.com');
      insert into public.marketplace_memberships (user_id, expires_at) values
        ('00000000-0000-4000-8000-000000000042', now() + interval '1 year'),
        ('00000000-0000-4000-8000-000000000043', now() + interval '1 year');
      insert into public.garments (
        id, user_id, original_path, image_hash, name, category, status
      ) values (
        '20000000-0000-4000-8000-000000000042',
        '00000000-0000-4000-8000-000000000042',
        '00000000-0000-4000-8000-000000000042/delete-race.jpg',
        'accept-delete-race', 'Acceptance deletion race', 'top', 'ready'
      );
      insert into public.marketplace_listings (
        id, garment_id, seller_id, accepts_credits, accepts_swap,
        is_giveaway, pickup_area
      ) values (
        '40000000-0000-4000-8000-000000000042',
        '20000000-0000-4000-8000-000000000042',
        '00000000-0000-4000-8000-000000000042',
        false, false, true, 'Deletion race area'
      );
      insert into public.marketplace_offers (
        id, listing_id, buyer_id, seller_id, mode
      ) values (
        '50000000-0000-4000-8000-000000000043',
        '40000000-0000-4000-8000-000000000042',
        '00000000-0000-4000-8000-000000000043',
        '00000000-0000-4000-8000-000000000042', 'giveaway'
      );
    `,
    'Create the acceptance-versus-deletion fixture',
  );

  const deletion = `
    begin;
    select private.account_deletion_lock_subjects(
      array['00000000-0000-4000-8000-000000000043'::uuid],
      '{}'::uuid[]
    );
    select pg_sleep(0.5);
    select * from public.account_deletion_start(
      '00000000-0000-4000-8000-000000000043'
    );
    commit;
  `;
  const acceptance = `
    begin;
    set local role authenticated;
    select set_config(
      'request.jwt.claim.sub',
      '00000000-0000-4000-8000-000000000042',
      true
    );
    select public.marketplace_respond_to_offer(
      '50000000-0000-4000-8000-000000000043', true
    );
    commit;
  `;
  const [deletionResult, acceptanceResult] = await Promise.all([
    concurrentQuery(databaseUrl, deletion),
    concurrentQuery(databaseUrl, acceptance),
  ]);
  const diagnostics = `${deletionResult.stderr}\n${acceptanceResult.stderr}`;
  if (diagnostics.toLowerCase().includes('deadlock detected')) {
    throw new UpgradeTestError(
      'Offer acceptance deadlocked with the account-deletion fence.',
    );
  }
  if (acceptanceResult.code !== 0
    || !deletionResult.stderr.includes('unresolved marketplace activity')) {
    throw new UpgradeTestError(
      'Acceptance and deletion did not serialize to a deterministic accepted-or-blocked result.',
    );
  }
}

async function verifyCrossedSwapCreation(databaseUrl) {
  psql(
    databaseUrl,
    `
      insert into auth.users (id, email) values
        ('00000000-0000-4000-8000-000000000040', 'swap-race-one@example.com'),
        ('00000000-0000-4000-8000-000000000041', 'swap-race-two@example.com');
      insert into public.marketplace_memberships (user_id, expires_at) values
        ('00000000-0000-4000-8000-000000000040', now() + interval '1 year'),
        ('00000000-0000-4000-8000-000000000041', now() + interval '1 year');
      insert into public.garments (
        id, user_id, original_path, image_hash, name, category, status
      ) values
        ('20000000-0000-4000-8000-000000000040',
         '00000000-0000-4000-8000-000000000040',
         '00000000-0000-4000-8000-000000000040/swap.jpg',
         'swap-race-one', 'Swap race one', 'top', 'ready'),
        ('20000000-0000-4000-8000-000000000041',
         '00000000-0000-4000-8000-000000000041',
         '00000000-0000-4000-8000-000000000041/swap.jpg',
         'swap-race-two', 'Swap race two', 'top', 'ready');
      insert into public.marketplace_listings (
        id, garment_id, seller_id, accepts_credits, accepts_swap,
        is_giveaway, pickup_area
      ) values
        ('40000000-0000-4000-8000-000000000040',
         '20000000-0000-4000-8000-000000000040',
         '00000000-0000-4000-8000-000000000040',
         false, true, false, 'Swap race area'),
        ('40000000-0000-4000-8000-000000000041',
         '20000000-0000-4000-8000-000000000041',
         '00000000-0000-4000-8000-000000000041',
         false, true, false, 'Swap race area');
    `,
    'Create the crossed-swap fixture',
  );

  const createSwap = (buyerId, targetId, offeredId) => `
    begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '${buyerId}', true);
    select public.marketplace_create_offer(
      '${targetId}', 'swap', '${offeredId}', 'Crossed swap'
    );
    commit;
  `;
  const results = await Promise.all([
    concurrentQuery(
      databaseUrl,
      createSwap(
        '00000000-0000-4000-8000-000000000040',
        '40000000-0000-4000-8000-000000000041',
        '40000000-0000-4000-8000-000000000040',
      ),
    ),
    concurrentQuery(
      databaseUrl,
      createSwap(
        '00000000-0000-4000-8000-000000000041',
        '40000000-0000-4000-8000-000000000040',
        '40000000-0000-4000-8000-000000000041',
      ),
    ),
  ]);
  if (results.some((result) => result.code !== 0)) {
    const diagnostics = results.map((result) => result.stderr).join('\n');
    throw new UpgradeTestError(
      `Crossed swap creation did not serialize safely: ${diagnostics}`,
    );
  }
  const pendingCount = capture(
    'psql',
    [
      databaseUrl, '-X', '-qAt', '-c',
      `select count(*) from public.marketplace_offers
       where buyer_id in (
         '00000000-0000-4000-8000-000000000040',
         '00000000-0000-4000-8000-000000000041'
       ) and status = 'pending';`,
    ],
    'Read crossed-swap result',
  ).trim();
  if (pendingCount !== '2') {
    throw new UpgradeTestError('Crossed swap creation did not persist both offers.');
  }
}

async function verifyLegacyWriterDeletionLockOrder(databaseUrl) {
  psql(
    databaseUrl,
    `
      insert into auth.users (id, email) values
        ('00000000-0000-4000-8000-000000000044', 'publish-delete-race@example.com'),
        ('00000000-0000-4000-8000-000000000045', 'listing-delete-race@example.com'),
        ('00000000-0000-4000-8000-000000000046', 'offer-delete-seller@example.com'),
        ('00000000-0000-4000-8000-000000000047', 'offer-delete-buyer@example.com');
      insert into public.marketplace_memberships (user_id, expires_at) values
        ('00000000-0000-4000-8000-000000000044', now() + interval '1 year'),
        ('00000000-0000-4000-8000-000000000045', now() + interval '1 year'),
        ('00000000-0000-4000-8000-000000000046', now() + interval '1 year'),
        ('00000000-0000-4000-8000-000000000047', now() + interval '1 year');
      insert into public.garments (
        id, user_id, original_path, image_hash, name, category, status
      ) values
        ('20000000-0000-4000-8000-000000000044',
         '00000000-0000-4000-8000-000000000044',
         '00000000-0000-4000-8000-000000000044/item.jpg',
         'publish-delete-race', 'Publish deletion race', 'top', 'ready'),
        ('20000000-0000-4000-8000-000000000045',
         '00000000-0000-4000-8000-000000000045',
         '00000000-0000-4000-8000-000000000045/item.jpg',
         'listing-delete-race', 'Listing deletion race', 'top', 'ready'),
        ('20000000-0000-4000-8000-000000000046',
         '00000000-0000-4000-8000-000000000046',
         '00000000-0000-4000-8000-000000000046/item.jpg',
         'offer-delete-race', 'Offer deletion race', 'top', 'ready');
      insert into public.marketplace_listings (
        id, garment_id, seller_id, accepts_credits, accepts_swap,
        is_giveaway, pickup_area
      ) values
        ('40000000-0000-4000-8000-000000000044',
         '20000000-0000-4000-8000-000000000044',
         '00000000-0000-4000-8000-000000000044',
         false, false, true, 'Publish race area'),
        ('40000000-0000-4000-8000-000000000045',
         '20000000-0000-4000-8000-000000000045',
         '00000000-0000-4000-8000-000000000045',
         false, false, true, 'Listing race area'),
        ('40000000-0000-4000-8000-000000000046',
         '20000000-0000-4000-8000-000000000046',
         '00000000-0000-4000-8000-000000000046',
         false, false, true, 'Offer race area');
      insert into public.marketplace_offers (
        id, listing_id, buyer_id, seller_id, mode
      ) values (
        '50000000-0000-4000-8000-000000000047',
        '40000000-0000-4000-8000-000000000046',
        '00000000-0000-4000-8000-000000000047',
        '00000000-0000-4000-8000-000000000046', 'giveaway'
      );
    `,
    'Create the legacy-writer deletion fixtures',
  );

  const deletionWithPause = (userId) => `
    begin;
    select private.account_deletion_lock_subjects(
      array['${userId}'::uuid], '{}'::uuid[]
    );
    select pg_sleep(0.5);
    select * from public.account_deletion_start('${userId}');
    commit;
  `;
  const authenticated = (userId, operation) => `
    begin;
    set local role authenticated;
    select set_config('request.jwt.claim.sub', '${userId}', true);
    ${operation}
    commit;
  `;

  const assertNoDeadlock = (results, label) => {
    const diagnostics = results.map((result) => result.stderr).join('\n');
    if (diagnostics.toLowerCase().includes('deadlock detected')) {
      throw new UpgradeTestError(`${label} deadlocked with account deletion.`);
    }
    return diagnostics;
  };

  const publishResults = await Promise.all([
    concurrentQuery(
      databaseUrl,
      deletionWithPause('00000000-0000-4000-8000-000000000044'),
    ),
    concurrentQuery(
      databaseUrl,
      authenticated(
        '00000000-0000-4000-8000-000000000044',
        `select public.marketplace_publish_listing(
          '20000000-0000-4000-8000-000000000044',
          false, false, true, null, 'Changed publish area'
        );`,
      ),
    ),
  ]);
  let diagnostics = assertNoDeadlock(publishResults, 'Listing publication');
  if (publishResults[0].code !== 0
    || publishResults[1].code === 0
    || !diagnostics.includes('Account deletion in progress')) {
    throw new UpgradeTestError('Listing publication did not yield to the deletion tombstone.');
  }

  const listingResults = await Promise.all([
    concurrentQuery(
      databaseUrl,
      deletionWithPause('00000000-0000-4000-8000-000000000045'),
    ),
    concurrentQuery(
      databaseUrl,
      authenticated(
        '00000000-0000-4000-8000-000000000045',
        `select public.marketplace_withdraw_listing(
          '40000000-0000-4000-8000-000000000045'
        );`,
      ),
    ),
  ]);
  diagnostics = assertNoDeadlock(listingResults, 'Listing withdrawal');
  if (listingResults[0].code !== 0
    || listingResults[1].code === 0
    || !diagnostics.includes('Account deletion in progress')) {
    throw new UpgradeTestError('Listing withdrawal did not yield to the deletion tombstone.');
  }

  const offerResults = await Promise.all([
    concurrentQuery(
      databaseUrl,
      deletionWithPause('00000000-0000-4000-8000-000000000047'),
    ),
    concurrentQuery(
      databaseUrl,
      authenticated(
        '00000000-0000-4000-8000-000000000047',
        `select public.marketplace_withdraw_offer(
          '50000000-0000-4000-8000-000000000047'
        );`,
      ),
    ),
  ]);
  diagnostics = assertNoDeadlock(offerResults, 'Offer withdrawal');
  if (offerResults[1].code !== 0
    || offerResults[0].code === 0
    || !diagnostics.includes('unresolved marketplace activity')) {
    throw new UpgradeTestError('Offer withdrawal and deletion did not serialize safely.');
  }
}

async function verifyConcurrentReservation(databaseUrl) {
  psql(
    databaseUrl,
    `
      insert into auth.users (id, email)
      values ('00000000-0000-4000-8000-000000000012', 'ledger-race@example.com');
      insert into public.marketplace_credit_accounts (user_id, available_balance)
      values ('00000000-0000-4000-8000-000000000012', 100);
      insert into public.marketplace_credit_ledger (
        user_id, kind, delta_available, idempotency_key, description
      ) values (
        '00000000-0000-4000-8000-000000000012',
        'adjustment', 100, 'ledger-race-opening', 'Concurrency fixture'
      );
    `,
    'Create the committed credit-concurrency fixture',
  );

  const operation = (key) => `
    select private.marketplace_post_credit_operation(
      (select party_id from public.marketplace_credit_accounts
       where user_id = '00000000-0000-4000-8000-000000000012'),
      'reserve', 80, '${key}', 'test-v1'
    );
  `;
  const results = await Promise.all([
    concurrentQuery(databaseUrl, operation('ledger-race-one')),
    concurrentQuery(databaseUrl, operation('ledger-race-two')),
  ]);
  const successes = results.filter((result) => result.code === 0);
  const insufficient = results.filter((result) =>
    result.stderr.includes('Insufficient marketplace credit balance'),
  );
  if (successes.length !== 1 || insufficient.length !== 1) {
    throw new UpgradeTestError(
      'Concurrent reservation did not produce exactly one winner and one insufficient-balance loser.',
    );
  }

  psql(
    databaseUrl,
    `
      insert into auth.users (id, email)
      values ('00000000-0000-4000-8000-000000000013', 'ledger-idempotency-race@example.com');
      insert into public.marketplace_credit_accounts (user_id, available_balance)
      values ('00000000-0000-4000-8000-000000000013', 100);
      insert into public.marketplace_credit_ledger (
        user_id, kind, delta_available, idempotency_key, description
      ) values (
        '00000000-0000-4000-8000-000000000013',
        'adjustment', 100, 'ledger-idempotency-opening', 'Idempotency fixture'
      );
    `,
    'Create the committed idempotency-concurrency fixture',
  );
  const sameOperation = `
    select private.marketplace_post_credit_operation(
      (select party_id from public.marketplace_credit_accounts
       where user_id = '00000000-0000-4000-8000-000000000013'),
      'reserve', 80, 'ledger-idempotency-race', 'test-v1'
    );
  `;
  const replayResults = await Promise.all([
    concurrentQuery(databaseUrl, sameOperation),
    concurrentQuery(databaseUrl, sameOperation),
  ]);
  if (replayResults.some((result) => result.code !== 0)) {
    throw new UpgradeTestError(
      'Concurrent retries with the same idempotency key did not both resolve successfully.',
    );
  }

  psql(
    databaseUrl,
    `
      insert into auth.users (id, email)
      values ('00000000-0000-4000-8000-000000000014', 'ledger-reversal-race@example.com');
      insert into public.marketplace_credit_accounts (user_id, available_balance)
      values ('00000000-0000-4000-8000-000000000014', 100);
      insert into public.marketplace_credit_ledger (
        user_id, kind, delta_available, idempotency_key, description
      ) values (
        '00000000-0000-4000-8000-000000000014',
        'adjustment', 100, 'ledger-reversal-opening', 'Reversal fixture'
      );
      select private.marketplace_post_credit_operation(
        (select party_id from public.marketplace_credit_accounts
         where user_id = '00000000-0000-4000-8000-000000000014'),
        'reserve', 20, 'ledger-reversal-source', 'test-v1'
      );
    `,
    'Create the committed reversal-concurrency fixture',
  );
  const sameReversal = `
    select private.marketplace_reverse_credit_journal(
      (select id from private.marketplace_ledger_journals
       where idempotency_key = 'ledger-reversal-source'),
      'ledger-reversal-race'
    );
  `;
  const reversalResults = await Promise.all([
    concurrentQuery(databaseUrl, sameReversal),
    concurrentQuery(databaseUrl, sameReversal),
  ]);
  if (reversalResults.some((result) => result.code !== 0)) {
    throw new UpgradeTestError(
      'Concurrent retries of the same reversal did not both resolve successfully.',
    );
  }
}

function allocatePort(excludedPorts) {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        if (!port || excludedPorts.has(port)) {
          allocatePort(excludedPorts).then(resolvePort, reject);
          return;
        }
        excludedPorts.add(port);
        resolvePort(port);
      });
    });
  });
}

async function createIsolatedWorkspace() {
  const workspace = mkdtempSync(join(tmpdir(), 'fitly-party-upgrade-'));
  const source = resolve(ROOT, 'supabase');
  const destination = join(workspace, 'supabase');
  cpSync(source, destination, {
    recursive: true,
    filter: (path) => !['.temp', '.branches'].includes(basename(path)),
  });

  const configPath = join(destination, 'config.toml');
  let config = readFileSync(configPath, 'utf8');
  config = config.replace(
    /^project_id\s*=.*$/m,
    `project_id = "fitly-party-upgrade-${process.pid}-${Date.now()}"`,
  );

  const portMatches = [...config.matchAll(/^(port|shadow_port)\s*=\s*\d+$/gm)];
  const ports = [];
  const excludedPorts = new Set();
  for (let index = 0; index < portMatches.length; index += 1) {
    ports.push(await allocatePort(excludedPorts));
  }
  let portIndex = 0;
  config = config.replace(
    /^(port|shadow_port)\s*=\s*\d+$/gm,
    (_, key) => `${key} = ${ports[portIndex++]}`,
  );
  writeFileSync(configPath, config);
  return workspace;
}

function withWorkdir(args, workspace) {
  return [...args, '--workdir', workspace];
}

let workspace;
let isolatedStackAttempted = false;
let cleanupStarted = false;
let cleanupFailure;

function cleanup() {
  if (cleanupStarted) return cleanupFailure;
  cleanupStarted = true;
  if (isolatedStackAttempted && workspace) {
    const stopped = spawnSync(
      'supabase',
      withWorkdir(['stop', '--no-backup'], workspace),
      { stdio: 'inherit', shell: false },
    );
    if (stopped.error || stopped.status !== 0) {
      cleanupFailure = new UpgradeTestError(
        `Isolated Supabase cleanup failed; preserved ${workspace} for recovery.`,
        stopped.status ?? 1,
      );
    }
  }
  if (!cleanupFailure && workspace) {
    try {
      rmSync(workspace, { recursive: true, force: true });
    } catch (error) {
      cleanupFailure = new UpgradeTestError(
        `Could not remove isolated workspace ${workspace}: ${error.message}`,
      );
    }
  }
  return cleanupFailure;
}

for (const [signal, exitCode] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(signal, () => {
    const cleanupError = cleanup();
    if (cleanupError) process.stderr.write(`[party-upgrade] ${cleanupError.message}\n`);
    process.exit(cleanupError ? cleanupError.exitCode : exitCode);
  });
}

async function main() {
  let failure;

  try {
    workspace = await createIsolatedWorkspace();
    isolatedStackAttempted = true;
    run(
      'supabase',
      withWorkdir(['start', '-x', SUPABASE_DB_EXCLUSIONS], workspace),
      'Start an isolated temporary Supabase database',
    );
    run(
      'supabase',
      withWorkdir([
        'db',
        'reset',
        '--local',
        '--version',
        '20261016030000',
        '--sql-paths',
        'upgrade-fixtures/marketplace-parties-legacy.sql',
      ], workspace),
      'Reset the isolated database to the legacy schema and load fixtures',
    );
    run(
      'supabase',
      withWorkdir(['migration', 'up', '--local'], workspace),
      'Apply the marketplace-party migration in isolation',
    );
    run(
      'supabase',
      withWorkdir(['db', 'lint', '--local'], workspace),
      'Lint the isolated upgraded database',
    );
    run(
      'supabase',
      withWorkdir([
        'test',
        'db',
        join(workspace, 'supabase/upgrade-tests/marketplace-parties-backfill.test.sql'),
      ], workspace),
      'Verify the isolated legacy-data backfill',
    );
    run(
      'supabase',
      withWorkdir([
        'test',
        'db',
        join(workspace, 'supabase/tests/database/credit_ledger.test.sql'),
      ], workspace),
      'Verify the isolated double-entry credit ledger',
    );
    const databaseUrl = isolatedDatabaseUrl(workspace);
    await verifyConcurrentReservation(databaseUrl);
    run(
      'supabase',
      withWorkdir([
        'test',
        'db',
        join(workspace, 'supabase/upgrade-tests/credit-ledger-concurrency.test.sql'),
      ], workspace),
      'Verify concurrent credit reservation reconciliation',
    );
    run(
      'supabase',
      withWorkdir(['db', 'reset', '--local'], workspace),
      'Reset the isolated database to the latest clean schema',
    );
    run(
      'supabase',
      withWorkdir([
        'test',
        'db',
        join(workspace, 'supabase/tests/database/rls.test.sql'),
      ], workspace),
      'Verify the complete isolated database RLS contract',
    );
    run(
      'supabase',
      withWorkdir([
        'test',
        'db',
        join(workspace, 'supabase/tests/database/marketplace_state_contract.test.sql'),
      ], workspace),
      'Verify the server-authoritative marketplace state contract',
    );
    const latestDatabaseUrl = isolatedDatabaseUrl(workspace);
    await verifyConcurrentOfferAcceptance(latestDatabaseUrl);
    run(
      'supabase',
      withWorkdir([
        'test',
        'db',
        join(workspace, 'supabase/upgrade-tests/marketplace-state-concurrency.test.sql'),
      ], workspace),
      'Verify competing marketplace acceptance serialization',
    );
    await verifyAcceptanceDeletionLockOrder(latestDatabaseUrl);
    await verifyCrossedSwapCreation(latestDatabaseUrl);
    await verifyLegacyWriterDeletionLockOrder(latestDatabaseUrl);
    await verifyDeletionWriteFence(latestDatabaseUrl);
    await verifyCommittedAuthDeletion(latestDatabaseUrl);
    run(
      'supabase',
      withWorkdir([
        'test',
        'db',
        join(workspace, 'supabase/upgrade-tests/account-deletion-concurrency.test.sql'),
      ], workspace),
      'Verify the account-deletion write fence across connections',
    );
    run(
      'supabase',
      withWorkdir([
        'test',
        'db',
        join(workspace, 'supabase/tests/database/account_deletion_lifecycle.test.sql'),
      ], workspace),
      'Verify marketplace-aware account deletion lifecycle',
    );
  } catch (error) {
    failure = error;
  } finally {
    const cleanupError = cleanup();
    if (cleanupFailure && !failure) failure = cleanupError;
    else if (cleanupError) {
      process.stderr.write(`[party-upgrade] ${cleanupError.message}\n`);
    }
  }

  if (failure) {
    process.stderr.write(`[party-upgrade] ${failure.message}\n`);
    process.exitCode = failure instanceof UpgradeTestError ? failure.exitCode : 1;
  }
}

main();
