const {
  assertPristineSeedState,
  assertSafeSeedTarget,
  assertSyntheticSeedEmail,
  seedE2EAccounts,
} = require('../seed-e2e-accounts');

describe('two-account E2E seed', () => {
  it('allows loopback targets without a remote override', () => {
    expect(() => assertSafeSeedTarget('http://127.0.0.1:57321')).not.toThrow();
    expect(() => assertSafeSeedTarget('http://localhost:57321')).not.toThrow();
  });

  it('rejects remote targets unless the acknowledgement and staging project ref are exact', () => {
    expect(() => assertSafeSeedTarget('https://project.supabase.co')).toThrow(/non-production staging/i);
    expect(() => assertSafeSeedTarget('https://stagingref.supabase.co', 'yes', 'stagingref')).toThrow(/non-production staging/i);
    expect(() => assertSafeSeedTarget('https://productionref.supabase.co', 'staging', 'stagingref')).toThrow(/non-production staging/i);
    expect(() => assertSafeSeedTarget('https://staging.example.com', 'staging', 'stagingref')).toThrow(/non-production staging/i);
    expect(() => assertSafeSeedTarget('https://stagingref.supabase.co', 'staging', 'stagingref')).not.toThrow();
  });

  it('accepts only reserved non-personal seed identities', () => {
    expect(() => assertSyntheticSeedEmail('fitly-e2e-seller@example.com')).not.toThrow();
    expect(() => assertSyntheticSeedEmail('fitly-e2e+run-123@example.test')).not.toThrow();
    expect(() => assertSyntheticSeedEmail('person@company.com')).toThrow(/non-synthetic/i);
  });

  it('is idempotent and prepares both marketplace members plus the seller listing', async () => {
    const calls = [];
    const existingUsers = [
      { id: '11111111-1111-4111-8111-111111111111', email: 'fitly-e2e-seller@example.com', user_metadata: { e2e_seed: true } },
      { id: '22222222-2222-4222-8222-222222222222', email: 'fitly-e2e-buyer@example.com', user_metadata: { e2e_seed: true } },
    ];
    const query = {
      select: jest.fn(() => query),
      or: jest.fn(async () => ({ data: [], error: null })),
      in: jest.fn(async () => ({ data: [], error: null })),
      upsert: jest.fn(async (value) => {
        calls.push(value);
        return { error: null };
      }),
    };
    const client = {
      auth: {
        admin: {
          listUsers: jest.fn(async () => ({ data: { users: existingUsers }, error: null })),
          createUser: jest.fn(),
          updateUserById: jest.fn(async () => ({ data: {}, error: null })),
        },
      },
      from: jest.fn(() => query),
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn(async () => ({ error: null })),
        })),
      },
    };

    const first = await seedE2EAccounts({
      client,
      fixtureBytes: new Uint8Array([1, 2, 3]),
      sellerEmail: existingUsers[0].email,
      sellerPassword: 'synthetic-seller-password',
      buyerEmail: existingUsers[1].email,
      buyerPassword: 'synthetic-buyer-password',
    });
    const second = await seedE2EAccounts({
      client,
      fixtureBytes: new Uint8Array([1, 2, 3]),
      sellerEmail: existingUsers[0].email,
      sellerPassword: 'synthetic-seller-password',
      buyerEmail: existingUsers[1].email,
      buyerPassword: 'synthetic-buyer-password',
    });

    expect(first).toEqual(second);
    expect(client.auth.admin.createUser).not.toHaveBeenCalled();
    expect(client.auth.admin.updateUserById).toHaveBeenCalledTimes(4);
    expect(client.from).toHaveBeenCalledWith('profiles');
    expect(client.from).toHaveBeenCalledWith('marketplace_memberships');
    expect(client.from).toHaveBeenCalledWith('marketplace_credit_ledger');
    expect(client.from).toHaveBeenCalledWith('marketplace_credit_accounts');
    expect(client.from).toHaveBeenCalledWith('garments');
    expect(client.from).toHaveBeenCalledWith('marketplace_listings');
    expect(calls).toEqual(expect.arrayContaining([
      expect.arrayContaining([
        expect.objectContaining({ display_name: 'Fitly E2E Seller' }),
        expect.objectContaining({ display_name: 'Fitly E2E Buyer' }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({ available_balance: 100 }),
        expect.objectContaining({ available_balance: 500 }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({ idempotency_key: 'e2e-seed:seller:initial-balance', delta_available: 100 }),
        expect.objectContaining({ idempotency_key: 'e2e-seed:buyer:initial-balance', delta_available: 500 }),
      ]),
      expect.objectContaining({ name: 'E2E green overshirt', status: 'ready' }),
      expect.objectContaining({ accepts_credits: true, credit_price: 25, status: 'active' }),
    ]));
  });

  it('refuses to take over an existing account that was not created by the harness', async () => {
    const client = {
      auth: {
        admin: {
          listUsers: jest.fn(async () => ({
            data: {
              users: [{
                id: '11111111-1111-4111-8111-111111111111',
                email: 'fitly-e2e-seller@example.com',
                user_metadata: {},
              }],
            },
            error: null,
          })),
          createUser: jest.fn(),
          updateUserById: jest.fn(),
        },
      },
    };

    await expect(seedE2EAccounts({
      client,
      fixtureBytes: new Uint8Array([1]),
      sellerPassword: 'synthetic-seller-password',
      buyerPassword: 'synthetic-buyer-password',
    })).rejects.toThrow(/not marked as an E2E seed account/i);
    expect(client.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it.each([
    ['marketplace_offers', { id: 'offer-1' }],
    ['marketplace_transactions', { id: 'transaction-1' }],
    ['marketplace_credit_ledger', {
      user_id: '11111111-1111-4111-8111-111111111111',
      idempotency_key: 'membership:first:unexpected',
    }],
  ])('refuses to overwrite fixture state containing %s activity', async (activeTable, activity) => {
    const client = {
      from: jest.fn((table) => ({
        select: jest.fn(() => ({
          or: jest.fn(async () => ({
            data: table === activeTable && table !== 'marketplace_credit_ledger' ? [activity] : [],
            error: null,
          })),
          in: jest.fn(async () => ({
            data: table === activeTable && table === 'marketplace_credit_ledger' ? [activity] : [],
            error: null,
          })),
        })),
      })),
    };

    await expect(assertPristineSeedState(
      client,
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    )).rejects.toThrow(/marketplace activity/i);
  });
});
