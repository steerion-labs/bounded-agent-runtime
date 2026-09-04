import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const repo = path.resolve(import.meta.dirname, '..');
const bar = path.join(repo, 'bin', 'bar.mjs');

function sourceRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-work-src-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@invalid'], { cwd: dir });
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'x.txt'), 'x\n');
  fs.writeFileSync(path.join(dir, 'verify.test.mjs'), "import assert from 'node:assert/strict'; import fs from 'node:fs'; assert.equal(fs.existsSync('demo-output/artifact.txt'),true);\n");
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ private:true, scripts:{ test:'node verify.test.mjs' } }) + '\n');
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'base'], { cwd: dir });
  return dir;
}

function run(args, cwd, env) {
  return spawnSync(process.execPath, [bar, ...args], { cwd, env, encoding: 'utf8', timeout: 60000 });
}
test('work dry-run resolves and retains an auditable bounded task without controller state', () => {
  const src = sourceRepo();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-work-dry-'));
  const root = path.join(cwd, 'runtime');
  const out = path.join(cwd, 'work.json');
  const env = { ...process.env, BOUNDED_AGENT_RUNTIME_ROOT: root };
  const result = run(['work','--repo',src,'--goal','Fix x','--allow','src','--allow','demo-output','--builder','demo','--reviewer','demo','--verify','node','--verify-arg=--test','--verify-arg','verify.test.mjs','--dry-run','--out',out], cwd, env);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /WORK_REQUEST_RESOLVED/);
  assert.match(result.stdout, /WORK_REQUEST_DRY_RUN/);
  assert.equal(fs.existsSync(path.join(root, 'runtime-state', 'state.json')), false);
  const task = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(task.intent, 'Fix x');
  assert.deepEqual(task.allowed_paths, ['src', 'demo-output']);
  assert.equal(task.workers.builder.adapter, 'demo');
  assert.equal(task.workers.reviewer.adapter, 'demo');
  assert.equal(task.verification.semantics, 'OPERATOR_DECLARED_COMMAND_EXECUTION_ONLY');
});

test('work refuses implicit write scope', () => {
  const src = sourceRepo();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-work-scope-'));
  const env = { ...process.env, BOUNDED_AGENT_RUNTIME_ROOT: path.join(cwd, 'runtime') };
  const result = run(['work','--repo',src,'--goal','Fix x','--builder','demo','--reviewer','demo','--verify','node','--verify-arg=--test','--verify-arg','verify.test.mjs','--dry-run'], cwd, env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ALLOWED_PATH_REQUIRED/);
});
test('work refuses a dirty source repository', () => {
  const src = sourceRepo();
  fs.writeFileSync(path.join(src, 'src', 'dirty.txt'), 'dirty\n');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-work-dirty-'));
  const env = { ...process.env, BOUNDED_AGENT_RUNTIME_ROOT: path.join(cwd, 'runtime') };
  const result = run(['work','--repo',src,'--goal','Fix x','--builder','demo','--reviewer','demo','--verify','node','--verify-arg=--test','--verify-arg','verify.test.mjs','--dry-run'], cwd, env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SOURCE_REPO_DIRTY/);
});

test('work executes the existing controller path and stops at Human Gate', () => {
  const src = sourceRepo();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-work-run-'));
  const root = path.join(cwd, 'runtime');
  const out = path.join(cwd, 'work.json');
  const env = { ...process.env, BOUNDED_AGENT_RUNTIME_ROOT: root };
  const result = run(['work','--repo',src,'--goal','Create bounded demo output','--allow','src','--allow','demo-output','--builder','demo','--reviewer','demo','--verify','node','--verify-arg=--test','--verify-arg','verify.test.mjs','--seconds','60','--out',out], cwd, env);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /HUMAN_GATE_REQUIRED/);
  assert.match(result.stdout, /State: HUMAN_GATE/);
  assert.equal(fs.existsSync(out), true);
  const state = JSON.parse(fs.readFileSync(path.join(root, 'runtime-state', 'state.json'), 'utf8'));
  assert.equal(state.state, 'HUMAN_GATE');
  assert.equal(state.task.intent, 'Create bounded demo output');
});
test('work requires explicit controller-observed verification', () => {
  const src = sourceRepo();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-work-verify-'));
  const env = { ...process.env, BOUNDED_AGENT_RUNTIME_ROOT: path.join(cwd, 'runtime') };
  const result = run(['work','--repo',src,'--goal','Fix x','--allow','src','--allow','demo-output','--builder','demo','--reviewer','demo','--dry-run'], cwd, env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /WORK_VERIFICATION_REQUIRED/);
});

test('work refuses to replace existing controller authority', () => {
  const src = sourceRepo();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-work-active-'));
  const root = path.join(cwd, 'runtime');
  fs.mkdirSync(path.join(root, 'runtime-state'), { recursive: true });
  fs.writeFileSync(path.join(root, 'runtime-state', 'state.json'), '{}\n');
  const env = { ...process.env, BOUNDED_AGENT_RUNTIME_ROOT: root };
  const result = run(['work','--repo',src,'--goal','Fix x','--allow','src','--allow','demo-output','--builder','demo','--reviewer','demo','--verify','node','--verify-arg=--test','--verify-arg','verify.test.mjs'], cwd, env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /WORK_RUNTIME_NOT_EMPTY/);
});

test('work never silently expands demo builder scope', () => {
  const src = sourceRepo();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-work-demo-scope-'));
  const env = { ...process.env, BOUNDED_AGENT_RUNTIME_ROOT: path.join(cwd, 'runtime') };
  const result = run(['work','--repo',src,'--goal','Fix x','--allow','src','--builder','demo','--reviewer','demo','--verify','node','--verify-arg=--test','--verify-arg','verify.test.mjs','--dry-run'], cwd, env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /WORK_DEMO_SCOPE_REQUIRED/);
});

test('work rejects unsupported verification command shapes', () => {
  const src = sourceRepo();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-work-noop-'));
  const env = { ...process.env, BOUNDED_AGENT_RUNTIME_ROOT: path.join(cwd, 'runtime') };
  const result = run(['work','--repo',src,'--goal','Fix x','--allow','src','--allow','demo-output','--builder','demo','--reviewer','demo','--verify','node','--verify-arg','-e','--verify-arg','process.exit(0)','--dry-run'], cwd, env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /WORK_VERIFICATION_PROFILE_REQUIRED/);
});


test('work default audit artifact stays outside the source repository', () => {
  const src = sourceRepo();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-work-default-out-'));
  const root = path.join(cwd, 'runtime');
  const env = { ...process.env, BOUNDED_AGENT_RUNTIME_ROOT: root };
  const result = run(['work','--repo',src,'--goal','Fix x','--allow','src','--allow','demo-output','--builder','demo','--reviewer','demo','--verify','node','--verify-arg=--test','--verify-arg','verify.test.mjs','--dry-run'], cwd, env);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(execFileSync('git', ['status','--porcelain=v1','--untracked-files=all'], { cwd: src, encoding: 'utf8' }).trim(), '');
  const auditDir = path.join(root, 'work-requests');
  assert.equal(fs.existsSync(auditDir), true);
  assert.equal(fs.readdirSync(auditDir).length, 1);
});

test('work never overwrites an existing audit artifact', () => {
  const src = sourceRepo();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-work-no-overwrite-'));
  const root = path.join(cwd, 'runtime');
  const out = path.join(cwd, 'existing.json');
  fs.writeFileSync(out, 'sentinel\n');
  const env = { ...process.env, BOUNDED_AGENT_RUNTIME_ROOT: root };
  const result = run(['work','--repo',src,'--goal','Fix x','--allow','src','--allow','demo-output','--builder','demo','--reviewer','demo','--verify','node','--verify-arg=--test','--verify-arg','verify.test.mjs','--dry-run','--out',out], cwd, env);
  assert.notEqual(result.status, 0);
  assert.equal(fs.readFileSync(out, 'utf8'), 'sentinel\n');
});


test('work rejects audit output inside the source repository', () => {
  const src = sourceRepo();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-work-outside-source-'));
  const root = path.join(cwd, 'runtime');
  const out = path.join(src, 'bounded-work-request.json');
  const env = { ...process.env, BOUNDED_AGENT_RUNTIME_ROOT: root };
  const result = run(['work','--repo',src,'--goal','Fix x','--allow','src','--allow','demo-output','--builder','demo','--reviewer','demo','--verify','node','--verify-arg=--test','--verify-arg','verify.test.mjs','--dry-run','--out',out], cwd, env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /WORK_AUDIT_OUTSIDE_SOURCE_REQUIRED/);
  assert.equal(fs.existsSync(out), false);
  assert.equal(execFileSync('git', ['status','--porcelain=v1','--untracked-files=all'], { cwd: src, encoding: 'utf8' }).trim(), '');
});


test('work validates task id before deriving audit path', () => {
  const src = sourceRepo();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-work-id-'));
  const root = path.join(cwd, 'runtime');
  const env = { ...process.env, BOUNDED_AGENT_RUNTIME_ROOT: root };
  const result = run(['work','--repo',src,'--goal','Fix x','--id','../escape','--allow','src','--allow','demo-output','--builder','demo','--reviewer','demo','--verify','node','--verify-arg=--test','--verify-arg','verify.test.mjs','--dry-run'], cwd, env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TASK_ID_INVALID/);
  assert.equal(fs.existsSync(path.join(root, 'escape.json')), false);
});
