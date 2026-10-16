import { handleOperationsHealth } from '../handler';

function request(method = 'GET', authorization = 'Bearer service-secret') {
  return { method, authorization };
}

function dependencies() {
  return {
    serviceKey: 'service-secret',
    now: () => new Date('2026-10-16T12:00:00.000Z'),
    readHealth: jest.fn().mockResolvedValue([
      {
        metric: 'credit_ledger_imbalance', status: 'ok', current_count: 0,
        warning_threshold: 1, critical_threshold: 1,
      },
      {
        metric: 'stale_tryon_jobs', status: 'warning', current_count: 2,
        warning_threshold: 1, critical_threshold: 10,
      },
    ]),
  };
}

describe('operations health handler', () => {
  it('rejects unsupported methods and non-service credentials', async () => {
    const deps = dependencies();
    await expect(handleOperationsHealth(request('POST'), deps)).resolves.toEqual({
      status: 405, body: { code: 'method_not_allowed' },
    });
    await expect(handleOperationsHealth(request('GET', 'Bearer member-token'), deps)).resolves.toEqual({
      status: 401, body: { code: 'unauthorized' },
    });
    expect(deps.readHealth).not.toHaveBeenCalled();
  });

  it('returns only aggregate allowlisted metrics', async () => {
    const deps = dependencies();
    await expect(handleOperationsHealth(request(), deps)).resolves.toEqual({
      status: 200,
      body: {
        status: 'warning',
        checkedAt: '2026-10-16T12:00:00.000Z',
        metrics: [
          {
            metric: 'credit_ledger_imbalance', status: 'ok', currentCount: 0,
            warningThreshold: 1, criticalThreshold: 1,
          },
          {
            metric: 'stale_tryon_jobs', status: 'warning', currentCount: 2,
            warningThreshold: 1, criticalThreshold: 10,
          },
        ],
      },
    });
  });

  it('uses a failing HTTP status for a critical synthetic check', async () => {
    const deps = dependencies();
    deps.readHealth.mockResolvedValue([{
      metric: 'credit_ledger_imbalance', status: 'critical', current_count: 1,
      warning_threshold: 1, critical_threshold: 1,
    }]);

    await expect(handleOperationsHealth(request(), deps)).resolves.toMatchObject({
      status: 503,
      body: { status: 'critical' },
    });
  });

  it('fails closed on malformed database output without echoing it', async () => {
    const deps = dependencies();
    deps.readHealth.mockResolvedValue([{
      metric: 'member@example.com', status: 'critical', current_count: 1,
      warning_threshold: 1, critical_threshold: 1, user_id: 'private-user',
    }]);

    await expect(handleOperationsHealth(request(), deps)).resolves.toEqual({
      status: 500, body: { code: 'health_check_failed' },
    });
  });

  it('returns generic failure output when the database is unavailable', async () => {
    const deps = dependencies();
    deps.readHealth.mockRejectedValue(new Error('private SQL details'));

    await expect(handleOperationsHealth(request(), deps)).resolves.toEqual({
      status: 500, body: { code: 'health_check_failed' },
    });
  });
});
