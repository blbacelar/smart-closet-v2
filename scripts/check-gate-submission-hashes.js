const { createHash } = require('node:crypto');
const { lstatSync, readFileSync, readdirSync, realpathSync } = require('node:fs');
const { basename, dirname, isAbsolute, relative, resolve, sep } = require('node:path');

const manifestRelativePath = 'docs/gates/submissions/README.md';
const expectedDrafts = Object.freeze({
  'gate-c-apple-v1': 'apple-storefront-classification-request.txt',
  'gate-c-google-v1': 'google-play-storefront-classification-request.txt',
  'gate-b-counsel-tax-v1': 'canadian-legal-tax-review-request.md',
});

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function parseManifest(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => /^\| `gate-[^`]+` \|/.test(line))
    .map((line) => {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
      return {
        draftId: cells[0]?.replaceAll('`', ''),
        fileName: cells[3]?.replaceAll('`', ''),
        expectedHash: cells[4]?.replaceAll('`', ''),
      };
    });
}

function verifyManifest(repositoryRoot, relativeManifestPath = manifestRelativePath) {
  const manifestPath = resolve(repositoryRoot, relativeManifestPath);
  const manifest = readFileSync(manifestPath, 'utf8');
  const manifestDirectory = dirname(manifestPath);
  const realManifestDirectory = realpathSync(manifestDirectory);
  const entries = parseManifest(manifest);
  const findings = [];
  const ids = new Set();
  const fileNames = new Set();

  if (entries.length === 0) {
    return [{ kind: 'missing-manifest-entries', filePath: relativeManifestPath }];
  }

  for (const entry of entries) {
    if (ids.has(entry.draftId)) {
      findings.push({
        kind: 'duplicate-draft-id',
        draftId: entry.draftId || 'unknown',
        filePath: relativeManifestPath,
      });
    }
    ids.add(entry.draftId);

    if (fileNames.has(entry.fileName)) {
      findings.push({
        kind: 'duplicate-draft-file',
        draftId: entry.draftId || 'unknown',
        filePath: entry.fileName || relativeManifestPath,
      });
    }
    fileNames.add(entry.fileName);

    const expectedFileName = expectedDrafts[entry.draftId];
    const hasCanonicalPath = Boolean(entry.fileName)
      && !isAbsolute(entry.fileName)
      && basename(entry.fileName) === entry.fileName
      && expectedFileName === entry.fileName;

    if (!entry.draftId || !expectedFileName || !hasCanonicalPath
      || !/^[a-f0-9]{64}$/.test(entry.expectedHash ?? '')) {
      findings.push({
        kind: 'invalid-manifest-entry',
        draftId: entry.draftId || 'unknown',
        filePath: relativeManifestPath,
      });

      if (!hasCanonicalPath) {
        findings.push({
          kind: 'invalid-draft-path',
          draftId: entry.draftId || 'unknown',
          filePath: entry.fileName || relativeManifestPath,
        });
      }
      continue;
    }

    const draftPath = resolve(manifestDirectory, entry.fileName);
    let actualHash;
    try {
      const draftStat = lstatSync(draftPath);
      if (draftStat.isSymbolicLink() || !draftStat.isFile()) {
        throw new Error('Draft must be a regular file, not a link or directory.');
      }
      const realDraftPath = realpathSync(draftPath);
      const pathWithinManifest = relative(realManifestDirectory, realDraftPath);
      if (pathWithinManifest.startsWith(`..${sep}`) || pathWithinManifest === '..' || isAbsolute(pathWithinManifest)) {
        throw new Error('Draft resolves outside the submission directory.');
      }
      actualHash = sha256(readFileSync(draftPath));
    } catch {
      findings.push({
        kind: 'missing-or-unsafe-draft',
        draftId: entry.draftId,
        filePath: entry.fileName,
      });
      continue;
    }

    if (actualHash !== entry.expectedHash) {
      findings.push({
        kind: 'stale-draft-hash',
        draftId: entry.draftId,
        filePath: entry.fileName,
      });
    }
  }

  for (const [draftId, fileName] of Object.entries(expectedDrafts)) {
    if (!entries.some((entry) => entry.draftId === draftId && entry.fileName === fileName)) {
      findings.push({ kind: 'missing-manifest-entry', draftId, filePath: fileName });
    }
  }

  const manifestedFiles = new Set(entries.map((entry) => entry.fileName));
  for (const directoryEntry of readdirSync(manifestDirectory, { withFileTypes: true })) {
    if (directoryEntry.name === 'README.md') continue;
    if (!manifestedFiles.has(directoryEntry.name)) {
      findings.push({
        kind: 'unmanifested-draft',
        draftId: 'manifest',
        filePath: directoryEntry.name,
      });
    }
  }

  return findings;
}

if (require.main === module) {
  const findings = verifyManifest(process.cwd());
  if (findings.length > 0) {
    process.stderr.write('Gate submission draft verification failed.\n');
    findings.forEach(({ kind, draftId = 'manifest', filePath }) => {
      process.stderr.write(`${draftId}: ${filePath} [${kind}]\n`);
    });
    process.exitCode = 1;
  } else {
    process.stdout.write('Gate submission draft hashes verified.\n');
  }
}

module.exports = { expectedDrafts, parseManifest, sha256, verifyManifest };
