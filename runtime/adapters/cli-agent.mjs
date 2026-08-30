import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { buildAgentInvocation, parseReviewOutput } from './contracts.mjs';

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { adapter, role, task, workspace, candidate, review_diff: reviewDiff = '', generic = null } = input;
if (!adapter || !role || !task?.task_id || !workspace) throw new Error('AGENT_INPUT_INVALID');

function workerConfig() {
  return task.workers?.[role] ?? { adapter };
}

function builderPrompt() {
  return [
    'You are the Builder inside Bounded Agent Runtime.',
    `Task: ${task.intent}`,
    `Allowed paths: ${task.allowed_paths.join(', ')}`,
    'Work only inside the provided workspace.',
    'Do not commit, push, merge, deploy, alter Git configuration, or expand your own permissions.',
    'Make the smallest correct code change. You may inspect files needed for the task.',
    'Do not claim completion unless the workspace contains the requested change.',
    'Finish with a short summary for the controller.'
  ].join('\n');
}

function reviewerPrompt() {
  return [
    'You are an independent Reviewer inside Bounded Agent Runtime.',
    `Task: ${task.intent}`,
    `Candidate commit: ${candidate?.candidate_sha ?? 'unknown'}`,
    `Candidate tree: ${candidate?.tree_hash ?? 'unknown'}`,
    'Review only. Do not modify files, commit, push, merge, deploy, or change permissions.',
    'Look for correctness, security, scope violations, missing tests, and evidence gaps.',
    reviewDiff ? `Candidate diff:\n${reviewDiff}` : 'Inspect the current workspace candidate.',
    'Return ONLY JSON: {"decision":"APPROVE"|"BLOCK","reason":"...","residual_risks":["..."]}'
  ].join('\n');
}


const prompt = role === 'builder' ? builderPrompt() : reviewerPrompt();
const call = buildAgentInvocation({adapter,role,task,workspace,prompt,generic});
const result = spawnSync(call.command, call.args, {
  cwd: workspace,
  encoding: 'utf8',
  timeout: Math.max(1000, Number(input.timeout_ms) || 30000),
  env: process.env,
  windowsHide: true,
  maxBuffer: 4 * 1024 * 1024
});
if (result.error?.code === 'ETIMEDOUT') throw new Error(`${adapter.toUpperCase()}_${role.toUpperCase()}_TIMEOUT`);
if (result.status !== 0) throw new Error(`${adapter.toUpperCase()}_${role.toUpperCase()}_FAILED:${String(result.stderr || '').trim().slice(0, 1000) || result.status}`);
const output = String(result.stdout || '').trim();
if (role === 'builder') {
  process.stdout.write(JSON.stringify({ status: 'PASS', artifact: `agent:${adapter}`, summary: output.slice(-4000) }));
} else {
  const review = parseReviewOutput(output);
  process.stdout.write(JSON.stringify({ ...review, reviewed_candidate_sha: candidate.candidate_sha, reviewed_tree_hash: candidate.tree_hash }));
}
