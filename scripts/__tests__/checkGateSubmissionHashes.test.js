const {
  mkdtempSync,
  mkdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const {
  expectedDrafts,
  parseManifest,
  sha256,
  verifyManifest,
} = require('../check-gate-submission-hashes');

function manifestRow(draftId, fileName, hash) {
  return `| \`${draftId}\` | Counterparty | Verified | \`${fileName}\` | \`${hash}\` | Drafted |`;
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'fitly-gate-drafts-'));
  const directory = join(root, 'docs/gates/submissions');
  mkdirSync(directory, { recursive: true });
  const rows = Object.entries(expectedDrafts).map(([draftId, fileName]) => {
    const content = `exact approved text for ${draftId}`;
    writeFileSync(join(directory, fileName), content);
    return manifestRow(draftId, fileName, sha256(content));
  });
  writeFileSync(
    join(directory, 'README.md'),
    [
      '| Draft ID | Counterparty | Destination | File | SHA-256 | Status |',
      '| --- | --- | --- | --- | --- | --- |',
      ...rows,
    ].join('\n'),
  );
  return { directory, root };
}

function replaceManifestRows(directory, rows) {
  writeFileSync(
    join(directory, 'README.md'),
    [
      '| Draft ID | Counterparty | Destination | File | SHA-256 | Status |',
      '| --- | --- | --- | --- | --- | --- |',
      ...rows,
    ].join('\n'),
  );
}

describe('gate submission draft hash verification', () => {
  it('parses immutable draft identifiers, files, and hashes', () => {
    const hash = 'a'.repeat(64);
    expect(parseManifest(
      `| \`gate-c-apple-v1\` | Apple | Verified | \`apple-storefront-classification-request.txt\` | \`${hash}\` | Drafted |`,
    )).toEqual([{
      draftId: 'gate-c-apple-v1',
      fileName: 'apple-storefront-classification-request.txt',
      expectedHash: hash,
    }]);
  });

  it('accepts an unchanged exact draft', () => {
    expect(verifyManifest(createFixture().root)).toEqual([]);
  });

  it('rejects a changed draft with a stale approval hash', () => {
    const { directory, root } = createFixture();
    writeFileSync(join(directory, expectedDrafts['gate-c-apple-v1']), 'changed text');
    expect(verifyManifest(root)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'stale-draft-hash',
        draftId: 'gate-c-apple-v1',
        filePath: expectedDrafts['gate-c-apple-v1'],
      }),
    ]));
  });

  it('rejects a genuinely missing draft', () => {
    const { directory, root } = createFixture();
    unlinkSync(join(directory, expectedDrafts['gate-c-apple-v1']));
    expect(verifyManifest(root)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'missing-or-unsafe-draft' }),
    ]));
  });

  it('rejects malformed manifest hashes', () => {
    const { directory, root } = createFixture();
    const fileName = expectedDrafts['gate-c-apple-v1'];
    const otherRows = Object.entries(expectedDrafts).slice(1).map(([draftId, name]) => {
      const content = `exact approved text for ${draftId}`;
      return manifestRow(draftId, name, sha256(content));
    });
    replaceManifestRows(directory, [manifestRow('gate-c-apple-v1', fileName, 'PENDING_HASH'), ...otherRows]);
    expect(verifyManifest(root)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'invalid-manifest-entry' }),
    ]));
  });

  it('rejects absolute and traversing paths even when their hashes match', () => {
    const { directory, root } = createFixture();
    const outsidePath = join(root, 'outside.txt');
    writeFileSync(outsidePath, 'outside text');
    const otherRows = Object.entries(expectedDrafts).slice(1).map(([draftId, fileName]) => manifestRow(
      draftId,
      fileName,
      sha256(`exact approved text for ${draftId}`),
    ));

    for (const unsafePath of ['../../../outside.txt', outsidePath]) {
      replaceManifestRows(directory, [
        manifestRow('gate-c-apple-v1', unsafePath, sha256('outside text')),
        ...otherRows,
      ]);
      expect(verifyManifest(root)).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'invalid-draft-path', filePath: unsafePath }),
      ]));
    }
  });

  it('rejects duplicate draft IDs and duplicate draft files', () => {
    const { directory, root } = createFixture();
    const apple = expectedDrafts['gate-c-apple-v1'];
    const google = expectedDrafts['gate-c-google-v1'];
    replaceManifestRows(directory, [
      manifestRow('gate-c-apple-v1', apple, sha256('exact approved text for gate-c-apple-v1')),
      manifestRow('gate-c-apple-v1', apple, sha256('exact approved text for gate-c-apple-v1')),
      manifestRow('gate-c-google-v1', google, sha256('exact approved text for gate-c-google-v1')),
    ]);
    expect(verifyManifest(root)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'duplicate-draft-id' }),
      expect.objectContaining({ kind: 'duplicate-draft-file' }),
    ]));
  });

  it('rejects a missing canonical manifest entry and an unmanifested outbound draft', () => {
    const { directory, root } = createFixture();
    const apple = expectedDrafts['gate-c-apple-v1'];
    replaceManifestRows(directory, [
      manifestRow('gate-c-apple-v1', apple, sha256('exact approved text for gate-c-apple-v1')),
    ]);
    writeFileSync(join(directory, 'extra-outbound.txt'), 'not approved');
    expect(verifyManifest(root)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'missing-manifest-entry', draftId: 'gate-c-google-v1' }),
      expect.objectContaining({ kind: 'missing-manifest-entry', draftId: 'gate-b-counsel-tax-v1' }),
      expect.objectContaining({ kind: 'unmanifested-draft', filePath: 'extra-outbound.txt' }),
    ]));
  });

  it('rejects symlinks in place of canonical drafts', () => {
    const { directory, root } = createFixture();
    const apple = expectedDrafts['gate-c-apple-v1'];
    unlinkSync(join(directory, apple));
    symlinkSync(join(directory, expectedDrafts['gate-c-google-v1']), join(directory, apple));
    expect(verifyManifest(root)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'missing-or-unsafe-draft', draftId: 'gate-c-apple-v1' }),
    ]));
  });
});
