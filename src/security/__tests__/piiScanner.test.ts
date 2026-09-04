const { scanText } = require('../../../scripts/piiScanner.js') as {
  scanText: (content: string, filePath: string) => Array<{
    kind: string;
    line: number;
  }>;
};

describe('PII safety scanner', () => {
  it('rejects runtime console logging that could bypass the observability scrubber', () => {
    expect(scanText("console.error('upload failed', error);", 'src/upload.ts')).toEqual([
      expect.objectContaining({ kind: 'runtime-console', line: 1 }),
    ]);
  });

  it('rejects committed non-empty secret values', () => {
    expect(scanText('GOOGLE_GEMINI_API_KEY=live-secret-value', '.env.example')).toEqual([
      expect.objectContaining({ kind: 'committed-secret', line: 1 }),
    ]);
  });

  it('rejects private signed Storage URLs', () => {
    const url = 'https://project.supabase.co/storage/v1/object/sign/body/member/photo.jpg?token=private';

    expect(scanText(`const leaked = '${url}';`, 'src/leak.ts')).toEqual([
      expect.objectContaining({ kind: 'private-storage-url', line: 1 }),
    ]);
  });

  it('rejects personal contact details and developer home-directory paths', () => {
    const content = [
      'owner=member@personalmail.co',
      'phone=+1 (604) 555-0137',
      'fixture=/Users/developer/Pictures/body-photo.jpg',
    ].join('\n');

    expect(scanText(content, 'src/leak.ts')).toEqual([
      expect.objectContaining({ kind: 'email-address', line: 1 }),
      expect.objectContaining({ kind: 'phone-number', line: 2 }),
      expect.objectContaining({ kind: 'home-directory', line: 3 }),
    ]);
  });

  it('allows empty environment templates, example identities, and test-only logging', () => {
    expect(scanText('EXPO_PUBLIC_SUPABASE_KEY=\nemail=member@example.com', '.env.example')).toEqual([]);
    expect(scanText("console.error('expected failure');", 'src/example.test.ts')).toEqual([]);
  });
});
