const {
  assertSafeSeedTarget,
  seedE2EAccounts,
} = require('../seed-e2e-accounts');

describe('two-account E2E seed', () => {
  it('allows loopback targets without a remote override', () => {
    expect(() => assertSafeSeedTarget('http://127.0.0.1:57321')).not.toThrow();
    expect(() => assertSafeSeedTarget('http://localhost:57321')).not.toThrow();
  });

  it('rejects remote targets unless the staging acknowledgement is exact', () => {
    expect(() => assertSafeSeedTarget('https://project.supabase.co')).toThrow(/non-production staging/i);
    expect(() => assertSafeSeedTarget('https://project.supabase.co', 'yes')).toThrow(/non-production staging/i);
    expect(() => assertSafeSeedTarget('https://project.supabase.co', 'staging')).not.toThrow();
  });

  it('is idempotent and prepares both marketplace members plus the seller listing', async () => {
    const calls = [];
    const existingUsers = [
      { id: '11111111-1111-4111-8111-111111111111', email: 'fitly-e2e-seller@example.com' },
      { id: '22222222-2222-4222-8222-222222222222', email: 'fitly-e2e-buyer@example.com' },
    ];
    const query = {
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
      expect.objectContaining({ name: 'E2E green overshirt', status: 'ready' }),
      expect.objectContaining({ accepts_credits: true, credit_price: 25, status: 'active' }),
    ]));
  });
});
