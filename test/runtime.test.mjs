import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  newLease, assertFreshLease, assertBudget, authorize, assertAllowedPath,
  createGateChallenge, canonicalGatePayload, verifyGateSignature, validateTask,
  ensureGitRepo, commitWorkspace, gitIdentity, assertWorkspaceIdentity, assertWorkerExecutionBoundary, assertVerificationExecutionBoundary
} from '../runtime/core.mjs';
import { assertTransition } from '../runtime/state-machine.mjs';
import { assertAdapterName } from '../runtime/adapters/registry.mjs';
import { hostMatches, isPrivateAddress, checkNetworkTarget, assertNetworkMethod, validateNetworkPolicy } from '../runtime/network-policy.mjs';
import { handleMcpRequest } from '../runtime/mcp-server.mjs';
import { createDashboardServer } from '../runtime/dashboard.mjs';
import { doctorReport, probeAgentVersion } from '../runtime/doctor.mjs';

test('illegal transitions fail closed', () => assert.throws(() => assertTransition('NEW','BUILDING'), /ILLEGAL_TRANSITION/));
test('unknown capability is denied', () => assert.throws(() => authorize({allowed_actions:['build_local'],protected_actions:[]}, 'remote_mutation'), /CAPABILITY_DENIED/));
test('task-declared protected action routes to Human Gate', () => assert.equal(authorize({allowed_actions:['merge'],protected_actions:['merge']}, 'merge'), 'HUMAN_GATE'));
test('protected but disallowed action is denied before Human Gate', () => assert.throws(() => authorize({allowed_actions:[],protected_actions:['merge']}, 'merge'), /CAPABILITY_DENIED:merge/));
test('expired lease is rejected', () => assert.throws(() => assertFreshLease(newLease('t1', -1)), /STALE_LEASE/));
test('fencing mismatch is rejected', () => assert.throws(() => assertFreshLease(newLease('t1',10000,5), 6), /FENCING_MISMATCH/));
test('model budget exhaustion rejected', () => assert.throws(() => assertBudget({started_at:new Date().toISOString(),budget:{limits:{model_calls:1,wall_clock_seconds:10},used:{model_calls:1}}},{model_calls:1}), /BUDGET_EXCEEDED:model_calls/));
test('wall-clock exhaustion rejected', () => assert.throws(() => assertBudget({started_at:new Date(Date.now()-5000).toISOString(),budget:{limits:{wall_clock_seconds:1},used:{}}}), /BUDGET_EXCEEDED:wall_clock_seconds/));
test('retry exhaustion rejected', () => assert.throws(() => assertBudget({started_at:new Date().toISOString(),budget:{limits:{retries:1,wall_clock_seconds:10},used:{retries:1}}},{retries:1}), /BUDGET_EXCEEDED:retries/));
test('path policy rejects traversal and non-allowlisted files', () => {
  const task={allowed_paths:['demo-output/']};
  assert.throws(() => assertAllowedPath(task,'../secret.txt'), /PATH_DENIED/);
  assert.throws(() => assertAllowedPath(task,'other/file.txt'), /PATH_DENIED/);
  assert.doesNotThrow(() => assertAllowedPath(task,'demo-output/file.txt'));
});
test('task schema fails closed', () => assert.throws(() => validateTask({task_id:'x'}), /TASK_FIELD_MISSING/));
test('gate signature binds identity and exact candidate', () => {
  const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
  const challenge=createGateChallenge({task_id:'t1',candidate_sha:'abc',tree_hash:'tree1',state_version:9});
  const identity='reviewer@example.invalid';
  const sig=crypto.sign(null,Buffer.from(canonicalGatePayload(challenge,identity)),privateKey).toString('base64');
  const pub=publicKey.export({type:'spki',format:'pem'});
  assert.doesNotThrow(() => verifyGateSignature(challenge,sig,pub,identity));
  assert.throws(() => verifyGateSignature({...challenge,candidate_sha:'tampered'},sig,pub,identity), /INVALID_HUMAN_GATE_SIGNATURE/);
  assert.throws(() => verifyGateSignature(challenge,sig,pub,'other'), /INVALID_HUMAN_GATE_SIGNATURE/);
});
test('controller-derived Git identity detects drift', () => {
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'bar-drift-'));
  const task={allowed_paths:['demo-output/']}; ensureGitRepo(repo);
  fs.mkdirSync(path.join(repo,'demo-output')); fs.writeFileSync(path.join(repo,'demo-output','x.txt'),'one');
  const id=commitWorkspace(repo,task,'one'); const state={...id};
  fs.writeFileSync(path.join(repo,'demo-output','x.txt'),'two'); commitWorkspace(repo,task,'two');
  assert.throws(() => assertWorkspaceIdentity(state,repo), /POST_TEST_CANDIDATE_DRIFT|POST_TEST_TREE_DRIFT/);
});
test('workspace hardlink escape is rejected before commit', () => {
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'bar-hardlink-'));
  const external=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'bar-external-')),'secret.txt');
  fs.writeFileSync(external,'outside'); ensureGitRepo(repo);
  fs.mkdirSync(path.join(repo,'demo-output')); fs.linkSync(external,path.join(repo,'demo-output','linked.txt'));
  assert.throws(() => commitWorkspace(repo,{allowed_paths:['demo-output/']},'blocked'), /WORKSPACE_HARDLINK_DENIED/);
});
test('source ref cannot inject Git options', () => {
  const task={schema_version:1,task_id:'x',intent:'x',allowed_actions:['build_local'],allowed_paths:['src'],protected_actions:[],budget:{model_calls:1,wall_clock_seconds:10,retries:0},source:{kind:'local_git',path:path.resolve('.'),ref:'--work-tree=outside'}};
  assert.throws(() => validateTask(task), /TASK_SOURCE_REF_INVALID/);
});

test('adapter registry enforces supported roles', () => {
  assert.equal(assertAdapterName('codex','builder'),'codex');
  assert.throws(() => assertAdapterName('ollama','builder'), /ADAPTER_ROLE_UNSUPPORTED/);
  assert.throws(() => assertAdapterName('missing','reviewer'), /ADAPTER_UNKNOWN/);
});

test('network policy host matcher does not overmatch suffixes', () => {
  assert.equal(hostMatches('*.example.com','api.example.com'), true);
  assert.equal(hostMatches('*.example.com','example.com'), false);
  assert.equal(hostMatches('*.example.com','evil-example.com'), false);
});

test('network policy rejects private and metadata addresses', () => {
  for (const address of ['127.0.0.1','10.1.2.3','172.16.1.1','192.168.1.1','169.254.169.254','::1','fd00::1','fe80::1']) assert.equal(isPrivateAddress(address), true, address);
  assert.equal(isPrivateAddress('8.8.8.8'), false);
});
test('network target check fails closed on DNS rebinding to private space', async () => {
  const policy={allowed_hosts:['api.example.com'],allowed_ports:[443],methods:['GET']};
  await assert.rejects(() => checkNetworkTarget('https://api.example.com/x', policy, async () => [{address:'203.0.113.10',family:4},{address:'127.0.0.1',family:4}]), /NETWORK_PRIVATE_ADDRESS_DENIED/);
  assert.throws(() => assertNetworkMethod('POST', policy), /NETWORK_METHOD_DENIED/);
});

test('MCP bridge exposes observation tools but no protected authority', () => {
  const listed=handleMcpRequest({jsonrpc:'2.0',id:1,method:'tools/list',params:{}});
  const names=listed.result.tools.map(tool=>tool.name);
  assert.deepEqual(names.sort(), ['bounded_doctor','bounded_evidence','bounded_status']);
  assert.equal(names.some(name=>/approve|merge|deploy|authorize/i.test(name)), false);
  const denied=handleMcpRequest({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'approve',arguments:{}}});
  assert.equal(denied.error.code, -32602);
});

test('dashboard refuses non-loopback bind addresses', () => {
  assert.throws(() => createDashboardServer({host:'0.0.0.0',port:0}), /DASHBOARD_LOOPBACK_ONLY/);
});

test('agent version probing is bounded and strips project authority', () => {
  process.env.BOUNDED_AGENT_TEST_SECRET='must-not-leak';
  let seen;
  const spawn=(command,args,options)=>{ seen={command,args,options}; return {status:0,stdout:'codex-cli 1.2.3\n',stderr:''}; };
  const result=probeAgentVersion('codex','codex',spawn);
  delete process.env.BOUNDED_AGENT_TEST_SECRET;
  assert.equal(result.version,'codex-cli 1.2.3'); assert.equal(result.version_probe,'ok');
  assert.equal(seen.options.timeout,2000); assert.equal(seen.options.cwd,os.tmpdir());
  assert.equal('BOUNDED_AGENT_TEST_SECRET' in seen.options.env,false);
});
test('agent version probing fails closed on timeout, missing executable and invalid output', () => {
  assert.equal(probeAgentVersion('codex',null).version_probe,'not_installed');
  assert.equal(probeAgentVersion('codex','codex',()=>({status:null,error:{code:'ETIMEDOUT'}})).version_probe,'timeout');
  assert.equal(probeAgentVersion('codex','codex',()=>({status:0,stdout:'',stderr:''})).version_probe,'invalid_output');
});

test('doctor is explicit that broker is not worker egress enforcement', () => {
  const report=doctorReport(); const check=report.checks.find(item=>item.id==='worker_egress');
  assert.ok(check); if (process.env.BOUNDED_AGENT_WORKER_EGRESS_ENFORCED !== '1') assert.match(check.detail, /broker is not a firewall/);
});
test('MCP modern wire stamps complete results and cache hints', () => {
  const meta={_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}};
  const discover=handleMcpRequest({jsonrpc:'2.0',id:10,method:'server/discover',params:meta});
  assert.equal(discover.result.resultType,'complete');
  assert.equal(discover.result.cacheScope,'private');
  assert.equal(typeof discover.result.ttlMs,'number');
  const listed=handleMcpRequest({jsonrpc:'2.0',id:11,method:'tools/list',params:meta});
  assert.equal(listed.result.resultType,'complete');
  assert.equal(listed.result.cacheScope,'private');
  const called=handleMcpRequest({jsonrpc:'2.0',id:12,method:'tools/call',params:{name:'bounded_status',arguments:{},...meta}});
  assert.equal(called.result.resultType,'complete');
});

test('MCP legacy initialize remains session-era compatible', () => {
  const init=handleMcpRequest({jsonrpc:'2.0',id:20,method:'initialize',params:{protocolVersion:'2025-11-25'}});
  assert.equal(init.result.protocolVersion,'2025-11-25');
  assert.equal('resultType' in init.result,false);
  const listed=handleMcpRequest({jsonrpc:'2.0',id:21,method:'tools/list',params:{}});
  assert.equal('resultType' in listed.result,false);
});
test('verification commands are structured argv and task-bound input only', () => {
  const base={schema_version:1,task_id:'verify-schema',intent:'x',allowed_actions:['build_local'],allowed_paths:['src'],protected_actions:[],budget:{model_calls:1,wall_clock_seconds:60,retries:0}};
  assert.throws(() => validateTask({...base,verification:{commands:[{command:'npm test',args:'--watch'}]}}), /TASK_VERIFICATION_COMMAND_INVALID/);
  assert.throws(() => validateTask({...base,verification:{commands:Array.from({length:21},()=>({command:'node',args:[]}))}}), /TASK_VERIFICATION_TOO_MANY_COMMANDS/);
  assert.doesNotThrow(() => validateTask({...base,verification:{commands:[{command:'node',args:['--version'],timeout_seconds:10}]}}));
});

test('agent CLI contracts keep authority outside model defaults', async () => {
  const { buildAgentInvocation } = await import('../runtime/adapters/contracts.mjs');
  const workspace=path.resolve('.'); const prompt='test';
  const mk=(adapter,role='builder',extra={})=>({adapter,role,workspace,prompt,task:{workers:{[role]:{adapter,...extra}}}});
  const codex=buildAgentInvocation(mk('codex'));
  assert.ok(codex.args.includes('workspace-write')); assert.ok(codex.args.includes('--ephemeral'));
  assert.equal(codex.args.some(x=>/dangerously|approve-for-me/i.test(x)),false);
  const codexReview=buildAgentInvocation(mk('codex','reviewer'));
  assert.ok(codexReview.args.includes('read-only'));
  const claude=buildAgentInvocation(mk('claude'));
  assert.ok(claude.args.includes('acceptEdits')); assert.ok(claude.args.includes('--strict-mcp-config'));
  assert.equal(claude.args.some(x=>/bypassPermissions|dangerously/i.test(x)),false);
  const claudeReview=buildAgentInvocation(mk('claude','reviewer'));
  assert.ok(claudeReview.args.includes('plan')); assert.ok(claudeReview.args.some(x=>x==='Read,Glob,Grep'));
  const opencode=buildAgentInvocation(mk('opencode'));
  assert.ok(opencode.args.includes('--pure')); assert.equal(opencode.args.includes('--auto'),false);
  assert.throws(()=>buildAgentInvocation(mk('ollama','builder',{model:'x'})),/ADAPTER_ROLE_UNSUPPORTED/);
  const ollama=buildAgentInvocation(mk('ollama','reviewer',{model:'qwen3:4b'})); assert.deepEqual(ollama.args.slice(0,2),['run','qwen3:4b']);
});

test('container tasks require immutable image digest binding', () => {
  const base={schema_version:1,task_id:'digest-task',intent:'x',allowed_actions:['build_local'],allowed_paths:['src'],protected_actions:[],budget:{model_calls:1,wall_clock_seconds:10,retries:0},workers:{builder:{adapter:'container',image:'node:20-alpine',command:'node',args:[]},reviewer:{adapter:'demo'}}};
  assert.throws(()=>validateTask(base),/TASK_CONTAINER_IMAGE_DIGEST_REQUIRED:builder/);
  const ok=structuredClone(base); ok.workers.builder.image='node@sha256:'+'a'.repeat(64);
  assert.doesNotThrow(()=>validateTask(ok));
});

test('controller-derived identity rejects uncommitted worktree drift', () => {
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'bar-dirty-drift-'));
  const task={allowed_paths:['demo-output/']}; ensureGitRepo(repo);
  fs.mkdirSync(path.join(repo,'demo-output')); fs.writeFileSync(path.join(repo,'demo-output','x.txt'),'one');
  const id=commitWorkspace(repo,task,'one');
  fs.writeFileSync(path.join(repo,'demo-output','x.txt'),'tampered');
  assert.throws(()=>assertWorkspaceIdentity({...id},repo),/POST_TEST_WORKTREE_DIRTY/);
});

test('protected mode only accepts technically isolated worker adapter', () => {
  assert.throws(()=>assertWorkerExecutionBoundary('codex','builder',true),/PROTECTED_MODE_REQUIRES_ISOLATED_WORKER:builder:codex/);
  assert.throws(()=>assertWorkerExecutionBoundary('demo','reviewer',true),/PROTECTED_MODE_REQUIRES_ISOLATED_WORKER:reviewer:demo/);
  assert.doesNotThrow(()=>assertWorkerExecutionBoundary('container','builder',true));
  assert.doesNotThrow(()=>assertWorkerExecutionBoundary('codex','builder',false));
});

test('protected mode denies local controller verification commands', () => {
  assert.throws(()=>assertVerificationExecutionBoundary(1,true),/PROTECTED_MODE_LOCAL_VERIFIER_DENIED/);
  assert.doesNotThrow(()=>assertVerificationExecutionBoundary(0,true));
  assert.doesNotThrow(()=>assertVerificationExecutionBoundary(1,false));
});


test('repository-controlled disabled-hooks cannot execute under controller Git', () => {
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'bar-repo-hook-')); const markers=[];
  ensureGitRepo(repo); fs.mkdirSync(path.join(repo,'.disabled-hooks'),{recursive:true}); fs.mkdirSync(path.join(repo,'demo-output'),{recursive:true});
  for (const name of ['pre-commit','prepare-commit-msg','commit-msg','post-commit']) { const marker=path.join(repo,'..',`repo-hook-${name}.txt`); markers.push(marker); const hook=path.join(repo,'.disabled-hooks',name); fs.writeFileSync(hook,`#!/bin/sh\necho pwned > \"${marker.replace(/\\/g,'/')}\"\n`); try{fs.chmodSync(hook,0o755)}catch{} }
  fs.writeFileSync(path.join(repo,'demo-output','base.txt'),'base\n'); execFileSync('git',['add','.'],{cwd:repo}); execFileSync('git',['commit','-q','-m','base'],{cwd:repo});
  fs.writeFileSync(path.join(repo,'demo-output','base.txt'),'changed\n'); commitWorkspace(repo,{allowed_paths:['demo-output']},'candidate');
  for (const marker of markers) assert.equal(fs.existsSync(marker),false,'repository-controlled hook executed with controller authority');
});


test('network policy rejects malformed limits and schema instead of failing open', () => {
  const base={version:1,allowed_hosts:['api.example.com']};
  assert.throws(()=>validateNetworkPolicy({...base,max_response_bytes:'unlimited'}),/NETWORK_POLICY_RESPONSE_LIMIT_INVALID/);
  assert.throws(()=>validateNetworkPolicy({...base,timeout_ms:0}),/NETWORK_POLICY_TIMEOUT_INVALID/);
  assert.throws(()=>validateNetworkPolicy({...base,allowed_hosts:['*example.com']}),/NETWORK_POLICY_HOSTS_INVALID/);
  assert.throws(()=>validateNetworkPolicy({...base,unexpected:true}),/NETWORK_POLICY_UNKNOWN_FIELD/);
  assert.throws(()=>validateNetworkPolicy({...base,secret_headers:{'evil.example.com':{Authorization:{secret:'x'}}}}),/NETWORK_POLICY_SECRET_HEADERS_INVALID/);
  assert.throws(()=>validateNetworkPolicy({...base,allowed_hosts:['*.com']}),/NETWORK_POLICY_HOSTS_INVALID/);
  assert.throws(()=>validateNetworkPolicy({...base,secret_headers:{'api.example.com':{Host:{secret:'x'}}}}),/NETWORK_POLICY_SECRET_HEADER_INVALID/);
  assert.throws(()=>validateNetworkPolicy({...base,secret_headers:{'api.example.com':{'Content-Length':{secret:'x'}}}}),/NETWORK_POLICY_SECRET_HEADER_INVALID/);
});
