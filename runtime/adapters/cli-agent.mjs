import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { buildAgentInvocation, parseReviewOutput } from './contracts.mjs';
import { resolveLaunchCommand, classifyLaunchFailure } from './launcher.mjs';
import { assertCodexBuilderConfigAllowed } from './codex-policy.mjs';
import { assertPrimeAgentPocAllowed, primeAgentPocEnv } from './prime-agent-policy.mjs';

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const { adapter, role, task, workspace, candidate, review_diff: reviewDiff = '', generic = null } = input;
if (!adapter || !role || !task?.task_id || !workspace) throw new Error('AGENT_INPUT_INVALID');

function builderPrompt() {
  return [
    'You are the Builder inside Bounded Agent Runtime.',
    `Task: ${task.intent}`,
    `Allowed paths: ${task.allowed_paths.join(', ')}`,
    'Work only inside the provided workspace.',
    'Do not commit, push, merge, deploy, alter Git configuration, create schedules, persist goals, install skills, or expand your own permissions.',
    'Do not access credentials or network resources unless the controller explicitly provides a bounded capability.',
    'Make the smallest correct code change. You may inspect files needed for the task.',
    'Do not claim completion unless the workspace contains the requested change.',
    'Finish with a short summary for the controller.'
  ].join('\n');
}

function reviewerPrompt() {
  return [
    'You are the Reviewer inside Bounded Agent Runtime.',
    `Task: ${task.intent}`,
    `Candidate commit: ${candidate?.candidate_sha ?? 'unknown'}`,
    `Candidate tree: ${candidate?.tree_hash ?? 'unknown'}`,
    'Review only. Do not modify files, commit, push, merge, deploy, schedule work, persist goals, install skills, or change permissions.',
    'Look for correctness, security, scope violations, missing tests, and evidence gaps.',
    reviewDiff ? `Candidate diff:\n${reviewDiff}` : 'Inspect the current workspace candidate.',
    'Return ONLY JSON: {"decision":"APPROVE"|"BLOCK","reason":"...","residual_risks":["..."]}'
  ].join('\n');
}

if (adapter === 'codex' && role === 'builder') assertCodexBuilderConfigAllowed(task);
if (adapter === 'prime-agent') assertPrimeAgentPocAllowed(task, role);
const prompt = role === 'builder' ? builderPrompt() : reviewerPrompt();
const call = buildAgentInvocation({adapter,role,task,workspace,prompt,generic});
const launch = resolveLaunchCommand(call.command, call.args);
const result = spawnSync(launch.command, launch.args, {
  cwd: workspace,
  input: call.input,
  encoding: 'utf8',
  timeout: Math.max(1000, Number(input.timeout_ms) || 30000),
  env: adapter === 'prime-agent' ? primeAgentPocEnv(process.env, workspace) : process.env,
  windowsHide: true,
  maxBuffer: 4 * 1024 * 1024
});
if (result.error?.code === 'ETIMEDOUT') throw new Error(`${adapter.toUpperCase().replaceAll('-', '_')}_${role.toUpperCase()}_TIMEOUT`);
if (result.status !== 0 || result.error) throw new Error(classifyLaunchFailure(adapter, role, result));
const output = String(result.stdout || '').trim();
if (role === 'builder') {
  process.stdout.write(JSON.stringify({ status: 'PASS', artifact: `agent:${adapter}`, summary: output.slice(-4000) }));
} else {
  const review = parseReviewOutput(output);
  process.stdout.write(JSON.stringify({ ...review, reviewed_candidate_sha: candidate.candidate_sha, reviewed_tree_hash: candidate.tree_hash }));
}
