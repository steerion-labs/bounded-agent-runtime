#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RUNTIME_ROOT, STATE_FILE, readJson } from '../runtime/core.mjs';
import { doctorReport, formatDoctor } from '../runtime/doctor.mjs';
import { adapterDefinitions, assertAdapterName, selectAvailableAdapter } from '../runtime/adapters/registry.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const argv = process.argv.slice(2);
const command = argv.shift();

function option(name, fallback = null) {
  const index = argv.indexOf(name);
  if (index < 0) return fallback;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`OPTION_VALUE_REQUIRED:${name}`);
  return value;
}
function has(name) { return argv.includes(name); }
function canonical(value) { if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'; if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key)+':'+canonical(value[key])).join(',') + '}'; return JSON.stringify(value); }
function options(name) { const values=[]; for(let i=0;i<argv.length;i+=1){ const token=argv[i]; if(token===name){ const value=argv[i+1]; if(value===undefined||value.startsWith('--')) throw new Error(`OPTION_VALUE_REQUIRED:${name}`); values.push(value); } else if(token.startsWith(`${name}=`)){ const value=token.slice(name.length+1); if(!value) throw new Error(`OPTION_VALUE_REQUIRED:${name}`); values.push(value); } } return values; }
function controller(args, { env = process.env, capture = false } = {}) {
  const result = spawnSync(process.execPath, [path.join(root, 'runtime', 'controller.mjs'), ...args], { stdio: capture ? ['ignore','pipe','pipe'] : 'inherit', encoding: capture ? 'utf8' : undefined, env, windowsHide: true });
  if (result.status !== 0) throw new Error(`CONTROLLER_EXIT:${result.status}:${String(result.stderr || '').trim()}`);
  return result;
}
function git(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`GIT_FAILED:${String(result.stderr || '').trim()}`);
  return String(result.stdout || '').trim();
}
function resolveContainerImage(image) {
  const r=spawnSync('docker',['image','inspect',image,'--format','{{json .RepoDigests}}'],{encoding:'utf8',windowsHide:true});
  if(r.status!==0) throw new Error(`CONTAINER_IMAGE_NOT_LOCAL:${image}:pull it explicitly before task creation`);
  let digests=[]; try{digests=JSON.parse(String(r.stdout||'[]').trim()||'[]')}catch{}
  const digest=digests.find(x=>typeof x==='string'&&x.includes('@sha256:'));
  if(!digest) throw new Error(`CONTAINER_IMAGE_DIGEST_REQUIRED:${image}`);
  return digest;
}
function workerSpec(role, adapter) {
  const model=option(`--${role}-model`);
  if(adapter!=='container') return {adapter,...(model?{model}:{}),...(role==='builder'&&adapter==='codex'&&has('--builder-allow-user-config')?{allow_user_config:true}:{})};
  const requested=option(`--${role}-image`), command=option(`--${role}-command`);
  if(!requested||!command) throw new Error(`CONTAINER_CONFIG_REQUIRED:${role}:use --${role}-image and --${role}-command`);
  const image=requested.includes('@sha256:')?requested:resolveContainerImage(requested);
  return {adapter,image,command,args:options(`--${role}-arg`),...(option(`--${role}-memory`)?{memory:option(`--${role}-memory`)}:{}),...(option(`--${role}-cpus`)?{cpus:option(`--${role}-cpus`)}:{})};
}

function generateTask({ intentFlag = '--intent', defaultOut = 'bounded-task.json', defaultBuilder = 'demo', defaultReviewer = 'demo', label = 'TASK_WRITTEN', allowDemoScopeExpansion = true, verificationSemantics = null, exclusiveOut = false, ensureDefaultOutDir = false } = {}) {
  const repoArg = option('--repo'); const intent = option(intentFlag);
  if (!repoArg || !intent) throw new Error('USAGE:bar task --repo <git-repo> --intent <text> [--builder auto|codex|claude|opencode|container|generic] [--reviewer auto|codex|claude|opencode|ollama|container|generic] [--builder-allow-user-config] [--verify npm --verify-arg test] [--out task.json]');
  const repo = path.resolve(repoArg); const top = git(repo, ['rev-parse','--show-toplevel']);
  if (git(top, ['status','--porcelain=v1','--untracked-files=all'])) throw new Error('SOURCE_REPO_DIRTY:commit or stash changes before creating a bounded task');
  const requestedBuilder = option('--builder', defaultBuilder); const requestedReviewer = option('--reviewer', defaultReviewer);
  const agents = doctorReport().agents;
  agents.container.configured_for_builder = Boolean(option('--builder-image') && option('--builder-command'));
  agents.container.configured_for_reviewer = Boolean(option('--reviewer-image') && option('--reviewer-command'));
  if (has('--builder-allow-user-config') && agents.codex) agents.codex.safe_for_builder = true;
  const builder = requestedBuilder === 'auto' ? selectAvailableAdapter('builder', agents) : requestedBuilder;
  const reviewer = requestedReviewer === 'auto' ? selectAvailableAdapter('reviewer', agents) : requestedReviewer;
  assertAdapterName(builder, 'builder'); assertAdapterName(reviewer, 'reviewer');
  if (builder === 'codex' && !has('--builder-allow-user-config')) throw new Error('CODEX_BUILDER_EXPLICIT_OPT_IN_REQUIRED:use --builder-allow-user-config only after reviewing local Codex user extensions');
  if (requestedBuilder === 'auto') console.log(`AUTO_SELECTED builder=${builder}`);
  if (requestedReviewer === 'auto') console.log(`AUTO_SELECTED reviewer=${reviewer}`);
  const repoEntries = git(top, ['ls-tree','--name-only','HEAD']).split(/\r?\n/).filter(Boolean);
  if (!repoEntries.length) throw new Error('SOURCE_REPO_EMPTY');
  let entries = options('--allow').map(value=>value.replaceAll('\\','/').replace(/^\.\//,'').replace(/\/$/,''));
  if (has('--allow-all')) entries=[...repoEntries];
  if (!entries.length) throw new Error('ALLOWED_PATH_REQUIRED:use --allow <path> (repeatable) or explicit --allow-all');
  if (builder === 'demo' && !entries.includes('demo-output')) {
    if (!allowDemoScopeExpansion) throw new Error('WORK_DEMO_SCOPE_REQUIRED:add `--allow demo-output` explicitly when using the synthetic demo builder');
    entries.push('demo-output');
  }
  const task = {
    schema_version: 1,
    task_id: option('--id', `bar-${Date.now()}`),
    intent,
    source: { kind: 'local_git', path: top, ref: git(top, ['rev-parse','HEAD']) },
    workers: {
      builder: workerSpec('builder',builder),
      reviewer: workerSpec('reviewer',reviewer)
    },
    allowed_actions: ['build_local','merge'],
    protected_actions: ['merge'],
    allowed_paths: entries,
    budget: { model_calls: 4, wall_clock_seconds: Number(option('--seconds', '900')), retries: 1 },
    ...(option('--verify') ? { verification: { ...(verificationSemantics ? { semantics: verificationSemantics } : {}), commands: [{ command: option('--verify'), args: options('--verify-arg'), timeout_seconds: Number(option('--verify-timeout', '120')) }] } } : {})
  };
  const fallbackOut = typeof defaultOut === 'function' ? defaultOut(task) : defaultOut;
  const requestedOut = option('--out');
  const out = path.resolve(requestedOut || fallbackOut);
  if (!requestedOut && ensureDefaultOutDir) fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(task, null, 2) + '\n', { encoding: 'utf8', ...(exclusiveOut ? { flag: 'wx' } : {}) });
  console.log(`${label} ${out}`);
  return { out, task };
}
function assertWorkVerificationProfile(command, args) {
  const exe = String(command || '').toLowerCase().replace(/\\/g,'/').split('/').at(-1)?.replace(/\.exe$/,'') || '';
  const a = (args || []).map(value => String(value).toLowerCase());
  const npmLike = ['npm','pnpm','yarn'].includes(exe) && (a[0] === 'test' || (a[0] === 'run' && ['test','lint','build','check','verify','typecheck'].includes(a[1])));
  const nodeTest = exe === 'node' && a.includes('--test');
  const pytest = exe === 'pytest' || (['python','python3','py'].includes(exe) && a[0] === '-m' && a[1] === 'pytest');
  const native = (exe === 'go' && a[0] === 'test') || (exe === 'cargo' && ['test','check','clippy'].includes(a[0])) || (exe === 'dotnet' && ['test','build'].includes(a[0])) || (['mvn','mvnw'].includes(exe) && a.includes('test')) || (['gradle','gradlew','make'].includes(exe) && a.some(value => ['test','check','verify','build'].includes(value)));
  if (!(npmLike || nodeTest || pytest || native)) throw new Error('WORK_VERIFICATION_PROFILE_REQUIRED:use a recognized test/check/build command shape; BAR proves execution/exit status, not semantic adequacy; lower-level `bar task` remains available for custom verification');
}

function workRequest() {
  if (!option('--repo') || !option('--goal')) throw new Error('USAGE:bar work --repo <git-repo> --goal <text> --allow <path> [--allow <path>] [--builder auto|...] [--reviewer auto|...] --verify <cmd> [--verify-arg <arg>] [--dry-run]');
  if (!option('--verify')) throw new Error('WORK_VERIFICATION_REQUIRED:bar work requires an explicit controller-observed verification command');
  assertWorkVerificationProfile(option('--verify'), options('--verify-arg'));
  if (fs.existsSync(STATE_FILE) && !has('--dry-run')) throw new Error('WORK_RUNTIME_NOT_EMPTY:inspect `bar status` and reset deliberately before starting another work request');
  const { out, task } = generateTask({ intentFlag: '--goal', defaultOut: task => path.join(RUNTIME_ROOT, 'work-requests', `${task.task_id}.json`), defaultBuilder: 'auto', defaultReviewer: 'auto', label: 'WORK_REQUEST_WRITTEN', allowDemoScopeExpansion: false, verificationSemantics: 'OPERATOR_DECLARED_COMMAND_EXECUTION_ONLY', exclusiveOut: true, ensureDefaultOutDir: true });
  console.log('WORK_REQUEST_RESOLVED');
  console.log(`Goal: ${task.intent}`);
  console.log(`Source: ${task.source.ref}`);
  console.log(`Scope: ${task.allowed_paths.join(', ')}`);
  console.log(`Builder / Reviewer: ${task.workers.builder.adapter} / ${task.workers.reviewer.adapter}`);
  console.log(`Verification: ${task.verification?.commands?.map(item => [item.command, ...(item.args || [])].join(' ')).join(' | ') || 'none'}`);
  console.log('Verification semantics: operator-declared command; BAR proves exact execution/exit status, not test semantic adequacy.');
  if (has('--dry-run')) { console.log('WORK_REQUEST_DRY_RUN no controller state created'); return; }
  controller(['init', out]);
  controller(['run']);
  showStatus(false);
}

function nextStepFor(state) {
  if (state === 'NOT_INITIALIZED') return 'Create a task with `bar task ...`, or run `bar quickstart`.';
  if (state === 'HUMAN_GATE') return 'Review the evidence. Sign and approve only if this exact candidate is acceptable.';
  if (state === 'ACCEPTED') return 'Protected authorization may now be checked with `bar authorize <action>`; BAR still performs no remote mutation.';
  if (['REJECTED','FAILED'].includes(state)) return 'Inspect evidence, fix the source/task, then `bar reset` before retrying.';
  return 'Run `bar run` to continue the bounded workflow, or `bar recover` after an interrupted controller.';
}
function showStatus(asJson = false) {
  if (!fs.existsSync(STATE_FILE)) {
    const empty = { initialized: false, state: 'NOT_INITIALIZED', next_step: nextStepFor('NOT_INITIALIZED') };
    console.log(asJson ? JSON.stringify(empty, null, 2) : `BAR status\nState: NOT_INITIALIZED\nNext: ${empty.next_step}`); return;
  }
  const state = readJson(STATE_FILE);
  const view = {
    initialized: true, task_id: state.task_id, state: state.state, state_version: state.state_version,
    candidate_sha: state.candidate_sha, tree_hash: state.tree_hash,
    builder_adapter: state.task?.workers?.builder?.adapter || 'demo', reviewer_adapter: state.task?.workers?.reviewer?.adapter || 'demo',
    evidence_count: state.evidence?.length || 0, human_gate_required: state.state === 'HUMAN_GATE', human_approval: Boolean(state.human_approval),
    next_step: nextStepFor(state.state)
  };
  if (asJson) return console.log(JSON.stringify(view, null, 2));
  console.log(['BAR status',`Task: ${view.task_id}`,`State: ${view.state}`,`Builder / Reviewer: ${view.builder_adapter} / ${view.reviewer_adapter}`,`Candidate: ${view.candidate_sha || 'not built yet'}`,`Evidence: ${view.evidence_count}`,`Human Gate: ${view.human_gate_required ? 'REQUIRED' : (view.human_approval ? 'APPROVED' : 'not reached')}`,`Next: ${view.next_step}`].join('\n'));
}
function quickstart() {
  const report=doctorReport();
  const failed=report.checks.filter(x=>x.severity==='required'&&!x.ok);
  console.log('BAR 5-minute quickstart');
  console.log('1/4 Prerequisites');
  if(failed.length) throw new Error(`QUICKSTART_PREREQUISITE_FAILED:${failed.map(x=>x.id).join(',')}`);
  console.log('    PASS Node 20+ and Git');
  const demoRoot=fs.mkdtempSync(path.join(process.env.TEMP || process.env.TMP || process.cwd(),'bar-quickstart-'));
  const env={...process.env,BOUNDED_AGENT_RUNTIME_ROOT:path.join(demoRoot,'runtime')};
  try {
    console.log('2/4 Initialize isolated synthetic task'); controller(['init',path.join(root,'examples','task.example.json')],{env,capture:true});
    console.log('3/4 Run Builder, verification and Reviewer'); const result=controller(['run'],{env,capture:true});
    const output=String(result.stdout||'')+String(result.stderr||''); if(!output.includes('HUMAN_GATE_REQUIRED')) throw new Error('QUICKSTART_EXPECTED_HUMAN_GATE_NOT_REACHED');
    console.log('4/4 PASS: HUMAN_GATE_REQUIRED');
    console.log('BAR stopped before any protected remote action. Next: create a real task with `bar task --repo ...`.');
  } finally { fs.rmSync(demoRoot,{recursive:true,force:true}); }
}
function friendlyError(message) {
  if (message.includes('_AUTH_REQUIRED')) return `${message}\nNEXT: Authenticate the selected agent CLI outside BAR, then rerun the same bounded task. BAR will not switch adapters silently.`;
  const guides=[
    ['ALLOWED_PATH_REQUIRED','No write scope was granted. Add `--allow <path>` (repeatable) or explicitly use `--allow-all`.'],
    ['SOURCE_REPO_DIRTY','The source repository has uncommitted changes. Commit or stash them, then retry.'],
    ['TASK_FILE_REQUIRED','No task is initialized. Run `bar task ...` then `bar run --task <file>`, or try `bar quickstart`.'],
    ['RUNTIME_ALREADY_INITIALIZED_FOR','BAR already owns another persisted task. Inspect `bar status`; use `bar reset` only when you intend to discard it.'],
    ['TASK_FILE_MISMATCH','The supplied task differs from persisted authority. Do not overwrite authority in place; inspect status and reset deliberately.'],
    ['ADAPTER_UNKNOWN','Unknown adapter. Run `bar agents` and see docs/19-ADAPTER-CONFORMANCE.md.'],
    ['AUTO_ADAPTER_UNAVAILABLE','No installed adapter can satisfy that role. Run `bar agents`, install one, then recreate the task.'],
    ['CONTROLLER_EXIT','The controller failed closed. Run `bar status` and `bar recover`; inspect the attached controller error before resetting.'],
    ['QUICKSTART_PREREQUISITE_FAILED','A required prerequisite is missing. Run `bar doctor` for the exact check and install it before retrying.'],
    ['WORK_RUNTIME_NOT_EMPTY','An existing controller task is still active. Inspect `bar status`; use `bar reset` only when you deliberately want to discard it.'],
    ['WORK_DEMO_SCOPE_REQUIRED','The synthetic demo builder writes `demo-output`; grant that path explicitly or choose another builder.'],
    ['WORK_VERIFICATION_PROFILE_REQUIRED','Use a recognized test/check/build command shape. BAR records exact execution evidence but does not claim semantic adequacy.']
  ];
  const hit=guides.find(([prefix])=>message.startsWith(prefix));
  return hit ? `${message}\nNEXT: ${hit[1]}` : message;
}
function help() {
  console.log(`Bounded Agent Runtime CLI\n\nbar quickstart\nbar work --repo <path> --goal <text> --allow <path> [--builder auto] [--reviewer auto] [--verify npm --verify-arg test] [--dry-run]\nbar doctor [--json]\nbar agents [--json]\nbar task ... container: --builder container --builder-image <image> --builder-command <cmd> [--builder-arg <arg>]\nbar task --repo <path> --intent <text> --allow <path> [--allow <path>] [--builder auto|codex|claude|opencode|container|generic] [--reviewer auto|codex|claude|opencode|ollama|container|generic] [--builder-allow-user-config] [--verify npm --verify-arg test]\nbar run --task <task.json>\nbar status [--json]\nbar recover\nbar reset\nbar gate keygen [dir]\nbar gate sign <private.pem>\nbar approve <signature>\nbar authorize <protected-action>\nbar dashboard [--port 4780]\nbar mcp\nbar net check <url> --policy <file>\nbar secret set <name>\nbar secret list`);
}

try {
  if (!command || command === 'help' || command === '--help' || command === '-h') help();
  else if (command === 'quickstart') quickstart();
  else if (command === 'work') workRequest();
  else if (command === 'doctor') { const report = doctorReport(); console.log(has('--json') ? JSON.stringify(report, null, 2) : formatDoctor(report)); if (report.status === 'FAIL') process.exitCode = 1; }
  else if (command === 'agents') { const agents = doctorReport().agents; console.log(has('--json') ? JSON.stringify(agents, null, 2) : Object.entries(agents).map(([n,a]) => `${a.installed ? 'OK' : '--'} ${n.padEnd(12)} ${a.roles.join('/')} ${a.executable || 'not found'} | ${a.boundary || 'controller-enforced'}`).join('\n')); }
  else if (command === 'task') generateTask();
  else if (command === 'run') { const task = option('--task'); if (!fs.existsSync(STATE_FILE)) { if (!task) throw new Error('TASK_FILE_REQUIRED'); controller(['init', path.resolve(task)]); } else if (task) { const requested=readJson(path.resolve(task)); const current=readJson(STATE_FILE); if(requested.task_id!==current.task_id) throw new Error(`RUNTIME_ALREADY_INITIALIZED_FOR:${current.task_id}:run bar reset before another task`); if(canonical(requested)!==canonical(current.task)) throw new Error('TASK_FILE_MISMATCH:the supplied task differs from persisted authority'); } controller(['run']); }
  else if (command === 'status') showStatus(has('--json'));
  else if (command === 'recover') controller(['recover']);
  else if (command === 'reset') controller(['reset']);
  else if (command === 'gate' && argv[0] === 'keygen') { const dir=argv[1] || '.human-gate'; const result=spawnSync(process.execPath,[path.join(root,'runtime','gate.mjs'),'keygen',path.resolve(dir)],{stdio:'inherit',env:process.env,windowsHide:true}); if(result.status!==0) throw new Error(`GATE_EXIT:${result.status}`); }
  else if (command === 'gate' && argv[0] === 'sign') { const key=argv[1]; if(!key) throw new Error('PRIVATE_KEY_REQUIRED'); const result=spawnSync(process.execPath,[path.join(root,'runtime','gate.mjs'),'sign',path.resolve(key)],{stdio:'inherit',env:process.env,windowsHide:true}); if(result.status!==0) throw new Error(`GATE_EXIT:${result.status}`); }
  else if (command === 'approve') { const signature=argv[0]; if(!signature) throw new Error('APPROVAL_SIGNATURE_REQUIRED'); controller(['approve',signature]); }
  else if (command === 'authorize') { const action=argv[0]; if(!action) throw new Error('PROTECTED_ACTION_REQUIRED'); controller(['authorize-protected',action]); }
  else if (command === 'dashboard') {
    const { createDashboardServer } = await import('../runtime/dashboard.mjs'); const port = Number(option('--port', '4780'));
    createDashboardServer({ port }); console.log(`BAR_DASHBOARD http://127.0.0.1:${port}`);
  }
  else if (command === 'mcp') { const { startStdioMcp } = await import('../runtime/mcp-server.mjs'); startStdioMcp(); }
  else if (command === 'net' && argv[0] === 'check') {
    const { readNetworkPolicy, checkNetworkTarget } = await import('../runtime/network-policy.mjs'); const policyFile = option('--policy'); const target = argv[1];
    if (!policyFile || !target) throw new Error('USAGE:bar net check <url> --policy <file>');
    const checked = await checkNetworkTarget(target, readNetworkPolicy(path.resolve(policyFile))); console.log(JSON.stringify({ allowed: true, host: checked.url.hostname, addresses: checked.addresses }, null, 2));
  }
  else if (command === 'secret' && argv[0] === 'set') {
    const { setBrokerSecret } = await import('../runtime/broker.mjs'); const name = argv[1]; if (!name) throw new Error('SECRET_NAME_REQUIRED');
    const envName = option('--from-env'); let value;
    if (envName) value = process.env[envName]; else { if (process.stdin.isTTY) throw new Error('SECRET_STDIN_REQUIRED:pipe the secret or use --from-env'); value = fs.readFileSync(0, 'utf8').replace(/[\r\n]+$/, ''); }
    setBrokerSecret(name, value); console.log(`SECRET_STORED ${name}`);
  }
  else if (command === 'secret' && argv[0] === 'list') { const { listBrokerSecrets } = await import('../runtime/broker.mjs'); console.log(listBrokerSecrets().join('\n')); }
  else if (command === 'broker' && argv[0] === 'request') {
    const { readNetworkPolicy } = await import('../runtime/network-policy.mjs'); const { brokerRequest } = await import('../runtime/broker.mjs');
    const target = argv[1], policyFile = option('--policy'); if (!target || !policyFile) throw new Error('USAGE:bar broker request <url> --policy <file>');
    const bodyFile = option('--body-file'); const response = await brokerRequest({ url: target, method: option('--method', 'GET'), body: bodyFile ? fs.readFileSync(path.resolve(bodyFile)) : null, policy: readNetworkPolicy(path.resolve(policyFile)) });
    console.log(JSON.stringify(response, null, 2));
  }
  else throw new Error(`UNKNOWN_COMMAND:${command}`);
} catch (error) { const message=error instanceof Error ? error.message : String(error); console.error(friendlyError(message)); process.exitCode = 1; }
