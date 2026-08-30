import fs from 'node:fs';
import net from 'node:net';
import dns from 'node:dns/promises';

export function readNetworkPolicy(file) {
  const policy = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if (policy.version !== 1 || !Array.isArray(policy.allowed_hosts) || !policy.allowed_hosts.length) throw new Error('NETWORK_POLICY_INVALID');
  policy.methods ??= ['GET']; policy.allowed_ports ??= [443];
  policy.timeout_ms ??= 10000; policy.max_response_bytes ??= 1024 * 1024; policy.max_request_bytes ??= 256 * 1024;
  if (!Array.isArray(policy.methods) || !Array.isArray(policy.allowed_ports)) throw new Error('NETWORK_POLICY_INVALID');
  return policy;
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
