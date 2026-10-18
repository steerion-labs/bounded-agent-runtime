import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
function value(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}
function has(flag) { return args.includes(flag); }

const outDir = path.resolve(value('--out') || 'bar-proof/security-evidence');
const includeContainer = has('--include-container');
const timeoutMs = Number(value('--timeout-ms') || 300000);

function run(command, argv, options = {}) {
  const result = spawnSync(command, argv, {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: options.timeout || timeoutMs,
    env: options.env || process.env,
    shell: false,
    windowsHide: true
  });
  return {
    command: [command].concat(argv).join(' '),
    status: result.error && result.error.code === 'ETIMEDOUT' ? 'TIMEOUT' : result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status,
    signal: result.signal,
    stdout: String(result.stdout || '').slice(-16000),
    stderr: String(result.stderr || '').slice(-16000),
    error: result.error ? String(result.error.message || result.error) : null
  };
}

function git(...argv) {
  const r = run('git', argv, { timeout: 30000 });
  if (r.status !== 'PASS') throw new Error('GIT_FAILED:' + argv.join(' ') + ':' + (r.stderr || r.stdout));
  return r.stdout.trim();
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function scanTrackedFiles() {
  const listed = run('git', ['ls-files', '-z'], { timeout: 30000 });
  if (listed.status !== 'PASS') throw new Error('GIT_LS_FILES_FAILED');
  const files = listed.stdout.split('\0').filter(Boolean);
  const rules = [
    ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
    ['github_token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,255}|github_pat_[A-Za-z0-9_]{20,255})\b/g],
    ['openai_key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
    ['anthropic_key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g],
    ['aws_access_key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
    ['google_api_key', /\bAIza[0-9A-Za-z_-]{35}\b/g],
    ['slack_token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g]
  ];
  const findings = [];
  let scanned = 0;
  let binarySkipped = 0;
  for (const file of files) {
    const full = path.resolve(file);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
    const buf = fs.readFileSync(full);
    if (buf.includes(0)) {
      binarySkipped++;
      continue;
    }
    scanned++;
    const text = buf.toString('utf8');
    for (const item of rules) {
      const rule = item[0];
      const re = item[1];
      re.lastIndex = 0;
      if (re.test(text)) findings.push({ file, rule });
    }
  }
  return {
    status: findings.length ? 'FAIL' : 'PASS',
    trackedFiles: files.length,
    textFilesScanned: scanned,
    binaryFilesSkipped: binarySkipped,
    findings
  };
}

function getTestFiles() {
  return fs.readdirSync(path.resolve('test'))
    .filter(name => name.endsWith('.test.mjs'))
    .filter(name => includeContainer || name !== 'container.e2e.mjs')
    .sort();
}

function runTests() {
  const results = [];
  for (const name of getTestFiles()) {
    const result = run(process.execPath, ['--test', path.join('test', name)]);
    results.push({
      file: 'test/' + name,
      status: result.status,
      exitCode: result.exitCode,
      signal: result.signal,
      error: result.error,
      stdoutTail: result.stdout,
      stderrTail: result.stderr
    });
    console.log(result.status.padEnd(7) + ' test/' + name);
  }
  return results;
}

fs.mkdirSync(outDir, { recursive: true });

const head = git('rev-parse', 'HEAD');
const tree = git('rev-parse', 'HEAD^{tree}');
const statusPorcelain = git('status', '--porcelain=v1', '--untracked-files=no');
const clean = statusPorcelain.length === 0;
const branchResult = run('git', ['branch', '--show-current'], { timeout: 30000 });
const branch = branchResult.stdout.trim() || null;
const secretScan = scanTrackedFiles();
const tests = runTests();

const packageLock = path.resolve('package-lock.json');
let dependencyInventory = { status: 'NOT_PRESENT', packageCount: null, lockfileSha256: null };
if (fs.existsSync(packageLock)) {
  const lock = JSON.parse(fs.readFileSync(packageLock, 'utf8'));
  dependencyInventory = {
    status: 'PASS',
    packageCount: Object.keys(lock.packages || {}).length,
    lockfileSha256: sha256File(packageLock)
  };
}

const failedTests = tests.filter(t => t.status !== 'PASS');
const overall = clean && secretScan.status === 'PASS' && failedTests.length === 0 ? 'PASS' : 'REVIEW_REQUIRED';

const manifest = {
  schemaVersion: 'bar.security-evidence-pack.v1',
  generatedAt: new Date().toISOString(),
  status: overall,
  exactHead: head,
  exactTree: tree,
  branch,
  cleanTrackedState: clean,
  nodeVersion: process.version,
  platform: process.platform + '-' + process.arch,
  timeoutMs,
  includeContainer,
  secretScan,
  dependencyInventory,
  tests: tests.map(t => ({
    file: t.file,
    status: t.status,
    exitCode: t.exitCode,
    signal: t.signal,
    error: t.error
  })),
  limitations: [
    'This pack is local exact-head evidence, not a third-party audit or certification.',
    'The tracked-file secret scan does not replace a full Git-history secret scan.',
    includeContainer
      ? 'Container E2E was requested; Docker daemon and host compromise remain outside the controller guarantee.'
      : 'Container E2E was not requested; run with --include-container where Docker evidence is required.',
    'Host effective-access claims require separate Linux/Windows identity and filesystem proof.',
    'Live-agent adversarial evaluation requires a separately approved safe worker and cost-controlled credentials.'
  ]
};

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const rows = tests.map(t => '| ' + t.file + ' | ' + t.status + ' |').join('\n');
const summary = [
  '# BAR Security Evidence Pack',
  '',
  '- Status: **' + overall + '**',
  '- Exact HEAD: ' + head,
  '- Exact tree: ' + tree,
  '- Clean tracked state: **' + (clean ? 'PASS' : 'FAIL') + '**',
  '- Tracked-file secret baseline: **' + secretScan.status + '**',
  '- Node: ' + process.version,
  '- Platform: ' + process.platform + '-' + process.arch,
  '- Container E2E included: **' + (includeContainer ? 'yes' : 'no') + '**',
  '',
  '## Per-file tests',
  '',
  '| Test file | Result |',
  '| --- | --- |',
  rows,
  '',
  '## Scope',
  '',
  'This bundle is exact-head local evidence. It does not certify the host, Docker daemon, credentials, external side-effect adapter, or organizational Reviewer independence.',
  '',
  'See docs/30-SECURITY-EVIDENCE.md and security/SECURITY_MATRIX.md for the control-level interpretation.',
  ''
].join('\n');
fs.writeFileSync(path.join(outDir, 'summary.md'), summary);

console.log('EVIDENCE_HEAD=' + head);
console.log('EVIDENCE_TREE=' + tree);
console.log('EVIDENCE_SECRET_SCAN=' + secretScan.status);
console.log('EVIDENCE_TESTS_PASS=' + (tests.length - failedTests.length) + '/' + tests.length);
console.log('EVIDENCE_STATUS=' + overall);
console.log('EVIDENCE_MANIFEST=' + path.join(outDir, 'manifest.json'));

if (overall !== 'PASS') process.exitCode = 1;
