const { spawnSync } = require('node:child_process');

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

try {
  for (const gate of gates) runGate(gate);

  runGate({
    name: 'Isolated database upgrade, ledger, concurrency, and RLS',
    display: 'npm run test:db:upgrade',
    command: 'npm',
    args: ['run', 'test:db:upgrade'],
  });

  process.stdout.write('\n[quality] All quality gates passed.\n');
} catch (error) {
  const failure = error instanceof QualityGateError
    ? error
    : new QualityGateError(error instanceof Error ? error.message : 'Unknown quality failure.');
  process.stderr.write(`[quality] ${failure.message}\n`);
  process.exitCode = failure.exitCode;
}
