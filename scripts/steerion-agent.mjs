#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const CFG_PATH = path.join(ROOT, '.steerion', 'agent-system.json');
const LESSONS_PATH = path.join(ROOT, '.steerion', 'learned-cases.json');
const RUN_DIR = path.join(ROOT, '.steerion', 'runtime', 'runs');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const writeJson = (p, value) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`); };
const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const command = process.argv[2];

if (!fs.existsSync(CFG_PATH)) throw new Error('AGENT_CONFIG_MISSING:.steerion/agent-system.json');
const cfg = readJson(CFG_PATH);
const loadLessons = () => fs.existsSync(LESSONS_PATH) ? readJson(LESSONS_PATH) : { schemaVersion: 1, cases: [] };
const getAgent = (id) => {
  const agent = (cfg.agents ?? []).find((x) => x.id === id);
  if (!agent) throw new Error(`UNKNOWN_AGENT:${id}`);
  if (agent.executable !== true) throw new Error(`AGENT_NOT_EXECUTABLE:${id}`);
  return agent;
};
const words = (v) => new Set(String(v ?? '').toLowerCase().split(/[^a-z0-9äöü]+/i).filter((x) => x.length >= 3));
const matchedLessons = (objective) => {
  const target = words(objective);
  return loadLessons().cases.map((item) => {
    const hay = words([...(item.tags ?? []), item.symptom, item.rootCause, item.rule].join(' '));
    let score = 0; for (const token of target) if (hay.has(token)) score += 1;
    return { ...item, matchScore: score };
  }).filter((x) => x.status === 'VERIFIED' && x.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore).slice(0, 8);
};
const getChecks = (agent, quick = false) => {
  const catalog = new Map((cfg.checks ?? []).map((x) => [x.id, x]));
  const ids = quick ? (cfg.defaultChecks ?? []) : (agent.checks ?? cfg.defaultChecks ?? []);
  return ids.map((id) => catalog.get(id)).filter(Boolean);
};
const scoreOutcome = (o) => {
  let score = 0;
  if (o.verifiedCorrect) score += 40;
  if (o.independentVerification) score += 20;
  if (o.regressionProof) score += 15;
  if (o.durationMs > 0 && o.durationMs <= 180000) score += 10;
  else if (o.durationMs > 0 && o.durationMs <= (cfg.maxMinutes ?? 10) * 60000) score += 5;
  if (o.repeatedKnownMistake) score -= 40;
  if (o.unauthorizedAction) score -= 50;
  if (!o.evidence?.length) score -= 20;
  if (o.selfCertified) score -= 25;
  if (o.durationMs > (cfg.maxMinutes ?? 10) * 60000) score -= 10;
  return score;
};
function runAgent({ agentId, objective, verificationOf = null, quick = false }) {
  const agent = getAgent(agentId);
  const started = Date.now();
  const deadline = started + (cfg.maxMinutes ?? 10) * 60000;
  const lessons = matchedLessons(objective);
  const checks = getChecks(agent, quick);
  const results = [];
  for (const check of checks) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) { results.push({ id: check.id, status: 'TIMEOUT' }); break; }
    const r = spawnSync(check.command, { cwd: ROOT, shell: true, encoding: 'utf8', timeout: remaining, maxBuffer: 8 * 1024 * 1024 });
    results.push({ id: check.id, command: check.command, status: r.status === 0 ? 'PASS' : 'FAIL', exitCode: r.status, stdout: (r.stdout ?? '').slice(-4000), stderr: (r.stderr ?? '').slice(-4000) });
    if (r.status !== 0 && check.stopOnFail !== false) break;
  }
  const allPass = results.length > 0 && results.every((x) => x.status === 'PASS');
  const durationMs = Date.now() - started;
  const run = {
    schemaVersion: 1,
    runId: `run-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    projectId: cfg.projectId,
    agent: { id: agent.id, role: agent.role, authority: agent.authority ?? 'bounded' },
    objective,
    verificationOf,
    startedAt: new Date(started).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs,
    maxMinutes: cfg.maxMinutes ?? 10,
    injectedLessons: lessons.map((x) => x.id),
    results,
    verdict: allPass ? (agent.requiresIndependentVerification ? 'REQUIRES_VERIFICATION' : 'PASS') : 'FINDING',
    rewardScore: scoreOutcome({ verifiedCorrect: allPass, regressionProof: allPass, durationMs, evidence: results.map((x) => x.id), selfCertified: agent.requiresIndependentVerification && allPass })
  };
  fs.mkdirSync(RUN_DIR, { recursive: true });
  writeJson(path.join(RUN_DIR, `${run.runId}.json`), run);
  return run;
}

if (command === 'list') {
  console.log(JSON.stringify({ projectId: cfg.projectId, runtimeVersion: cfg.runtimeVersion, agents: cfg.agents }, null, 2));
} else if (command === 'context') {
  const agent = getAgent(arg('--agent')); const objective = arg('--objective') ?? '';
  console.log(JSON.stringify({ projectId: cfg.projectId, agent, objective, maxMinutes: cfg.maxMinutes, learnedCases: matchedLessons(objective), knowledgeFiles: cfg.knowledgeFiles ?? [] }, null, 2));
} else if (command === 'run') {
  const agentId = arg('--agent'); const objective = arg('--objective');
  if (!agentId || !objective) throw new Error('usage: run --agent <id> --objective <text>');
  console.log(JSON.stringify(runAgent({ agentId, objective, quick: process.argv.includes('--quick') }), null, 2));
} else if (command === 'verify') {
  const runId = arg('--run'); const verifierId = arg('--agent');
  if (!runId || !verifierId) throw new Error('usage: verify --run <id> --agent <verifier>');
  const source = readJson(path.join(RUN_DIR, `${runId}.json`));
  if (source.agent.id === verifierId) throw new Error('INDEPENDENT_VERIFIER_REQUIRED');
  console.log(JSON.stringify(runAgent({ agentId: verifierId, objective: source.objective, verificationOf: runId, quick: process.argv.includes('--quick') }), null, 2));
} else if (command === 'learn') {
  const file = arg('--file'); if (!file) throw new Error('usage: learn --file <verified-case.json>');
  const input = readJson(path.resolve(ROOT, file));
  if (input.status !== 'VERIFIED') throw new Error('LESSON_NOT_VERIFIED');
  if (!input.evidence?.length) throw new Error('LESSON_EVIDENCE_REQUIRED');
  if (input.material !== false && (!input.verifierAgentId || input.verifierAgentId === input.sourceAgentId)) throw new Error('INDEPENDENT_VERIFIER_REQUIRED');
  const store = loadLessons(); const lesson = { ...input, id: input.id ?? `lesson-${Date.now()}`, verifiedAt: input.verifiedAt ?? new Date().toISOString() };
  const idx = store.cases.findIndex((x) => x.id === lesson.id); if (idx >= 0) store.cases[idx] = lesson; else store.cases.push(lesson); writeJson(LESSONS_PATH, store);
  console.log(JSON.stringify(lesson, null, 2));
} else if (command === 'check') {
  const failures = [];
  if (!cfg.projectId) failures.push('projectId missing');
  if ((cfg.maxMinutes ?? 999) > 10) failures.push('maxMinutes > 10');
  if (!Array.isArray(cfg.agents) || cfg.agents.length === 0) failures.push('no agents');
  const ids = new Set(); for (const a of cfg.agents ?? []) { if (!a.id || !a.role || a.executable !== true) failures.push(`invalid agent:${a.id ?? '?'}`); if (ids.has(a.id)) failures.push(`duplicate agent:${a.id}`); ids.add(a.id); }
  const lessons = loadLessons(); for (const id of cfg.requiredLessonIds ?? []) if (!lessons.cases.some((x) => x.id === id && x.status === 'VERIFIED')) failures.push(`forgotten lesson:${id}`);
  const profiles = cfg.githubProfiles ?? [];
  if (profiles.length !== (cfg.agents ?? []).length) failures.push(`github profile count mismatch:${profiles.length}/${(cfg.agents ?? []).length}`);
  for (const profile of profiles) {
    const full = path.join(ROOT, profile.path);
    if (!fs.existsSync(full)) { failures.push(`missing github agent profile:${profile.path}`); continue; }
    const text = fs.readFileSync(full, 'utf8');
    if (!text.startsWith('---\n') || !text.includes('description:')) failures.push(`invalid github agent profile:${profile.path}`);
  }
  for (const k of cfg.knowledgeFiles ?? []) if (!fs.existsSync(path.join(ROOT, k))) failures.push(`missing knowledge:${k}`);
  if (failures.length) { console.error(JSON.stringify({ status: 'FAIL', failures }, null, 2)); process.exit(1); }
  console.log(JSON.stringify({ status: 'PASS', projectId: cfg.projectId, executableAgents: cfg.agents.length, verifiedLessons: lessons.cases.filter((x) => x.status === 'VERIFIED').length, maxMinutes: cfg.maxMinutes }, null, 2));
} else if (command === 'status') {
  const lessons = loadLessons(); const runs = fs.existsSync(RUN_DIR) ? fs.readdirSync(RUN_DIR).filter((x) => x.endsWith('.json')).length : 0;
  console.log(JSON.stringify({ projectId: cfg.projectId, executableAgents: cfg.agents.length, verifiedLessons: lessons.cases.filter((x) => x.status === 'VERIFIED').length, localRuns: runs }, null, 2));
} else {
  throw new Error('commands: list | context | run | verify | learn | check | status');
}


