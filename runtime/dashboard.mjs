import fs from 'node:fs';
import http from 'node:http';
import { STATE_FILE, readJson } from './core.mjs';
import { doctorReport } from './doctor.mjs';

const text = value => value === null || value === undefined ? '' : String(value).slice(0, 512);

export function publicStatus() {
  if (!fs.existsSync(STATE_FILE)) return { initialized:false, state:'NOT_INITIALIZED', evidence_count:0, gate_state:'NOT_REQUIRED' };
  const state = readJson(STATE_FILE);
  const gateState = state.state === 'HUMAN_GATE' ? 'WAITING' : (state.human_approval ? 'APPROVAL_RECORDED' : 'NOT_REQUIRED');
  return {
    initialized:true,
    task_id:text(state.task_id),
    state:text(state.state),
    state_version:Number(state.state_version || 0),
    candidate_sha:text(state.candidate_sha),
    tree_hash:text(state.tree_hash),
    builder_adapter:text(state.task?.workers?.builder?.adapter || 'demo'),
    reviewer_adapter:text(state.task?.workers?.reviewer?.adapter || 'demo'),
    evidence_count:Array.isArray(state.evidence) ? state.evidence.length : 0,
    gate_state:gateState
  };
}

export function publicEvidence() {
  if (!fs.existsSync(STATE_FILE)) return [];
  const evidence = Array.isArray(readJson(STATE_FILE).evidence) ? readJson(STATE_FILE).evidence : [];
  return evidence.map(item => ({
    evidence_id:text(item.evidence_id),
    claim:text(item.claim),
    producer_identity:text(item.producer_identity),
    trust_class:text(item.trust_class),
    candidate_sha:text(item.candidate_sha),
    tree_hash:text(item.tree_hash),
    created_at:text(item.created_at),
    status:text(item.status)
  })).sort((a,b) => a.created_at.localeCompare(b.created_at));
}

export function dashboardHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bounded Agent Runtime</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b1020;color:#edf2ff;margin:0;padding:32px}main{max-width:1080px;margin:auto}.hero{margin-bottom:28px}.muted{color:#9aa7c2}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}.card{background:#151d33;border:1px solid #283552;border-radius:14px;padding:18px;margin-top:14px}.big{font-size:26px;font-weight:700}.flow{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0}.step{padding:10px 14px;border-radius:999px;background:#202b49}.active{outline:2px solid #8bc5ff}.ok{color:#76e3a5}.warn{color:#ffd166}.bad{color:#ff8c8c}code{word-break:break-all}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:9px;border-bottom:1px solid #283552;vertical-align:top}.empty{padding:14px 0;color:#9aa7c2}</style></head><body><main>
<div class="hero"><h1>Bounded Agent Runtime</h1><p class="muted">Read-only local evidence view. Authority stays in the controller and authenticated Human Gate.</p></div>
<div class="grid"><div class="card"><div class="muted">State</div><div class="big" id="state">Loading</div></div><div class="card"><div class="muted">Evidence</div><div class="big" id="evidence-count">0</div></div><div class="card"><div class="muted">Human Gate</div><div class="big" id="gate">-</div></div><div class="card"><div class="muted">Doctor</div><div class="big" id="doctor">-</div></div></div>
<div class="flow" id="flow"></div>
<div class="card"><h3>Exact candidate</h3><div class="muted">Commit SHA</div><code id="candidate">not created</code><div class="muted" style="margin-top:12px">Tree hash</div><code id="tree"></code><h3>Workers</h3><p id="workers"></p></div>
<div class="card"><h3>Evidence timeline</h3><div id="timeline-empty" class="empty">No evidence recorded.</div><table id="timeline" hidden><thead><tr><th>Time</th><th>Claim</th><th>Status</th><th>Producer</th><th>Trust</th><th>Candidate</th></tr></thead><tbody id="timeline-body"></tbody></table></div>
<script>
const stages=['NEW','CLASSIFIED','CONTEXT_READY','AUTHORIZED','BUILDING','TESTING','HANDOFF_VALIDATION','REVIEWING','REVIEW_READY','HUMAN_GATE','ACCEPTED'];
const byId=id=>document.getElementById(id);
const setText=(id,value)=>{byId(id).textContent=value===null||value===undefined?'':String(value)};
function renderFlow(state){const root=byId('flow');root.replaceChildren();for(const stage of stages){const el=document.createElement('span');el.className='step'+(stage===state?' active':'');el.textContent=stage;root.appendChild(el)}}
function renderEvidence(items){const body=byId('timeline-body');body.replaceChildren();const table=byId('timeline');const empty=byId('timeline-empty');if(!items.length){table.hidden=true;empty.hidden=false;return}table.hidden=false;empty.hidden=true;for(const item of items){const row=document.createElement('tr');for(const value of [item.created_at,item.claim,item.status,item.producer_identity,item.trust_class,item.candidate_sha]){const cell=document.createElement('td');cell.textContent=value||'-';row.appendChild(cell)}body.appendChild(row)}}
async function load(){const [s,e,d]=await Promise.all([fetch('/api/status').then(r=>r.json()),fetch('/api/evidence').then(r=>r.json()),fetch('/api/doctor').then(r=>r.json())]);setText('state',s.state);setText('evidence-count',s.evidence_count||0);setText('gate',s.gate_state||'NOT_REQUIRED');byId('gate').className='big '+(s.gate_state==='WAITING'?'warn':'ok');setText('doctor',d.status);setText('candidate',s.candidate_sha||'not created');setText('tree',s.tree_hash||'');setText('workers',(s.builder_adapter||'-')+' → '+(s.reviewer_adapter||'-'));renderFlow(s.state);renderEvidence(e)}
load();setInterval(load,3000);
</script></main></body></html>`;
}

function json(res, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(200, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'content-security-policy':"default-src 'none'", 'x-content-type-options':'nosniff' });
  res.end(body);
}

export function createDashboardServer({ host='127.0.0.1', port=4780 }={}) {
  if (!['127.0.0.1','::1','localhost'].includes(host)) throw new Error('DASHBOARD_LOOPBACK_ONLY');
  return http.createServer((req,res) => {
    if (req.method !== 'GET') { res.writeHead(405,{allow:'GET'}); res.end('Method Not Allowed'); return; }
    if (req.url === '/api/status') return json(res,publicStatus());
    if (req.url === '/api/evidence') return json(res,publicEvidence());
    if (req.url === '/api/doctor') return json(res,doctorReport());
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200,{ 'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
      res.end(dashboardHtml()); return;
    }
    res.writeHead(404); res.end('Not Found');
  }).listen(port,host);
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\','/')}`).href) {
  const port=Number(process.argv[2]||4780); createDashboardServer({port}); console.log(`BAR_DASHBOARD http://127.0.0.1:${port}`);
}
