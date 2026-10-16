const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const SELLER_EMAIL = 'fitly-e2e-seller@example.com';
const BUYER_EMAIL = 'fitly-e2e-buyer@example.com';
const LOCAL_SELLER_PASSWORD = 'FitlyE2ESeller2026';
const LOCAL_BUYER_PASSWORD = 'FitlyE2EBuyer2026';
const GARMENT_ID = 'e2000000-0000-4000-8000-000000000001';
const LISTING_ID = 'e2000000-0000-4000-8000-000000000002';
const FIXED_START = '2026-01-01T00:00:00.000Z';
const FIXED_EXPIRY = '2099-01-01T00:00:00.000Z';

function isLoopback(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function assertSafeSeedTarget(url, remoteAcknowledgement = '') {
  const target = new URL(url);
  if (!isLoopback(target.hostname) && remoteAcknowledgement !== 'staging') {
    throw new Error(
      'Remote E2E seeding is allowed only for a non-production staging project. '
      + 'Set E2E_SEED_ALLOW_REMOTE=staging after verifying the target.',
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

async function findOrCreateUser(client, { email, password, displayName }) {
  const users = await requireSuccess(
    client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    `List E2E users for ${displayName}`,
  );
  const existing = users.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    await requireSuccess(
      client.auth.admin.updateUserById(existing.id, {
        password,
        user_metadata: { display_name: displayName, adult_confirmed: true },
      }),
      `Refresh ${displayName}`,
    );
    return existing;
  }

  const created = await requireSuccess(
    client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, adult_confirmed: true },
    }),
    `Create ${displayName}`,
  );
  return created.user;
}

async function upsert(client, table, value, onConflict) {
  await requireSuccess(client.from(table).upsert(value, { onConflict }), `Seed ${table}`);
}

async function seedE2EAccounts({
  client,
  fixtureBytes,
  sellerEmail = SELLER_EMAIL,
  sellerPassword,
  buyerEmail = BUYER_EMAIL,
  buyerPassword,
}) {
  const seller = await findOrCreateUser(client, {
    email: sellerEmail,
    password: sellerPassword,
    displayName: 'Fitly E2E Seller',
  });
  const buyer = await findOrCreateUser(client, {
    email: buyerEmail,
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
  assertSafeSeedTarget(settings.url, process.env.E2E_SEED_ALLOW_REMOTE);
  const sellerPassword = process.env.E2E_SELLER_PASSWORD
    || (settings.isLocal ? LOCAL_SELLER_PASSWORD : undefined);
  const buyerPassword = process.env.E2E_BUYER_PASSWORD
    || (settings.isLocal ? LOCAL_BUYER_PASSWORD : undefined);
  if (!sellerPassword || !buyerPassword) {
    throw new Error('Remote staging seeds require E2E_SELLER_PASSWORD and E2E_BUYER_PASSWORD.');
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
  parseStatusEnv,
  seedE2EAccounts,
};
