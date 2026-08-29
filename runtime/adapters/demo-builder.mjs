import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ensureGitRepo, gitIdentity } from '../core.mjs';

export async function runBuilder(task) {
  const repo=path.join(os.tmpdir(),`bounded-agent-workspace-${crypto.randomUUID()}`);
  ensureGitRepo(repo);
  const out=path.join(repo,'demo-output'); fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'artifact.txt'),`${task.task_id}\nsynthetic reversible demo change\n`);
  execFileSync('git',['-C',repo,'add','.']);
  execFileSync('git',['-C',repo,'commit','-q','--allow-empty','-m','synthetic bounded candidate']);
  const id=gitIdentity(repo);
  return {task_id:task.task_id,status:'PASS',repository:repo,artifact:'demo-output/artifact.txt',...id};
}
