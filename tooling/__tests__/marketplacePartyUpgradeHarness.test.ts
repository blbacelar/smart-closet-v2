import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');

function read(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('marketplace party legacy-upgrade harness', () => {
  it('owns a legacy fixture and executable pgTAP backfill contract', () => {
    const fixture = 'supabase/upgrade-fixtures/marketplace-parties-legacy.sql';
    const test = 'supabase/upgrade-tests/marketplace-parties-backfill.test.sql';

    expect(existsSync(resolve(root, fixture))).toBe(true);
    expect(existsSync(resolve(root, test))).toBe(true);
    expect(read(fixture)).toContain('insert into public.marketplace_transactions');
    expect(read(test)).toContain('private.marketplace_parties');
    expect(read(test)).toContain('public.marketplace_credit_ledger');
  });

  it('uses an isolated prior-version stack and always removes it', () => {
    const runner = read('scripts/test-marketplace-party-upgrade.js');

    expect(runner).toContain('mkdtempSync');
    expect(runner).toContain('tmpdir()');
    expect(runner).toContain('cpSync');
    expect(runner).toContain('createIsolatedWorkspace');
    expect(runner).toContain('withWorkdir');
    expect(runner).toContain("['start', '-x', SUPABASE_DB_EXCLUSIONS]");
    expect(runner).toContain("'20261016030000'");
    expect(runner).toContain('marketplace-parties-legacy.sql');
    expect(runner).toContain("['migration', 'up', '--local']");
    expect(runner).toContain('marketplace-parties-backfill.test.sql');
    expect(runner).toContain("['stop', '--no-backup']");
    expect(runner).toContain('isolatedStackAttempted = true');
    expect(runner).toContain('if (cleanupFailure && !failure)');
    expect(runner).toContain('if (!cleanupFailure && workspace)');
    expect(runner).toContain('rmSync');
    expect(runner).toContain('finally');
    expect(runner).not.toContain('Restore the latest local schema');
  });

  it('runs the upgrade contract in local quality and database CI', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      scripts?: Record<string, string>;
    };
    const workflow = read('.github/workflows/ci.yml');
    const qualityRunner = read('scripts/run-quality.js');

    expect(packageJson.scripts?.['test:db:upgrade']).toBe(
      'node scripts/test-marketplace-party-upgrade.js',
    );
    expect(workflow).toContain('run: npm run test:db:upgrade');
    expect(qualityRunner).toContain('npm run test:db:upgrade');
  });
});
