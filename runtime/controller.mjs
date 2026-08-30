import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  STATE_FILE, BUILDER_DIR, REVIEWER_DIR, VERIFICATION_DIR, ensureRuntimeDir, assertProtectedRootConfigured,
  loadState, saveState, journal, transition, newLease, assertCurrentLease, acquireControllerLock, releaseControllerLock, claimControllerLease, sha256,
  validateTask, authorize, assertWorkerExecutionBoundary, assertVerificationExecutionBoundary, spendBudget, remainingWallClockMs, evidence, verifyEvidence, verifyStateEvidence,
  ensureGitRepo, seedLocalGitWorkspace, cloneReviewerWorkspace, cloneCandidateWorkspace, commitWorkspace, assertWorkspaceIdentity, assertWorkspaceScope, changedWorkspacePaths, gitExec,
  createGateChallenge, createHumanApproval, assertHumanApproval, recoverState,
  readJson, resetDemoRuntime
} from './core.mjs';
import { assertAdapterName, resolveAdapter } from './adapters/registry.mjs';

const command = process.argv[2], arg = process.argv[3];
const fail = message => { console.error(message); process.exitCode = 1; };
const adapterPath = name => path.resolve(import.meta.dirname, 'adapters', name);
function workerEnv() {
  const env = {};
  for (const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','HOME','USERPROFILE','LOCALAPPDATA','APPDATA']) if (process.env[key]) env[key] = process.env[key];
  return env;
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
function workerConfigHash(state, role) { return sha256(JSON.stringify(state.task.workers?.[role] || { adapter: 'demo' })); }
function runAdapter(state, adapterName, role, input, label) {
  assertWorkerExecutionBoundary(adapterName, role);
  const file = resolveAdapter(adapterName, role); let lastError;
  for (let attempt = 0; attempt <= state.budget.limits.retries; attempt += 1) {
    if (attempt > 0) spendBudget(state, { retries: 1 });
    spendBudget(state, { model_calls: 1 });
    const timeout = Math.min(remainingWallClockMs(state), 120000);
    const payload = { ...input, adapter: adapterName, role, generic: adapterName === 'generic' ? genericConfig() : null, timeout_ms: Math.max(1000, timeout - 500) };
    const result = spawnSync(process.execPath, [adapterPath(file)], { input: JSON.stringify(payload), encoding: 'utf8', timeout, env: workerEnv(), windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    if (result.status === 0) { try { return JSON.parse(result.stdout); } catch { lastError = new Error(`${label}_INVALID_JSON`); } }
    else if (result.error?.code === 'ETIMEDOUT') lastError = new Error(`${label}_TIMEOUT`);
    else lastError = new Error(`${label}_FAILED:${(result.stderr || '').trim() || result.status}`);
  }
  throw lastError ?? new Error(`${label}_FAILED`);
}
function verificationEnv() {
  const env = {};
  for (const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','ComSpec']) if (process.env[key]) env[key] = process.env[key];
  return env;
}
function runVerification(state, builderWorkspace) {
  const commands = state.task.verification?.commands ?? [];
  assertVerificationExecutionBoundary(commands.length);
  const workspace = path.join(VERIFICATION_DIR, state.task_id);
  const identity = cloneCandidateWorkspace(builderWorkspace, workspace, state.candidate_sha);
  if (identity.candidate_sha !== state.candidate_sha || identity.tree_hash !== state.tree_hash) throw new Error('VERIFICATION_WORKSPACE_BINDING_MISMATCH');
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
  ensureRuntimeDir(); const state = initialState(task, approverIdentity); saveState(state);
  journal('RUNTIME_INITIALIZED', { task_id: state.task_id, mode });
  console.log(`INITIALIZED ${state.task_id}`);
}
function run() {
  const state = loadState();
  recoverState(state);
  claimControllerLease(state); assertCurrentLease(state); validateTask(state.task); remainingWallClockMs(state);
  if (state.state === 'HUMAN_GATE') { console.log('HUMAN_GATE_REQUIRED'); return; }
  if (state.state !== 'NEW') throw new Error(`SAFE_RESUME_REQUIRED:${state.state}`);

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
  const builderAdapter = workerName(state, 'builder');
  const builder = runAdapter(state, builderAdapter, 'builder', { task: state.task, workspace }, 'BUILDER');
  if (builder.status !== 'PASS') throw new Error('BUILDER_REPORTED_FAILURE');
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
  const candidate = { task_id: state.task_id, candidate_sha: state.candidate_sha, tree_hash: state.tree_hash };
  const reviewerWorkspace = path.join(REVIEWER_DIR, state.task_id);
  const reviewerIdentity = cloneReviewerWorkspace(workspace, reviewerWorkspace, state.candidate_sha);
  if (reviewerIdentity.candidate_sha !== state.candidate_sha || reviewerIdentity.tree_hash !== state.tree_hash) throw new Error('REVIEWER_WORKSPACE_BINDING_MISMATCH');
  state.reviewer_workspace_path = reviewerWorkspace; saveState(state);
  const rawDiff = state.base_sha ? gitExec(workspace, ['diff','--no-ext-diff','--no-renames',`${state.base_sha}..${state.candidate_sha}`], { trim: false }) : gitExec(workspace, ['show','--format=','--no-ext-diff','--no-renames',state.candidate_sha], { trim: false });
  const reviewDiffTruncated = rawDiff.length > 100000; const reviewDiff = rawDiff.slice(0, 100000);
  const reviewerAdapter = workerName(state, 'reviewer');
  if (reviewerAdapter === 'ollama' && reviewDiffTruncated) throw new Error('REVIEW_DIFF_TOO_LARGE_FOR_OLLAMA');
  const review = runAdapter(state, reviewerAdapter, 'reviewer', { task: state.task, workspace: reviewerWorkspace, candidate, review_diff: reviewDiff, review_diff_truncated: reviewDiffTruncated }, 'REVIEWER');
  if (changedWorkspacePaths(reviewerWorkspace).length) throw new Error('REVIEWER_MUTATED_WORKSPACE');
  assertWorkspaceIdentity(state, reviewerWorkspace); assertCurrentLease(state); assertWorkspaceIdentity(state, workspace);
  if (review.decision !== 'APPROVE') throw new Error(`REVIEW_BLOCKED:${review.reason ?? 'unknown'}`);
  if (review.reviewed_candidate_sha !== state.candidate_sha || review.reviewed_tree_hash !== state.tree_hash) throw new Error('REVIEW_BINDING_MISMATCH');
  const reviewEvidence = evidence('review_observation', { ...review, ...identity, worker_adapter: reviewerAdapter, worker_config_hash: workerConfigHash(state, 'reviewer'), separate_workspace: true }, state, `reviewer:${reviewerAdapter}`, 'CONTROLLER_OBSERVED');
  verifyEvidence(reviewEvidence, state); transition(state, 'REVIEW_READY', reviewEvidence);
  assertWorkspaceIdentity(state, workspace);
  transition(state, 'HUMAN_GATE');
  state.gate_challenge = createGateChallenge(state); saveState(state);
  journal('HUMAN_GATE_CHALLENGE', { task_id: state.task_id, state_version: state.state_version, nonce_hash: state.gate_challenge.nonce ? 'PRESENT' : 'MISSING' });
  console.log('HUMAN_GATE_REQUIRED'); console.log(JSON.stringify(state.gate_challenge, null, 2));
}
function approve(signature) {
  const state = loadState(); recoverState(state); claimControllerLease(state); assertCurrentLease(state); remainingWallClockMs(state);
  if (state.workspace_path) assertWorkspaceIdentity(state, state.workspace_path);
  verifyStateEvidence(state);
  if (state.state !== 'HUMAN_GATE') throw new Error(`APPROVAL_NOT_ALLOWED_IN:${state.state}`);
  if (!signature) throw new Error('APPROVAL_SIGNATURE_REQUIRED');
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
function recover() { const state = loadState(); const result = recoverState(state); claimControllerLease(state); console.log(result); }
function authorizeProtected(action) { if (!action) throw new Error('PROTECTED_ACTION_REQUIRED'); const state = loadState(); recoverState(state); claimControllerLease(state); assertCurrentLease(state); if (state.workspace_path) assertWorkspaceIdentity(state, state.workspace_path); verifyStateEvidence(state); if (authorize(state.task, action) !== 'HUMAN_GATE') throw new Error('PROTECTED_ACTION_NOT_DECLARED:' + action); assertHumanApproval(state, action); console.log('PROTECTED_ACTION_AUTHORIZED ' + action); }
function reset() { console.log(resetDemoRuntime()); }
let controllerLock = null;
try {
  if (['init','run','approve','recover','authorize-protected'].includes(command)) controllerLock = acquireControllerLock();
  if (command === 'init') init(arg);
  else if (command === 'run') run();
  else if (command === 'approve') approve(arg);
  else if (command === 'recover') recover();
  else if (command === 'authorize-protected') authorizeProtected(arg);
  else if (command === 'reset') reset();
  else throw new Error('USAGE:init <task.json> | run | approve <signature> | authorize-protected <action> | recover | reset');
} catch (error) { fail(error instanceof Error ? error.message : String(error)); }
finally { if (controllerLock) { try { releaseControllerLock(controllerLock); } catch (error) { fail(error instanceof Error ? error.message : String(error)); } } }

