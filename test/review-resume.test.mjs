import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

// Review-only resume (issue #81): a built and controller-verified candidate whose Reviewer
// was unavailable can later be reviewed without running the Builder again. Every stale,
// mismatched, replayed or tampered resume must fail closed.

const repo = path.resolve(import.meta.dirname, '..');
const controller = path.join(repo, 'runtime', 'controller.mjs');
const barCli = path.join(repo, 'bin', 'bar.mjs');
const gate = path.join(repo, 'runtime', 'gate.mjs');

function makeSourceRepo() {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-resume-source-'));
  execFileSync('git', ['init', '-q'], { cwd: source });
  execFileSync('git', ['config', 'user.name', 'Source'], { cwd: source });
  execFileSync('git', ['config', 'user.email', 'source@example.invalid'], { cwd: source });
  fs.mkdirSync(path.join(source, 'src'));
  fs.writeFileSync(path.join(source, 'src', 'value.txt'), 'before\n');
  execFileSync('git', ['add', '.'], { cwd: source });
  execFileSync('git', ['commit', '-q', '-m', 'base'], { cwd: source });
  return source;
}

// One generic worker plays both roles. The Builder appends to builder.log; the Reviewer
// behaves according to reviewer-mode (down | up | block | mutate) and appends to reviewer.log.
function setup({ verification = true } = {}) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-resume-'));
  const source = makeSourceRepo();
  const control = path.join(cwd, 'control');
  fs.mkdirSync(control);
  const files = {
    builderLog: path.join(control, 'builder.log'),
    reviewerLog: path.join(control, 'reviewer.log'),
    mode: path.join(control, 'reviewer-mode')
  };
  fs.writeFileSync(files.mode, 'down');
  const worker = path.join(cwd, 'worker.mjs');
  fs.writeFileSync(worker, `import fs from 'node:fs';
const files = ${JSON.stringify(files)};
const prompt = process.argv.at(-1) || '';
if (prompt.includes('You are the Reviewer')) {
  fs.appendFileSync(files.reviewerLog, 'review\\n');
  const mode = fs.readFileSync(files.mode, 'utf8').trim();
  if (mode === 'down') { console.error('provider unavailable'); process.exit(7); }
  const sha = prompt.match(/Candidate commit: ([a-f0-9]{40})/)[1];
  const tree = prompt.match(/Candidate tree: ([a-f0-9]{40})/)[1];
  if (mode === 'mutate') fs.writeFileSync('src/review.txt', 'mutated\\n');
  console.log(JSON.stringify({ decision: mode === 'block' ? 'BLOCK' : 'APPROVE', reason: mode, residual_risks: [], reviewed_candidate_sha: sha, reviewed_tree_hash: tree }));
} else {
  fs.appendFileSync(files.builderLog, 'build\\n');
  fs.writeFileSync('src/value.txt', 'after\\n');
  console.log('changed');
}
`);
  const task = {
    schema_version: 1,
    task_id: `resume-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    intent: 'Change src/value.txt',
    source: { kind: 'local_git', path: source, ref: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim() },
    workers: { builder: { adapter: 'generic' }, reviewer: { adapter: 'generic' } },
    allowed_actions: ['build_local', 'merge'],
    protected_actions: ['merge'],
    allowed_paths: ['src'],
    budget: { model_calls: 4, wall_clock_seconds: 60, retries: 0 },
    ...(verification ? { verification: { commands: [{ command: process.execPath, args: ['-e', "if(require('fs').readFileSync('src/value.txt','utf8').trim()!=='after')process.exit(3)"], timeout_seconds: 20 }] } } : {})
  };
  const taskFile = path.join(cwd, 'task.json');
  fs.writeFileSync(taskFile, JSON.stringify(task, null, 2));
  const ctx = { cwd, source, files, root: path.join(cwd, 'runtime-root'), worker, taskFile };
  ctx.env = (extra = {}) => ({ ...process.env, BOUNDED_AGENT_RUNTIME_ROOT: ctx.root, BOUNDED_AGENT_APPROVER_IDENTITY: 'demo-approver', BOUNDED_AGENT_GENERIC_EXECUTABLE: process.execPath, BOUNDED_AGENT_GENERIC_ARGS_JSON: JSON.stringify([worker]), ...extra });
  ctx.run = (args, extra) => spawnSync(process.execPath, [controller, ...args], { cwd, encoding: 'utf8', env: ctx.env(extra) });
  ctx.stateFile = () => path.join(ctx.root, 'runtime-state', 'state.json');
  ctx.state = () => JSON.parse(fs.readFileSync(ctx.stateFile(), 'utf8'));
  ctx.journal = () => fs.readFileSync(path.join(ctx.root, 'journal', 'journal.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  ctx.count = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).length : 0);
  ctx.mode = (value) => fs.writeFileSync(files.mode, value);
  return ctx;
}

// Build + verify, then the Reviewer is down: BAR stops in REVIEWING with a bound candidate.
function parkedCandidate(options) {
  const ctx = setup(options);
  assert.equal(ctx.run(['init', ctx.taskFile]).status, 0);
  const first = ctx.run(['run']);
  assert.notEqual(first.status, 0);
  assert.match(first.stderr, /REVIEWER_FAILED/);
  const state = ctx.state();
  assert.equal(state.state, 'REVIEWING');
  assert.match(state.candidate_sha, /^[a-f0-9]{40}$/);
  assert.deepEqual(state.evidence.map((item) => item.claim), ['builder_candidate', 'controller_verification']);
  assert.equal(ctx.count(ctx.files.builderLog), 1);
  ctx.request = { candidate: state.candidate_sha, tree: state.tree_hash, sourceHead: state.base_sha ?? 'none', stateVersion: state.state_version };
  return ctx;
}

function resumeArgs(request, overrides = {}) {
  const r = { ...request, ...overrides };
  return ['review-resume', '--candidate', r.candidate, '--tree', r.tree, '--source-head', r.sourceHead, '--state-version', String(r.stateVersion), '--json'];
}
function resume(ctx, overrides = {}, extraArgs = []) {
  const result = ctx.run([...resumeArgs(ctx.request, overrides), ...extraArgs]);
  let body = null;
  try { body = JSON.parse(result.stdout); } catch {}
  return { ...result, body };
}
function assertDenied(ctx, result, reason) {
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.equal(result.body.status, 'DENIED');
  assert.equal(result.body.retryable, false);
  assert.match(result.body.message, reason);
  assert.equal(result.body.builder_invoked, false);
  assert.equal(result.body.protected_effects_attempted, false);
  assert.equal(ctx.count(ctx.files.builderLog), 1, 'Builder must never run during resume');
}

test('verified candidate resumes review-only to Human Gate without running the Builder', () => {
  const ctx = parkedCandidate();
  const before = ctx.state();
  const reviewsBefore = ctx.count(ctx.files.reviewerLog);
  ctx.mode('up');
  const result = resume(ctx);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.body.status, 'HUMAN_GATE_REQUIRED');
  assert.equal(result.body.builder_invoked, false);
  assert.equal(result.body.protected_effects_attempted, false);
  assert.equal(result.body.candidate_sha, before.candidate_sha);
  assert.equal(result.body.tree_hash, before.tree_hash);
  assert.equal(result.body.source_head, before.base_sha);

  const after = ctx.state();
  assert.equal(after.state, 'HUMAN_GATE');
  assert.equal(after.candidate_sha, before.candidate_sha);
  assert.equal(after.tree_hash, before.tree_hash);
  assert.equal(after.base_sha, before.base_sha);
  assert.ok(after.lease.generation > before.lease.generation, 'resume must fence out older controllers');
  assert.equal(ctx.count(ctx.files.builderLog), 1);
  assert.equal(ctx.count(ctx.files.reviewerLog), reviewsBefore + 1);
  const review = after.evidence.find((item) => item.claim === 'review_observation');
  assert.equal(review.producer_identity, 'reviewer:generic');
  assert.equal(review.candidate_sha, before.candidate_sha);
  assert.equal(review.tree_hash, before.tree_hash);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: after.workspace_path, encoding: 'utf8' }).trim(), before.candidate_sha);
  assert.notEqual(after.reviewer_workspace_path, after.workspace_path);
  const events = ctx.journal().map((entry) => entry.event);
  assert.ok(events.includes('REVIEW_RESUME_STARTED') && events.includes('REVIEW_RESUME_COMPLETED'));

  // Human Gate stays in force: no protected action without a signed approval.
  const auth = ctx.run(['authorize-protected', 'merge', '--json']);
  assert.equal(auth.status, 2);
  assert.equal(JSON.parse(auth.stdout).status, 'DENIED');
});

test('Reviewer outage during resume is retryable and still never rebuilds', () => {
  const ctx = parkedCandidate();
  const outage = resume(ctx);
  assert.equal(outage.status, 3);
  assert.equal(outage.body.status, 'REVIEWER_UNAVAILABLE');
  assert.equal(outage.body.retryable, true);
  assert.equal(ctx.state().state, 'REVIEWING');
  assert.equal(ctx.state().state_version, ctx.request.stateVersion);
  ctx.mode('up');
  const retry = resume(ctx);
  assert.equal(retry.status, 0, retry.stdout + retry.stderr);
  assert.equal(retry.body.attempt, 2);
  assert.equal(ctx.count(ctx.files.builderLog), 1);
});

test('replayed resume after success is rejected and changes nothing', () => {
  const ctx = parkedCandidate();
  ctx.mode('up');
  assert.equal(resume(ctx).status, 0);
  const done = ctx.state();
  const reviews = ctx.count(ctx.files.reviewerLog);
  const replay = resume(ctx);
  assertDenied(ctx, replay, /REVIEW_RESUME_STATE_INVALID:HUMAN_GATE/);
  assert.equal(ctx.state().state_version, done.state_version);
  assert.equal(ctx.state().gate_challenge.nonce, done.gate_challenge.nonce);
  assert.equal(ctx.count(ctx.files.reviewerLog), reviews);
});

test('stale or mismatched binding fails closed before any Reviewer call', () => {
  const ctx = parkedCandidate();
  ctx.mode('up');
  const reviews = ctx.count(ctx.files.reviewerLog);
  const other = 'f'.repeat(40);
  const cases = [
    [{ candidate: other }, /REVIEW_RESUME_BINDING_MISMATCH:candidate_sha/],
    [{ tree: other }, /REVIEW_RESUME_BINDING_MISMATCH:tree_hash/],
    [{ sourceHead: other }, /REVIEW_RESUME_BINDING_MISMATCH:source_head/],
    [{ sourceHead: 'none' }, /REVIEW_RESUME_BINDING_MISMATCH:source_head/],
    [{ stateVersion: ctx.request.stateVersion - 1 }, /REVIEW_RESUME_BINDING_MISMATCH:state_version/],
    [{ stateVersion: ctx.request.stateVersion + 1 }, /REVIEW_RESUME_BINDING_MISMATCH:state_version/]
  ];
  for (const [override, reason] of cases) assertDenied(ctx, resume(ctx, override), reason);
  assert.equal(ctx.count(ctx.files.reviewerLog), reviews);
  assert.equal(ctx.state().state, 'REVIEWING');
  assert.equal(ctx.state().review_resume, undefined);
});

test('malformed resume requests and authority-widening flags are rejected', () => {
  const ctx = parkedCandidate();
  ctx.mode('up');
  const base = resumeArgs(ctx.request).slice(1);
  const bad = [
    [['--candidate', ctx.request.candidate, '--tree', ctx.request.tree, '--source-head', ctx.request.sourceHead, '--json'], /REVIEW_RESUME_ARGUMENT_REQUIRED:--state-version/],
    [[...base, '--candidate', ctx.request.candidate], /REVIEW_RESUME_ARGUMENT_DUPLICATE:--candidate/],
    [base.map((value) => (value === ctx.request.candidate ? ctx.request.candidate.toUpperCase() : value)), /REVIEW_RESUME_REQUEST_MALFORMED:candidate_sha/],
    [base.map((value) => (value === String(ctx.request.stateVersion) ? '-1' : value)), /REVIEW_RESUME_REQUEST_MALFORMED:state_version|REVIEW_RESUME_ARGUMENT_VALUE_REQUIRED/],
    // A resume can never pick or swap workers, paths, actions or effects.
    [[...base, '--reviewer', 'generic'], /REVIEW_RESUME_ARGUMENT_FORBIDDEN:--reviewer/],
    [[...base, '--builder', 'generic'], /REVIEW_RESUME_ARGUMENT_FORBIDDEN:--builder/],
    [[...base, '--allow', '.'], /REVIEW_RESUME_ARGUMENT_FORBIDDEN:--allow/],
    [[...base, '--protected-action', 'merge'], /REVIEW_RESUME_ARGUMENT_FORBIDDEN:--protected-action/]
  ];
  for (const [args, reason] of bad) {
    const result = ctx.run(['review-resume', ...args]);
    let body = null; try { body = JSON.parse(result.stdout); } catch {}
    assertDenied(ctx, { ...result, body }, reason);
  }
  assert.equal(ctx.state().state, 'REVIEWING');
});

test('mutated or drifted candidate workspace is rejected', () => {
  const dirty = parkedCandidate();
  dirty.mode('up');
  fs.writeFileSync(path.join(dirty.state().workspace_path, 'src', 'value.txt'), 'tampered\n');
  assertDenied(dirty, resume(dirty), /POST_TEST_WORKTREE_DIRTY/);

  const moved = parkedCandidate();
  moved.mode('up');
  const ws = moved.state().workspace_path;
  fs.writeFileSync(path.join(ws, 'src', 'value.txt'), 'rewritten\n');
  execFileSync('git', ['-c', 'user.name=x', '-c', 'user.email=x@invalid', 'commit', '-q', '-am', 'swap candidate'], { cwd: ws });
  assertDenied(moved, resume(moved), /POST_TEST_CANDIDATE_DRIFT/);

  const missing = parkedCandidate();
  missing.mode('up');
  fs.rmSync(missing.state().workspace_path, { recursive: true, force: true });
  assertDenied(missing, resume(missing), /REVIEW_RESUME_CANDIDATE_MISSING/);
});

test('tampered state cannot swap candidate, reviewer or verification evidence', () => {
  const swapped = parkedCandidate();
  const state = swapped.state();
  state.candidate_sha = 'e'.repeat(40);
  fs.writeFileSync(swapped.stateFile(), JSON.stringify(state, null, 2));
  assertDenied(swapped, resume(swapped, { candidate: 'e'.repeat(40) }), /EVIDENCE_BINDING_INVALID|STATE_GATE_BINDING_INVALID/);

  // Self-review attempt: rewrite the task so the reviewer becomes the builder's worker config.
  const selfReview = parkedCandidate();
  const s2 = selfReview.state();
  s2.task.workers.reviewer = { adapter: 'generic', model: 'builder-identity' };
  fs.writeFileSync(selfReview.stateFile(), JSON.stringify(s2, null, 2));
  assertDenied(selfReview, resume(selfReview), /TASK_BINDING_INVALID/);

  const noVerification = parkedCandidate();
  const s3 = noVerification.state();
  s3.evidence = s3.evidence.filter((item) => item.claim !== 'controller_verification');
  fs.writeFileSync(noVerification.stateFile(), JSON.stringify(s3, null, 2));
  assertDenied(noVerification, resume(noVerification), /REQUIRED_EVIDENCE_MISSING:controller_verification/);

  const forged = parkedCandidate();
  const s4 = forged.state();
  s4.evidence[1] = { ...s4.evidence[1], producer_identity: 'reviewer:generic' };
  fs.writeFileSync(forged.stateFile(), JSON.stringify(s4, null, 2));
  assertDenied(forged, resume(forged), /EVIDENCE_INTEGRITY_INVALID/);
});

test('reviewer that mutates its workspace or blocks never reaches the Human Gate', () => {
  const mutate = parkedCandidate();
  mutate.mode('mutate');
  const mutated = resume(mutate);
  assertDenied(mutate, mutated, /REVIEWER_MUTATED_WORKSPACE/);
  assert.equal(mutate.state().state, 'REVIEWING');

  const block = parkedCandidate();
  block.mode('block');
  const blocked = resume(block);
  assert.equal(blocked.status, 4);
  assert.equal(blocked.body.status, 'REVIEW_BLOCKED');
  assert.equal(blocked.body.retryable, false);
  assert.equal(block.state().state, 'REVIEWING');
  assert.equal(block.state().evidence.some((item) => item.claim === 'review_observation'), false);
  assert.equal(block.count(block.files.builderLog), 1);
});

test('resume attempts are bounded', () => {
  const ctx = parkedCandidate();
  for (let attempt = 1; attempt <= 3; attempt += 1) assert.equal(resume(ctx).status, 3);
  assertDenied(ctx, resume(ctx), /REVIEW_RESUME_ATTEMPTS_EXHAUSTED/);
  ctx.mode('up');
  assertDenied(ctx, resume(ctx), /REVIEW_RESUME_ATTEMPTS_EXHAUSTED/);
});

test('resume after the original wall clock uses a bounded review window, not a rebuild', () => {
  const ctx = parkedCandidate();
  const state = ctx.state();
  state.started_at = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  fs.writeFileSync(ctx.stateFile(), JSON.stringify(state, null, 2));
  ctx.mode('up');
  const result = resume(ctx);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const after = ctx.state();
  assert.equal(after.review_resume.active, true);
  assert.equal(after.review_resume.used.model_calls, 1);
  assert.equal(after.budget.used.model_calls, state.budget.used.model_calls);
});

test('a parked runtime root may be relocated as a whole; identity is still proven', () => {
  const ctx = parkedCandidate();
  const parked = path.join(ctx.cwd, 'review-queue', 'parked-run');
  fs.mkdirSync(path.dirname(parked), { recursive: true });
  fs.renameSync(ctx.root, parked);
  ctx.root = parked;
  ctx.mode('up');
  const result = resume(ctx);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const after = ctx.state();
  assert.equal(after.workspace_path, path.join(parked, 'builder-work', after.task_id));
  assert.ok(ctx.journal().some((entry) => entry.event === 'REVIEW_RESUME_RUNTIME_RELOCATED'));
  assert.equal(ctx.count(ctx.files.builderLog), 1);
});

test('state pointing the candidate at a foreign workspace is rejected', () => {
  const ctx = parkedCandidate();
  const state = ctx.state();
  state.workspace_path = path.join(ctx.cwd, 'elsewhere', 'not-this-task');
  fs.writeFileSync(ctx.stateFile(), JSON.stringify(state, null, 2));
  assertDenied(ctx, resume(ctx), /REVIEW_RESUME_WORKSPACE_INVALID/);
});

test('resume refuses to run while another controller holds the lock', () => {
  const ctx = parkedCandidate();
  const lockDir = path.join(ctx.root, 'runtime-core', 'controller-lock');
  fs.mkdirSync(lockDir, { recursive: true });
  fs.writeFileSync(path.join(lockDir, 'owner.json'), JSON.stringify({ pid: process.pid, token: 'other', created_at: new Date().toISOString() }));
  ctx.mode('up');
  const result = resume(ctx);
  assert.equal(result.status, 3);
  assert.equal(result.body.status, 'UNAVAILABLE');
  assert.equal(ctx.state().state, 'REVIEWING');
  fs.rmSync(lockDir, { recursive: true, force: true });
});

test('resume is only valid from REVIEWING', () => {
  const ctx = setup();
  assert.equal(ctx.run(['init', ctx.taskFile]).status, 0);
  const state = ctx.state();
  const result = ctx.run(['review-resume', '--candidate', 'a'.repeat(40), '--tree', 'b'.repeat(40), '--source-head', state.task.source.ref, '--state-version', '0', '--json']);
  assert.equal(result.status, 2);
  assert.match(JSON.parse(result.stdout).message, /REVIEW_RESUME_STATE_INVALID:NEW/);
  assert.equal(ctx.count(ctx.files.builderLog), 0);
});

test('bar CLI passes review-resume through with machine-readable exit codes', () => {
  const ctx = parkedCandidate();
  const cli = (args) => spawnSync(process.execPath, [barCli, ...args], { cwd: ctx.cwd, encoding: 'utf8', env: ctx.env() });
  const status = JSON.parse(cli(['status', '--json']).stdout);
  assert.match(status.next_step, /bar review-resume/);
  const denied = cli(resumeArgs(ctx.request, { tree: 'f'.repeat(40) }));
  assert.equal(denied.status, 2);
  assert.equal(JSON.parse(denied.stdout).reason_code, 'REVIEW_RESUME_BINDING_MISMATCH');
  ctx.mode('up');
  const ok = cli(resumeArgs(ctx.request));
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.equal(JSON.parse(ok.stdout).status, 'HUMAN_GATE_REQUIRED');
  assert.equal(ctx.count(ctx.files.builderLog), 1);
});

test('approved resumed candidate keeps the normal Human Gate approval chain', () => {
  const ctx = parkedCandidate();
  ctx.mode('up');
  assert.equal(resume(ctx).status, 0);
  const keyDir = path.join(ctx.cwd, 'gate-keys');
  const kg = spawnSync(process.execPath, [gate, 'keygen', keyDir], { cwd: ctx.cwd, encoding: 'utf8', env: ctx.env() });
  assert.equal(kg.status, 0, kg.stderr);
  const fingerprint = kg.stdout.match(/PUBLIC_KEY_FINGERPRINT ([a-f0-9]+)/)[1];
  const keyEnv = { BOUNDED_AGENT_APPROVAL_PUBLIC_KEY: path.join(keyDir, 'public.pem'), BOUNDED_AGENT_APPROVAL_KEY_FINGERPRINT: fingerprint };
  const signed = spawnSync(process.execPath, [gate, 'sign', path.join(keyDir, 'private.pem')], { cwd: ctx.cwd, encoding: 'utf8', env: ctx.env(keyEnv) });
  assert.equal(signed.status, 0, signed.stderr);
  const approved = ctx.run(['approve', signed.stdout.trim()], keyEnv);
  assert.equal(approved.status, 0, approved.stderr);
  assert.match(approved.stdout, /ACCEPTED_NO_REMOTE_MUTATION_EXECUTED/);
  assert.equal(ctx.state().candidate_sha, ctx.request.candidate);
  assert.equal(ctx.count(ctx.files.builderLog), 1);
});
