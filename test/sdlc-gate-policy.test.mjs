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
  assert.equal(policy.externalAgentApps.installAutomatically, false);
  assert.equal(policy.externalAgentApps.mayBeSoleReleaseEvidence, false);
  assert.equal(policy.externalAgentApps.requiresHumanApprovalForInstallOrNewSpend, true);
  assert.deepEqual(policy.requiredCommands, ['git diff --check', 'npm run test']);
  assert.equal(policy.policyIntegrity.candidatePolicyAuthoritative, false);
  assert.equal(policy.policyIntegrity.trustedPolicySource, 'accepted-base');
  assert.equal(policy.policyIntegrity.candidateMayWeakenBase, false);
  assert.equal(policy.policyIntegrity.policyChangesRequireIndependentReview, true);
  assert.equal(policy.policyIntegrity.policyChangesRequireHumanGate, true);
});
