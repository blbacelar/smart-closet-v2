const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

const testPathPattern = /(^|\/)(__tests__|tests)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/;
const runtimeSourcePattern = /\.[cm]?[jt]sx?$/;
const exampleEmailDomains = new Set(['example.com', 'example.net', 'example.org']);

function finding(kind, line) {
  return { kind, line };
}

function scanText(content, filePath) {
  const normalizedPath = filePath.replaceAll('\\', '/');
  const isTest = testPathPattern.test(normalizedPath);
  const findings = [];

  content.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;

    if (!isTest && runtimeSourcePattern.test(normalizedPath) && /\bconsole\.(?:debug|error|info|log|warn)\s*\(/.test(line)) {
      findings.push(finding('runtime-console', lineNumber));
    }

    const secretAssignment = line.match(/^\s*(?:export\s+)?[A-Z][A-Z0-9_]*(?:KEY|PASSWORD|SECRET|TOKEN)[A-Z0-9_]*\s*=\s*(.*?)\s*$/);
    if (secretAssignment && secretAssignment[1] && !/^env\([A-Z0-9_]+\)$/.test(secretAssignment[1])) {
      findings.push(finding('committed-secret', lineNumber));
    }

    if (/https?:\/\/[^\s'"`]+\/storage\/v1\/object\/(?:authenticated|sign)\/(?:body|garments|results)(?:\/|\?)/i.test(line)) {
      findings.push(finding('private-storage-url', lineNumber));
    }

    for (const match of line.matchAll(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi)) {
      if (!exampleEmailDomains.has(match[1].toLowerCase())) {
        findings.push(finding('email-address', lineNumber));
        break;
      }
    }

    if (/(?:\+?1[\s.-]*)?\(?[2-9]\d{2}\)?[\s.-]+\d{3}[\s.-]+\d{4}\b/.test(line)) {
      findings.push(finding('phone-number', lineNumber));
    }

    if (/(?:^|[='"`\s])\/(?:Users|home)\/[^/\s]+\//.test(line)) {
      findings.push(finding('home-directory', lineNumber));
    }
  });

  return findings;
}

function shouldScan(filePath) {
  const normalizedPath = filePath.replaceAll('\\', '/');
  return !(
    normalizedPath === 'package-lock.json'
    || normalizedPath === 'scripts/check-pii.js'
    || normalizedPath.startsWith('assets/')
    || testPathPattern.test(normalizedPath)
  );
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
    .split('\0')
    .filter(Boolean);
}

function scanRepository() {
  return trackedFiles().filter(shouldScan).flatMap((filePath) => {
    const content = readFileSync(filePath, 'utf8');
    return scanText(content, filePath).map((result) => ({ ...result, filePath }));
  });
}

if (require.main === module) {
  const findings = scanRepository();
  if (findings.length > 0) {
    process.stderr.write('PII safety check failed. Values are omitted to avoid repeating sensitive data.\n');
    findings.forEach(({ filePath, line, kind }) => {
      process.stderr.write(`${filePath}:${line} [${kind}]\n`);
    });
    process.exitCode = 1;
  } else {
    process.stdout.write('PII safety check passed.\n');
  }
}

module.exports = { scanRepository, scanText };
