const {
  capabilityIds,
  validateReceipt,
} = require('../check-gate-readiness-receipt');

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
      { name: 'provider ownership and terms', result: 'passed' },
      { name: 'budget and data-processing boundary', result: 'passed' },
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
      { name: 'representative provider flow', result: 'passed' },
    ],
    endToEndChecks: [
      { name: 'provider failure recovery', result: 'passed' },
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
    const failed = accessReceipt({ accessChecks: [{ name: 'terms', result: 'failed' }] });
    const empty = accessReceipt({ accessChecks: [] });
    expect(validateReceipt(failed, { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'failed-check' })]),
    );
    expect(validateReceipt(empty, { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'missing-checks' })]),
    );
  });

  it('rejects acceptance-only fields on an access-ready receipt', () => {
    expect(validateReceipt(accessReceipt({ commitSha: 'a'.repeat(40) }), { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'unexpected-field', field: 'commitSha' })]),
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
      expect.arrayContaining([expect.objectContaining({ kind: 'invalid-decision-capability' })]),
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
      expect.objectContaining({ kind: 'unexpected-field', field: 'apiKey' }),
      expect.objectContaining({ kind: 'sensitive-value', field: 'apiKey' }),
      expect.objectContaining({ kind: 'personal-data', field: 'evidenceReference' }),
    ]));
    expect(JSON.stringify(findings)).not.toContain(secret);
  });

  it('rejects malformed or future verification timestamps', () => {
    expect(validateReceipt(accessReceipt({ verifiedAt: 'not-a-date' }), { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'invalid-date', field: 'verifiedAt' })]),
    );
    expect(validateReceipt(accessReceipt({ verifiedAt: '2026-10-17T12:00:00.000Z' }), { now })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'future-evidence', field: 'verifiedAt' })]),
    );
  });
});
