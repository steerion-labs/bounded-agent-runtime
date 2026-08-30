import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  STATE_FILE, BUILDER_DIR, ensureRuntimeDir, assertProtectedRootConfigured,
  loadState, saveState, journal, transition, newLease, assertCurrentLease,
  validateTask, authorize, spendBudget, remainingWallClockMs, evidence, verifyEvidence, verifyStateEvidence,
  ensureGitRepo, commitWorkspace, assertWorkspaceIdentity, assertWorkspaceScope,
  createGateChallenge, createHumanApproval, assertHumanApproval, recoverState,
  readJson, resetDemoRuntime
} from './core.mjs';

const command = process.argv[2], arg = process.argv[3];
const fail = message => { console.error(message); process.exitCode = 1; };
const adapterPath = name => path.resolve(import.meta.dirname, 'adapters', name);
function workerEnv() {
  const env = {};
  for (const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','HOME']) if (process.env[key]) env[key] = process.env[key];
  return env;
}
function runAdapter(state, file, input, label) {
  let lastError;
  for (let attempt = 0; attempt <= state.budget.limits.retries; attempt += 1) {
    if (attempt > 0) spendBudget(state, { retries: 1 });
    spendBudget(state, { model_calls: 1 });
    const timeout = Math.min(remainingWallClockMs(state), 30000);
    const result = spawnSync(process.execPath, [adapterPath(file)], {
      input: JSON.stringify(input), encoding: 'utf8', timeout, env: workerEnv(), windowsHide: true
    });
    if (result.status === 0) {
      try { return JSON.parse(result.stdout); }
      catch { lastError = new Error(`${label}_INVALID_JSON`); }
    } else if (result.error?.code === 'ETIMEDOUT') lastError = new Error(`${label}_TIMEOUT`);
    else lastError = new Error(`${label}_FAILED:${(result.stderr || '').trim() || result.status}`);
  }
  throw lastError ?? new Error(`${label}_FAILED`);
}
function initialState(task, approverIdentity) {
  return { schema_version: 1, task_id: task.task_id, state: 'NEW', state_version: 0,
    started_at: new Date().toISOString(), task, lease: newLease(task.task_id),
    budget: { limits: task.budget, used: { model_calls: 0, retries: 0 } }, evidence: [],
    candidate_sha: null, tree_hash: null, workspace_path: null, gate_challenge: null,
    human_approval: null, approver_identity: approverIdentity };
}
function init(file) {
  if (!file) throw new Error('TASK_FILE_REQUIRED');
  const mode = assertProtectedRootConfigured();
  if (fs.existsSync(STATE_FILE)) throw new Error('RUNTIME_ALREADY_INITIALIZED');
  const task = validateTask(readJson(file));
  const approverIdentity = process.env.BOUNDED_AGENT_APPROVER_IDENTITY || (mode === 'DEMO_MODE' ? 'demo-approver' : null);
  if (!approverIdentity) throw new Error('APPROVER_IDENTITY_REQUIRED');
  ensureRuntimeDir(); const state = initialState(task, approverIdentity); saveState(state);
  journal('RUNTIME_INITIALIZED', { task_id: state.task_id, mode });
  console.log(`INITIALIZED ${state.task_id}`);
}
function run() {
  const state = loadState();
  recoverState(state);
  assertCurrentLease(state); validateTask(state.task); remainingWallClockMs(state);
  if (state.state === 'HUMAN_GATE') { console.log('HUMAN_GATE_REQUIRED'); return; }
  if (state.state !== 'NEW') throw new Error(`SAFE_RESUME_REQUIRED:${state.state}`);

  transition(state, 'CLASSIFIED');
  transition(state, 'CONTEXT_READY');
  if (authorize(state.task, 'build_local') !== 'ALLOW') throw new Error('BUILD_NOT_AUTHORIZED');
  transition(state, 'AUTHORIZED');
  transition(state, 'BUILDING');

  const workspace = path.join(BUILDER_DIR, state.task_id);
  fs.rmSync(workspace, { recursive: true, force: true });
  ensureGitRepo(workspace);
  const builder = runAdapter(state, 'demo-builder.mjs', { task: state.task, workspace }, 'BUILDER');
  if (builder.status !== 'PASS') throw new Error('BUILDER_REPORTED_FAILURE');
  const identity = commitWorkspace(workspace, state.task, 'synthetic bounded candidate', Math.min(remainingWallClockMs(state), 10000));
  state.candidate_sha = identity.candidate_sha; state.tree_hash = identity.tree_hash; state.workspace_path = workspace; saveState(state);
  assertWorkspaceScope(state.task, workspace); assertWorkspaceIdentity(state, workspace);
  const buildEvidence = evidence('builder_candidate', { ...identity, artifact: builder.artifact }, state, 'controller', 'CONTROLLER_VERIFIED');
  verifyEvidence(buildEvidence, state); transition(state, 'TESTING', buildEvidence);

  assertWorkspaceIdentity(state, workspace); transition(state, 'HANDOFF_VALIDATION');
  transition(state, 'REVIEWING');
  const candidate = { task_id: state.task_id, candidate_sha: state.candidate_sha, tree_hash: state.tree_hash };
  const review = runAdapter(state, 'demo-reviewer.mjs', { candidate }, 'REVIEWER');
  assertCurrentLease(state); assertWorkspaceIdentity(state, workspace);
  if (review.decision !== 'APPROVE') throw new Error(`REVIEW_BLOCKED:${review.reason ?? 'unknown'}`);
  if (review.reviewed_candidate_sha !== state.candidate_sha || review.reviewed_tree_hash !== state.tree_hash) throw new Error('REVIEW_BINDING_MISMATCH');
  const reviewEvidence = evidence('independent_review', { ...review, ...identity }, state, 'reviewer', 'CONTROLLER_OBSERVED');
  verifyEvidence(reviewEvidence, state); transition(state, 'REVIEW_READY', reviewEvidence);
  assertWorkspaceIdentity(state, workspace);
  transition(state, 'HUMAN_GATE');
  state.gate_challenge = createGateChallenge(state); saveState(state);
  journal('HUMAN_GATE_CHALLENGE', { task_id: state.task_id, state_version: state.state_version, nonce_hash: state.gate_challenge.nonce ? 'PRESENT' : 'MISSING' });
  console.log('HUMAN_GATE_REQUIRED');
  console.log(JSON.stringify(state.gate_challenge, null, 2));
}
function approve(signature) {
  const state = loadState(); recoverState(state); assertCurrentLease(state); remainingWallClockMs(state);
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
  assertHumanApproval(state, 'remote_mutation');
  console.log('ACCEPTED_NO_REMOTE_MUTATION_EXECUTED');
}
function recover() { const state = loadState(); console.log(recoverState(state)); }
function authorizeProtected(action) { if (!action) throw new Error('PROTECTED_ACTION_REQUIRED'); const state = loadState(); recoverState(state); if (state.workspace_path) assertWorkspaceIdentity(state, state.workspace_path); verifyStateEvidence(state); assertHumanApproval(state, action); console.log('PROTECTED_ACTION_AUTHORIZED ' + action); }
function reset() { console.log(resetDemoRuntime()); }
try {
  if (command === 'init') init(arg);
  else if (command === 'run') run();
  else if (command === 'approve') approve(arg);
  else if (command === 'recover') recover();
  else if (command === 'authorize-protected') authorizeProtected(arg);
  else if (command === 'reset') reset();
  else throw new Error('USAGE:init <task.json> | run | approve <signature> | authorize-protected <action> | recover | reset');
} catch (error) { fail(error instanceof Error ? error.message : String(error)); }

