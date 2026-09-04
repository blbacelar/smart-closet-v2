import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../..');

describe('security automation contracts', () => {
  it('has an executable pgTAP RLS suite', () => {
    const testPath = resolve(root, 'supabase/tests/database/rls.test.sql');

    expect(existsSync(testPath)).toBe(true);
    const sql = readFileSync(testPath, 'utf8').toLowerCase();
    expect(sql).toContain('select plan(');
    expect(sql).toContain("set local role 'authenticated'");
    expect(sql).toContain('select * from finish()');
  });

  it('runs database and PII gates in the quality workflow', () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const workflow = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8');

    expect(packageJson.scripts['test:db']).toBe('supabase test db');
    expect(packageJson.scripts['check:pii']).toBe('node scripts/check-pii.js');
    expect(workflow).toContain('supabase/setup-cli@v1');
    expect(workflow).toContain('npm run test:db');
    expect(workflow).toContain('npm run check:pii');
  });

  it('uses explicit TypeScript extensions for local Edge Function imports', () => {
    const functionsRoot = resolve(root, 'supabase/functions');
    const sourceFiles = readdirSync(functionsRoot, { withFileTypes: true }).flatMap((directory) => {
      if (!directory.isDirectory()) return [];
      const directoryPath = resolve(functionsRoot, directory.name);
      return readdirSync(directoryPath)
        .filter((file) => file.endsWith('.ts'))
        .map((file) => resolve(directoryPath, file));
    });

    const invalidImports = sourceFiles.flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      return Array.from(source.matchAll(/from ['"](\.\.?\/[^'"]+)['"]/g))
        .map((match) => match[1])
        .filter((specifier) => !specifier.endsWith('.ts'))
        .map((specifier) => `${filePath}:${specifier}`);
    });

    expect(invalidImports).toEqual([]);
  });
});
