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