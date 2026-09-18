import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const policy = JSON.parse(fs.readFileSync(new URL('../.steerion/sdlc-gate.json', import.meta.url), 'utf8'));

test('SDLC gate policy preserves BAR hard security floor', () => {
  assert.equal(policy.authority.automaticMerge, false);
  assert.equal(policy.authority.automaticDeploy, false);
  assert.equal(policy.authority.productiveActions, false);
  assert.equal(policy.authority.externalCommunication, false);
  assert.equal(policy.authority.externalSpend, false);
  assert.equal(policy.authority.humanGateRequired, true);
  assert.equal(policy.requiredEvidence.exactHeadRequired, true);
  assert.equal(policy.requiredEvidence.existingCiMustPass, true);
  assert.equal(policy.requiredEvidence.independentReviewRequired, true);
  assert.equal(policy.requiredEvidence.changedFilesRequired, true);
  assert.equal(policy.requiredEvidence.useAgentSystemChecksWhenPresent, true);
  assert.equal(policy.independentReview.controllerVerifiedAttestationRequired, true);
  assert.equal(policy.independentReview.failClosedIfMissingOrUnverifiable, true);
  assert.equal(policy.independentReview.exactCandidateBindingRequired, true);
  assert.equal(policy.independentReview.distinctReviewerIdentityRequired, true);
  assert.equal(policy.independentReview.separateWorkspaceRequired, true);
  assert.equal(policy.independentReview.readOnlyReviewerRequired, true);
  assert.equal(policy.independentReview.credentialSeparationRequired, true);
  assert.equal(policy.independentReview.additionalTrustSeparationRequired, true);
  assert.deepEqual(policy.independentReview.allowedAdditionalSeparationFactors, ['provider', 'model', 'operator', 'trust-domain']);
  assert.deepEqual(policy.independentReview.requiredAttestationFields, [
    'candidate_sha', 'tree_hash', 'builder_identity', 'reviewer_identity',
    'reviewer_workspace', 'reviewer_read_only', 'builder_credential_domain',
    'reviewer_credential_domain', 'separation_factor', 'separation_factor_value'
  ]);
  assert.equal(policy.externalAgentApps.installAutomatically, false);
  assert.equal(policy.externalAgentApps.mayBeSoleReleaseEvidence, false);
  assert.equal(policy.externalAgentApps.requiresHumanApprovalForInstallOrNewSpend, true);
  assert.deepEqual(policy.requiredCommands, ['git diff --check', 'npm run test']);
  assert.equal(policy.policyIntegrity.candidatePolicyAuthoritative, false);
  assert.equal(policy.policyIntegrity.trustedPolicySource, 'accepted-base');
  assert.equal(policy.policyIntegrity.candidateMayWeakenBase, false);
  assert.equal(policy.policyIntegrity.policyChangesRequireIndependentReview, true);
  assert.equal(policy.policyIntegrity.policyChangesRequireHumanGate, true);
  assert.deepEqual(policy.policyIntegrity.bootstrapTrustFloor, ['AGENTS.md', 'SECURITY.md']);
  assert.deepEqual(policy.rules, [
    'Authority, credential isolation, fencing, recovery and fail-closed behavior are release-blocking.',
    'Agent verdicts never replace deterministic adversarial evidence.',
    'No automatic merge or productive deployment.'
  ]);
});
