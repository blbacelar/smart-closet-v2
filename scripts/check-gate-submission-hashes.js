const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

const manifestRelativePath = 'docs/gates/submissions/README.md';

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
  const entries = parseManifest(manifest);
  const findings = [];

  if (entries.length === 0) {
    return [{ kind: 'missing-manifest-entries', filePath: relativeManifestPath }];
  }

  for (const entry of entries) {
    if (!entry.draftId || !entry.fileName || !/^[a-f0-9]{64}$/.test(entry.expectedHash ?? '')) {
      findings.push({
        kind: 'invalid-manifest-entry',
        draftId: entry.draftId || 'unknown',
        filePath: relativeManifestPath,
      });
      continue;
    }

    const draftPath = resolve(manifestDirectory, entry.fileName);
    let actualHash;
    try {
      actualHash = sha256(readFileSync(draftPath));
    } catch {
      findings.push({
        kind: 'missing-draft',
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

module.exports = { parseManifest, sha256, verifyManifest };
