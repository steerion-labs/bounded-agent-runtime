import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { SECRETS_DIR } from './core.mjs';
import { checkNetworkTarget, assertNetworkMethod, hostMatches } from './network-policy.mjs';

const BROKER_SECRET_DIR = path.join(SECRETS_DIR, 'broker');
const HOP_BY_HOP = new Set(['connection','proxy-connection','keep-alive','transfer-encoding','upgrade','te','trailer','proxy-authorization','proxy-authenticate']);

function secretName(name) {
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(String(name))) throw new Error('SECRET_NAME_INVALID');
  return String(name);
}
export function setBrokerSecret(name, value) {
  const safe = secretName(name); if (!value) throw new Error('SECRET_VALUE_REQUIRED');
  fs.mkdirSync(BROKER_SECRET_DIR, { recursive: true });
  const file = path.join(BROKER_SECRET_DIR, safe); fs.writeFileSync(file, String(value), { encoding: 'utf8', mode: 0o600 });
  return safe;
}
export function listBrokerSecrets() {
  if (!fs.existsSync(BROKER_SECRET_DIR)) return [];
  return fs.readdirSync(BROKER_SECRET_DIR, { withFileTypes: true }).filter(x => x.isFile()).map(x => x.name).sort();
}
function loadBrokerSecret(name) {
  const file = path.join(BROKER_SECRET_DIR, secretName(name));
  if (!fs.existsSync(file)) throw new Error(`SECRET_NOT_FOUND:${name}`);
  return fs.readFileSync(file, 'utf8');
}
function injectedHeaders(url, policy) {
  const out = {};
  for (const [pattern, headers] of Object.entries(policy.secret_headers || {})) {
    if (!hostMatches(pattern, url.hostname)) continue;
    for (const [header, spec] of Object.entries(headers || {})) {
      const lower = header.toLowerCase();
      if (HOP_BY_HOP.has(lower) || lower === 'host' || lower === 'content-length') throw new Error(`SECRET_HEADER_DENIED:${header}`);
      if (!spec?.secret) throw new Error(`SECRET_HEADER_INVALID:${header}`);
      out[header] = `${spec.prefix || ''}${loadBrokerSecret(spec.secret)}${spec.suffix || ''}`;
    }
  }
  return out;
}

function publicHeaders(headers = {}) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || ['authorization','cookie','proxy-authorization'].includes(lower)) continue;
    out[key] = String(value);
  }
  return out;
}

export async function brokerRequest({ url: rawUrl, method = 'GET', headers = {}, body = null, policy, redirects = 0 }) {
  const checked = await checkNetworkTarget(rawUrl, policy); const verb = assertNetworkMethod(method, policy);
  const bodyBuffer = body == null ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  if (bodyBuffer && bodyBuffer.length > policy.max_request_bytes) throw new Error('NETWORK_REQUEST_TOO_LARGE');
  const merged = { ...publicHeaders(headers), ...injectedHeaders(checked.url, policy) };
  if (bodyBuffer) merged['content-length'] = String(bodyBuffer.length);
  const pinned = checked.addresses[0];
  return await new Promise((resolve, reject) => {
    const req = https.request({ protocol: 'https:', hostname: checked.url.hostname, port: checked.url.port || 443, path: `${checked.url.pathname}${checked.url.search}`, method: verb, headers: merged, servername: checked.url.hostname, lookup: (_host, _opts, cb) => cb(null, pinned.address, pinned.family), timeout: policy.timeout_ms }, res => {
      const chunks = []; let size = 0;
      res.on('data', chunk => { size += chunk.length; if (size > policy.max_response_bytes) { req.destroy(new Error('NETWORK_RESPONSE_TOO_LARGE')); return; } chunks.push(chunk); });
      res.on('end', async () => {
        const location = res.headers.location;
        if (location && res.statusCode >= 300 && res.statusCode < 400) {
          if (!policy.follow_redirects || redirects >= 3) { reject(new Error('NETWORK_REDIRECT_DENIED')); return; }
          try { resolve(await brokerRequest({ url: new URL(location, checked.url).href, method: verb, headers, body, policy, redirects: redirects + 1 })); } catch (error) { reject(error); }
          return;
        }
        resolve({ status: res.statusCode, headers: publicHeaders(res.headers), body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    req.on('timeout', () => req.destroy(new Error('NETWORK_TIMEOUT')));
    req.on('error', reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}
