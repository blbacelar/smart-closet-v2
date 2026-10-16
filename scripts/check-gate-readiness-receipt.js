const { readFileSync } = require('node:fs');
const { basename, resolve } = require('node:path');

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
const billingCapabilities = new Set([
  capabilityIds.webBilling,
  capabilityIds.storeKit,
  capabilityIds.playBilling,
]);

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
  /\bAIza[A-Za-z0-9_-]{16,}\b/,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
];
const personalValuePatterns = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:\+?1[\s.-]*)?\(?[2-9]\d{2}\)?[\s.-]+\d{3}[\s.-]+\d{4}\b/,
  /(?:^|[='"`\s])\/(?:Users|home)\/[^/\s]+\//,
  /https?:\/\/[^\s'"`]+\/storage\/v1\/object\/(?:authenticated|sign)\//i,
];

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

function rejectUnexpectedFields(receipt, allowedFields, findings) {
  for (const field of Object.keys(receipt)) {
    if (!allowedFields.has(field)) {
      findings.push(finding('unexpected-field', field));
    }
  }
}

function walkValues(value, field, visit) {
  if (typeof value === 'string') {
    visit(value, field);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => walkValues(item, field, visit));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, nested]) => walkValues(nested, key, visit));
  }
}

function checkSensitiveValues(receipt, findings) {
  for (const [field, value] of Object.entries(receipt)) {
    if (forbiddenFieldPattern.test(field)) {
      findings.push(finding('sensitive-value', field));
    }
    walkValues(value, field, (text, nestedField) => {
      if (secretValuePatterns.some((pattern) => pattern.test(text))) {
        findings.push(finding('sensitive-value', nestedField));
      }
      if (personalValuePatterns.some((pattern) => pattern.test(text))) {
        findings.push(finding('personal-data', nestedField));
      }
    });
  }
}

function parseDate(value, field, findings) {
  if (!isNonEmptyString(value)) return null;
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
}

function checkFutureDate(receipt, field, now, findings) {
  const timestamp = parseDate(receipt[field], field, findings);
  if (timestamp !== null && timestamp <= now.getTime()) {
    findings.push(finding('expired-evidence', field));
  }
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

function checkList(receipt, field, findings) {
  const checks = receipt[field];
  if (!Array.isArray(checks) || checks.length === 0) {
    findings.push(finding('missing-checks', field));
    return;
  }
  checks.forEach((check, index) => {
    if (!check || !isNonEmptyString(check.name) || check.result !== 'passed') {
      findings.push(finding('failed-check', `${field}[${index}]`));
    }
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
  checkApproval(receipt, findings);
  checkPastDate(receipt, 'verifiedAt', now, findings);
  checkPastDate(receipt, 'decisionAt', now, findings);
  checkFutureDate(receipt, 'nextReviewAt', now, findings);
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
  checkList(receipt, 'accessChecks', findings);
  checkPassed(receipt, 'termsFundingEntitlement', findings);
  checkPassed(receipt, 'secretBoundary', findings);
  checkPassed(receipt, 'minimumConnectivity', findings);
}

function validateAcceptance(receipt, now, findings) {
  rejectUnexpectedFields(receipt, acceptanceFields, findings);
  validateCommon(receipt, now, findings);
  requireFields(receipt, [
    'accessReceiptReference',
    'commitSha',
    'acceptanceChecks',
    'endToEndChecks',
    'disableRollbackCheck',
    'reconciliationCheck',
  ], findings);
  if (isNonEmptyString(receipt.commitSha) && !/^[a-f0-9]{7,40}$/i.test(receipt.commitSha)) {
    findings.push(finding('invalid-commit', 'commitSha'));
  }
  checkList(receipt, 'acceptanceChecks', findings);
  checkList(receipt, 'endToEndChecks', findings);
  checkPassed(receipt, 'disableRollbackCheck', findings);
  const reconciliationResult = receipt.reconciliationCheck?.result;
  if (billingCapabilities.has(receipt.capability) && reconciliationResult !== 'passed') {
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
  checkApproval(receipt, findings);
  checkPastDate(receipt, 'decidedAt', now, findings);

  const reconsideration = receipt.reconsideration;
  if (reconsideration?.kind === 'date') {
    const timestamp = parseDate(reconsideration.reviewAt, 'reconsideration.reviewAt', findings);
    if (timestamp !== null && timestamp <= now.getTime()) {
      findings.push(finding('expired-evidence', 'reconsideration.reviewAt'));
    }
  } else if (reconsideration?.kind === 'permanent-for-release') {
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
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(resolve(filePath), 'utf8'));
  } catch {
    return [finding('unreadable-or-invalid-json')];
  }
  return validateReceipt(receipt, options);
}

if (require.main === module) {
  const filePaths = process.argv.slice(2);
  if (filePaths.length === 0) {
    process.stderr.write('Usage: node scripts/check-gate-readiness-receipt.js <receipt.json> [...receipt.json]\n');
    process.exitCode = 2;
  } else {
    let hasFindings = false;
    filePaths.forEach((filePath) => {
      const findings = validateFile(filePath);
      if (findings.length === 0) {
        process.stdout.write(`${basename(filePath)}: receipt verified.\n`);
        return;
      }
      hasFindings = true;
      findings.forEach(({ kind, field = 'receipt' }) => {
        process.stderr.write(`${basename(filePath)}: ${field} [${kind}]\n`);
      });
    });
    if (hasFindings) process.exitCode = 1;
  }
}

module.exports = { capabilityIds, validateFile, validateReceipt };
