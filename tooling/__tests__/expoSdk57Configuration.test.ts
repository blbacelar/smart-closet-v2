import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

describe('Expo Go SDK 57 compatibility', () => {
  it('uses the Expo 57 runtime and its matching React versions', () => {
    expect(packageJson.dependencies.expo).toMatch(/^~57\./);
    expect(packageJson.dependencies.react).toBe('19.2.3');
    expect(packageJson.dependencies['react-dom']).toBe('19.2.3');
    expect(packageJson.dependencies['react-native']).toMatch(/^0\.86\./);
  });

  it('uses the matching Expo 57 Jest preset', () => {
    expect(packageJson.devDependencies['jest-expo']).toMatch(/^~57\./);
  });

  it('pins the minimum Node version required by Expo 57', () => {
    expect(readFileSync(resolve(root, '.nvmrc'), 'utf8').trim()).toBe('22.13.0');
  });
});
