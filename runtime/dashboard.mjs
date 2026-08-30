import fs from 'node:fs';
import http from 'node:http';
import { STATE_FILE, readJson } from './core.mjs';
import { doctorReport } from './doctor.mjs';

export function publicStatus() {
  if (!fs.existsSync(STATE_FILE)) return { initialized: false, state: 'NOT_INITIALIZED', evidence: [] };
  const state = readJson(STATE_FILE);
  return {
    initialized: true,
    task_id: state.task_id,
    state: state.state,
    state_version: state.state_version,
    candidate_sha: state.candidate_sha,
    tree_hash: state.tree_hash,
    builder_adapter: state.task?.workers?.builder?.adapter || 'demo',
    reviewer_adapter: state.task?.workers?.reviewer?.adapter || 'demo',
    evidence_count: state.evidence?.length || 0,
    human_gate_required: state.state === 'HUMAN_GATE',
    human_approval: Boolean(state.human_approval)
  };
}

export function publicEvidence() {
  if (!fs.existsSync(STATE_FILE)) return [];
  return (readJson(STATE_FILE).evidence || []).map(item => ({ evidence_id: item.evidence_id, claim: item.claim, producer_identity: item.producer_identity, trust_class: item.trust_class, candidate_sha: item.candidate_sha, tree_hash: item.tree_hash, created_at: item.created_at, status: item.status }));
}
function html() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bounded Agent Runtime</title><style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b1020;color:#edf2ff;margin:0;padding:32px}main{max-width:980px;margin:auto}.hero{margin-bottom:28px}.muted{color:#9aa7c2}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.card{background:#151d33;border:1px solid #283552;border-radius:14px;padding:18px}.big{font-size:28px;font-weight:700}.flow{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0}.step{padding:10px 14px;border-radius:999px;background:#202b49}.active{outline:2px solid #8bc5ff}.ok{color:#76e3a5}.warn{color:#ffd166}code{word-break:break-all}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:9px;border-bottom:1px solid #283552}</style></head><body><main>
  <div class="hero"><h1>Bounded Agent Runtime</h1><p class="muted">Read-only local control view. Authority stays in the controller and authenticated Human Gate.</p></div>
  <div id="root">Loading...</div>
  <script>const stages=['NEW','CLASSIFIED','CONTEXT_READY','AUTHORIZED','BUILDING','TESTING','HANDOFF_VALIDATION','REVIEWING','REVIEW_READY','HUMAN_GATE','ACCEPTED'];
  async function load(){const [s,e,d]=await Promise.all([fetch('/api/status').then(r=>r.json()),fetch('/api/evidence').then(r=>r.json()),fetch('/api/doctor').then(r=>r.json())]);
  const flow=stages.map(x=>'<span class="step '+(x===s.state?'active':'')+'">'+x+'</span>').join('');
  document.querySelector('#root').innerHTML='<div class="grid"><div class="card"><div class="muted">State</div><div class="big">'+s.state+'</div></div><div class="card"><div class="muted">Evidence</div><div class="big">'+s.evidence_count+'</div></div><div class="card"><div class="muted">Human Gate</div><div class="big '+(s.human_gate_required?'warn':'ok')+'">'+(s.human_gate_required?'WAITING':'NO')+'</div></div><div class="card"><div class="muted">Doctor</div><div class="big">'+d.status+'</div></div></div><div class="flow">'+flow+'</div><div class="card"><h3>Candidate</h3><p><code>'+String(s.candidate_sha||'not created')+'</code></p><p><code>'+String(s.tree_hash||'')+'</code></p><h3>Workers</h3><p>'+String(s.builder_adapter||'-')+' → '+String(s.reviewer_adapter||'-')+'</p></div><div class="card" style="margin-top:14px"><h3>Evidence timeline</h3><table><thead><tr><th>Claim</th><th>Producer</th><th>Trust</th></tr></thead><tbody>'+e.map(x=>'<tr><td>'+x.claim+'</td><td>'+x.producer_identity+'</td><td>'+x.trust_class+'</td></tr>').join('')+'</tbody></table></div>'}
  load();setInterval(load,3000);</script></main></body></html>`;
}
function json(res, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'" });
  res.end(body);
}

export function createDashboardServer({ host = '127.0.0.1', port = 4780 } = {}) {
  if (!['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('DASHBOARD_LOOPBACK_ONLY');
  return http.createServer((req, res) => {
    if (req.method !== 'GET') { res.writeHead(405); res.end('Method Not Allowed'); return; }
    if (req.url === '/api/status') return json(res, publicStatus());
    if (req.url === '/api/evidence') return json(res, publicEvidence());
    if (req.url === '/api/doctor') return json(res, doctorReport());
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'none'; object-src 'none'; frame-ancestors 'none'" });
      res.end(html()); return;
    }
    res.writeHead(404); res.end('Not Found');
  }).listen(port, host);
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\','/')}`).href) {
  const port = Number(process.argv[2] || 4780); createDashboardServer({ port }); console.log(`BAR_DASHBOARD http://127.0.0.1:${port}`);
}
