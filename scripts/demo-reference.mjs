import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCandidatePublicationRequest } from '../runtime/remote/candidate-publication.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin', 'bar.mjs');

function exec(exe, args, options = {}) {
  const result = spawnSync(exe, args, {
    encoding: 'utf8', windowsHide: true, timeout: 45000, ...options
  });
  if (result.error || result.status !== 0) {
    const detail = String(result.stderr || result.error?.message || result.stdout || '').slice(0, 800);
    throw new Error('REFERENCE_COMMAND_FAILED:' + path.basename(exe) + ':' + detail);
  }
  return String(result.stdout || '');
}
function git(repo, ...args) {
  return exec('git', ['-C', repo, ...args]).trim();
}
function denied(label, callback, pattern) {
  try { callback(); } catch (error) {
    assert.match(String(error.message), pattern, 'Unexpected denial: ' + label);
    console.log('BLOCKED  ' + label);
    return;
  }
  throw new Error('REFERENCE_AUTHORITY_ESCALATION_NOT_BLOCKED:' + label);
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bar-reference-'));
try {
  const source = path.join(temporary, 'source');
  const runtime = path.join(temporary, 'runtime');
  const taskFile = path.join(temporary, 'task.json');
  fs.mkdirSync(path.join(source, 'src'), { recursive: true });
  fs.mkdirSync(path.join(source, 'test'), { recursive: true });
  fs.writeFileSync(path.join(source, 'src', 'main.txt'), 'synthetic reference repository\n');
  fs.writeFileSync(path.join(source, 'test', 'verify-artifact.mjs'), [
    "import assert from 'node:assert/strict';",
    "import fs from 'node:fs';",
    "assert.equal(fs.readFileSync('demo-output/artifact.txt', 'utf8'),",
    "  'bar-reference-demo-001\\nsynthetic reversible demo change\\n');"
  ].join('\n') + '\n');
  git(source, 'init', '-q');
  git(source, 'add', '--', 'src/main.txt', 'test/verify-artifact.mjs');
  git(source, '-c', 'user.name=BAR Demo', '-c', 'user.email=bar-demo@example.invalid',
    'commit', '-qm', 'synthetic reference base');
  const base = git(source, 'rev-parse', 'HEAD');
  const env = { ...process.env, BOUNDED_AGENT_RUNTIME_ROOT: runtime };

  console.log('BAR REFERENCE DEMO - real disposable Git repository / synthetic workers');
  const taskOutput = exec(process.execPath, [cli, 'task', '--repo', source,
    '--intent', 'Create and review one bounded synthetic artifact',
    '--id', 'bar-reference-demo-001', '--allow', 'demo-output',
    '--builder', 'demo', '--reviewer', 'demo',
    '--verify', 'node', '--verify-arg', 'test/verify-artifact.mjs',
    '--out', taskFile], { env });
  assert.match(taskOutput, /TASK_WRITTEN/);
  const runOutput = exec(process.execPath, [cli, 'run', '--task', taskFile], { env });
  assert.match(runOutput, /HUMAN_GATE_REQUIRED/);
  const state = JSON.parse(fs.readFileSync(path.join(runtime, 'runtime-state', 'state.json'), 'utf8'));
  assert.equal(state.state, 'HUMAN_GATE');
  assert.match(state.candidate_sha, /^[a-f0-9]{40}$/);
  assert.match(state.tree_hash, /^[a-f0-9]{40}$/);
  assert.equal(state.base_sha, base);
  assert.equal(state.human_approval, null);
  const builder = path.join(runtime, 'builder-work', state.task_id);
  const reviewer = path.join(runtime, 'reviewer-work', state.task_id);
  assert.equal(git(builder, 'rev-parse', 'HEAD'), state.candidate_sha);
  assert.equal(git(builder, 'rev-parse', 'HEAD^{tree}'), state.tree_hash);
  assert.equal(git(reviewer, 'rev-parse', 'HEAD'), state.candidate_sha);
  assert.equal(git(source, 'rev-parse', 'HEAD'), base);
  assert.equal(git(source, 'status', '--porcelain'), '');
  const evidence = JSON.stringify(state.evidence);
  for (const type of ['builder_candidate', 'controller_verification', 'review_observation']) {
    assert.ok(evidence.includes(type), 'Missing observed evidence: ' + type);
  }
  console.log('PASS     source unchanged, controller-owned candidate/tree verified');
  console.log('PASS     separate reviewer workspace and bound evidence observed');
  const args = {
    operationId: 'reference-demo', repository: { nameWithOwner: 'synthetic/bar-reference',
      remoteFingerprint: 'f'.repeat(64) }, baseBranch: 'main',
    baseHead: base, candidateSha: state.candidate_sha, treeHash: state.tree_hash,
    evidenceHash: 'd'.repeat(64), candidateBranch: 'bar-candidate/reference-demo',
    providerId: 'synthetic-candidate-publisher', worker: {
      identity: 'worker:reference', role: 'publisher', capabilitiesHash: '1'.repeat(64)
    }, lease: { generation: 1, fencingTokenHash: 'e'.repeat(64) }
  };
  denied('default-branch write', () => createCandidatePublicationRequest({
    ...args, candidateBranch: 'main'
  }), /CANDIDATE_BRANCH_PREFIX_REQUIRED|CANDIDATE_DEFAULT_BRANCH_WRITE_FORBIDDEN/);
  denied('protected merge request', () => createCandidatePublicationRequest({
    ...args, actions: ['candidate_branch_create', 'merge']
  }), /CANDIDATE_PUBLISH_ACTION_NOT_ALLOWED/);
  console.log('RESULT   1/1 BOUNDED WORKFLOW VERIFIED; 2/2 ESCALATIONS BLOCKED');
  console.log('HUMAN_GATE_REQUIRED; no network publication, merge, deployment or release');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
