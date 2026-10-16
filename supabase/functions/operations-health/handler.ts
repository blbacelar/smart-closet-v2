export type OperationalMetricName =
  | 'credit_ledger_imbalance'
  | 'acquisition_anomalies'
  | 'overdue_marketplace_items'
  | 'expiry_retry_backlog'
  | 'stale_tryon_jobs'
  | 'stale_notification_work'
  | 'recent_notification_failures';

export type OperationalHealthStatus = 'ok' | 'warning' | 'critical';

type HealthRow = {
  metric: OperationalMetricName;
  status: OperationalHealthStatus;
  currentCount: number;
  warningThreshold: number;
  criticalThreshold: number;
};

type HandlerRequest = {
  method: string;
  authorization: string;
};

type HandlerDependencies = {
  accessToken: string;
  now: () => Date;
  readHealth: () => Promise<unknown>;
};

type HandlerResponse = {
  status: number;
  body: Record<string, unknown>;
};

export type OperationalHealthConfig = {
  staleMinutes: number;
  warningCount: number;
  criticalCount: number;
};

const defaultConfig: OperationalHealthConfig = {
  staleMinutes: 15,
  warningCount: 1,
  criticalCount: 10,
};

function configuredInteger(
  readEnvironment: (name: string) => string | undefined,
  name: string,
  fallback: number,
) {
  const raw = readEnvironment(name);
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw new Error('Invalid operational health configuration.');
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error('Invalid operational health configuration.');
  return value;
}

export function parseOperationalHealthConfig(
  readEnvironment: (name: string) => string | undefined,
): OperationalHealthConfig {
  const config = {
    staleMinutes: configuredInteger(
      readEnvironment, 'OPERATIONS_HEALTH_STALE_MINUTES', defaultConfig.staleMinutes,
    ),
    warningCount: configuredInteger(
      readEnvironment, 'OPERATIONS_HEALTH_WARNING_COUNT', defaultConfig.warningCount,
    ),
    criticalCount: configuredInteger(
      readEnvironment, 'OPERATIONS_HEALTH_CRITICAL_COUNT', defaultConfig.criticalCount,
    ),
  };
  if (config.staleMinutes < 1 || config.staleMinutes > 1_440
      || config.warningCount < 1 || config.criticalCount <= config.warningCount) {
    throw new Error('Invalid operational health configuration.');
  }
  return config;
}

export function parseOperationalHealthAccessToken(value: string | undefined) {
  if (!value || value.length < 32 || value.length > 256 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid operational health access token configuration.');
  }
  return value;
}

const metricNames = new Set<OperationalMetricName>([
  'credit_ledger_imbalance',
  'acquisition_anomalies',
  'overdue_marketplace_items',
  'expiry_retry_backlog',
  'stale_tryon_jobs',
  'stale_notification_work',
  'recent_notification_failures',
]);
const statuses = new Set<OperationalHealthStatus>(['ok', 'warning', 'critical']);

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid row');
  return value as Record<string, unknown>;
}

function nonnegativeInteger(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('invalid count');
  return value;
}

function parseRows(input: unknown): HealthRow[] {
  if (!Array.isArray(input) || input.length !== metricNames.size) {
    throw new Error('invalid health response');
  }
  const seen = new Set<OperationalMetricName>();
  const rows = input.map((value) => {
    const row = record(value);
    if (Object.keys(row).some((key) => ![
      'metric', 'status', 'current_count', 'warning_threshold', 'critical_threshold',
    ].includes(key))) throw new Error('unexpected health field');
    if (!metricNames.has(row.metric as OperationalMetricName)) throw new Error('invalid metric');
    const metric = row.metric as OperationalMetricName;
    if (seen.has(metric)) throw new Error('duplicate metric');
    seen.add(metric);
    if (!statuses.has(row.status as OperationalHealthStatus)) throw new Error('invalid status');
    const warningThreshold = nonnegativeInteger(row.warning_threshold);
    const criticalThreshold = nonnegativeInteger(row.critical_threshold);
    if (warningThreshold < 1 || criticalThreshold < warningThreshold) throw new Error('invalid threshold');
    const currentCount = nonnegativeInteger(row.current_count);
    const expectedStatus: OperationalHealthStatus = currentCount >= criticalThreshold
      ? 'critical'
      : currentCount >= warningThreshold ? 'warning' : 'ok';
    if (row.status !== expectedStatus) throw new Error('inconsistent status');
    return {
      metric,
      status: row.status as OperationalHealthStatus,
      currentCount,
      warningThreshold,
      criticalThreshold,
    };
  });
  if ([...metricNames].some((metric) => !seen.has(metric))) throw new Error('missing metric');
  return rows;
}

export async function handleOperationsHealth(
  request: HandlerRequest,
  dependencies: HandlerDependencies,
): Promise<HandlerResponse> {
  if (request.method !== 'GET') return { status: 405, body: { code: 'method_not_allowed' } };
  if (!dependencies.accessToken
      || request.authorization !== `Bearer ${dependencies.accessToken}`) {
    return { status: 401, body: { code: 'unauthorized' } };
  }
  try {
    const metrics = parseRows(await dependencies.readHealth());
    const status: OperationalHealthStatus = metrics.some((metric) => metric.status === 'critical')
      ? 'critical'
      : metrics.some((metric) => metric.status === 'warning') ? 'warning' : 'ok';
    return {
      status: status === 'critical' ? 503 : 200,
      body: { status, checkedAt: dependencies.now().toISOString(), metrics },
    };
  } catch {
    return { status: 500, body: { code: 'health_check_failed' } };
  }
}
