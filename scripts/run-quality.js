const { spawnSync } = require('node:child_process');

const SUPABASE_DB_EXCLUSIONS = 'gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor';

const gates = [
  {
    name: 'Typecheck',
    display: 'npm run typecheck',
    command: 'npm',
    args: ['run', 'typecheck'],
  },
  {
    name: 'Coverage',
    display: 'npm run test:coverage -- --ci',
    command: 'npm',
    args: ['run', 'test:coverage', '--', '--ci'],
  },
  {
    name: 'PII check',
    display: 'npm run check:pii',
    command: 'npm',
    args: ['run', 'check:pii'],
  },
  {
    name: 'Expo Doctor',
    display: 'npm exec --offline expo-doctor',
    command: 'npm',
    args: ['exec', '--offline', 'expo-doctor'],
  },
  {
    name: 'Web export',
    display: 'npm run build:web',
    command: 'npm',
    args: ['run', 'build:web'],
  },
  {
    name: 'Critical production dependency audit',
    display: 'npm audit --omit=dev --audit-level=critical',
    command: 'npm',
    args: ['audit', '--omit=dev', '--audit-level=critical'],
  },
];

class QualityGateError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

function runGate(gate) {
  process.stdout.write(`\n[quality] ${gate.name}: ${gate.display}\n`);
  const result = spawnSync(gate.command, gate.args, {
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw new QualityGateError(`${gate.name} could not start.`);
  }

  if (result.status !== 0) {
    throw new QualityGateError(`${gate.name} failed.`, result.status ?? 1);
  }
}

function isDatabaseRunning() {
  const statusCheck = {
    command: 'supabase',
    args: ['status'],
  };
  const result = spawnSync(statusCheck.command, statusCheck.args, {
    stdio: 'ignore',
    shell: false,
  });
  return !result.error && result.status === 0;
}

let databaseStartedByRunner = false;
let cleanupInProgress = false;

function stopManagedDatabase() {
  if (!databaseStartedByRunner || cleanupInProgress) return;
  cleanupInProgress = true;
  try {
    runGate({
      name: 'Stop managed Supabase database',
      display: 'supabase stop --no-backup',
      command: 'supabase',
      args: ['stop', '--no-backup'],
    });
    databaseStartedByRunner = false;
  } finally {
    cleanupInProgress = false;
  }
}

for (const [signal, exitCode] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(signal, () => {
    try {
      stopManagedDatabase();
    } catch (error) {
      process.stderr.write(`[quality] ${error.message}\n`);
    }
    process.exit(exitCode);
  });
}

try {
  for (const gate of gates) runGate(gate);

  if (!isDatabaseRunning()) {
    databaseStartedByRunner = true;
    runGate({
      name: 'Start managed Supabase database',
      display: `supabase start -x ${SUPABASE_DB_EXCLUSIONS}`,
      command: 'supabase',
      args: ['start', '-x', SUPABASE_DB_EXCLUSIONS],
    });
  }

  runGate({
    name: 'Marketplace party legacy upgrade',
    display: 'npm run test:db:upgrade',
    command: 'npm',
    args: ['run', 'test:db:upgrade'],
  });

  runGate({
    name: 'Apply pending local database migrations',
    display: 'supabase migration up --local',
    command: 'supabase',
    args: ['migration', 'up', '--local'],
  });

  runGate({
    name: 'Database RLS policies',
    display: 'npm run test:db',
    command: 'npm',
    args: ['run', 'test:db'],
  });

  process.stdout.write('\n[quality] All quality gates passed.\n');
} catch (error) {
  const failure = error instanceof QualityGateError
    ? error
    : new QualityGateError(error instanceof Error ? error.message : 'Unknown quality failure.');
  process.stderr.write(`[quality] ${failure.message}\n`);
  process.exitCode = failure.exitCode;
} finally {
  try {
    stopManagedDatabase();
  } catch (error) {
    process.stderr.write(`[quality] ${error.message}\n`);
    process.exitCode = error instanceof QualityGateError ? error.exitCode : 1;
  }
}
