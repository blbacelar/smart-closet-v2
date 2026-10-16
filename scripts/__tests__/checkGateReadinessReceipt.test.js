const {
  capabilityIds,
  validateFile,
  validateReceipt,
} = require('../check-gate-readiness-receipt');
const { mkdtempSync, symlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const now = new Date('2026-10-16T12:00:00.000Z');

function commonReceipt(overrides = {}) {
  return {
    schemaVersion: 1,
    capability: capabilityIds.gemini,
    stage: 'access-ready',
    environment: 'staging',
    accountOwnerReference: 'private-register:owner-1',
    authorizedApproverReference: 'private-register:approver-1',
    operatorRole: 'ai-staging-operator',
    evidenceReference: 'private-register:evidence-1',
    verifiedAt: '2026-10-16T10:00:00.000Z',
    reviewerReference: 'private-register:reviewer-1',
    openFindings: [],
    approvalDecision: 'approved',
    decisionAt: '2026-10-16T11:00:00.000Z',
    nextReviewAt: '2027-01-16T11:00:00.000Z',
    ...overrides,
  };
}

function accessReceipt(overrides = {}) {
  return commonReceipt({
    accessChecks: [
      { name: 'funding-terms-budget', result: 'passed' },
      { name: 'data-processing-secret-boundary', result: 'passed' },
      { name: 'non-personal-fixture-policy', result: 'passed' },
      { name: 'authenticated-model-connectivity', result: 'passed' },
    ],
    termsFundingEntitlement: 'passed',
    secretBoundary: 'passed',
    minimumConnectivity: 'passed',
    revocationPlan: 'Disable the Edge Function secret and revoke the provider role.',
    ...overrides,
  });
}

function acceptanceReceipt(overrides = {}) {
  return commonReceipt({
    stage: 'acceptance-ready',
    accessReceiptReference: 'private-register:access-1',
    commitSha: 'a'.repeat(40),
    acceptanceChecks: [
      { name: 'moderation-tagging-color-tryon', result: 'passed' },
      { name: 'latency-cost-privacy-observation', result: 'passed' },
    ],
    endToEndChecks: [
      { name: 'provider-failure-circuit-breaker', result: 'passed' },
      { name: 'budget-circuit-breaker', result: 'passed' },
      { name: 'disable-provider-enqueue', result: 'passed' },
    ],
    disableRollbackCheck: 'passed',
    reconciliationCheck: {
      result: 'not-applicable',
      rationale: 'This AI capability does not mutate credits or paid state.',
    },
    ...overrides,
  });
}

function decisionOnlyReceipt(overrides = {}) {
  return {
    schemaVersion: 1,
    capability: capabilityIds.imageCleanup,
    stage: 'decision-only',
    releaseScope: 'first-release',
    providerDecision: 'excluded',
    decisionOwnerReference: 'private-register:owner-1',
    authorizedApproverReference: 'private-register:approver-1',
    rationale: 'The first release preserves the original image without third-party cleanup.',
    privacyProductApproval: 'passed',
    noProviderAccountCredentialOrData: 'confirmed',
    reconsideration: {
      kind: 'date',
      reviewAt: '2027-01-16T11:00:00.000Z',
    },
    evidenceReference: 'private-register:cleanup-decision-1',
    decidedAt: '2026-10-16T11:00:00.000Z',
    reviewerReference: 'private-register:reviewer-1',
    openFindings: [],
    approvalDecision: 'approved',
    ...overrides,
  };
}

describe('Gate D/E readiness receipt validator', () => {
  it('accepts a complete current access-ready receipt', () => {
    expect(validateReceipt(accessReceipt(), { now })).toEqual([]);
  });

  it.each([
    ['missing common ownership', { accountOwnerReference: undefined }, 'missing-field'],
    ['failed connectivity', { minimumConnectivity: 'failed' }, 'failed-check'],
    ['open findings', { openFindings: ['budget owner unresolved'] }, 'open-findings'],
    ['rejected approval', { approvalDecision: 'rejected' }, 'not-approved'],
    ['expired evidence', { nextReviewAt: '2026-10-15T11:00:00.000Z' }, 'expired-evidence'],
  ])('rejects access-ready receipt with %s', (_label, overrides, kind) => {
    expect(validateReceipt(accessReceipt(overrides), { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind })]),
    );
  });

  it('rejects failed and empty access checks', () => {
    const failed = accessReceipt({
      accessChecks: accessReceipt().accessChecks.map((check, index) => (
        index === 0 ? { ...check, result: 'failed' } : check
      )),
    });
    const empty = accessReceipt({ accessChecks: [] });
    expect(validateReceipt(failed, { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'failed-check' })]),
    );
    expect(validateReceipt(empty, { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'missing-checks' })]),
    );
  });

  it('requires each capability check ID exactly once and rejects unknown IDs', () => {
    const checks = accessReceipt().accessChecks;
    const findings = validateReceipt(accessReceipt({
      accessChecks: [checks[0], checks[0], checks[1], checks[2], { name: 'anything', result: 'passed' }],
    }), { now });
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'duplicate-check-id', field: 'accessChecks.funding-terms-budget' }),
      expect.objectContaining({ kind: 'unknown-check-id', field: 'accessChecks[4]' }),
      expect.objectContaining({ kind: 'missing-check-id', field: 'accessChecks.authenticated-model-connectivity' }),
    ]));
  });

  it('enforces capability environments and native build evidence', () => {
    const wrongEnvironment = accessReceipt({
      capability: capabilityIds.supabaseProduction,
      environment: 'sandbox',
    });
    expect(validateReceipt(wrongEnvironment, { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'capability-environment-mismatch' })]),
    );

    const appleAcceptance = acceptanceReceipt({
      capability: capabilityIds.appleStore,
      environment: 'production',
      acceptanceChecks: [
        { name: 'reproducible-signed-internal-build', result: 'passed' },
        { name: 'physical-device-install-and-exercise', result: 'passed' },
        { name: 'role-signing-review', result: 'passed' },
      ],
      endToEndChecks: [
        { name: 'distribution-halt-exercise', result: 'passed' },
        { name: 'operator-signing-revocation-exercise', result: 'passed' },
      ],
      buildIdentifier: undefined,
    });
    expect(validateReceipt(appleAcceptance, { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'missing-field', field: 'buildIdentifier' })]),
    );
  });

  it('rejects acceptance-only fields on an access-ready receipt', () => {
    expect(validateReceipt(accessReceipt({ commitSha: 'a'.repeat(40) }), { now })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'unexpected-field', field: 'receipt.unexpected[1]' }),
      ]),
    );
  });

  it('accepts a complete acceptance-ready receipt that references current access', () => {
    expect(validateReceipt(acceptanceReceipt(), { now })).toEqual([]);
  });

  it('rejects acceptance without a current access reference or passing rollback', () => {
    const findings = validateReceipt(acceptanceReceipt({
      accessReceiptReference: undefined,
      disableRollbackCheck: 'failed',
    }), { now });
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'missing-field', field: 'accessReceiptReference' }),
      expect.objectContaining({ kind: 'failed-check', field: 'disableRollbackCheck' }),
    ]));
  });

  it('requires passed reconciliation for billing capabilities', () => {
    const receipt = acceptanceReceipt({
      capability: capabilityIds.webBilling,
      reconciliationCheck: {
        result: 'not-applicable',
        rationale: 'Incorrectly omitted.',
      },
    });
    expect(validateReceipt(receipt, { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'reconciliation-required' })]),
    );
  });

  it('accepts a complete deferred or excluded cleanup decision-only receipt', () => {
    expect(validateReceipt(decisionOnlyReceipt(), { now })).toEqual([]);
    expect(validateReceipt(decisionOnlyReceipt({ providerDecision: 'deferred' }), { now })).toEqual([]);
  });

  it('rejects decision-only receipts for any other capability', () => {
    expect(validateReceipt(decisionOnlyReceipt({ capability: capabilityIds.gemini }), { now })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'capability-stage-mismatch' }),
        expect.objectContaining({ kind: 'invalid-decision-capability' }),
      ]),
    );
  });

  it('rejects cleanup decisions that imply provider use or omit reconsideration', () => {
    const findings = validateReceipt(decisionOnlyReceipt({
      noProviderAccountCredentialOrData: 'unconfirmed',
      reconsideration: undefined,
    }), { now });
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'provider-use-not-excluded' }),
      expect.objectContaining({ kind: 'missing-field', field: 'reconsideration' }),
    ]));
  });

  it('accepts a permanently excluded cleanup decision', () => {
    expect(validateReceipt(decisionOnlyReceipt({
      reconsideration: {
        kind: 'permanent-for-release',
        statement: 'Excluded for the first release unless a new approved gate decision replaces it.',
      },
    }), { now })).toEqual([]);
  });

  it('rejects unknown fields and secret-like or personal evidence values without echoing them', () => {
    const secret = 'sk-' + 'x'.repeat(30);
    const receipt = accessReceipt({
      apiKey: secret,
      evidenceReference: 'owner@private-company.test',
    });
    const findings = validateReceipt(receipt, { now });
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'unexpected-field' }),
      expect.objectContaining({ kind: 'sensitive-value' }),
      expect.objectContaining({ kind: 'personal-data' }),
    ]));
    expect(JSON.stringify(findings)).not.toContain(secret);
    expect(JSON.stringify(findings)).not.toContain('apiKey');
    expect(JSON.stringify(findings)).not.toContain('owner@private-company.test');
  });

  it.each([
    'sk_live_' + 'a'.repeat(24),
    'rk_live_' + 'b'.repeat(24),
    'whsec_' + 'c'.repeat(24),
    'sb_secret_' + 'd'.repeat(24),
  ])('rejects covered provider credential format without echoing it: %s', (secret) => {
    const findings = validateReceipt(accessReceipt({ rationale: secret }), { now });
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'unexpected-field' }),
      expect.objectContaining({ kind: 'sensitive-value' }),
    ]));
    expect(JSON.stringify(findings)).not.toContain(secret);
  });

  it('constrains evidence references to opaque safe identifiers', () => {
    expect(validateReceipt(accessReceipt({
      evidenceReference: 'arbitrary free text with sk_live_' + 'q'.repeat(24),
    }), { now })).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'invalid-reference', field: 'evidenceReference' }),
      expect.objectContaining({ kind: 'sensitive-value' }),
    ]));
  });

  it('rejects malformed or future verification timestamps', () => {
    expect(validateReceipt(accessReceipt({ verifiedAt: 'not-a-date' }), { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'invalid-date', field: 'verifiedAt' })]),
    );
    expect(validateReceipt(accessReceipt({ verifiedAt: '2026-10-17T12:00:00.000Z' }), { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'future-evidence', field: 'verifiedAt' })]),
    );
  });

  it('requires exact ISO-8601 timestamps rather than locale-dependent dates', () => {
    expect(validateReceipt(accessReceipt({ verifiedAt: '10/16/2026 10:00' }), { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'invalid-date', field: 'verifiedAt' })]),
    );
    expect(validateReceipt(accessReceipt({ verifiedAt: '2026-02-31T10:00:00.000Z' }), { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'invalid-date', field: 'verifiedAt' })]),
    );
  });

  it('rejects wrong or blank types for required references and plans', () => {
    const findings = validateReceipt(accessReceipt({
      accountOwnerReference: [],
      reviewerReference: '   ',
      revocationPlan: 42,
      verifiedAt: 123,
    }), { now });
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'invalid-field', field: 'accountOwnerReference' }),
      expect.objectContaining({ kind: 'invalid-field', field: 'reviewerReference' }),
      expect.objectContaining({ kind: 'invalid-field', field: 'revocationPlan' }),
      expect.objectContaining({ kind: 'invalid-date', field: 'verifiedAt' }),
    ]));
  });

  it('rejects wrong acceptance and decision text types', () => {
    expect(validateReceipt(acceptanceReceipt({
      accessReceiptReference: {},
      commitSha: 123,
    }), { now })).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'invalid-field', field: 'accessReceiptReference' }),
      expect.objectContaining({ kind: 'invalid-commit', field: 'commitSha' }),
    ]));
    expect(validateReceipt(decisionOnlyReceipt({
      releaseScope: [],
      rationale: '   ',
    }), { now })).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'invalid-field', field: 'releaseScope' }),
      expect.objectContaining({ kind: 'invalid-field', field: 'rationale' }),
    ]));
  });

  it('rejects unexpected fields inside checks and reconciliation objects', () => {
    const accessFindings = validateReceipt(accessReceipt({
      accessChecks: [{ name: 'terms', result: 'passed', note: 'ambiguous free text' }],
    }), { now });
    const acceptanceFindings = validateReceipt(acceptanceReceipt({
      reconciliationCheck: {
        result: 'not-applicable',
        rationale: 'This capability does not mutate credits.',
        assertion: 'unreviewed extension',
      },
    }), { now });

    expect(accessFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'unexpected-field', field: 'accessChecks[0].unexpected[1]' }),
    ]));
    expect(acceptanceFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'unexpected-field', field: 'reconciliationCheck.unexpected[1]' }),
    ]));
  });

  it('rejects unexpected fields inside decision reconsideration objects', () => {
    const findings = validateReceipt(decisionOnlyReceipt({
      reconsideration: {
        kind: 'date',
        reviewAt: '2027-01-16T11:00:00.000Z',
        statement: 'Conflicts with date reconsideration.',
      },
    }), { now });
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'unexpected-field', field: 'reconsideration.unexpected[1]' }),
    ]));
  });

  it('rejects unsupported schema, environment, stage, commit, and reconciliation forms', () => {
    expect(validateReceipt(accessReceipt({ schemaVersion: 2, environment: 'local' }), { now })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'unsupported-schema' }),
        expect.objectContaining({ kind: 'invalid-environment' }),
      ]),
    );
    expect(validateReceipt({ stage: 'draft' }, { now })).toEqual([
      expect.objectContaining({ kind: 'invalid-stage' }),
    ]);
    expect(validateReceipt(acceptanceReceipt({
      commitSha: 'working-tree',
      reconciliationCheck: { result: 'failed' },
    }), { now })).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'invalid-commit' }),
      expect.objectContaining({ kind: 'failed-check', field: 'reconciliationCheck' }),
    ]));
  });

  it('rejects invalid decision values and expired or malformed reconsideration', () => {
    expect(validateReceipt(decisionOnlyReceipt({
      providerDecision: 'required',
      reconsideration: { kind: 'date', reviewAt: '2026-10-15T11:00:00.000Z' },
    }), { now })).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'invalid-provider-decision' }),
      expect.objectContaining({ kind: 'expired-evidence', field: 'reconsideration.reviewAt' }),
    ]));
    expect(validateReceipt(decisionOnlyReceipt({
      reconsideration: { kind: 'later' },
    }), { now })).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'invalid-reconsideration' }),
    ]));
  });

  it('rejects chronologically impossible approvals and reconsideration', () => {
    expect(validateReceipt(accessReceipt({
      verifiedAt: '2026-10-16T11:30:00.000Z',
      decisionAt: '2026-10-16T11:00:00.000Z',
    }), { now })).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'invalid-chronology', field: 'decisionAt' }),
    ]));
    expect(validateReceipt(decisionOnlyReceipt({
      decidedAt: '2027-01-16T11:00:00.000Z',
      reconsideration: { kind: 'date', reviewAt: '2026-12-16T11:00:00.000Z' },
    }), { now: new Date('2026-10-16T12:00:00.000Z') })).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'invalid-chronology', field: 'reconsideration.reviewAt' }),
    ]));
  });

  it('validates JSON files without exposing their content', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fitly-gate-receipt-'));
    const validPath = join(directory, 'valid.json');
    const malformedPath = join(directory, 'malformed.json');
    writeFileSync(validPath, JSON.stringify(accessReceipt()));
    writeFileSync(malformedPath, '{not-json');

    expect(validateFile(validPath, { now })).toEqual([]);
    expect(validateFile(malformedPath, { now })).toEqual([
      expect.objectContaining({ kind: 'unreadable-or-invalid-json' }),
    ]);
  });

  it('rejects receipt files and symlinks inside the repository', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fitly-gate-symlink-'));
    const symlinkPath = join(directory, 'outside-link.json');
    const repositoryFile = join(__dirname, '..', '..', 'package.json');
    symlinkSync(repositoryFile, symlinkPath);

    expect(validateFile(repositoryFile, { now })).toEqual([
      expect.objectContaining({ kind: 'private-file-required' }),
    ]);
    expect(validateFile(symlinkPath, { now })).toEqual([
      expect.objectContaining({ kind: 'private-file-required' }),
    ]);
  });

  it('uses stable CLI exit codes and never echoes secret-like receipt values', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fitly-gate-cli-'));
    const validPath = join(directory, 'owner@example.test.json');
    const invalidPath = join(directory, 'private-owner-phone-555-555-1212.json');
    const secret = 'sk-' + 'z'.repeat(30);
    const currentTime = Date.now();
    const cliDates = {
      verifiedAt: new Date(currentTime - 120_000).toISOString(),
      decisionAt: new Date(currentTime - 60_000).toISOString(),
      nextReviewAt: new Date(currentTime + 86_400_000).toISOString(),
    };
    writeFileSync(validPath, JSON.stringify(accessReceipt(cliDates)));
    writeFileSync(invalidPath, JSON.stringify(accessReceipt({ ...cliDates, apiKey: secret })));
    const scriptPath = join(__dirname, '..', 'check-gate-readiness-receipt.js');

    const usage = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });
    const requirements = spawnSync(process.execPath, [scriptPath, '--requirements'], { encoding: 'utf8' });
    const valid = spawnSync(process.execPath, [scriptPath, validPath], { encoding: 'utf8' });
    const invalid = spawnSync(process.execPath, [scriptPath, invalidPath], { encoding: 'utf8' });

    expect(usage.status).toBe(2);
    expect(usage.stderr).toContain('Usage:');
    expect(requirements.status).toBe(0);
    expect(JSON.parse(requirements.stdout)[capabilityIds.gemini].access).toContain(
      'authenticated-model-connectivity',
    );
    expect(valid.status).toBe(0);
    expect(valid.stdout).toContain('receipt[1]: receipt structure valid; external evidence not verified.');
    expect(valid.stdout).not.toContain('owner@example.test.json');
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('receipt[1]: receipt.field[');
    expect(invalid.stderr).toContain('[sensitive-value]');
    expect(invalid.stderr).not.toContain('private-owner-phone-555-555-1212.json');
    expect(invalid.stderr).not.toContain(secret);
  });

  it('does not echo adversarial unknown JSON keys in CLI output', () => {
    const directory = mkdtempSync(join(tmpdir(), 'fitly-gate-keys-'));
    const invalidPath = join(directory, 'invalid.json');
    const adversarialKeys = [
      'owner@example.test',
      '555-555-1212',
      'sk_live_' + 'x'.repeat(24),
      '/Users/private-owner/receipt',
      'line\nbreak',
      '\u001b[31mred',
    ];
    const currentTime = Date.now();
    const receipt = accessReceipt({
      verifiedAt: new Date(currentTime - 120_000).toISOString(),
      decisionAt: new Date(currentTime - 60_000).toISOString(),
      nextReviewAt: new Date(currentTime + 86_400_000).toISOString(),
    });
    adversarialKeys.forEach((key) => { receipt[key] = 'unexpected'; });
    writeFileSync(invalidPath, JSON.stringify(receipt));

    const scriptPath = join(__dirname, '..', 'check-gate-readiness-receipt.js');
    const result = spawnSync(process.execPath, [scriptPath, invalidPath], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('receipt.unexpected[1] [unexpected-field]');
    adversarialKeys.forEach((key) => expect(result.stderr).not.toContain(key));
    expect(result.stderr).not.toContain('\u001b');
  });
});
