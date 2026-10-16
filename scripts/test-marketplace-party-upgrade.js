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
