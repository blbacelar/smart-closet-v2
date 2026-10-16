const { mkdtempSync, mkdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const {
  parseManifest,
  sha256,
  verifyManifest,
} = require('../check-gate-submission-hashes');

function createFixture({ draft = 'exact approved text', expectedHash } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'fitly-gate-drafts-'));
  const directory = join(root, 'docs/gates/submissions');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'apple.txt'), draft);
  writeFileSync(
    join(directory, 'README.md'),
    [
      '| Draft ID | Counterparty | Destination | File | SHA-256 | Status |',
      '| --- | --- | --- | --- | --- | --- |',
      `| \`gate-c-apple-v1\` | Apple | Verified | \`apple.txt\` | \`${expectedHash ?? sha256(draft)}\` | Drafted |`,
    ].join('\n'),
  );
  return root;
}

describe('gate submission draft hash verification', () => {
  it('parses immutable draft identifiers, files, and hashes', () => {
    const hash = 'a'.repeat(64);
    expect(parseManifest(
      `| \`gate-c-apple-v1\` | Apple | Verified | \`apple.txt\` | \`${hash}\` | Drafted |`,
    )).toEqual([{
      draftId: 'gate-c-apple-v1',
      fileName: 'apple.txt',
      expectedHash: hash,
    }]);
  });

  it('accepts an unchanged exact draft', () => {
    expect(verifyManifest(createFixture())).toEqual([]);
  });

  it('rejects a changed draft with a stale approval hash', () => {
    const root = createFixture({ expectedHash: sha256('older text') });
    expect(verifyManifest(root)).toEqual([
      expect.objectContaining({
        kind: 'stale-draft-hash',
        draftId: 'gate-c-apple-v1',
        filePath: 'apple.txt',
      }),
    ]);
  });

  it('rejects missing drafts and malformed manifest hashes', () => {
    const root = createFixture({ expectedHash: 'PENDING_HASH' });
    expect(verifyManifest(root)).toEqual([
      expect.objectContaining({ kind: 'invalid-manifest-entry' }),
    ]);
  });
});
