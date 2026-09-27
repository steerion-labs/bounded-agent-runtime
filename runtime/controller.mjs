import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  STATE_FILE, CORE_DIR, BUILDER_DIR, REVIEWER_DIR, VERIFICATION_DIR, ensureRuntimeDir, assertProtectedRootConfigured,
  loadState, saveState, journal, transition, newLease, assertCurrentLease, assertCurrentFence, acquireControllerLock, releaseControllerLock, cleanupControllerHooks, claimControllerLease, sha256,
  validateTask, authorize, assertWorkerExecutionBoundary, assertVerificationExecutionBoundary, spendBudget, remainingWallClockMs, workerTimeoutMs, evidence, verifyEvidence, verifyStateEvidence,
  ensureGitRepo, seedLocalGitWorkspace, cloneReviewerWorkspace, cloneCandidateWorkspace, commitWorkspace, assertWorkspaceIdentity, assertWorkspaceScope, changedWorkspacePaths, gitExec, captureGitControlState, assertGitControlState,
  createGateChallenge, createHumanApproval, assertHumanApproval, approvalExpiresAt, signAuthorizationReceipt, authorizationReceiptPublicKey, recoverState,
  readJson, resetDemoRuntime, REVIEW_RESUME_MAX_ATTEMPTS, assertWorkspaceTreeSafe
} from './core.mjs';
import { assertAdapterName, resolveAdapter } from './adapters/registry.mjs';

const command = process.argv[2], arg = process.argv[3];
const fail = message => { console.error(message); process.exitCode = 1; };
const adapterPath = name => path.resolve(import.meta.dirname, 'adapters', name);
function workerEnv(role) {
  const env = {};
  for (const key of ['PATH','Path','PATHEXT','SystemRoot','SYSTEMROOT','WINDIR','ComSpec','COMSPEC','TEMP','TMP','TMPDIR']) if (process.env[key]) env[key] = process.env[key];
  if (process.env.BOUNDED_AGENT_LOCAL_PROFILE_MODE === 'inherit') {
    for (const key of ['HOME','USERPROFILE','LOCALAPPDATA','APPDATA']) if (process.env[key]) env[key] = process.env[key];
    return env;
  }
  const profile = path.join(CORE_DIR, 'worker-profiles', role);
  const localAppData = path.join(profile, 'AppData', 'Local');
  const appData = path.join(profile, 'AppData', 'Roaming');
  for (const dir of [profile, localAppData, appData]) fs.mkdirSync(dir, { recursive: true });
  return { ...env, HOME: profile, USERPROFILE: profile, LOCALAPPDATA: localAppData, APPDATA: appData };
}
function genericConfig() {
  const executable = process.env.BOUNDED_AGENT_GENERIC_EXECUTABLE;
  if (!executable) return null;
  let args = [];
  if (process.env.BOUNDED_AGENT_GENERIC_ARGS_JSON) args = JSON.parse(process.env.BOUNDED_AGENT_GENERIC_ARGS_JSON);
  if (!Array.isArray(args)) throw new Error('GENERIC_ADAPTER_ARGS_INVALID');
  return { executable, args };
}
function workerName(state, role) {
  const name = state.task.workers?.[role]?.adapter || 'demo';
  return assertAdapterName(name, role);
}
function workerConfigHash(state, role) {
  const worker = state.task.workers?.[role] || { adapter: 'demo' };
  const runtime = worker.adapter === 'generic' ? genericConfig() : null;
  return sha256(JSON.stringify({ worker, runtime }));
}
function runAdapter(state, adapterName, role, input, label) {
  assertWorkerExecutionBoundary(adapterName, role);
  const file = resolveAdapter(adapterName, role); let lastError;
  for (let attempt = 0; attempt <= state.budget.limits.retries; attempt += 1) {
    if (attempt > 0) spendBudget(state, { retries: 1 });
    spendBudget(state, { model_calls: 1 });
    const timeout = workerTimeoutMs(state, role);
    const payload = { ...input, adapter: adapterName, role, generic: adapterName === 'generic' ? genericConfig() : null, timeout_ms: Math.max(1000, timeout - 500) };
    const result = spawnSync(process.execPath, [adapterPath(file)], { input: JSON.stringify(payload), encoding: 'utf8', timeout, env: workerEnv(role), windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    if (result.status === 0) { try { return JSON.parse(result.stdout); } catch { lastError = new Error(`${label}_INVALID_JSON`); } }
    else if (result.error?.code === 'ETIMEDOUT') lastError = new Error(`${label}_TIMEOUT`);
    else lastError = new Error(`${label}_FAILED:${(result.stderr || '').trim() || result.status}`);
  }
  throw lastError ?? new Error(`${label}_FAILED`);
}
function verificationEnv() {
  const env = {};
  for (const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','TMPDIR','ComSpec']) if (process.env[key]) env[key] = process.env[key];
  return env;
}
function runVerification(state, builderWorkspace) {
  const commands = state.task.verification?.commands ?? [];
  assertVerificationExecutionBoundary(commands.length);
  const workspace = path.join(VERIFICATION_DIR, state.task_id);
  const identity = cloneCandidateWorkspace(builderWorkspace, workspace, state.candidate_sha);
  if (identity.candidate_sha !== state.candidate_sha || identity.tree_hash !== state.tree_hash) throw new Error('VERIFICATION_WORKSPACE_BINDING_MISMATCH');
  const verificationGitControl = captureGitControlState(workspace);
  const results = [];
  for (const item of commands) {
    assertCurrentLease(state);
    const declared = Math.floor((item.timeout_seconds ?? 120) * 1000);
    const timeout = Math.min(declared, remainingWallClockMs(state));
    const payload = { workspace, command: item.command, args: item.args, timeout_ms: Math.max(1000, timeout - 500) };
    const result = spawnSync(process.execPath, [adapterPath('command-verifier.mjs')], { input: JSON.stringify(payload), encoding: 'utf8', timeout, env: verificationEnv(), windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    if (result.error?.code === 'ETIMEDOUT') throw new Error(`VERIFICATION_TIMEOUT:${item.command}`);
    if (result.status !== 0) throw new Error(`VERIFICATION_WORKER_FAILED:${String(result.stderr || '').trim().slice(0, 1000) || result.status}`);
    let observed; try { observed = JSON.parse(result.stdout); } catch { throw new Error('VERIFICATION_WORKER_INVALID_JSON'); }
    results.push(observed);
    if (observed.status !== 0) throw new Error(`VERIFICATION_FAILED:${item.command}:${observed.status}`);
  }
  assertGitControlState(workspace, verificationGitControl);
  assertWorkspaceIdentity(state, workspace);
  return { workspace, commands_declared: commands.length, results };
}

function initialState(task, approverIdentity) {
  return { schema_version: 1, task_id: task.task_id, state: 'NEW', state_version: 0,
    started_at: new Date().toISOString(), task, lease: newLease(task.task_id),
    budget: { limits: task.budget, used: { model_calls: 0, retries: 0 } }, evidence: [],
    candidate_sha: null, tree_hash: null, workspace_path: null, gate_challenge: null,
    human_approval: null, approver_identity: approverIdentity, base_sha: null, base_tree_hash: null, reviewer_workspace_path: null };
}
function init(file) {
  if (!file) throw new Error('TASK_FILE_REQUIRED');
  const mode = assertProtectedRootConfigured();
  if (fs.existsSync(STATE_FILE)) throw new Error('RUNTIME_ALREADY_INITIALIZED');
  const task = validateTask(readJson(file));
  if (task.workers) { assertAdapterName(task.workers.builder.adapter, 'builder'); assertAdapterName(task.workers.reviewer.adapter, 'reviewer'); }
  const approverIdentity = process.env.BOUNDED_AGENT_APPROVER_IDENTITY || (mode === 'DEMO_MODE' ? 'demo-approver' : null);
  if (!approverIdentity) throw new Error('APPROVER_IDENTITY_REQUIRED');
  ensureRuntimeDir(); const receiptKey=authorizationReceiptPublicKey(); const state = initialState(task, approverIdentity); saveState(state);
  journal('RUNTIME_INITIALIZED', { task_id: state.task_id, mode, authorization_receipt_key_fingerprint:receiptKey.fingerprint });
  console.log(`INITIALIZED ${state.task_id}`);
}
function run() {
  const state = loadState();
  recoverState(state);
  validateTask(state.task);
  if (state.state === 'HUMAN_GATE') { console.log('HUMAN_GATE_REQUIRED'); return; }
  if (state.state !== 'NEW') throw new Error(`SAFE_RESUME_REQUIRED:${state.state}`);
  claimControllerLease(state); assertCurrentLease(state); remainingWallClockMs(state);

  transition(state, 'CLASSIFIED');
  transition(state, 'CONTEXT_READY');
  if (authorize(state.task, 'build_local') !== 'ALLOW') throw new Error('BUILD_NOT_AUTHORIZED');
  transition(state, 'AUTHORIZED');
  transition(state, 'BUILDING');

  const workspace = path.join(BUILDER_DIR, state.task_id);
  if (state.task.source) {
    const seeded = seedLocalGitWorkspace(state.task.source, workspace);
    state.base_sha = seeded.base_sha; state.base_tree_hash = seeded.base_tree_hash;
  } else {
    fs.rmSync(workspace, { recursive: true, force: true }); ensureGitRepo(workspace);
  }
  state.workspace_path = workspace; saveState(state);
  const builderGitControl = captureGitControlState(workspace);
  const builderAdapter = workerName(state, 'builder');
  const builder = runAdapter(state, builderAdapter, 'builder', { task: state.task, workspace }, 'BUILDER');
  if (builder.status !== 'PASS') throw new Error('BUILDER_REPORTED_FAILURE');
  assertGitControlState(workspace, builderGitControl);
  const identity = commitWorkspace(workspace, state.task, 'bounded agent candidate', Math.min(remainingWallClockMs(state), 10000));
  state.candidate_sha = identity.candidate_sha; state.tree_hash = identity.tree_hash; saveState(state);
  if (state.base_sha && gitExec(workspace, ['rev-parse','HEAD^']) !== state.base_sha) throw new Error('BASE_PARENT_DRIFT');
  assertWorkspaceScope(state.task, workspace, state.base_sha); assertWorkspaceIdentity(state, workspace);
  const buildEvidence = evidence('builder_candidate', { ...identity, base_sha: state.base_sha, base_tree_hash: state.base_tree_hash, worker_adapter: builderAdapter, worker_config_hash: workerConfigHash(state, 'builder'), artifact: builder.artifact }, state, 'controller', 'CONTROLLER_VERIFIED');
  verifyEvidence(buildEvidence, state); transition(state, 'TESTING', buildEvidence);

  assertWorkspaceIdentity(state, workspace);
  const verification = runVerification(state, workspace);
  const verificationEvidence = evidence('controller_verification', { candidate_sha: state.candidate_sha, tree_hash: state.tree_hash, commands_declared: verification.commands_declared, results: verification.results }, state, 'controller', 'CONTROLLER_VERIFIED');
  verifyEvidence(verificationEvidence, state); transition(state, 'HANDOFF_VALIDATION', verificationEvidence);
  transition(state, 'REVIEWING');
  reviewCandidate(state, workspace, identity);
  console.log('HUMAN_GATE_REQUIRED'); console.log(JSON.stringify(state.gate_challenge, null, 2));
}
// Independent review of the exact bound candidate, from REVIEWING up to the Human Gate.
// Shared by `run` and `review-resume` so both produce the same review evidence.
function reviewCandidate(state, workspace, identity, extraEvidence = {}) {
  if (state.state !== 'REVIEWING') throw new Error(`REVIEW_STATE_INVALID:${state.state}`);
  const candidate = { task_id: state.task_id, candidate_sha: state.candidate_sha, tree_hash: state.tree_hash };
  const reviewerWorkspace = path.join(REVIEWER_DIR, state.task_id);
  if (path.resolve(reviewerWorkspace) === path.resolve(workspace)) throw new Error('REVIEWER_WORKSPACE_NOT_SEPARATE');
  const reviewerIdentity = cloneReviewerWorkspace(workspace, reviewerWorkspace, state.candidate_sha);
  if (reviewerIdentity.candidate_sha !== state.candidate_sha || reviewerIdentity.tree_hash !== state.tree_hash) throw new Error('REVIEWER_WORKSPACE_BINDING_MISMATCH');
  const reviewerGitControl = captureGitControlState(reviewerWorkspace);
  state.reviewer_workspace_path = reviewerWorkspace; saveState(state);
  const rawDiff = state.base_sha ? gitExec(workspace, ['diff','--no-ext-diff','--no-renames',`${state.base_sha}..${state.candidate_sha}`], { trim: false }) : gitExec(workspace, ['show','--format=','--no-ext-diff','--no-renames',state.candidate_sha], { trim: false });
  const reviewDiffTruncated = rawDiff.length > 100000; const reviewDiff = rawDiff.slice(0, 100000);
  const reviewerAdapter = workerName(state, 'reviewer');
  if (reviewDiffTruncated) throw new Error('REVIEW_DIFF_TOO_LARGE_FOR_SINGLE_REVIEW');
  const review = runAdapter(state, reviewerAdapter, 'reviewer', { task: state.task, workspace: reviewerWorkspace, candidate, review_diff: reviewDiff, review_diff_truncated: reviewDiffTruncated }, 'REVIEWER');
  assertGitControlState(reviewerWorkspace, reviewerGitControl);
  if (changedWorkspacePaths(reviewerWorkspace).length) throw new Error('REVIEWER_MUTATED_WORKSPACE');
  assertWorkspaceIdentity(state, reviewerWorkspace); assertCurrentLease(state); assertWorkspaceIdentity(state, workspace);
  if (review.decision !== 'APPROVE') throw new Error(`REVIEW_BLOCKED:${review.reason ?? 'unknown'}`);
  if (review.reviewed_candidate_sha !== state.candidate_sha || review.reviewed_tree_hash !== state.tree_hash) throw new Error('REVIEW_BINDING_MISMATCH');
  const reviewEvidence = evidence('review_observation', { ...review, ...identity, worker_adapter: reviewerAdapter, worker_config_hash: workerConfigHash(state, 'reviewer'), separate_workspace: true, ...extraEvidence }, state, `reviewer:${reviewerAdapter}`, 'CONTROLLER_OBSERVED');
  verifyEvidence(reviewEvidence, state); transition(state, 'REVIEW_READY', reviewEvidence);
  assertWorkspaceIdentity(state, workspace);
  transition(state, 'HUMAN_GATE');
  state.gate_challenge = createGateChallenge(state); saveState(state);
  journal('HUMAN_GATE_CHALLENGE', { task_id: state.task_id, state_version: state.state_version, nonce_hash: state.gate_challenge.nonce ? 'PRESENT' : 'MISSING' });
  return state;
}

// Review-only resume (issue #81): after a Reviewer outage, review the already built and
// controller-verified candidate later WITHOUT running the Builder again. The caller must
// restate the exact binding (candidate, tree, source HEAD, state version); every mismatch,
// replay, missing evidence or drifted workspace fails closed. It advances at most to the
// existing Human Gate and never performs a protected action.
const RESUME_FLAGS = Object.freeze({ '--candidate': 'candidate_sha', '--tree': 'tree_hash', '--source-head': 'source_head', '--state-version': 'state_version' });
const SHA40 = /^[a-f0-9]{40}$/;
function parseReviewResumeRequest(args) {
  const request = {}; const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--json') { if (seen.has(flag)) throw new Error('REVIEW_RESUME_ARGUMENT_DUPLICATE:--json'); seen.add(flag); continue; }
    if (!Object.hasOwn(RESUME_FLAGS, flag)) throw new Error(`REVIEW_RESUME_ARGUMENT_FORBIDDEN:${String(flag).slice(0, 40)}`);
    if (seen.has(flag)) throw new Error(`REVIEW_RESUME_ARGUMENT_DUPLICATE:${flag}`);
    const value = args[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`REVIEW_RESUME_ARGUMENT_VALUE_REQUIRED:${flag}`);
    seen.add(flag); request[RESUME_FLAGS[flag]] = value; index += 1;
  }
  for (const flag of Object.keys(RESUME_FLAGS)) if (!seen.has(flag)) throw new Error(`REVIEW_RESUME_ARGUMENT_REQUIRED:${flag}`);
  if (!SHA40.test(request.candidate_sha)) throw new Error('REVIEW_RESUME_REQUEST_MALFORMED:candidate_sha');
  if (!SHA40.test(request.tree_hash)) throw new Error('REVIEW_RESUME_REQUEST_MALFORMED:tree_hash');
  if (request.source_head !== 'none' && !SHA40.test(request.source_head)) throw new Error('REVIEW_RESUME_REQUEST_MALFORMED:source_head');
  if (!/^(0|[1-9][0-9]{0,15})$/.test(request.state_version)) throw new Error('REVIEW_RESUME_REQUEST_MALFORMED:state_version');
  request.state_version = Number(request.state_version);
  return request;
}
function resumeBuilderWorkspace(state) {
  // The runtime root may be relocated as a whole (for example parked in a review queue).
  // Only the canonical builder workspace of this task under the current root is accepted;
  // its identity is then proven from Git plus HMAC-bound evidence, never from the path.
  const canonical = path.join(BUILDER_DIR, state.task_id);
  const recorded = String(state.workspace_path ?? '');
  if (path.resolve(recorded) !== path.resolve(canonical)) {
    if (path.basename(recorded) !== state.task_id || path.basename(path.dirname(recorded)) !== path.basename(BUILDER_DIR)) throw new Error('REVIEW_RESUME_WORKSPACE_INVALID');
    journal('REVIEW_RESUME_RUNTIME_RELOCATED', { task_id: state.task_id, from_hash: sha256(path.resolve(recorded)), to: canonical });
    state.workspace_path = canonical; saveState(state);
  }
  if (!fs.existsSync(canonical)) throw new Error('REVIEW_RESUME_CANDIDATE_MISSING');
  return canonical;
}
function reviewResume(args) {
  const request = parseReviewResumeRequest(args);
  const state = loadState(); recoverState(state); validateTask(state.task);
  if (state.state !== 'REVIEWING') throw new Error(`REVIEW_RESUME_STATE_INVALID:${state.state}`);
  if (state.evidence.some(item => item.claim === 'review_observation') || state.gate_challenge || state.human_approval) throw new Error('REVIEW_RESUME_REPLAY');
  if (request.state_version !== state.state_version) throw new Error('REVIEW_RESUME_BINDING_MISMATCH:state_version');
  if (request.candidate_sha !== state.candidate_sha) throw new Error('REVIEW_RESUME_BINDING_MISMATCH:candidate_sha');
  if (request.tree_hash !== state.tree_hash) throw new Error('REVIEW_RESUME_BINDING_MISMATCH:tree_hash');
  if (request.source_head !== (state.base_sha ?? 'none')) throw new Error('REVIEW_RESUME_BINDING_MISMATCH:source_head');
  verifyStateEvidence(state);
  for (const claim of ['builder_candidate','controller_verification']) {
    const proofs = state.evidence.filter(item => item.claim === claim);
    if (proofs.length !== 1 || proofs[0].producer_identity !== 'controller' || proofs[0].trust_class !== 'CONTROLLER_VERIFIED') throw new Error(`REVIEW_RESUME_EVIDENCE_INVALID:${claim}`);
  }
  const workspace = resumeBuilderWorkspace(state);
  assertWorkspaceIdentity(state, workspace);
  if (state.base_sha && gitExec(workspace, ['rev-parse','HEAD^']) !== state.base_sha) throw new Error('BASE_PARENT_DRIFT');
  assertWorkspaceTreeSafe(workspace); assertWorkspaceScope(state.task, workspace, state.base_sha);
  const attempts = (state.review_resume?.attempts ?? 0) + 1;
  if (attempts > REVIEW_RESUME_MAX_ATTEMPTS) throw new Error('REVIEW_RESUME_ATTEMPTS_EXHAUSTED');
  // A new controller lease generation fences out any older controller of this task.
  claimControllerLease(state);
  state.review_resume = { schema_version: 'bar.review-resume.v1', attempts, active: true, started_at: new Date().toISOString(), used: { model_calls: 0, retries: 0 } };
  saveState(state);
  journal('REVIEW_RESUME_STARTED', { task_id: state.task_id, attempt: attempts, candidate_sha: state.candidate_sha, tree_hash: state.tree_hash, source_head: state.base_sha ?? null, state_version: state.state_version, lease_generation: state.lease.generation });
  assertCurrentLease(state); remainingWallClockMs(state);
  try {
    reviewCandidate(state, workspace, { candidate_sha: state.candidate_sha, tree_hash: state.tree_hash }, { review_resume_attempt: attempts });
  } catch (error) {
    // A failed attempt closes its window; the next attempt needs a new request and window.
    // On success the window stays in force, exactly like the run window for the normal path.
    state.review_resume = { ...state.review_resume, active: false }; saveState(state);
    throw error;
  }
  journal('REVIEW_RESUME_COMPLETED', { task_id: state.task_id, attempt: attempts, state_version: state.state_version });
  return { state, attempts };
}
function reviewResumeCommand(args) {
  const { state, attempts } = reviewResume(args);
  const result = { schema_version: 'bar.review-resume-result.v1', status: 'HUMAN_GATE_REQUIRED', task_id: state.task_id, candidate_sha: state.candidate_sha, tree_hash: state.tree_hash, source_head: state.base_sha ?? null, state_version: state.state_version, lease_generation: state.lease.generation, attempt: attempts, builder_invoked: false, protected_effects_attempted: false, gate_challenge: state.gate_challenge };
  if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else { console.log('HUMAN_GATE_REQUIRED'); console.log(JSON.stringify(state.gate_challenge, null, 2)); }
}
const REVIEWER_OUTAGE = /^(REVIEWER_(TIMEOUT|FAILED|INVALID_JSON)|[A-Z_]+_REVIEWER_(TIMEOUT|FAILED))/;
function reviewResumeFailure(message) {
  const reason = String(message).split(':')[0];
  if (['CONTROLLER_LOCKED','CONTROLLER_LOCK_ACQUIRE_FAILED','CONTROLLER_LOCK_TAKEOVER_FAILED'].includes(reason)) return { status: 'UNAVAILABLE', retryable: true, exit: 3, reason };
  if (REVIEWER_OUTAGE.test(String(message))) return { status: 'REVIEWER_UNAVAILABLE', retryable: true, exit: 3, reason };
  if (reason === 'REVIEW_BLOCKED') return { status: 'REVIEW_BLOCKED', retryable: false, exit: 4, reason };
  return { status: 'DENIED', retryable: false, exit: 2, reason };
}
function approve(signature) {
  const state = loadState(); recoverState(state);
  if (state.workspace_path) assertWorkspaceIdentity(state, state.workspace_path);
  verifyStateEvidence(state);
  if (state.state !== 'HUMAN_GATE') throw new Error(`APPROVAL_NOT_ALLOWED_IN:${state.state}`);
  if (!signature) throw new Error('APPROVAL_SIGNATURE_REQUIRED');
  claimControllerLease(state); assertCurrentLease(state); remainingWallClockMs(state);
  const approval = createHumanApproval(state, signature);
  state.human_approval = approval; saveState(state);
  const approvalEvidence = evidence('human_approval', {
    candidate_sha: state.candidate_sha, tree_hash: state.tree_hash,
    decision_identity: approval.decision_identity, signed_payload_hash: approval.signed_payload_hash
  }, state, 'human', 'CRYPTOGRAPHICALLY_VERIFIED');
  verifyEvidence(approvalEvidence, state);
  transition(state, 'ACCEPTED', approvalEvidence);
  for (const action of state.task.protected_actions) assertHumanApproval(state, action);
  console.log('ACCEPTED_NO_REMOTE_MUTATION_EXECUTED');
}
function recover() { const state = loadState(); const result = recoverState(state); console.log(result); }
function verifyProtected(action) {
  if (!action) throw new Error('PROTECTED_ACTION_REQUIRED');
  const state = loadState(); recoverState(state); validateTask(state.task);
  if (['ACCEPTED','DONE'].includes(state.state)) assertCurrentFence(state); else assertCurrentLease(state);
  if (state.workspace_path) assertWorkspaceIdentity(state, state.workspace_path);
  verifyStateEvidence(state);
  if (authorize(state.task, action) !== 'HUMAN_GATE') throw new Error('PROTECTED_ACTION_NOT_DECLARED:' + action);
  assertHumanApproval(state, action);
  return state;
}
function buildAuthorizationReceipt(state, action) {
  const receipt = {
    schema_version:'bar.authorization-receipt.v3', receipt_id:crypto.randomUUID(), issued_at:new Date().toISOString(), expires_at:approvalExpiresAt(state),
    task_id:state.task_id, requested_action:action, approval_scope:'declared_protected_actions',
    declared_protected_actions:[...state.task.protected_actions].sort(), candidate_sha:state.candidate_sha, tree_hash:state.tree_hash,
    source_repo_path:state.task.source?.path ?? null, source_remote_url:state.task.source?.remote_url ?? null, source_ref:state.task.source?.ref ?? null, source_head_sha:state.base_sha ?? state.task.source?.ref ?? null,
    state_version:state.state_version, lease_generation:state.lease?.generation ?? null,
    decision_identity:state.human_approval.decision_identity, approved_at:state.human_approval.approved_at,
    approval_signed_payload_hash:state.human_approval.signed_payload_hash, approval_public_key_fingerprint:state.human_approval.public_key_fingerprint
  };
  return signAuthorizationReceipt(receipt);
}
function authorizeProtected(action) {
  const state = verifyProtected(action); const receipt = buildAuthorizationReceipt(state, action);
  journal('PROTECTED_ACTION_AUTHORIZED', { task_id:state.task_id, requested_action:action, receipt_id:receipt.receipt_id, candidate_sha:state.candidate_sha, tree_hash:state.tree_hash, decision_identity:state.human_approval.decision_identity, controller_key_fingerprint:receipt.controller_key_fingerprint });
  if(process.argv.includes('--json')) console.log(JSON.stringify(receipt,null,2)); else console.log('PROTECTED_ACTION_AUTHORIZED ' + action + ' RECEIPT ' + receipt.receipt_id);
}
function verifyProtectedCommand(action) {
  const state = verifyProtected(action);
  const view={schema_version:'bar.authorization-verification.v1',status:'VERIFIED',task_id:state.task_id,requested_action:action,approval_scope:'declared_protected_actions',declared_protected_actions:[...state.task.protected_actions].sort(),candidate_sha:state.candidate_sha,tree_hash:state.tree_hash,state_version:state.state_version,lease_generation:state.lease?.generation ?? null};
  if(process.argv.includes('--json')) console.log(JSON.stringify(view,null,2)); else console.log('PROTECTED_ACTION_VERIFIED ' + action);
}
function reset() { console.log(resetDemoRuntime()); }
let controllerLock = null;
try {
  if (['init','run','approve','recover','authorize-protected','review-resume'].includes(command)) controllerLock = acquireControllerLock();
  if (command === 'init') init(arg);
  else if (command === 'run') run();
  else if (command === 'approve') approve(arg);
  else if (command === 'recover') recover();
  else if (command === 'authorize-protected') authorizeProtected(arg);
  else if (command === 'verify-authorization') verifyProtectedCommand(arg);
  else if (command === 'reset') reset();
  else if (command === 'review-resume') reviewResumeCommand(process.argv.slice(3));
  else throw new Error('USAGE:init <task.json> | run | approve <signature> | authorize-protected <action> [--json] | verify-authorization <action> [--json] | review-resume --candidate <sha> --tree <sha> --source-head <sha|none> --state-version <n> [--json] | recover | reset');
} catch (error) {
  const message=error instanceof Error ? error.message : String(error);
  if (command === 'review-resume') {
    const outcome = reviewResumeFailure(message);
    if (process.argv.includes('--json')) console.log(JSON.stringify({ schema_version: 'bar.review-resume-result.v1', status: outcome.status, retryable: outcome.retryable, reason_code: outcome.reason, builder_invoked: false, protected_effects_attempted: false, message: String(message).slice(0, 2000) }, null, 2));
    else console.error(message);
    process.exitCode = outcome.exit;
  } else if (['authorize-protected','verify-authorization'].includes(command) && process.argv.includes('--json')) {
    const reason=String(message).split(':')[0]; const unavailable=['CONTROLLER_LOCKED','CONTROLLER_LOCK_ACQUIRE_FAILED','CONTROLLER_LOCK_TAKEOVER_FAILED'].includes(reason);
    console.log(JSON.stringify({schema_version:unavailable?'bar.authorization-unavailable.v1':'bar.authorization-denial.v1',status:unavailable?'UNAVAILABLE':'DENIED',retryable:unavailable,reason_code:reason,requested_action:arg ?? null,message},null,2));
    process.exitCode=unavailable?3:2;
  } else fail(message);
}
finally {
  try { cleanupControllerHooks(); } catch (error) { fail(error instanceof Error ? error.message : String(error)); }
  if (controllerLock) { try { releaseControllerLock(controllerLock); } catch (error) { fail(error instanceof Error ? error.message : String(error)); } }
}

