import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');

function read(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('GitHub quality CI', () => {
  const workflow = read('.github/workflows/ci.yml');

  it('checks every pull request and main-branch push without application secrets', () => {
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('push:');
    expect(workflow).toContain('- main');
    expect(workflow).toContain('permissions:');
    expect(workflow).toContain('contents: read');
    expect(workflow).not.toMatch(/\$\{\{\s*secrets\./);
  });

  it('uses reproducible dependencies and runs every local quality gate', () => {
    expect(workflow).toContain('node-version-file: .nvmrc');
    expect(workflow).toContain('cache: npm');
    expect(workflow).toContain('run: npm ci');
    expect(workflow).toContain('run: npm run typecheck');
    expect(workflow).toContain('run: npm run test:coverage -- --ci');
    expect(workflow).toContain('run: npm run check:gate-drafts');
    expect(workflow).toContain('run: npm exec --offline expo-doctor');
    expect(workflow).toContain('run: npm run build:web');
    expect(workflow).toContain('run: npm audit --omit=dev --audit-level=critical');
  });

  it('limits execution time and cancels superseded branch runs', () => {
    expect(workflow).toContain('timeout-minutes: 20');
    expect(workflow).toContain('cancel-in-progress: true');
    expect(workflow).toContain('persist-credentials: false');
  });
});

describe('manual EAS build workflow', () => {
  const workflow = read('.github/workflows/eas-build.yml');

  it('cannot spend EAS build capacity from a push or pull request', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toMatch(/^\s{2}(push|pull_request):/m);
  });

  it('defaults to an Android preview and supports an explicit future platform choice', () => {
    expect(workflow).toContain('default: android');
    expect(workflow).toContain('default: preview');
    expect(workflow).toContain('- ios');
    expect(workflow).toContain('- all');
  });

  it('uses the repository Expo token only in the manual build boundary', () => {
    expect(workflow).toContain('uses: expo/expo-github-action@v8');
    expect(workflow).toContain('token: ${{ secrets.EXPO_TOKEN }}');
    expect(workflow).toContain('--non-interactive --no-wait');
    expect(workflow).toContain('persist-credentials: false');
  });
});

describe('dependency automation', () => {
  const packageJson = JSON.parse(read('package.json')) as {
    devDependencies?: Record<string, string>;
    overrides?: Record<string, string>;
    scripts?: Record<string, string>;
  };

  const dependabot = read('.github/dependabot.yml');

  it.each(['npm', 'github-actions'])('checks %s dependencies weekly', (ecosystem) => {
    expect(dependabot).toContain(`package-ecosystem: ${ecosystem}`);
    expect(dependabot).toContain('interval: weekly');
  });

  it('uses the Expo 57 compatible Node baseline for CI', () => {
    expect(read('.nvmrc').trim()).toBe('22.13.0');
  });

  it('pins the audited shell quoting implementation used by React Native tooling', () => {
    expect(packageJson.overrides?.['shell-quote']).toBe('1.11.0');
  });

  it('provides one local command for every CI gate', () => {
    expect(packageJson.scripts?.quality).toBe('node scripts/run-quality.js');

    const qualityRunner = read('scripts/run-quality.js');
    for (const command of [
      'npm run typecheck',
      'npm run test:coverage -- --ci',
      'npm run check:pii',
      'npm run check:gate-drafts',
      'npm exec --offline expo-doctor',
      'npm run build:web',
      'npm audit --omit=dev --audit-level=critical',
      'npm run test:db:upgrade',
    ]) {
      expect(qualityRunner).toContain(command);
    }
  });

  it('locks Expo Doctor instead of downloading an untracked release', () => {
    expect(packageJson.devDependencies?.['expo-doctor']).toBe('1.20.4');
  });

  it('delegates database startup to the isolated upgrade and pgTAP harness', () => {
    const workflow = read('.github/workflows/ci.yml');
    expect(workflow).toContain('run: npm run test:db:upgrade');
    expect(workflow).not.toContain('run: supabase start');
    expect(workflow).not.toContain('run: supabase stop');
  });

  it('never mutates or stops an existing developer database stack', () => {
    const qualityRunner = read('scripts/run-quality.js');
    expect(qualityRunner).toContain('npm run test:db:upgrade');
    expect(qualityRunner).not.toContain("args: ['status']");
    expect(qualityRunner).not.toContain("args: ['start'");
    expect(qualityRunner).not.toContain("args: ['stop'");
    expect(qualityRunner).not.toContain("args: ['migration', 'up', '--local']");
  });
});

describe('coverage ownership', () => {
  it('includes launch-critical marketplace and notification implementations', () => {
    const packageJson = JSON.parse(read('package.json')) as {
      jest?: { collectCoverageFrom?: string[] };
    };

    expect(packageJson.jest?.collectCoverageFrom).toContain(
      'src/features/marketplace/**/*.{ts,tsx}',
    );
    expect(packageJson.jest?.collectCoverageFrom).toContain(
      'src/features/notifications/notificationRegistration.ts',
    );
    expect(packageJson.jest?.collectCoverageFrom).toContain(
      'supabase/functions/process-notification-outbox/{expoPushProvider,processor}.ts',
    );
  });
});
