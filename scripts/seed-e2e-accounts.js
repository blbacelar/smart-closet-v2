const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const SELLER_EMAIL = 'fitly-e2e-seller@example.com';
const BUYER_EMAIL = 'fitly-e2e-buyer@example.com';
const GARMENT_ID = 'e2000000-0000-4000-8000-000000000001';
const LISTING_ID = 'e2000000-0000-4000-8000-000000000002';
const FIXED_START = '2026-01-01T00:00:00.000Z';
const FIXED_EXPIRY = '2099-01-01T00:00:00.000Z';
const SELLER_LEDGER_KEY = 'e2e-seed:seller:initial-balance';
const BUYER_LEDGER_KEY = 'e2e-seed:buyer:initial-balance';

function isLoopback(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function assertSyntheticSeedEmail(email) {
  if (!/^fitly-e2e(?:[+.-][a-z0-9-]+)?@example\.(?:com|test)$/i.test(email)) {
    throw new Error(
      `Refusing non-synthetic E2E identity ${email}. Use the fitly-e2e namespace on example.com or example.test.`,
    );
  }
}

function assertSafeSeedTarget(url, remoteAcknowledgement = '', stagingProjectRef = '') {
  const target = new URL(url);
  if (isLoopback(target.hostname)) return;

  const hostnameMatch = target.hostname.match(/^([a-z0-9]+)\.supabase\.co$/);
  const targetProjectRef = hostnameMatch?.[1];
  if (
    target.protocol !== 'https:'
    || !targetProjectRef
    || remoteAcknowledgement !== 'staging'
    || !stagingProjectRef
    || targetProjectRef !== stagingProjectRef
  ) {
    throw new Error(
      'Remote E2E seeding is allowed only for a non-production staging project. '
      + 'Set E2E_SEED_ALLOW_REMOTE=staging and E2E_SEED_STAGING_PROJECT_REF '
      + 'to the exact project ref in E2E_SUPABASE_URL.',
    );
  }
}

function parseStatusEnv(output) {
  return Object.fromEntries(output.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    return match ? [[match[1], match[2]]] : [];
  }));
}

function localSupabaseSettings() {
  const output = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' });
  const values = parseStatusEnv(output);
  return {
    url: values.API_URL,
    serviceRoleKey: values.SERVICE_ROLE_KEY,
  };
}

async function requireSuccess(result, operation) {
  const resolved = await result;
  if (resolved.error) {
    throw new Error(`${operation}: ${resolved.error.message}`);
  }
  return resolved.data;
}

async function findOrCreateUser(client, {
  email,
  password,
  displayName,
  allowLegacyExistingUser,
}) {
  const users = await requireSuccess(
    client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    `List E2E users for ${displayName}`,
  );
  const existing = users.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    if (existing.user_metadata?.e2e_seed !== true && !allowLegacyExistingUser) {
      throw new Error(
        `Refusing to modify ${email}: the existing account is not marked as an E2E seed account.`,
      );
    }
    return { user: existing, created: false };
  }

  const created = await requireSuccess(
    client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, adult_confirmed: true, e2e_seed: true },
    }),
    `Create ${displayName}`,
  );
  return { user: created.user, created: true };
}

async function upsert(client, table, value, onConflict) {
  await requireSuccess(client.from(table).upsert(value, { onConflict }), `Seed ${table}`);
}

async function assertPristineSeedState(client, sellerId, buyerId) {
  const participantFilter = [sellerId, buyerId].join(',');
  const [offers, transactions, ledger] = await Promise.all([
    requireSuccess(
      client.from('marketplace_offers')
        .select('id')
        .or(`buyer_id.in.(${participantFilter}),seller_id.in.(${participantFilter})`),
      'Check E2E offers',
    ),
    requireSuccess(
      client.from('marketplace_transactions')
        .select('id')
        .or(`buyer_id.in.(${participantFilter}),seller_id.in.(${participantFilter})`),
      'Check E2E transactions',
    ),
    requireSuccess(
      client.from('marketplace_credit_ledger')
        .select('user_id,idempotency_key')
        .in('user_id', [sellerId, buyerId]),
      'Check E2E credit ledger',
    ),
  ]);
  const allowedLedgerKeys = new Map([
    [sellerId, SELLER_LEDGER_KEY],
    [buyerId, BUYER_LEDGER_KEY],
  ]);
  const hasForeignLedgerEntry = ledger.some(
    (entry) => allowedLedgerKeys.get(entry.user_id) !== entry.idempotency_key,
  );

  if (offers.length > 0 || transactions.length > 0 || hasForeignLedgerEntry) {
    throw new Error(
      'Refusing to reset E2E accounts with marketplace activity. '
      + 'Use fresh synthetic accounts or reset the isolated staging project.',
    );
  }
}

async function refreshExistingUser(client, resolved, { password, displayName }) {
  if (resolved.created) return;
  await requireSuccess(
    client.auth.admin.updateUserById(resolved.user.id, {
      password,
      user_metadata: {
        ...resolved.user.user_metadata,
        display_name: displayName,
        adult_confirmed: true,
        e2e_seed: true,
      },
    }),
    `Refresh ${displayName}`,
  );
}

async function seedE2EAccounts({
  client,
  fixtureBytes,
  sellerEmail = SELLER_EMAIL,
  sellerPassword,
  buyerEmail = BUYER_EMAIL,
  buyerPassword,
  allowLegacyExistingUsers = false,
}) {
  assertSyntheticSeedEmail(sellerEmail);
  assertSyntheticSeedEmail(buyerEmail);
  const sellerResult = await findOrCreateUser(client, {
    email: sellerEmail,
    password: sellerPassword,
    displayName: 'Fitly E2E Seller',
    allowLegacyExistingUser: allowLegacyExistingUsers,
  });
  const buyerResult = await findOrCreateUser(client, {
    email: buyerEmail,
    password: buyerPassword,
    displayName: 'Fitly E2E Buyer',
    allowLegacyExistingUser: allowLegacyExistingUsers,
  });
  const seller = sellerResult.user;
  const buyer = buyerResult.user;

  await assertPristineSeedState(client, seller.id, buyer.id);
  await refreshExistingUser(client, sellerResult, {
    password: sellerPassword,
    displayName: 'Fitly E2E Seller',
  });
  await refreshExistingUser(client, buyerResult, {
    password: buyerPassword,
    displayName: 'Fitly E2E Buyer',
  });

  await upsert(client, 'profiles', [
    {
      id: seller.id,
      display_name: 'Fitly E2E Seller',
      region: 'lower-mainland-bc',
      adult_confirmed_at: FIXED_START,
      onboarding_completed_at: FIXED_START,
    },
    {
      id: buyer.id,
      display_name: 'Fitly E2E Buyer',
      region: 'lower-mainland-bc',
      adult_confirmed_at: FIXED_START,
      onboarding_completed_at: FIXED_START,
    },
  ], 'id');
  await upsert(client, 'marketplace_memberships', [
    { user_id: seller.id, status: 'active', starts_at: FIXED_START, expires_at: FIXED_EXPIRY },
    { user_id: buyer.id, status: 'active', starts_at: FIXED_START, expires_at: FIXED_EXPIRY },
  ], 'user_id');
  await upsert(client, 'marketplace_credit_ledger', [
    {
      user_id: seller.id,
      kind: 'adjustment',
      delta_available: 100,
      delta_reserved: 0,
      idempotency_key: SELLER_LEDGER_KEY,
      description: 'Synthetic seller balance for installed-build testing',
    },
    {
      user_id: buyer.id,
      kind: 'adjustment',
      delta_available: 500,
      delta_reserved: 0,
      idempotency_key: BUYER_LEDGER_KEY,
      description: 'Synthetic buyer balance for installed-build testing',
    },
  ], 'idempotency_key');
  await upsert(client, 'marketplace_credit_accounts', [
    { user_id: seller.id, available_balance: 100, reserved_balance: 0 },
    { user_id: buyer.id, available_balance: 500, reserved_balance: 0 },
  ], 'user_id');

  const imagePath = `${seller.id}/e2e-marketplace-overshirt.jpg`;
  await requireSuccess(
    client.storage.from('garments').upload(imagePath, fixtureBytes, {
      contentType: 'image/jpeg',
      upsert: true,
    }),
    'Upload synthetic marketplace fixture',
  );
  await upsert(client, 'garments', {
    id: GARMENT_ID,
    user_id: seller.id,
    original_path: imagePath,
    clean_path: imagePath,
    image_hash: 'synthetic-e2e-green-overshirt',
    name: 'E2E green overshirt',
    category: 'top',
    color: 'green',
    size: 'M',
    season: 'all-season',
    status: 'ready',
    marketplace_archived_at: null,
  }, 'id');
  await upsert(client, 'marketplace_listings', {
    id: LISTING_ID,
    garment_id: GARMENT_ID,
    seller_id: seller.id,
    status: 'active',
    accepts_credits: true,
    accepts_swap: true,
    is_giveaway: false,
    credit_price: 25,
    pickup_area: 'E2E Northgate',
  }, 'id');

  return {
    seller: { id: seller.id, email: sellerEmail },
    buyer: { id: buyer.id, email: buyerEmail },
    garmentId: GARMENT_ID,
    listingId: LISTING_ID,
  };
}

function resolveCliSettings(environment) {
  if (environment.E2E_SUPABASE_URL || environment.E2E_SUPABASE_SERVICE_ROLE_KEY) {
    if (!environment.E2E_SUPABASE_URL || !environment.E2E_SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Set both E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY.');
    }
    return {
      url: environment.E2E_SUPABASE_URL,
      serviceRoleKey: environment.E2E_SUPABASE_SERVICE_ROLE_KEY,
      isLocal: isLoopback(new URL(environment.E2E_SUPABASE_URL).hostname),
    };
  }

  return { ...localSupabaseSettings(), isLocal: true };
}

async function main() {
  const settings = resolveCliSettings(process.env);
  assertSafeSeedTarget(
    settings.url,
    process.env.E2E_SEED_ALLOW_REMOTE,
    process.env.E2E_SEED_STAGING_PROJECT_REF,
  );
  const sellerPassword = process.env.E2E_SELLER_PASSWORD;
  const buyerPassword = process.env.E2E_BUYER_PASSWORD;
  if (!sellerPassword || !buyerPassword) {
    throw new Error('E2E seeds require E2E_SELLER_PASSWORD and E2E_BUYER_PASSWORD.');
  }

  const client = createClient(settings.url, settings.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const fixtureBytes = readFileSync(resolve(__dirname, '../.maestro/fixtures/synthetic-green-overshirt.jpg'));
  const result = await seedE2EAccounts({
    client,
    fixtureBytes,
    sellerEmail: process.env.E2E_SELLER_EMAIL || SELLER_EMAIL,
    sellerPassword,
    buyerEmail: process.env.E2E_BUYER_EMAIL || BUYER_EMAIL,
    buyerPassword,
    allowLegacyExistingUsers: settings.isLocal,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  assertSafeSeedTarget,
  assertSyntheticSeedEmail,
  assertPristineSeedState,
  parseStatusEnv,
  seedE2EAccounts,
};
