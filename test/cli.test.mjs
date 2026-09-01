import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import http from 'node:http';
import { createDashboardServer } from '../runtime/dashboard.mjs';

const repo=path.resolve(import.meta.dirname,'..');
const bar=path.join(repo,'bin','bar.mjs');
function sourceRepo(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bar-cli-src-')); execFileSync('git',['init','-q'],{cwd:dir});
  execFileSync('git',['config','user.name','test'],{cwd:dir}); execFileSync('git',['config','user.email','test@invalid'],{cwd:dir});
  fs.mkdirSync(path.join(dir,'src')); fs.writeFileSync(path.join(dir,'src','x.txt'),'x\n'); execFileSync('git',['add','.'],{cwd:dir}); execFileSync('git',['commit','-q','-m','base'],{cwd:dir}); return dir;
}
const run=(args,cwd=repo,env=process.env)=>spawnSync(process.execPath,[bar,...args],{cwd,encoding:'utf8',env});

test('bar task requires explicit path authority',()=>{
  const src=sourceRepo(); const result=run(['task','--repo',src,'--intent','x']);
  assert.notEqual(result.status,0); assert.match(result.stderr,/ALLOWED_PATH_REQUIRED/);
});

test('bar task binds clean source commit and selected path',()=>{
  const src=sourceRepo(), cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-cli-out-')), out=path.join(cwd,'task.json');
  const result=run(['task','--repo',src,'--intent','x','--allow','src','--out',out],cwd); assert.equal(result.status,0,result.stderr);
  const task=JSON.parse(fs.readFileSync(out,'utf8')); assert.deepEqual(task.allowed_paths,['src','demo-output']);
  assert.equal(task.source.ref,execFileSync('git',['rev-parse','HEAD'],{cwd:src,encoding:'utf8'}).trim());
});

test('bar secret list reveals names but not secret values',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-secret-')), root=path.join(cwd,'runtime');
  const env={...process.env,BOUNDED_AGENT_RUNTIME_ROOT:root,TEST_BAR_SECRET:'never-print-this'};
  const set=run(['secret','set','api_demo','--from-env','TEST_BAR_SECRET'],cwd,env); assert.equal(set.status,0,set.stderr); assert.doesNotMatch(set.stdout,/never-print-this/);
  const list=run(['secret','list'],cwd,env); assert.equal(list.status,0,list.stderr); assert.match(list.stdout,/api_demo/); assert.doesNotMatch(list.stdout,/never-print-this/);
  assert.equal(fs.readFileSync(path.join(root,'secrets','broker','api_demo'),'utf8'),'never-print-this');
});

function getLocal(port,pathname){return new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port,path:pathname,headers:{connection:'close'},agent:false},res=>{const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8')}));});req.on('error',reject);});}
test('dashboard serves sanitized status on loopback',async()=>{
  const server=createDashboardServer({port:0}); await new Promise(resolve=>server.once('listening',resolve));
  try {
    const address=server.address(); assert.ok(address&&typeof address==='object');
    const response=await getLocal(address.port,'/api/status'); assert.equal(response.status,200);
    const body=JSON.parse(response.body); assert.equal(typeof body.state,'string'); assert.equal('signature' in body,false);
    const page=await getLocal(address.port,'/'); assert.equal(page.status,200); assert.match(page.body,/Read-only local control view/);
  } finally { server.closeAllConnections?.(); await new Promise(resolve=>server.close(resolve)); }
});

test('bar run rejects same task id with different persisted authority',()=>{
  const src=sourceRepo(), cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-cli-match-')), taskFile=path.join(cwd,'task.json');
  const env={...process.env,BOUNDED_AGENT_RUNTIME_ROOT:path.join(cwd,'runtime')};
  const made=run(['task','--repo',src,'--intent','x','--allow','src','--out',taskFile],cwd,env); assert.equal(made.status,0,made.stderr);
  const first=run(['run','--task',taskFile],cwd,env); assert.equal(first.status,0,first.stderr); assert.match(first.stdout,/HUMAN_GATE_REQUIRED/);
  const altered=JSON.parse(fs.readFileSync(taskFile,'utf8')); altered.intent='different authority with same id'; const other=path.join(cwd,'task-altered.json'); fs.writeFileSync(other,JSON.stringify(altered,null,2));
  const second=run(['run','--task',other],cwd,env); assert.notEqual(second.status,0); assert.match(second.stderr,/TASK_FILE_MISMATCH/);
});

test('bar quickstart reaches Human Gate without architecture knowledge',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-quickstart-cli-'));
  const result=run(['quickstart'],cwd,{...process.env,BOUNDED_AGENT_RUNTIME_ROOT:path.join(cwd,'unused')});
  assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/4\/4 PASS: HUMAN_GATE_REQUIRED/); assert.match(result.stdout,/stopped before any protected remote action/i);
});

test('bar status explains next safe step when uninitialized',()=>{
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bar-status-cli-'));
  const result=run(['status'],cwd,{...process.env,BOUNDED_AGENT_RUNTIME_ROOT:path.join(cwd,'runtime')});
  assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/State: NOT_INITIALIZED/); assert.match(result.stdout,/bar quickstart/);
});

test('CLI adapter contracts keep unsafe bypass flags out of primary defaults',async()=>{
  const { buildAgentInvocation } = await import('../runtime/adapters/contracts.mjs');
  const task={workers:{builder:{adapter:'codex'},reviewer:{adapter:'claude'}},task_id:'t',intent:'x',allowed_paths:['src']};
  const codex=buildAgentInvocation({adapter:'codex',role:'builder',task,workspace:'C:/w',prompt:'x'});
  assert.ok(codex.args.includes('workspace-write')); assert.equal(codex.args.includes('danger-full-access'),false); assert.equal(codex.args.includes('--full-auto'),false);
  const claude=buildAgentInvocation({adapter:'claude',role:'reviewer',task,workspace:'C:/w',prompt:'x'});
  assert.ok(claude.args.includes('plan')); assert.ok(claude.args.includes('--safe-mode')); assert.equal(typeof claude.input,'string'); assert.equal(claude.args.includes('--dangerously-skip-permissions'),false);
  const openTask={...task,workers:{builder:{adapter:'opencode'}}};
  const opencode=buildAgentInvocation({adapter:'opencode',role:'builder',task:openTask,workspace:'C:/w',prompt:'x'});
  assert.ok(opencode.args.includes('--pure')); assert.equal(opencode.args.includes('--auto'),false);
});

test('Windows npm command shims resolve without shell execution', async t => {
  if (process.platform !== 'win32') return t.skip('Windows-specific launcher contract');
  const { resolveLaunchCommand } = await import('../runtime/adapters/launcher.mjs');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bar-launcher-'));
  const target=path.join(dir,'node_modules','demo','bin','tool.js'); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,'');
  const shim=path.join(dir,'bar-test-shim.cmd');
  fs.writeFileSync(shim,'@ECHO off\r\n"%dp0%\\node.exe" "%dp0%\\node_modules\\demo\\bin\\tool.js" %*\r\n');
  const previous=process.env.PATH; process.env.PATH=`${dir};${previous}`;
  try {
    const resolved=resolveLaunchCommand('bar-test-shim',['hello']);
    assert.equal(resolved.command,process.execPath); assert.equal(path.normalize(resolved.args[0]),path.normalize(target)); assert.equal(resolved.args[1],'hello');
  } finally { process.env.PATH=previous; fs.rmSync(dir,{recursive:true,force:true}); }
});

test('launcher failures preserve actionable OS error details', async()=>{
  const { launchFailureDetail, classifyLaunchFailure } = await import('../runtime/adapters/launcher.mjs');
  assert.match(launchFailureDetail({error:{code:'ENOENT',message:'spawn missing ENOENT'}}),/ENOENT/);
  assert.equal(launchFailureDetail({status:null,stderr:'',stdout:''}),'NO_EXIT_STATUS');
  assert.match(classifyLaunchFailure('claude','reviewer',{status:1,stderr:'Failed to authenticate: OAuth session expired'}),/CLAUDE_REVIEWER_AUTH_REQUIRED/);
});

test('auto adapter selection is deterministic and role-aware',async()=>{
  const { selectAvailableAdapter } = await import('../runtime/adapters/registry.mjs');
  const agents={codex:{installed:false},claude:{installed:true},opencode:{installed:true},ollama:{installed:true},container:{installed:false},generic:{installed:false}};
  assert.equal(selectAvailableAdapter('builder',agents),'claude');
  assert.equal(selectAvailableAdapter('reviewer',agents),'claude');
  const reviewerOnly={...agents,claude:{installed:false},opencode:{installed:false}};
  assert.equal(selectAvailableAdapter('reviewer',reviewerOnly),'ollama');
  assert.throws(()=>selectAvailableAdapter('builder',reviewerOnly),/AUTO_ADAPTER_UNAVAILABLE:builder/);
});

test('auto adapter selection skips unauthenticated or unsafe builders',async()=>{
  const { selectAvailableAdapter } = await import('../runtime/adapters/registry.mjs');
  const agents={codex:{installed:true,authenticated:true,safe_for_builder:false},claude:{installed:true,authenticated:false},opencode:{installed:true,authenticated:true},container:{installed:false},generic:{installed:false}};
  assert.equal(selectAvailableAdapter('builder',agents),'opencode');
  assert.equal(selectAvailableAdapter('reviewer',agents),'codex');
});

test('Codex builder user extensions fail closed without task opt-in',async()=>{
  const { inspectCodexUserExtensions, assertCodexBuilderConfigAllowed } = await import('../runtime/adapters/codex-policy.mjs');
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'bar-codex-policy-'));
  fs.writeFileSync(path.join(home,'config.toml'),'[mcp_servers.demo]\ncommand="demo"\n[features]\nhooks = true\n');
  const env={...process.env,CODEX_HOME:home};
  try {
    const state=inspectCodexUserExtensions(env); assert.equal(state.risky,true); assert.ok(state.reasons.includes('mcp_servers')); assert.ok(state.reasons.includes('hooks'));
    assert.throws(()=>assertCodexBuilderConfigAllowed({workers:{builder:{adapter:'codex'}}},env),/CODEX_USER_EXTENSIONS_ACTIVE/);
    assert.doesNotThrow(()=>assertCodexBuilderConfigAllowed({workers:{builder:{adapter:'codex',allow_user_config:true}}},env));
  } finally { fs.rmSync(home,{recursive:true,force:true}); }
});

test('Windows launcher preserves PATH directory precedence', async t => {
  if (process.platform !== 'win32') return t.skip('Windows-specific launcher contract');
  const { resolveLaunchCommand } = await import('../runtime/adapters/launcher.mjs');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bar-path-order-'));
  const first=path.join(root,'first'), second=path.join(root,'second'); fs.mkdirSync(first); fs.mkdirSync(second);
  const target=path.join(first,'tool.js'); fs.writeFileSync(target,'');
  fs.writeFileSync(path.join(first,'bar-order.cmd'),'@ECHO off\r\n"%dp0%\\tool.js" %*\r\n');
  fs.writeFileSync(path.join(second,'bar-order.exe'),'not-a-real-exe');
  const prevPath=process.env.PATH, prevExt=process.env.PATHEXT; process.env.PATH=`${first};${second};${prevPath}`; process.env.PATHEXT='.EXE;.COM;.BAT;.CMD';
  try { const resolved=resolveLaunchCommand('bar-order',[]); assert.equal(resolved.command,process.execPath); assert.equal(path.normalize(resolved.args[0]),path.normalize(target)); }
  finally { process.env.PATH=prevPath; if(prevExt===undefined) delete process.env.PATHEXT; else process.env.PATHEXT=prevExt; fs.rmSync(root,{recursive:true,force:true}); }
});

test('auto selection never picks an unconfigured container',async()=>{
  const { selectAvailableAdapter } = await import('../runtime/adapters/registry.mjs');
  const agents={codex:{installed:true,authenticated:true,safe_for_builder:false},claude:{installed:true,authenticated:false},opencode:{installed:true,authenticated:false},container:{installed:true,configured_for_builder:false},generic:{installed:false}};
  assert.throws(()=>selectAvailableAdapter('builder',agents),/AUTO_ADAPTER_UNAVAILABLE:builder/);
  agents.container.configured_for_builder=true; assert.equal(selectAvailableAdapter('builder',agents),'container');
});
