import fs from 'node:fs';
import net from 'node:net';
import dns from 'node:dns/promises';

const POLICY_KEYS = new Set(['version','allowed_hosts','allowed_ports','methods','timeout_ms','max_response_bytes','max_request_bytes','follow_redirects','secret_headers']);
const SAFE_METHODS = new Set(['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS']);
function validHostPattern(value) {
  if (typeof value !== 'string' || !value || value.length > 253) return false;
  const base = value.startsWith('*.') ? value.slice(2) : value;
  if (value.includes('*') && !value.startsWith('*.')) return false;
  if (net.isIP(base)) return !value.startsWith('*.');
  return /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(base);
}
function boundedInteger(value, min, max) { return Number.isSafeInteger(value) && value >= min && value <= max; }
export function validateNetworkPolicy(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('NETWORK_POLICY_INVALID');
  for (const key of Object.keys(input)) if (!POLICY_KEYS.has(key)) throw new Error(`NETWORK_POLICY_UNKNOWN_FIELD:${key}`);
  const policy = structuredClone(input);
  if (policy.version !== 1 || !Array.isArray(policy.allowed_hosts) || !policy.allowed_hosts.length || policy.allowed_hosts.some(x => !validHostPattern(x))) throw new Error('NETWORK_POLICY_HOSTS_INVALID');
  policy.methods ??= ['GET']; policy.allowed_ports ??= [443]; policy.timeout_ms ??= 10000;
  policy.max_response_bytes ??= 1024 * 1024; policy.max_request_bytes ??= 256 * 1024; policy.follow_redirects ??= false; policy.secret_headers ??= {};
  if (!Array.isArray(policy.methods) || !policy.methods.length || policy.methods.some(x => typeof x !== 'string' || !SAFE_METHODS.has(x.toUpperCase()))) throw new Error('NETWORK_POLICY_METHODS_INVALID');
  policy.methods = [...new Set(policy.methods.map(x => x.toUpperCase()))];
  if (!Array.isArray(policy.allowed_ports) || !policy.allowed_ports.length || policy.allowed_ports.some(x => !boundedInteger(x,1,65535))) throw new Error('NETWORK_POLICY_PORTS_INVALID');
  if (!boundedInteger(policy.timeout_ms,100,120000)) throw new Error('NETWORK_POLICY_TIMEOUT_INVALID');
  if (!boundedInteger(policy.max_request_bytes,0,10*1024*1024)) throw new Error('NETWORK_POLICY_REQUEST_LIMIT_INVALID');
  if (!boundedInteger(policy.max_response_bytes,1,20*1024*1024)) throw new Error('NETWORK_POLICY_RESPONSE_LIMIT_INVALID');
  if (typeof policy.follow_redirects !== 'boolean') throw new Error('NETWORK_POLICY_REDIRECT_INVALID');
  if (!policy.secret_headers || typeof policy.secret_headers !== 'object' || Array.isArray(policy.secret_headers)) throw new Error('NETWORK_POLICY_SECRET_HEADERS_INVALID');
  for (const [pattern, headers] of Object.entries(policy.secret_headers)) {
    if (!validHostPattern(pattern) || !policy.allowed_hosts.includes(pattern) || !headers || typeof headers !== 'object' || Array.isArray(headers)) throw new Error('NETWORK_POLICY_SECRET_HEADERS_INVALID');
    for (const [header, spec] of Object.entries(headers)) {
      if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/.test(header) || !spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('NETWORK_POLICY_SECRET_HEADER_INVALID');
      for (const key of Object.keys(spec)) if (!['secret','prefix','suffix'].includes(key)) throw new Error(`NETWORK_POLICY_SECRET_HEADER_UNKNOWN_FIELD:${key}`);
      if (typeof spec.secret !== 'string' || !/^[A-Za-z0-9_.-]{1,64}$/.test(spec.secret)) throw new Error('NETWORK_POLICY_SECRET_NAME_INVALID');
      if (spec.prefix !== undefined && (typeof spec.prefix !== 'string' || spec.prefix.length > 256)) throw new Error('NETWORK_POLICY_SECRET_PREFIX_INVALID');
      if (spec.suffix !== undefined && (typeof spec.suffix !== 'string' || spec.suffix.length > 256)) throw new Error('NETWORK_POLICY_SECRET_SUFFIX_INVALID');
    }
  }
  return policy;
}
export function readNetworkPolicy(file) {
  return validateNetworkPolicy(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')));
}

export function hostMatches(pattern, host) {
  const p = String(pattern).toLowerCase(); const h = String(host).toLowerCase();
  if (p.startsWith('*.')) return h.endsWith(p.slice(1)) && h.length > p.length - 1;
  return h === p;
}

function privateV4(address) {
  const p = address.split('.').map(Number); if (p.length !== 4 || p.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  if (p[0] === 10 || p[0] === 127 || p[0] === 0 || p[0] >= 224) return true;
  if (p[0] === 169 && p[1] === 254) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
  if (p[0] === 198 && (p[1] === 18 || p[1] === 19)) return true;
  return false;
}
export function isPrivateAddress(address) {
  const value = String(address).toLowerCase().split('%')[0];
  if (net.isIP(value) === 4) return privateV4(value);
  if (net.isIP(value) !== 6) return true;
  if (value === '::' || value === '::1') return true;
  if (value.startsWith('fc') || value.startsWith('fd') || /^fe[89ab]/.test(value)) return true;
  if (value.startsWith('::ffff:')) return privateV4(value.slice(7));
  return false;
}

export async function checkNetworkTarget(rawUrl, policy, lookup = dns.lookup) {
  let url; try { url = new URL(rawUrl); } catch { throw new Error('NETWORK_URL_INVALID'); }
  if (url.protocol !== 'https:') throw new Error('NETWORK_HTTPS_REQUIRED');
  if (url.username || url.password) throw new Error('NETWORK_URL_CREDENTIALS_DENIED');
  if (!policy.allowed_hosts.some(pattern => hostMatches(pattern, url.hostname))) throw new Error(`NETWORK_HOST_DENIED:${url.hostname}`);
  const port = Number(url.port || 443); if (!policy.allowed_ports.includes(port)) throw new Error(`NETWORK_PORT_DENIED:${port}`);
  const rows = await lookup(url.hostname, { all: true, verbatim: true });
  if (!Array.isArray(rows) || !rows.length) throw new Error('NETWORK_DNS_EMPTY');
  for (const row of rows) if (isPrivateAddress(row.address)) throw new Error(`NETWORK_PRIVATE_ADDRESS_DENIED:${row.address}`);
  return { url, addresses: rows.map(row => ({ address: row.address, family: row.family })) };
}

export function assertNetworkMethod(method, policy) {
  const normalized = String(method || 'GET').toUpperCase();
  if (!policy.methods.map(x => String(x).toUpperCase()).includes(normalized)) throw new Error(`NETWORK_METHOD_DENIED:${normalized}`);
  return normalized;
}
