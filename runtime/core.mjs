import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { assertTransition } from './state-machine.mjs';

export const RUNTIME_ROOT = path.resolve(process.env.BOUNDED_AGENT_RUNTIME_ROOT || '.bounded-agent');
export const CORE_DIR = path.join(RUNTIME_ROOT, 'runtime-core');
export const STATE_DIR = path.join(RUNTIME_ROOT, 'runtime-state');
export const JOURNAL_DIR = path.join(RUNTIME_ROOT, 'journal');
export const SECRETS_DIR = path.join(RUNTIME_ROOT, 'secrets');
export const EVIDENCE_DIR = path.join(RUNTIME_ROOT, 'evidence');
export const BUILDER_DIR = path.join(RUNTIME_ROOT, 'builder-work');
export const REVIEWER_DIR = path.join(RUNTIME_ROOT, 'reviewer-work');
export const VERIFICATION_DIR = path.join(RUNTIME_ROOT, 'verification-work');
export const STATE_FILE = path.join(STATE_DIR, 'state.json');
export const JOURNAL_FILE = path.join(JOURNAL_DIR, 'journal.jsonl');
const JOURNAL_KEY_FILE = path.join(SECRETS_DIR, 'journal-hmac.key');
const JOURNAL_ANCHOR_FILE = path.join(SECRETS_DIR, 'journal-anchor.json');
const NONCE_LEDGER_FILE = path.join(SECRETS_DIR, 'human-gate-nonces.json');
const CONTROLLER_LOCK_DIR = path.join(CORE_DIR, 'controller-lock');
const CONTROLLER_LOCK_OWNER = path.join(CONTROLLER_LOCK_DIR, 'owner.json');
let SAFE_HOOKS_DIR = null;

export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const hmac256 = (key, value) => crypto.createHmac('sha256', key).update(value).digest('hex');
export function ensureRuntimeDir() {
  for (const dir of [CORE_DIR, STATE_DIR, JOURNAL_DIR, SECRETS_DIR, EVIDENCE_DIR, BUILDER_DIR, REVIEWER_DIR, VERIFICATION_DIR]) fs.mkdirSync(dir, { recursive: true });
}
export function assertProtectedRootConfigured() {
  if (process.env.BOUNDED_AGENT_PROTECTED_MODE !== '1') return 'DEMO_MODE';
  if (!process.env.BOUNDED_AGENT_RUNTIME_ROOT || !path.isAbsolute(process.env.BOUNDED_AGENT_RUNTIME_ROOT)) throw new Error('PROTECTED_RUNTIME_ROOT_REQUIRED');
  return 'PROTECTED_MODE';
}
export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}
function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error?.code === 'EPERM'; }
}
function lockOwner() {
  try { return readJson(CONTROLLER_LOCK_OWNER); } catch { return null; }
}
export function acquireControllerLock({ staleMs = 30000 } = {}) {
  fs.mkdirSync(CORE_DIR, { recursive: true });
  const token = crypto.randomUUID();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      fs.mkdirSync(CONTROLLER_LOCK_DIR);
      fs.writeFileSync(CONTROLLER_LOCK_OWNER, JSON.stringify({ pid: process.pid, token, created_at: new Date().toISOString() }) + '\n', { flag: 'wx', mode: 0o600 });
      return { pid: process.pid, token };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const owner = lockOwner(); let age = 0; try { age = Date.now() - fs.statSync(CONTROLLER_LOCK_DIR).mtimeMs; } catch {}
      if ((owner?.pid && processAlive(owner.pid)) || (!owner && age < staleMs)) throw new Error(`CONTROLLER_LOCKED:${owner?.pid ?? 'unknown'}`);
      const tomb = `${CONTROLLER_LOCK_DIR}.stale.${crypto.randomUUID()}`;
      try { fs.renameSync(CONTROLLER_LOCK_DIR, tomb); fs.rmSync(tomb, { recursive: true, force: true }); } catch { if (attempt === 3) throw new Error('CONTROLLER_LOCK_TAKEOVER_FAILED'); }
    }
  }
  throw new Error('CONTROLLER_LOCK_ACQUIRE_FAILED');
}
export function cleanupControllerHooks() {
  if (!SAFE_HOOKS_DIR) return;
  fs.rmSync(SAFE_HOOKS_DIR, { recursive: true, force: true });
  SAFE_HOOKS_DIR = null;
}
export function releaseControllerLock(lock) {
  if (!lock) return;
  const owner = lockOwner();
  if (!owner || owner.pid !== lock.pid || owner.token !== lock.token) throw new Error('CONTROLLER_LOCK_OWNERSHIP_LOST');
  fs.rmSync(CONTROLLER_LOCK_DIR, { recursive: true, force: false });
}
function writeAtomic(file, text, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const fd = fs.openSync(temp, 'wx', mode);
  try { fs.writeFileSync(fd, text, 'utf8'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
}
export function loadState() {
  if (!fs.existsSync(STATE_FILE)) throw new Error('RUNTIME_NOT_INITIALIZED');
  return readJson(STATE_FILE);
}
export function saveState(state) { writeAtomic(STATE_FILE, JSON.stringify(state, null, 2) + '\n'); }
function integrityKey() {
  ensureRuntimeDir();
  if (!fs.existsSync(JOURNAL_KEY_FILE)) writeAtomic(JOURNAL_KEY_FILE, crypto.randomBytes(32).toString('hex') + '\n');
  return Buffer.from(fs.readFileSync(JOURNAL_KEY_FILE, 'utf8').trim(), 'hex');
}
function readAnchor() {
  if (!fs.existsSync(JOURNAL_ANCHOR_FILE)) return { seq: 0, entry_hash: 'GENESIS', hmac: null };
  return readJson(JOURNAL_ANCHOR_FILE);
}
function writeAnchor(seq, entryHash, key) {
  const base = { seq, entry_hash: entryHash };
  writeAtomic(JOURNAL_ANCHOR_FILE, JSON.stringify({ ...base, hmac: hmac256(key, JSON.stringify(base)) }) + '\n');
}
function canonicalJournalEntry(entry) {
  const { hmac, entry_hash, ...base } = entry;
  return JSON.stringify(base);
}
export function verifyJournal({ repairAnchor = false } = {}) {
  const key = integrityKey();
  const raw = fs.existsSync(JOURNAL_FILE) ? fs.readFileSync(JOURNAL_FILE, 'utf8').trim() : '';
  const entries = []; let prev = 'GENESIS'; let seq = 0;
  if (raw) for (const line of raw.split(/\r?\n/)) {
    let entry; try { entry = JSON.parse(line); } catch { throw new Error('JOURNAL_PARSE_ERROR'); }
    seq += 1;
    if (entry.seq !== seq || entry.prev_hash !== prev) throw new Error('JOURNAL_CHAIN_INVALID');
    const canonical = canonicalJournalEntry(entry);
    if (hmac256(key, canonical) !== entry.hmac) throw new Error('JOURNAL_HMAC_INVALID');
    const hash = sha256(canonical + ':' + entry.hmac);
    if (entry.entry_hash !== hash) throw new Error('JOURNAL_HASH_INVALID');
    prev = hash; entries.push(entry);
  }
  const anchor = readAnchor();
  if (anchor.seq > 0) {
    const expected = { seq: anchor.seq, entry_hash: anchor.entry_hash };
    if (!anchor.hmac || hmac256(key, JSON.stringify(expected)) !== anchor.hmac) throw new Error('JOURNAL_ANCHOR_INVALID');
  }
  if (anchor.seq === entries.length && anchor.entry_hash === prev) return entries;
  const oneBehind = anchor.seq === Math.max(0, entries.length - 1) && (anchor.seq === 0 || anchor.entry_hash === entries[anchor.seq - 1]?.entry_hash);
  if (repairAnchor && oneBehind) { writeAnchor(entries.length, prev, key); return entries; }
  throw new Error('JOURNAL_ANCHOR_MISMATCH');
}
export function journal(event, details = {}) {
  ensureRuntimeDir();
  const key = integrityKey();
  const prior = verifyJournal({ repairAnchor: true });
  const prev = prior.at(-1)?.entry_hash || 'GENESIS';
  const base = { seq: prior.length + 1, at: new Date().toISOString(), event, ...details, prev_hash: prev };
  const canonical = JSON.stringify(base);
  const hmac = hmac256(key, canonical);
  const entry_hash = sha256(canonical + ':' + hmac);
  const entry = { ...base, hmac, entry_hash };
  const fd = fs.openSync(JOURNAL_FILE, 'a', 0o600);
  try { fs.writeSync(fd, JSON.stringify(entry) + '\n'); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  writeAnchor(entry.seq, entry_hash, key);
  return entry;
}
export function transition(state, to, proof = null) {
  assertTransition(state.state, to);
  const from = state.state;
  const nextVersion = state.state_version + 1;
  journal('STATE_TRANSITION', { task_id: state.task_id, from, to, state_version: nextVersion, proof });
  state.state = to; state.state_version = nextVersion;
  if (proof) state.evidence.push(proof);
  saveState(state);
  return state;
}
export function recoverState(state) {
  const entries = verifyJournal({ repairAnchor: true });
  const transitions = entries.filter(x => x.event === 'STATE_TRANSITION');
  let expectedState = 'NEW', expectedVersion = 0;
  for (const entry of transitions) {
    if (entry.from !== expectedState || entry.state_version !== expectedVersion + 1) throw new Error('RECOVERY_TRANSITION_CHAIN_INVALID');
    expectedState = entry.to; expectedVersion = entry.state_version;
  }
  if (state.state === expectedState && state.state_version === expectedVersion) return 'SAFE_RESUME';
  if (state.state_version + 1 === expectedVersion && transitions.at(-1)?.from === state.state) {
    const last = transitions.at(-1);
    state.state = last.to; state.state_version = last.state_version;
    if (last.proof) state.evidence.push(last.proof);
    saveState(state); return 'RECOVERED_FORWARD';
  }
  throw new Error('RECOVERY_STATE_JOURNAL_MISMATCH');
}
export function newLease(taskId, ttlMs = 300000, generation = Date.now()) {
  return { task_id: taskId, owner: `controller-${process.pid}`, generation,
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
    fencing_token: sha256(`${taskId}:${generation}:${crypto.randomUUID()}`) };
}
export function assertFreshLease(lease, expectedGeneration = lease?.generation) {
  if (!lease || Date.parse(lease.expires_at) <= Date.now()) throw new Error('STALE_LEASE');
  if (lease.generation !== expectedGeneration) throw new Error('FENCING_MISMATCH');
}
export function assertCurrentLease(localState) {
  assertFreshLease(localState.lease, localState.lease.generation);
  const persisted = loadState();
  if (persisted.lease.generation !== localState.lease.generation) throw new Error('STALE_CONTROLLER_GENERATION');
  if (persisted.lease.fencing_token !== localState.lease.fencing_token) throw new Error('STALE_CONTROLLER_FENCE');
}
export function claimControllerLease(state) {
  const prior = Number.isSafeInteger(state.lease?.generation) ? state.lease.generation : 0;
  const wallMs = Number.isFinite(state.budget?.limits?.wall_clock_seconds) ? state.budget.limits.wall_clock_seconds * 1000 : 0;
  state.lease = newLease(state.task_id, Math.max(300000, wallMs + 60000), prior + 1);
  saveState(state);
  journal('LEASE_ACQUIRED', { task_id: state.task_id, generation: state.lease.generation, owner: state.lease.owner, expires_at: state.lease.expires_at });
  return state.lease;
}
export function assertBudget(state, delta = {}) {
  const wall = state.budget?.limits?.wall_clock_seconds;
  if (state.started_at && Number.isFinite(wall) && Date.now() - Date.parse(state.started_at) > wall * 1000) throw new Error('BUDGET_EXCEEDED:wall_clock_seconds');
  for (const [key, value] of Object.entries(delta)) {
    const limit = state.budget?.limits?.[key] ?? 0, used = state.budget?.used?.[key] ?? 0;
    if (used + value > limit) throw new Error(`BUDGET_EXCEEDED:${key}`);
  }
}
export function spendBudget(state, delta = {}) {
  assertBudget(state, delta);
  for (const [key, value] of Object.entries(delta)) state.budget.used[key] = (state.budget.used[key] ?? 0) + value;
  saveState(state);
}
export function remainingWallClockMs(state) {
  assertBudget(state); return Math.max(1, state.budget.limits.wall_clock_seconds * 1000 - (Date.now() - Date.parse(state.started_at)));
}
export function validateTask(task) {
  for (const key of ['schema_version','task_id','intent','allowed_actions','allowed_paths','budget','protected_actions']) if (task[key] === undefined) throw new Error(`TASK_FIELD_MISSING:${key}`);
  if (!Array.isArray(task.allowed_actions) || !Array.isArray(task.allowed_paths) || !Array.isArray(task.protected_actions)) throw new Error('TASK_ARRAY_INVALID');
  if (typeof task.task_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(task.task_id)) throw new Error('TASK_ID_INVALID');
  if (!task.allowed_paths.length) throw new Error('TASK_ALLOWED_PATHS_EMPTY');
  for (const item of task.allowed_paths) {
    if (typeof item !== 'string' || !item.trim() || path.isAbsolute(item)) throw new Error(`TASK_ALLOWED_PATH_INVALID:${item}`);
    const normalized = item.replace(/\\/g,'/').replace(/^\.\//,'').replace(/\/$/,'');
    if (!normalized || normalized === '.git' || normalized.startsWith('.git/') || normalized.split('/').includes('..')) throw new Error(`TASK_ALLOWED_PATH_INVALID:${item}`);
  }
  for (const key of ['model_calls','wall_clock_seconds','retries']) if (!Number.isFinite(task.budget[key]) || task.budget[key] < 0) throw new Error(`TASK_BUDGET_INVALID:${key}`);
  for (const action of task.protected_actions) if (!task.allowed_actions.includes(action)) throw new Error(`PROTECTED_ACTION_NOT_ALLOWED:${action}`);
  if (task.source !== undefined) {
    if (task.source?.kind !== 'local_git' || typeof task.source.path !== 'string' || !path.isAbsolute(task.source.path)) throw new Error('TASK_SOURCE_INVALID');
    if (task.source.ref !== undefined && (typeof task.source.ref !== 'string' || !task.source.ref.trim() || task.source.ref.startsWith('-'))) throw new Error('TASK_SOURCE_REF_INVALID');
  }
  if (task.verification !== undefined) {
    if (!Array.isArray(task.verification?.commands)) throw new Error('TASK_VERIFICATION_INVALID');
    if (task.verification.commands.length > 20) throw new Error('TASK_VERIFICATION_TOO_MANY_COMMANDS');
    for (const item of task.verification.commands) {
      if (!item || typeof item.command !== 'string' || !item.command.trim() || !Array.isArray(item.args) || item.args.some(x => typeof x !== 'string')) throw new Error('TASK_VERIFICATION_COMMAND_INVALID');
      if (item.timeout_seconds !== undefined && (!Number.isFinite(item.timeout_seconds) || item.timeout_seconds <= 0 || item.timeout_seconds > 1800)) throw new Error('TASK_VERIFICATION_TIMEOUT_INVALID');
    }
  }
  if (task.workers !== undefined) {
    for (const role of ['builder','reviewer']) {
      const worker = task.workers?.[role];
      if (!worker || typeof worker.adapter !== 'string') throw new Error(`TASK_WORKER_INVALID:${role}`);
      if (worker.model !== undefined && typeof worker.model !== 'string') throw new Error(`TASK_WORKER_MODEL_INVALID:${role}`);
      if (worker.adapter === 'container') {
        if (typeof worker.image !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/:@-]{0,255}$/.test(worker.image)) throw new Error(`TASK_CONTAINER_IMAGE_INVALID:${role}`);
        if (!/@sha256:[a-f0-9]{64}$/.test(worker.image)) throw new Error(`TASK_CONTAINER_IMAGE_DIGEST_REQUIRED:${role}`);
        if (typeof worker.command !== 'string' || !worker.command || worker.command.startsWith('-')) throw new Error(`TASK_CONTAINER_COMMAND_INVALID:${role}`);
        if (worker.args !== undefined && (!Array.isArray(worker.args) || worker.args.some(x => typeof x !== 'string')) ) throw new Error(`TASK_CONTAINER_ARGS_INVALID:${role}`);
      }
    }
  }
  return task;
}
export function assertWorkerExecutionBoundary(adapter, role, protectedMode = process.env.BOUNDED_AGENT_PROTECTED_MODE === '1') {
  if (protectedMode && adapter !== 'container') throw new Error(`PROTECTED_MODE_REQUIRES_ISOLATED_WORKER:${role}:${adapter}`);
  return true;
}
export function assertVerificationExecutionBoundary(commandCount, protectedMode = process.env.BOUNDED_AGENT_PROTECTED_MODE === '1') {
  if (protectedMode && commandCount > 0) throw new Error('PROTECTED_MODE_LOCAL_VERIFIER_DENIED');
  return true;
}

export function authorize(task, action) {
  if (!task.allowed_actions.includes(action)) throw new Error(`CAPABILITY_DENIED:${action}`);
  if (task.protected_actions.includes(action)) return 'HUMAN_GATE';
  return 'ALLOW';
}
export function assertAllowedPath(task, relativePath) {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('../') || path.isAbsolute(relativePath)) throw new Error(`PATH_DENIED:${relativePath}`);
  const ok = task.allowed_paths.some(prefix => {
    const clean = prefix.replace(/\\/g, '/').replace(/\/$/, '');
    return normalized === clean || normalized.startsWith(clean + '/');
  });
  if (!ok) throw new Error(`PATH_DENIED:${relativePath}`);
  return true;
}
function evidenceBase(claim, payload, state, producer, trustClass) {
  return { evidence_id: crypto.randomUUID(), task_id: state.task_id, claim,
    producer_identity: producer, trust_class: trustClass,
    candidate_sha: payload.candidate_sha ?? state.candidate_sha,
    tree_hash: payload.tree_hash ?? state.tree_hash,
    input_hash: sha256(JSON.stringify(state.task)), payload_hash: sha256(JSON.stringify(payload)),
    created_at: new Date().toISOString(), status: 'VALID' };
}
export function evidence(claim, payload, state, producer = 'controller', trustClass = 'CONTROLLER_VERIFIED') {
  if (!state?.task_id || !state?.task) throw new Error('EVIDENCE_STATE_REQUIRED');
  const base = evidenceBase(claim, payload, state, producer, trustClass);
  return { ...base, integrity_hmac: hmac256(integrityKey(), JSON.stringify(base)) };
}
export function verifyEvidence(item, state) {
  const { integrity_hmac, ...base } = item;
  if (!integrity_hmac || hmac256(integrityKey(), JSON.stringify(base)) !== integrity_hmac) throw new Error('EVIDENCE_INTEGRITY_INVALID');
  if (item.task_id !== state.task_id || item.candidate_sha !== state.candidate_sha || item.tree_hash !== state.tree_hash) throw new Error('EVIDENCE_BINDING_INVALID');
  if (item.input_hash !== sha256(JSON.stringify(state.task))) throw new Error('TASK_BINDING_INVALID');
  return true;
}
export function assertBoundEvidence(state, candidate) {
  if (candidate.task_id !== state.task_id) throw new Error('TASK_BINDING_MISMATCH');
  if (candidate.candidate_sha !== state.candidate_sha) throw new Error('CANDIDATE_BINDING_MISMATCH');
  if (candidate.tree_hash !== state.tree_hash) throw new Error('TREE_BINDING_MISMATCH');
}
function safeGitEnv(extra = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  return { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null', GIT_TERMINAL_PROMPT: '0', ...extra };
}

function controllerHooksPath() {
  if (!SAFE_HOOKS_DIR) {
    fs.mkdirSync(CORE_DIR, { recursive: true });
    SAFE_HOOKS_DIR = fs.mkdtempSync(path.join(CORE_DIR, 'disabled-hooks-'));
  }
  return SAFE_HOOKS_DIR;
}
export function gitExec(repo, args, { timeout = 10000, stdio = ['ignore','pipe','pipe'], trim = true } = {}) {
  const hookPath = controllerHooksPath();
  const output = execFileSync('git', ['-c', `core.hooksPath=${hookPath}`, '-c', 'protocol.file.allow=never', '-C', repo, ...args],
    { encoding: 'utf8', timeout, env: safeGitEnv(), stdio });
  if (output == null) return '';
  return trim ? output.trim() : output.replace(/[\r\n]+$/, '');
}
export function seedLocalGitWorkspace(source, workspace) {
  if (!source || source.kind !== 'local_git' || typeof source.path !== 'string' || !path.isAbsolute(source.path)) throw new Error('TASK_SOURCE_INVALID');
  const sourcePath = fs.realpathSync(source.path);
  if (!fs.statSync(sourcePath).isDirectory()) throw new Error('TASK_SOURCE_NOT_DIRECTORY');
  try { gitExec(sourcePath, ['rev-parse','--is-inside-work-tree'], { stdio: 'ignore' }); }
  catch { throw new Error('TASK_SOURCE_NOT_GIT_REPO'); }
  fs.rmSync(workspace, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(workspace), { recursive: true });
  execFileSync('git', ['-c','protocol.file.allow=always','clone','-q','--no-hardlinks','--no-checkout',sourcePath,workspace], { timeout: 30000, env: safeGitEnv(), stdio: ['ignore','pipe','pipe'] });
  const ref = source.ref || 'HEAD';
  gitExec(workspace, ['checkout','-q','--detach',ref], { timeout: 20000 });
  gitExec(workspace, ['config','core.autocrlf','false']);
  gitExec(workspace, ['config','user.name','Bounded Agent Builder']);
  gitExec(workspace, ['config','user.email','builder@invalid.example']);
  const base = gitIdentity(workspace);
  assertWorkspaceTreeSafe(workspace);
  return { base_sha: base.candidate_sha, base_tree_hash: base.tree_hash, source_path: sourcePath, source_ref: ref };
}

export function cloneCandidateWorkspace(builderWorkspace, targetWorkspace, candidateSha) {
  fs.rmSync(targetWorkspace, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetWorkspace), { recursive: true });
  execFileSync('git', ['-c','protocol.file.allow=always','clone','-q','--no-hardlinks','--no-checkout',builderWorkspace,targetWorkspace], { timeout: 30000, env: safeGitEnv(), stdio: ['ignore','pipe','pipe'] });
  gitExec(targetWorkspace, ['checkout','-q','--detach',candidateSha], { timeout: 20000 });
  assertWorkspaceTreeSafe(targetWorkspace);
  return gitIdentity(targetWorkspace);
}
export function cloneReviewerWorkspace(builderWorkspace, reviewerWorkspace, candidateSha) {
  return cloneCandidateWorkspace(builderWorkspace, reviewerWorkspace, candidateSha);
}

export function ensureGitRepo(repo) {
  fs.mkdirSync(repo, { recursive: true });
  try { gitExec(repo, ['rev-parse','--git-dir'], { stdio: 'ignore' }); }
  catch { execFileSync('git', ['init','-q',repo], { timeout: 10000, env: safeGitEnv(), stdio: 'ignore' }); }
  gitExec(repo, ['config','core.autocrlf','false']);
  gitExec(repo, ['config','user.name','Bounded Agent Demo']);
  gitExec(repo, ['config','user.email','demo@invalid.example']);
  return repo;
}
export function changedWorkspacePaths(repo) {
  const raw = gitExec(repo, ['status','--porcelain=v1','--untracked-files=all'], { trim: false });
  return raw ? raw.split(/\r?\n/).filter(Boolean).map(line => line.slice(3).replace(/^"|"$/g, '')) : [];
}
function assertWorkspacePathSafe(repo, relativePath) {
  const root = fs.realpathSync(repo); let current = root;
  for (const part of relativePath.replaceAll(String.fromCharCode(92), '/').split('/').filter(Boolean)) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) return true;
    const info = fs.lstatSync(current);
    if (info.isSymbolicLink()) throw new Error('WORKSPACE_LINK_DENIED:' + relativePath);
  }
  const resolved = fs.realpathSync(current);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error('WORKSPACE_ESCAPE_DENIED:' + relativePath);
  const finalInfo = fs.statSync(current); if (finalInfo.isFile() && finalInfo.nlink > 1) throw new Error('WORKSPACE_HARDLINK_DENIED:' + relativePath);
  return true;
}
export function commitWorkspace(repo, task, message, timeout = 10000) {
  const paths = changedWorkspacePaths(repo);
  for (const file of paths) { assertAllowedPath(task, file); assertWorkspacePathSafe(repo, file); }
  if (!paths.length) throw new Error('NO_WORKSPACE_CHANGES');
  gitExec(repo, ['add','--',...paths], { timeout });
  gitExec(repo, ['commit','-q','-m',message], { timeout });
  return gitIdentity(repo);
}
export function gitIdentity(repo) {
  return { candidate_sha: gitExec(repo, ['rev-parse','HEAD']), tree_hash: gitExec(repo, ['rev-parse','HEAD^{tree}']) };
}
export function assertWorkspaceIdentity(state, repo) {
  const current = gitIdentity(repo);
  if (current.candidate_sha !== state.candidate_sha) throw new Error('POST_TEST_CANDIDATE_DRIFT');
  if (current.tree_hash !== state.tree_hash) throw new Error('POST_TEST_TREE_DRIFT');
  if (changedWorkspacePaths(repo).length) throw new Error('POST_TEST_WORKTREE_DIRTY');
  return true;
}
function splitLines(value) {
  return String(value).split(String.fromCharCode(10)).map(line => line.endsWith(String.fromCharCode(13)) ? line.slice(0, -1) : line).filter(Boolean);
}
export function assertWorkspaceTreeSafe(repo) {
  const rows = splitLines(gitExec(repo, ['ls-tree','-r','HEAD']));
  const files = [];
  for (const row of rows) {
    const tab = row.indexOf(String.fromCharCode(9)); const meta = row.slice(0, tab); const file = row.slice(tab + 1);
    const mode = meta.split(' ')[0];
    if (mode === '120000') throw new Error('WORKSPACE_GIT_SYMLINK_DENIED:' + file);
    if (fs.existsSync(path.join(repo, file))) assertWorkspacePathSafe(repo, file);
    files.push(file);
  }
  return files;
}
export function assertWorkspaceScope(task, repo, baseSha = null) {
  const treeFiles = assertWorkspaceTreeSafe(repo);
  const files = baseSha ? splitLines(gitExec(repo, ['diff','--name-only','--diff-filter=ACMRD',`${baseSha}..HEAD`])) : treeFiles;
  for (const file of files) assertAllowedPath(task, file);
  return files;
}
export function publicKeyFingerprint(publicKeyPem) {
  const der = crypto.createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  return sha256(der);
}
export function createGateChallenge(state) {
  return { task_id: state.task_id, candidate_sha: state.candidate_sha, tree_hash: state.tree_hash,
    state_version: state.state_version, nonce: crypto.randomUUID() };
}
export function canonicalGatePayload(challenge, decisionIdentity, decision = 'ACCEPT') {
  const { task_id, candidate_sha, tree_hash, state_version, nonce } = challenge;
  return JSON.stringify({ task_id, candidate_sha, tree_hash, state_version, nonce, decision, decision_identity: decisionIdentity });
}
export function verifyGateSignature(challenge, signatureBase64, publicKeyPem, decisionIdentity, decision = 'ACCEPT') {
  if (!challenge || !signatureBase64 || !publicKeyPem || !decisionIdentity) throw new Error('GATE_SIGNATURE_INPUT_MISSING');
  const ok = crypto.verify(null, Buffer.from(canonicalGatePayload(challenge, decisionIdentity, decision)), publicKeyPem, Buffer.from(signatureBase64, 'base64'));
  if (!ok) throw new Error('INVALID_HUMAN_GATE_SIGNATURE');
  return true;
}
function approverPolicy() {
  const keyPath = process.env.BOUNDED_AGENT_APPROVAL_PUBLIC_KEY;
  const expectedFingerprint = process.env.BOUNDED_AGENT_APPROVAL_KEY_FINGERPRINT;
  const identity = process.env.BOUNDED_AGENT_APPROVER_IDENTITY;
  if (!keyPath || !expectedFingerprint || !identity) throw new Error('APPROVER_POLICY_REQUIRED');
  const publicKey = fs.readFileSync(keyPath, 'utf8');
  const actual = publicKeyFingerprint(publicKey);
  if (actual !== expectedFingerprint) throw new Error('APPROVER_KEY_FINGERPRINT_MISMATCH');
  return { publicKey, fingerprint: actual, identity };
}
function readNonceLedger() {
  const key = integrityKey();
  if (!fs.existsSync(NONCE_LEDGER_FILE)) return { entries: [] };
  const doc = readJson(NONCE_LEDGER_FILE); const { hmac, ...base } = doc;
  if (!hmac || hmac256(key, JSON.stringify(base)) !== hmac) throw new Error('NONCE_LEDGER_INTEGRITY_INVALID');
  return base;
}
function writeNonceLedger(base) {
  const key = integrityKey();
  writeAtomic(NONCE_LEDGER_FILE, JSON.stringify({ ...base, hmac: hmac256(key, JSON.stringify(base)) }, null, 2) + '\n');
}
function challengeHash(challenge, identity) {
  return sha256(canonicalGatePayload(challenge, identity, 'ACCEPT'));
}
export function consumeApprovalNonce(challenge, identity, signatureBase64) {
  const ledger = readNonceLedger(); const hash = challengeHash(challenge, identity); const signature_hash = sha256(signatureBase64);
  const found = ledger.entries.find(x => x.nonce === challenge.nonce);
  if (found) {
    if (found.challenge_hash === hash && found.signature_hash === signature_hash && found.status === 'PENDING') return found;
    throw new Error('HUMAN_GATE_NONCE_REPLAY');
  }
  const entry = { nonce: challenge.nonce, challenge_hash: hash, signature_hash, status: 'PENDING', consumed_at: new Date().toISOString() };
  writeNonceLedger({ entries: [...ledger.entries, entry] }); return entry;
}
export function commitApprovalNonce(challenge, identity, signatureBase64) {
  const ledger = readNonceLedger(); const hash = challengeHash(challenge, identity); const signature_hash = sha256(signatureBase64);
  const index = ledger.entries.findIndex(x => x.nonce === challenge.nonce);
  if (index < 0) throw new Error('HUMAN_GATE_NONCE_NOT_CONSUMED');
  const entry = ledger.entries[index];
  if (entry.challenge_hash !== hash || entry.signature_hash !== signature_hash) throw new Error('HUMAN_GATE_NONCE_BINDING_MISMATCH');
  if (entry.status !== 'COMMITTED') { ledger.entries[index] = { ...entry, status: 'COMMITTED', committed_at: new Date().toISOString() }; writeNonceLedger(ledger); }
  return ledger.entries[index];
}
function assertConsumedNonce(challenge, identity, signatureBase64, allowPending = false) {
  const ledger = readNonceLedger(); const hash = challengeHash(challenge, identity); const signature_hash = sha256(signatureBase64);
  const found = ledger.entries.find(x => x.nonce === challenge.nonce);
  if (!found || found.challenge_hash !== hash || found.signature_hash !== signature_hash) throw new Error('HUMAN_GATE_NONCE_NOT_CONSUMED');
  if (found.status !== 'COMMITTED' && !(allowPending && found.status === 'PENDING')) throw new Error('HUMAN_GATE_NONCE_NOT_COMMITTED');
  return found;
}
export function createHumanApproval(state, signatureBase64) {
  const policy = approverPolicy(); if (state.approver_identity !== policy.identity) throw new Error('APPROVER_IDENTITY_MISMATCH');
  verifyGateSignature(state.gate_challenge, signatureBase64, policy.publicKey, policy.identity);
  consumeApprovalNonce(state.gate_challenge, policy.identity, signatureBase64);
  return { challenge: state.gate_challenge, signature: signatureBase64, decision: 'ACCEPT', decision_identity: policy.identity, public_key_fingerprint: policy.fingerprint,
    signed_payload_hash: challengeHash(state.gate_challenge, policy.identity), approved_at: new Date().toISOString() };
}
export function assertHumanApproval(state, action) {
  if (!state.task?.allowed_actions?.includes(action)) throw new Error('CAPABILITY_DENIED:' + action);
  if (!state.task?.protected_actions?.includes(action)) throw new Error('PROTECTED_ACTION_NOT_DECLARED:' + action);
  const policy = approverPolicy(); const approval = state.human_approval;
  if (!approval || !['ACCEPTED','CONTROLLER_MUTATION','VERIFIED','DONE'].includes(state.state)) throw new Error('HUMAN_GATE_REQUIRED:' + action);
  if (approval.decision !== 'ACCEPT' || approval.decision_identity !== policy.identity || approval.public_key_fingerprint !== policy.fingerprint) throw new Error('HUMAN_APPROVAL_POLICY_MISMATCH');
  verifyGateSignature(approval.challenge, approval.signature, policy.publicKey, policy.identity, approval.decision);
  if (approval.challenge.task_id !== state.task_id || approval.challenge.candidate_sha !== state.candidate_sha || approval.challenge.tree_hash !== state.tree_hash) throw new Error('HUMAN_APPROVAL_BINDING_MISMATCH');
  if (approval.signed_payload_hash !== challengeHash(approval.challenge, policy.identity)) throw new Error('HUMAN_APPROVAL_HASH_MISMATCH');
  const nonce = assertConsumedNonce(approval.challenge, policy.identity, approval.signature, true);
  if (nonce.status === 'PENDING') commitApprovalNonce(approval.challenge, policy.identity, approval.signature);
  return true;
}
export function resetDemoRuntime() {
  if (process.env.BOUNDED_AGENT_PROTECTED_MODE === '1') throw new Error('RESET_FORBIDDEN_IN_PROTECTED_MODE');
  for (const dir of [STATE_DIR, JOURNAL_DIR, EVIDENCE_DIR, BUILDER_DIR, REVIEWER_DIR, VERIFICATION_DIR]) fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(JOURNAL_ANCHOR_FILE, { force: true });
  ensureRuntimeDir();
  return 'DEMO_RUNTIME_RESET';
}

export function verifyStateEvidence(state) {
  for (const item of state.evidence ?? []) verifyEvidence(item, state);
  return true;
}
