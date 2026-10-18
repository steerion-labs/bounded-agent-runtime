import {
  createCandidatePublicationRequest,
  validateCandidatePublicationRequest
} from '../runtime/remote/candidate-publication.mjs';

const base = 'a'.repeat(40);
const candidate = 'b'.repeat(40);
const tree = 'c'.repeat(40);
const evidence = 'd'.repeat(64);
const fence = 'e'.repeat(64);
const remoteFingerprint = 'f'.repeat(64);

function request(overrides = {}) {
  return createCandidatePublicationRequest({
    operationId: 'demo-attack',
    repository: {
      nameWithOwner: 'demo/example',
      remoteFingerprint
    },
    baseBranch: 'main',
    baseHead: base,
    candidateSha: candidate,
    treeHash: tree,
    evidenceHash: evidence,
    candidateBranch: 'bar-candidate/demo-attack-bbbbbbbb',
    providerId: 'synthetic-candidate-publisher',
    worker: {
      identity: 'worker:demo',
      role: 'publisher',
      capabilitiesHash: '1'.repeat(64)
    },
    lease: {
      generation: 1,
      fencingTokenHash: fence
    },
    ...overrides
  });
}

function blocked(label, action, expected) {
  try {
    action();
  } catch (error) {
    const message = String(error?.message || error);
    if (!expected.test(message)) {
      throw new Error(`DEMO_UNEXPECTED_DENIAL:${label}:${message}`);
    }
    console.log(`BLOCKED  ${label}`);
    console.log(`         ${message}`);
    return true;
  }
  throw new Error(`DEMO_ATTACK_NOT_BLOCKED:${label}`);
}

console.log('BAR ATTACK DEMO — deterministic authority boundary');
console.log('No credentials. No network. No real GitHub mutation.\n');

const results = [
  blocked(
    'default-branch write',
    () => request({ candidateBranch: 'main' }),
    /CANDIDATE_BRANCH_PREFIX_REQUIRED|CANDIDATE_DEFAULT_BRANCH_WRITE_FORBIDDEN/
  ),
  blocked(
    'arbitrary branch escape',
    () => request({ candidateBranch: 'feature/escape' }),
    /CANDIDATE_BRANCH_PREFIX_REQUIRED/
  ),
  blocked(
    'protected merge request',
    () => request({ actions: ['candidate_branch_create', 'merge'] }),
    /CANDIDATE_PUBLISH_ACTION_NOT_ALLOWED/
  ),
  blocked(
    'request tampering',
    () => {
      const valid = request();
      const tampered = JSON.parse(JSON.stringify(valid));
      tampered.candidateBranch = 'bar-candidate/attacker';
      validateCandidatePublicationRequest(tampered);
    },
    /CANDIDATE_PUBLISH_REQUEST_HASH_MISMATCH/
  )
];

if (!results.every(Boolean)) process.exitCode = 1;

console.log('\nRESULT   4/4 ATTACKS BLOCKED');
console.log('BAR kept protected authority outside the worker-controlled request.');
