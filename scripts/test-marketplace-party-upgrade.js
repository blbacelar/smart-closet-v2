const { spawnSync } = require('node:child_process');
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
      withWorkdir([
        'test',
        'db',
        join(workspace, 'supabase/upgrade-tests/marketplace-parties-backfill.test.sql'),
      ], workspace),
      'Verify the isolated legacy-data backfill',
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
