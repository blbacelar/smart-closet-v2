import { handleOperationsHealth, parseOperationalHealthConfig } from '../handler';

function request(method = 'GET', authorization = 'Bearer service-secret') {
  return { method, authorization };
}

const healthRows = [
  {
    metric: 'credit_ledger_imbalance', status: 'ok', current_count: 0,
    warning_threshold: 1, critical_threshold: 1,
  },
  {
    metric: 'acquisition_anomalies', status: 'ok', current_count: 0,
    warning_threshold: 1, critical_threshold: 1,
  },
  {
    metric: 'overdue_marketplace_items', status: 'ok', current_count: 0,
    warning_threshold: 1, critical_threshold: 10,
  },
  {
    metric: 'expiry_retry_backlog', status: 'ok', current_count: 0,
    warning_threshold: 1, critical_threshold: 10,
  },
  {
    metric: 'stale_tryon_jobs', status: 'warning', current_count: 2,
    warning_threshold: 1, critical_threshold: 10,
  },
  {
    metric: 'stale_notification_work', status: 'ok', current_count: 0,
    warning_threshold: 1, critical_threshold: 10,
  },
  {
    metric: 'recent_notification_failures', status: 'ok', current_count: 0,
    warning_threshold: 1, critical_threshold: 10,
  },
];

function dependencies() {
  return {
    serviceKey: 'service-secret',
    now: () => new Date('2026-10-16T12:00:00.000Z'),
    readHealth: jest.fn().mockResolvedValue(healthRows),
  };
}

describe('operations health handler', () => {
  it('parses bounded environment-owned thresholds and rejects unsafe values', () => {
    expect(parseOperationalHealthConfig((name) => ({
      OPERATIONS_HEALTH_STALE_MINUTES: '20',
      OPERATIONS_HEALTH_WARNING_COUNT: '2',
      OPERATIONS_HEALTH_CRITICAL_COUNT: '8',
    }[name]))).toEqual({ staleMinutes: 20, warningCount: 2, criticalCount: 8 });
    expect(parseOperationalHealthConfig(() => undefined)).toEqual({
      staleMinutes: 15, warningCount: 1, criticalCount: 10,
    });
    expect(() => parseOperationalHealthConfig((name) => (
      name === 'OPERATIONS_HEALTH_STALE_MINUTES' ? '0' : undefined
    ))).toThrow('Invalid operational health configuration.');
    expect(() => parseOperationalHealthConfig((name) => ({
      OPERATIONS_HEALTH_WARNING_COUNT: '10',
      OPERATIONS_HEALTH_CRITICAL_COUNT: '10',
    }[name]))).toThrow('Invalid operational health configuration.');
  });

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
    const result = await handleOperationsHealth(request(), deps);
    expect(result).toMatchObject({
      status: 200,
      body: { status: 'warning', checkedAt: '2026-10-16T12:00:00.000Z' },
    });
    expect(result.body.metrics).toHaveLength(7);
    expect(result.body.metrics).toEqual(expect.arrayContaining([
      {
        metric: 'stale_tryon_jobs', status: 'warning', currentCount: 2,
        warningThreshold: 1, criticalThreshold: 10,
      },
    ]));
  });

  it('uses a failing HTTP status for a critical synthetic check', async () => {
    const deps = dependencies();
    deps.readHealth.mockResolvedValue(healthRows.map((row) => (
      row.metric === 'credit_ledger_imbalance'
        ? { ...row, status: 'critical', current_count: 1 }
        : row
    )));

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

  it('fails closed on incomplete, duplicate, or severity-inconsistent metrics', async () => {
    const incomplete = dependencies();
    incomplete.readHealth.mockResolvedValue(healthRows.slice(0, -1));
    await expect(handleOperationsHealth(request(), incomplete)).resolves.toEqual({
      status: 500, body: { code: 'health_check_failed' },
    });

    const duplicate = dependencies();
    duplicate.readHealth.mockResolvedValue([...healthRows.slice(0, -1), healthRows[0]]);
    await expect(handleOperationsHealth(request(), duplicate)).resolves.toEqual({
      status: 500, body: { code: 'health_check_failed' },
    });

    const inconsistent = dependencies();
    inconsistent.readHealth.mockResolvedValue(healthRows.map((row) => (
      row.metric === 'stale_tryon_jobs' ? { ...row, status: 'ok' } : row
    )));
    await expect(handleOperationsHealth(request(), inconsistent)).resolves.toEqual({
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
