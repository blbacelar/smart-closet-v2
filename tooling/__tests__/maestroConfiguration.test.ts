import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const flowPath = resolve(root, '.maestro/signup-to-tryon.yaml');
const expoGoFlowPath = resolve(root, '.maestro/expo-go-auth-smoke.yaml');
const expoGoActivationFlowPath = resolve(root, '.maestro/expo-go-signup-to-tryon.yaml');
const bodyFixturePath = resolve(root, '.maestro/fixtures/synthetic-adult-body.jpg');
const garmentFixturePath = resolve(root, '.maestro/fixtures/synthetic-green-overshirt.jpg');
const guidePath = resolve(root, '.maestro/README.md');
const twoAccountFlowPath = resolve(root, '.maestro/two-account-marketplace-smoke.yaml');
const appConfigPath = resolve(root, 'app.json');
const easConfigPath = resolve(root, 'eas.json');
const packagePath = resolve(root, 'package.json');
const supabaseConfigPath = resolve(root, 'supabase/config.toml');
const seedScriptPath = resolve(root, 'scripts/seed-e2e-accounts.js');

describe('Maestro activation journey', () => {
  it('covers signup, onboarding, body photo, garment, and try-on', () => {
    expect(existsSync(flowPath)).toBe(true);
    const flow = readFileSync(flowPath, 'utf8');

    expect(flow).toContain('appId: app.fitly.mobile');
    expect(flow).toContain('Create an account');
    expect(flow).toContain('auth-birth-date-input');
    expect(flow).toContain('inputText: "19900101"');
    expect(flow).toContain('auth-name-input');
    expect(flow).toContain('auth-password-input');
    expect(flow.match(/pressKey: Enter/g)?.length).toBeGreaterThanOrEqual(3);
    expect(flow).not.toContain('hideKeyboard');
    expect(flow).toContain('PXGGridLayout-Info');
    expect(flow).toContain('Start my closet');
    expect(flow).toContain('Save private photo');
    expect(flow).toContain('Add to my closet');
    expect(flow).toContain('Try it on');
    expect(flow).toContain('Your Fitly fitting is ready');
    expect(flow).toContain('addMedia:');
    expect(flow).toContain('auth-birth-date-input');
  });

  it('documents its isolated test-account and provider prerequisites', () => {
    expect(existsSync(guidePath)).toBe(true);
    const guide = readFileSync(guidePath, 'utf8');

    expect(guide).toContain('E2E_EMAIL');
    expect(guide).toContain('synthetic-adult-body.jpg');
    expect(guide).toContain('synthetic-green-overshirt.jpg');
    expect(guide).toContain('available prepaid credits');
    expect(guide).toContain('E2E_SEED_STAGING_PROJECT_REF');
    expect(guide).not.toMatch(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/);
  });

  it('provides a no-credential Expo Go authentication smoke flow', () => {
    expect(existsSync(expoGoFlowPath)).toBe(true);
    const flow = readFileSync(expoGoFlowPath, 'utf8');

    expect(flow).toContain('appId: host.exp.Exponent');
    expect(flow).toContain('openLink: ${EXPO_URL}');
    expect(flow).toContain('Continue with Google');
    expect(flow).toContain('Continue with Apple');
    expect(flow).toContain('Create an account');
    expect(flow).not.toContain('inputText:');
  });

  it('provides synthetic fixtures and a real Expo Go provider journey', () => {
    expect(existsSync(expoGoActivationFlowPath)).toBe(true);
    expect(existsSync(bodyFixturePath)).toBe(true);
    expect(existsSync(garmentFixturePath)).toBe(true);

    const flow = readFileSync(expoGoActivationFlowPath, 'utf8');
    expect(flow).toContain('appId: host.exp.Exponent');
    expect(flow).toContain('addMedia:');
    expect(flow).toContain('Save private photo');
    expect(flow).toContain('Add to my closet');
    expect(flow).toContain('Your Fitly fitting is ready');
  });

  it('defines an SDK 57 development-client and staging build contract', () => {
    const appConfig = JSON.parse(readFileSync(appConfigPath, 'utf8'));
    const easConfig = JSON.parse(readFileSync(easConfigPath, 'utf8'));
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

    expect(packageJson.dependencies['expo-dev-client']).toMatch(/^~57\./);
    expect(appConfig.expo.runtimeVersion).toEqual({ policy: 'appVersion' });
    expect(easConfig.build.development).toEqual(expect.objectContaining({
      developmentClient: true,
      distribution: 'internal',
    }));
    expect(easConfig.build['development-simulator']).toEqual(expect.objectContaining({
      developmentClient: true,
      distribution: 'internal',
      ios: expect.objectContaining({ simulator: true }),
    }));
    expect(easConfig.build.staging).toEqual(expect.objectContaining({
      distribution: 'internal',
      environment: 'preview',
      android: expect.objectContaining({ buildType: 'apk' }),
    }));
    expect(packageJson.scripts['e2e:seed']).toBe('node scripts/seed-e2e-accounts.js');
    const supabaseConfig = readFileSync(supabaseConfigPath, 'utf8');
    expect(supabaseConfig).toMatch(/\[db\.seed\][\s\S]*?enabled = false/);
    expect(supabaseConfig).not.toContain('sql_paths = ["./seed.sql"]');
  });

  it('provides an installed-build two-account marketplace smoke', () => {
    expect(existsSync(twoAccountFlowPath)).toBe(true);
    const flow = readFileSync(twoAccountFlowPath, 'utf8');

    expect(flow).toContain('appId: app.fitly.mobile');
    expect(flow).toContain('openLink: ${EXPO_URL}');
    expect(flow).toContain('${E2E_SELLER_EMAIL}');
    expect(flow).toContain('${E2E_SELLER_PASSWORD}');
    expect(flow).toContain('${E2E_BUYER_EMAIL}');
    expect(flow).toContain('${E2E_BUYER_PASSWORD}');
    expect(flow.match(/inputText: "19900101"/g)?.length).toBe(2);
    expect(flow.match(/E2E green overshirt/g)?.length).toBeGreaterThanOrEqual(2);
    expect(flow).toContain('500 Fitly credits available; view marketplace membership');
    expect(flow).toContain('Sign out');
  });

  it('never checks a harness password into source or documentation', () => {
    const guide = readFileSync(guidePath, 'utf8');
    const seedScript = readFileSync(seedScriptPath, 'utf8');

    expect(seedScript).not.toMatch(/LOCAL_(?:SELLER|BUYER)_PASSWORD/);
    expect(seedScript).toContain('process.env.E2E_SELLER_PASSWORD');
    expect(seedScript).toContain('process.env.E2E_BUYER_PASSWORD');
    expect(guide).toContain('-e E2E_SELLER_PASSWORD="$E2E_SELLER_PASSWORD"');
    expect(guide).toContain('-e E2E_BUYER_PASSWORD="$E2E_BUYER_PASSWORD"');
  });
});
