import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const flowPath = resolve(root, '.maestro/signup-to-tryon.yaml');
const guidePath = resolve(root, '.maestro/README.md');

describe('Maestro activation journey', () => {
  it('covers signup, onboarding, body photo, garment, and try-on', () => {
    expect(existsSync(flowPath)).toBe(true);
    const flow = readFileSync(flowPath, 'utf8');

    expect(flow).toContain('appId: app.fitly.mobile');
    expect(flow).toContain('Create an account');
    expect(flow).toContain('Start my closet');
    expect(flow).toContain('Save private photo');
    expect(flow).toContain('Add to my closet');
    expect(flow).toContain('Try it on');
    expect(flow).toContain('Your Fitly fitting is ready');
    expect(flow).toContain('addMedia:');
  });

  it('documents its isolated test-account and provider prerequisites', () => {
    expect(existsSync(guidePath)).toBe(true);
    const guide = readFileSync(guidePath, 'utf8');

    expect(guide).toContain('E2E_EMAIL');
    expect(guide).toContain('E2E_BODY_PHOTO');
    expect(guide).toContain('E2E_GARMENT_PHOTO');
    expect(guide).toContain('funded Gemini');
    expect(guide).not.toMatch(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/);
  });
});
