const { readFileSync, realpathSync } = require('node:fs');
const { isAbsolute, relative, resolve, sep } = require('node:path');

const capabilityIds = Object.freeze({
  appleStore: 'apple-developer-app-store-connect',
  googlePlay: 'google-play-console',
  supabaseStaging: 'hosted-supabase-staging',
  supabaseProduction: 'hosted-supabase-production',
  easPush: 'eas-apns-fcm-expo-push',
  gemini: 'funded-direct-gemini-staging',
  imageCleanup: 'optional-image-cleanup-provider',
  smtp: 'production-smtp',
  crash: 'approved-crash-error-provider',
  oauth: 'apple-google-oauth',
  webBilling: 'web-billing-provider',
  storeKit: 'storekit-billing',
  playBilling: 'google-play-billing',
});

const knownCapabilities = new Set(Object.values(capabilityIds));
const capabilityRequirements = Object.freeze({
  [capabilityIds.appleStore]: {
    stages: ['access-ready', 'acceptance-ready'],
    environments: ['production'],
    access: ['ownership-terms', 'least-privilege-operator', 'app-identifier-signing-boundary', 'authenticated-provider-access'],
    acceptance: ['reproducible-signed-internal-build', 'physical-device-install-and-exercise', 'role-signing-review'],
    endToEnd: ['distribution-halt-exercise', 'operator-signing-revocation-exercise'],
    buildRequired: true,
    reconciliation: 'not-applicable-allowed',
  },
  [capabilityIds.googlePlay]: {
    stages: ['access-ready', 'acceptance-ready'],
    environments: ['production'],
    access: ['ownership-terms', 'least-privilege-operator', 'package-signing-boundary', 'internal-track-entitlement', 'authenticated-provider-access'],
    acceptance: ['reproducible-signed-internal-build', 'internal-track-install-and-exercise', 'role-signing-review'],
    endToEnd: ['track-halt-exercise', 'operator-signing-revocation-exercise'],
    buildRequired: true,
    reconciliation: 'not-applicable-allowed',
  },
  [capabilityIds.supabaseStaging]: {
    stages: ['access-ready', 'acceptance-ready'],
    environments: ['staging'],
    access: ['project-ownership-isolation', 'least-privilege-secret-boundary', 'approved-seed-boundary', 'authenticated-health-connectivity'],
    acceptance: ['migrations-functions-auth-storage', 'seed-isolation-smoke-tests', 'backup-isolated-restore', 'forward-fix-exercise'],
    endToEnd: ['revoke-access-secrets', 'disable-affected-functions', 'rls-preserving-recovery'],
    buildRequired: false,
    reconciliation: 'not-applicable-allowed',
  },
  [capabilityIds.supabaseProduction]: {
    stages: ['access-ready', 'acceptance-ready'],
    environments: ['production'],
    access: ['production-project-ownership-terms', 'least-privilege-secret-boundary', 'backup-entitlement', 'authenticated-health-connectivity'],
    acceptance: ['production-config-deployment', 'backup-schedule-isolated-restore', 'client-schema-compatibility-window', 'forward-fix-drill'],
    endToEnd: ['revoke-scoped-access', 'disable-affected-features', 'isolated-restore-forward-fix'],
    buildRequired: false,
    reconciliation: 'not-applicable-allowed',
  },
  [capabilityIds.easPush]: {
    stages: ['access-ready', 'acceptance-ready'],
    environments: ['staging', 'production'],
    access: ['eas-project-ownership', 'scoped-automation-role', 'apns-fcm-credential-boundary', 'authenticated-push-connectivity'],
    acceptance: ['reproducible-physical-builds', 'credential-rotation-revocation', 'push-ticket-receipt-reconciliation'],
    endToEnd: ['ios-push-lifecycle', 'android-push-lifecycle', 'push-disable-and-rollout-halt'],
    buildRequired: true,
    reconciliation: 'required',
  },
  [capabilityIds.gemini]: {
    stages: ['access-ready', 'acceptance-ready'],
    environments: ['staging'],
    access: ['funding-terms-budget', 'data-processing-secret-boundary', 'non-personal-fixture-policy', 'authenticated-model-connectivity'],
    acceptance: ['moderation-tagging-color-tryon', 'latency-cost-privacy-observation'],
    endToEnd: ['provider-failure-circuit-breaker', 'budget-circuit-breaker', 'disable-provider-enqueue'],
    buildRequired: false,
    reconciliation: 'not-applicable-allowed',
  },
  [capabilityIds.imageCleanup]: {
    stages: ['access-ready', 'acceptance-ready', 'decision-only'],
    environments: ['staging', 'production'],
    access: ['product-privacy-provider-approval', 'funding-deletion-contract', 'credential-boundary', 'authenticated-cleanup-connectivity'],
    acceptance: ['representative-cleanup-original-preservation', 'cost-timeout-deletion'],
    endToEnd: ['provider-failure-behavior', 'disable-provider-preserve-original'],
    buildRequired: false,
    reconciliation: 'not-applicable-allowed',
  },
  [capabilityIds.smtp]: {
    stages: ['access-ready', 'acceptance-ready'],
    environments: ['production'],
    access: ['provider-domain-ownership-terms', 'least-privilege-credential-boundary', 'authenticated-controlled-inbox'],
    acceptance: ['spf-dkim-dmarc', 'reviewed-templates-confirmation', 'delivery-bounce-recovery'],
    endToEnd: ['provider-failure-behavior', 'disable-rotate-credential-preserve-access'],
    buildRequired: false,
    reconciliation: 'not-applicable-allowed',
  },
  [capabilityIds.crash]: {
    stages: ['access-ready', 'acceptance-ready'],
    environments: ['staging', 'production'],
    access: ['product-privacy-provider-approval', 'project-ownership-terms', 'retention-secret-boundary', 'authenticated-project-connectivity'],
    acceptance: ['allowlist-deployed', 'synthetic-redacted-event-alert', 'retention-deletion-export'],
    endToEnd: ['provider-outage-behavior', 'disable-adapter-startup-safe'],
    buildRequired: false,
    reconciliation: 'not-applicable-allowed',
  },
  [capabilityIds.oauth]: {
    stages: ['access-ready', 'acceptance-ready'],
    environments: ['staging', 'production'],
    access: ['provider-client-ownership-terms', 'redirect-uri-registration', 'secret-boundary-consent-plan', 'provider-configuration-access'],
    acceptance: ['physical-sign-in-link-redirect', 'revoke-collision-fallback-email', 'strong-reauthentication'],
    endToEnd: ['provider-credential-revocation', 'email-login-preservation'],
    buildRequired: true,
    reconciliation: 'not-applicable-allowed',
  },
  [capabilityIds.webBilling]: {
    stages: ['access-ready', 'acceptance-ready'],
    environments: ['sandbox', 'production'],
    access: ['account-ownership-terms', 'environment-product-tax-setup', 'api-webhook-secret-boundary', 'authenticated-provider-connectivity'],
    acceptance: ['signed-webhook-idempotency', 'purchase-renew-cancel', 'refund-revoke-duplicate', 'disclosures-mobile-restore'],
    endToEnd: ['sales-renewal-stop', 'webhook-reconciliation-history', 'refund-wind-down'],
    buildRequired: false,
    reconciliation: 'required',
  },
  [capabilityIds.storeKit]: {
    stages: ['access-ready', 'acceptance-ready'],
    environments: ['sandbox', 'production'],
    access: ['app-store-agreements-ownership', 'sandbox-product-tax-banking', 'notification-configuration-access', 'credential-boundary-authenticated-access'],
    acceptance: ['notification-idempotency', 'purchase-restore-renew', 'cancel-refund-revoke', 'disclosures-reconciliation'],
    endToEnd: ['sales-renewal-stop', 'notification-reconciliation-history', 'refund-wind-down'],
    buildRequired: true,
    reconciliation: 'required',
  },
  [capabilityIds.playBilling]: {
    stages: ['access-ready', 'acceptance-ready'],
    environments: ['sandbox', 'production'],
    access: ['play-agreements-ownership', 'sandbox-product-merchant-tax', 'rtdn-configuration-access', 'credential-boundary-authenticated-access'],
    acceptance: ['rtdn-idempotency', 'purchase-restore-renew', 'cancel-refund-revoke', 'disclosures-reconciliation'],
    endToEnd: ['sales-renewal-stop', 'notification-reconciliation-history', 'refund-wind-down'],
    buildRequired: true,
    reconciliation: 'required',
  },
});

const commonFields = new Set([
  'schemaVersion',
  'capability',
  'stage',
  'environment',
  'accountOwnerReference',
  'authorizedApproverReference',
  'operatorRole',
  'evidenceReference',
  'verifiedAt',
  'reviewerReference',
  'openFindings',
  'approvalDecision',
  'decisionAt',
  'nextReviewAt',
]);

const accessFields = new Set([
  ...commonFields,
  'accessChecks',
  'termsFundingEntitlement',
  'secretBoundary',
  'minimumConnectivity',
  'revocationPlan',
]);

const acceptanceFields = new Set([
  ...commonFields,
  'accessReceiptReference',
  'commitSha',
  'buildIdentifier',
  'acceptanceChecks',
  'endToEndChecks',
  'disableRollbackCheck',
  'reconciliationCheck',
]);

const decisionFields = new Set([
  'schemaVersion',
  'capability',
  'stage',
  'releaseScope',
  'providerDecision',
  'decisionOwnerReference',
  'authorizedApproverReference',
  'rationale',
  'privacyProductApproval',
  'noProviderAccountCredentialOrData',
  'reconsideration',
  'evidenceReference',
  'decidedAt',
  'reviewerReference',
  'openFindings',
  'approvalDecision',
]);

const forbiddenFieldPattern = /(?:api[_-]?key|password|private[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|service[_-]?role|certificate|credential)$/i;
const secretValuePatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(?:sk|sb_secret)-[A-Za-z0-9_-]{16,}\b/,
  /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_-]{8,}\b/,
  /\b(?:whsec|sb_secret)_[A-Za-z0-9_-]{8,}\b/,
  /\bAIza[A-Za-z0-9_-]{16,}\b/,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
];
const personalValuePatterns = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:\+?1[\s.-]*)?\(?[2-9]\d{2}\)?[\s.-]+\d{3}[\s.-]+\d{4}\b/,
  /(?:^|[='"`\s])\/(?:Users|home)\/[^/\s]+\//,
  /https?:\/\/[^\s'"`]+\/storage\/v1\/object\/(?:authenticated|sign)\//i,
];
const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const safeReferencePattern = /^[a-z][a-z0-9-]{1,63}:[A-Za-z0-9][A-Za-z0-9._/-]{0,191}$/;
const repositoryRoot = realpathSync(resolve(__dirname, '..'));

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function finding(kind, field) {
  return field ? { kind, field } : { kind };
}

function requireFields(receipt, fields, findings) {
  for (const field of fields) {
    if (receipt[field] === undefined || receipt[field] === null || receipt[field] === '') {
      findings.push(finding('missing-field', field));
    }
  }
}

function checkNonEmptyStrings(receipt, fields, findings) {
  for (const field of fields) {
    if (receipt[field] !== undefined && !isNonEmptyString(receipt[field])) {
      findings.push(finding('invalid-field', field));
    }
  }
}

function checkReferences(receipt, fields, findings) {
  for (const field of fields) {
    if (receipt[field] !== undefined
      && (!isNonEmptyString(receipt[field]) || !safeReferencePattern.test(receipt[field]))) {
      findings.push(finding('invalid-reference', field));
    }
  }
}

function rejectUnexpectedFields(receipt, allowedFields, findings) {
  let unexpectedIndex = 0;
  for (const field of Object.keys(receipt)) {
    if (!allowedFields.has(field)) {
      unexpectedIndex += 1;
      findings.push(finding('unexpected-field', `receipt.unexpected[${unexpectedIndex}]`));
    }
  }
}

function rejectUnexpectedObjectFields(value, allowedFields, path, findings) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  let unexpectedIndex = 0;
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      unexpectedIndex += 1;
      findings.push(finding('unexpected-field', `${path}.unexpected[${unexpectedIndex}]`));
    }
  }
}

function walkValues(value, path, visit) {
  if (typeof value === 'string') {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkValues(item, `${path}.item[${index}]`, visit));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, nested], index) => {
      visit(key, `${path}.key[${index}]`);
      walkValues(nested, `${path}.value[${index}]`, visit);
    });
  }
}

function checkSensitiveValues(receipt, findings) {
  Object.entries(receipt).forEach(([field, value], index) => {
    const opaqueField = `receipt.field[${index + 1}]`;
    if (forbiddenFieldPattern.test(field)) {
      findings.push(finding('sensitive-value', opaqueField));
    }
    walkValues(value, `receipt.value[${index + 1}]`, (text, opaquePath) => {
      if (secretValuePatterns.some((pattern) => pattern.test(text))) {
        findings.push(finding('sensitive-value', opaquePath));
      }
      if (personalValuePatterns.some((pattern) => pattern.test(text))) {
        findings.push(finding('personal-data', opaquePath));
      }
    });
    walkValues(field, opaqueField, (text, opaquePath) => {
      if (secretValuePatterns.some((pattern) => pattern.test(text))) {
        findings.push(finding('sensitive-value', opaquePath));
      }
      if (personalValuePatterns.some((pattern) => pattern.test(text))) {
        findings.push(finding('personal-data', opaquePath));
      }
    });
  });
}

function parseDate(value, field, findings) {
  if (value === undefined || value === null || value === '') return null;
  if (!isNonEmptyString(value) || !iso8601Pattern.test(value)) {
    findings.push(finding('invalid-date', field));
    return null;
  }
  const [, yearText, monthText, dayText] = value.match(/^(\d{4})-(\d{2})-(\d{2})/) || [];
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const daysInMonth = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;
  if (day < 1 || day > daysInMonth) {
    findings.push(finding('invalid-date', field));
    return null;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    findings.push(finding('invalid-date', field));
    return null;
  }
  return timestamp;
}

function checkPastDate(receipt, field, now, findings) {
  const timestamp = parseDate(receipt[field], field, findings);
  if (timestamp !== null && timestamp > now.getTime()) {
    findings.push(finding('future-evidence', field));
  }
  return timestamp;
}

function checkFutureDate(receipt, field, now, findings) {
  const timestamp = parseDate(receipt[field], field, findings);
  if (timestamp !== null && timestamp <= now.getTime()) {
    findings.push(finding('expired-evidence', field));
  }
  return timestamp;
}

function checkApproval(receipt, findings) {
  if (!Array.isArray(receipt.openFindings) || receipt.openFindings.length > 0) {
    findings.push(finding('open-findings', 'openFindings'));
  }
  if (receipt.approvalDecision !== 'approved') {
    findings.push(finding('not-approved', 'approvalDecision'));
  }
}

function checkPassed(receipt, field, findings) {
  if (receipt[field] !== 'passed') {
    findings.push(finding('failed-check', field));
  }
}

function checkList(receipt, field, expectedIds, findings) {
  const checks = receipt[field];
  if (!Array.isArray(checks) || checks.length === 0) {
    findings.push(finding('missing-checks', field));
    return;
  }
  const expected = new Set(expectedIds || []);
  const counts = new Map();
  checks.forEach((check, index) => {
    rejectUnexpectedObjectFields(
      check,
      new Set(['name', 'result']),
      `${field}[${index}]`,
      findings,
    );
    if (!check || !isNonEmptyString(check.name) || check.result !== 'passed') {
      findings.push(finding('failed-check', `${field}[${index}]`));
    }
    if (isNonEmptyString(check?.name)) {
      if (!expected.has(check.name)) {
        findings.push(finding('unknown-check-id', `${field}[${index}]`));
      } else {
        counts.set(check.name, (counts.get(check.name) || 0) + 1);
      }
    }
  });
  expected.forEach((id) => {
    const count = counts.get(id) || 0;
    if (count === 0) findings.push(finding('missing-check-id', `${field}.${id}`));
    if (count > 1) findings.push(finding('duplicate-check-id', `${field}.${id}`));
  });
}

function validateCommon(receipt, now, findings) {
  requireFields(receipt, [
    'schemaVersion',
    'capability',
    'stage',
    'environment',
    'accountOwnerReference',
    'authorizedApproverReference',
    'operatorRole',
    'evidenceReference',
    'verifiedAt',
    'reviewerReference',
    'openFindings',
    'approvalDecision',
    'decisionAt',
    'nextReviewAt',
  ], findings);
  if (receipt.schemaVersion !== 1) findings.push(finding('unsupported-schema', 'schemaVersion'));
  if (!knownCapabilities.has(receipt.capability)) findings.push(finding('unknown-capability', 'capability'));
  if (!['staging', 'sandbox', 'production'].includes(receipt.environment)) {
    findings.push(finding('invalid-environment', 'environment'));
  }
  const requirements = capabilityRequirements[receipt.capability];
  if (requirements && !requirements.environments.includes(receipt.environment)) {
    findings.push(finding('capability-environment-mismatch', 'environment'));
  }
  checkNonEmptyStrings(receipt, [
    'accountOwnerReference',
    'authorizedApproverReference',
    'operatorRole',
    'evidenceReference',
    'reviewerReference',
  ], findings);
  checkReferences(receipt, [
    'accountOwnerReference',
    'authorizedApproverReference',
    'evidenceReference',
    'reviewerReference',
  ], findings);
  checkApproval(receipt, findings);
  const verifiedAt = checkPastDate(receipt, 'verifiedAt', now, findings);
  const decisionAt = checkPastDate(receipt, 'decisionAt', now, findings);
  const nextReviewAt = checkFutureDate(receipt, 'nextReviewAt', now, findings);
  if (verifiedAt !== null && decisionAt !== null && verifiedAt > decisionAt) {
    findings.push(finding('invalid-chronology', 'decisionAt'));
  }
  if (decisionAt !== null && nextReviewAt !== null && decisionAt >= nextReviewAt) {
    findings.push(finding('invalid-chronology', 'nextReviewAt'));
  }
}

function validateAccess(receipt, now, findings) {
  rejectUnexpectedFields(receipt, accessFields, findings);
  validateCommon(receipt, now, findings);
  requireFields(receipt, [
    'accessChecks',
    'termsFundingEntitlement',
    'secretBoundary',
    'minimumConnectivity',
    'revocationPlan',
  ], findings);
  checkNonEmptyStrings(receipt, ['revocationPlan'], findings);
  checkList(receipt, 'accessChecks', capabilityRequirements[receipt.capability]?.access, findings);
  checkPassed(receipt, 'termsFundingEntitlement', findings);
  checkPassed(receipt, 'secretBoundary', findings);
  checkPassed(receipt, 'minimumConnectivity', findings);
}

function validateAcceptance(receipt, now, findings) {
  rejectUnexpectedFields(receipt, acceptanceFields, findings);
  validateCommon(receipt, now, findings);
  const requirements = capabilityRequirements[receipt.capability];
  const requiredFields = [
    'accessReceiptReference',
    'commitSha',
    'acceptanceChecks',
    'endToEndChecks',
    'disableRollbackCheck',
    'reconciliationCheck',
  ];
  if (requirements?.buildRequired) requiredFields.push('buildIdentifier');
  requireFields(receipt, requiredFields, findings);
  checkNonEmptyStrings(receipt, ['accessReceiptReference'], findings);
  checkReferences(receipt, ['accessReceiptReference'], findings);
  if (receipt.buildIdentifier !== undefined) {
    checkNonEmptyStrings(receipt, ['buildIdentifier'], findings);
  }
  if (!isNonEmptyString(receipt.commitSha) || !/^[a-f0-9]{7,40}$/i.test(receipt.commitSha)) {
    findings.push(finding('invalid-commit', 'commitSha'));
  }
  checkList(receipt, 'acceptanceChecks', requirements?.acceptance, findings);
  checkList(receipt, 'endToEndChecks', requirements?.endToEnd, findings);
  checkPassed(receipt, 'disableRollbackCheck', findings);
  rejectUnexpectedObjectFields(
    receipt.reconciliationCheck,
    new Set(['result', 'rationale']),
    'reconciliationCheck',
    findings,
  );
  const reconciliationResult = receipt.reconciliationCheck?.result;
  if (requirements?.reconciliation === 'required' && reconciliationResult !== 'passed') {
    findings.push(finding('reconciliation-required', 'reconciliationCheck'));
  } else if (!['passed', 'not-applicable'].includes(reconciliationResult)) {
    findings.push(finding('failed-check', 'reconciliationCheck'));
  }
  if (reconciliationResult === 'not-applicable'
    && !isNonEmptyString(receipt.reconciliationCheck?.rationale)) {
    findings.push(finding('missing-field', 'reconciliationCheck.rationale'));
  }
}

function validateDecisionOnly(receipt, now, findings) {
  rejectUnexpectedFields(receipt, decisionFields, findings);
  requireFields(receipt, [
    'schemaVersion',
    'capability',
    'stage',
    'releaseScope',
    'providerDecision',
    'decisionOwnerReference',
    'authorizedApproverReference',
    'rationale',
    'privacyProductApproval',
    'noProviderAccountCredentialOrData',
    'reconsideration',
    'evidenceReference',
    'decidedAt',
    'reviewerReference',
    'openFindings',
    'approvalDecision',
  ], findings);
  if (receipt.schemaVersion !== 1) findings.push(finding('unsupported-schema', 'schemaVersion'));
  if (receipt.capability !== capabilityIds.imageCleanup) {
    findings.push(finding('invalid-decision-capability', 'capability'));
  }
  if (!['deferred', 'excluded'].includes(receipt.providerDecision)) {
    findings.push(finding('invalid-provider-decision', 'providerDecision'));
  }
  if (receipt.privacyProductApproval !== 'passed') {
    findings.push(finding('failed-check', 'privacyProductApproval'));
  }
  if (receipt.noProviderAccountCredentialOrData !== 'confirmed') {
    findings.push(finding('provider-use-not-excluded', 'noProviderAccountCredentialOrData'));
  }
  checkNonEmptyStrings(receipt, [
    'releaseScope',
    'decisionOwnerReference',
    'authorizedApproverReference',
    'rationale',
    'evidenceReference',
    'reviewerReference',
  ], findings);
  checkReferences(receipt, [
    'decisionOwnerReference',
    'authorizedApproverReference',
    'evidenceReference',
    'reviewerReference',
  ], findings);
  checkApproval(receipt, findings);
  const decidedAt = checkPastDate(receipt, 'decidedAt', now, findings);

  const reconsideration = receipt.reconsideration;
  if (reconsideration?.kind === 'date') {
    rejectUnexpectedObjectFields(
      reconsideration,
      new Set(['kind', 'reviewAt']),
      'reconsideration',
      findings,
    );
    const timestamp = parseDate(reconsideration.reviewAt, 'reconsideration.reviewAt', findings);
    if (timestamp !== null && timestamp <= now.getTime()) {
      findings.push(finding('expired-evidence', 'reconsideration.reviewAt'));
    }
    if (decidedAt !== null && timestamp !== null && decidedAt >= timestamp) {
      findings.push(finding('invalid-chronology', 'reconsideration.reviewAt'));
    }
  } else if (reconsideration?.kind === 'permanent-for-release') {
    rejectUnexpectedObjectFields(
      reconsideration,
      new Set(['kind', 'statement']),
      'reconsideration',
      findings,
    );
    if (!isNonEmptyString(reconsideration.statement)) {
      findings.push(finding('missing-field', 'reconsideration.statement'));
    }
  } else if (reconsideration !== undefined) {
    findings.push(finding('invalid-reconsideration', 'reconsideration'));
  }
}

function validateReceipt(receipt, options = {}) {
  const findings = [];
  const now = options.now instanceof Date ? options.now : new Date();

  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return [finding('invalid-receipt')];
  }

  checkSensitiveValues(receipt, findings);
  const requirements = capabilityRequirements[receipt.capability];
  if (requirements && !requirements.stages.includes(receipt.stage)) {
    findings.push(finding('capability-stage-mismatch', 'stage'));
  }
  if (receipt.stage === 'access-ready') {
    validateAccess(receipt, now, findings);
  } else if (receipt.stage === 'acceptance-ready') {
    validateAcceptance(receipt, now, findings);
  } else if (receipt.stage === 'decision-only') {
    validateDecisionOnly(receipt, now, findings);
  } else {
    findings.push(finding('invalid-stage', 'stage'));
  }

  return findings;
}

function validateFile(filePath, options) {
  const lexicalPath = resolve(filePath);
  if (isPathWithin(repositoryRoot, lexicalPath)) {
    return [finding('private-file-required')];
  }
  let receipt;
  try {
    const resolvedPath = realpathSync(lexicalPath);
    if (isPathWithin(repositoryRoot, resolvedPath)) {
      return [finding('private-file-required')];
    }
    receipt = JSON.parse(readFileSync(resolvedPath, 'utf8'));
  } catch {
    return [finding('unreadable-or-invalid-json')];
  }
  return validateReceipt(receipt, options);
}

function isPathWithin(parentPath, candidatePath) {
  const pathFromParent = relative(parentPath, candidatePath);
  return pathFromParent === ''
    || (!isAbsolute(pathFromParent)
      && pathFromParent !== '..'
      && !pathFromParent.startsWith(`..${sep}`));
}

if (require.main === module) {
  const filePaths = process.argv.slice(2);
  if (filePaths.length === 1 && filePaths[0] === '--requirements') {
    process.stdout.write(`${JSON.stringify(capabilityRequirements, null, 2)}\n`);
  } else if (filePaths.length === 0) {
    process.stderr.write('Usage: node scripts/check-gate-readiness-receipt.js <receipt.json> [...receipt.json]\n');
    process.exitCode = 2;
  } else {
    let hasFindings = false;
    filePaths.forEach((filePath, index) => {
      const receiptLabel = `receipt[${index + 1}]`;
      const findings = validateFile(filePath);
      if (findings.length === 0) {
        process.stdout.write(`${receiptLabel}: receipt structure valid; external evidence not verified.\n`);
        return;
      }
      hasFindings = true;
      findings.forEach(({ kind, field = 'receipt' }) => {
        process.stderr.write(`${receiptLabel}: ${field} [${kind}]\n`);
      });
    });
    if (hasFindings) process.exitCode = 1;
  }
}

module.exports = {
  capabilityIds,
  capabilityRequirements,
  validateFile,
  validateReceipt,
};
