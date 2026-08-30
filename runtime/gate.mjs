import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadState, canonicalGatePayload, publicKeyFingerprint } from './core.mjs';

const command = process.argv[2], arg = process.argv[3];
function keygen(dir = '.human-gate') {
  fs.mkdirSync(dir, { recursive: true });
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
  fs.writeFileSync(path.join(dir, 'public.pem'), publicPem);
  fs.writeFileSync(path.join(dir, 'private.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  console.log(`HUMAN_GATE_KEYS_CREATED ${path.resolve(dir)}`);
  console.log(`PUBLIC_KEY_FINGERPRINT ${publicKeyFingerprint(publicPem)}`);
  console.log('Protect private.pem. Never commit it.');
}
function sign(privateKeyFile) {
  if (!privateKeyFile) throw new Error('PRIVATE_KEY_FILE_REQUIRED');
  const identity = process.env.BOUNDED_AGENT_APPROVER_IDENTITY?.trim();
  if (!identity) throw new Error('APPROVER_IDENTITY_REQUIRED');
  const state = loadState();
  if (state.state !== 'HUMAN_GATE' || !state.gate_challenge) throw new Error('NO_ACTIVE_HUMAN_GATE');
  if (identity !== state.approver_identity) throw new Error('APPROVER_IDENTITY_MISMATCH');
  const privateKey = fs.readFileSync(privateKeyFile, 'utf8');
  const payload = canonicalGatePayload(state.gate_challenge, identity, 'ACCEPT');
  console.log(crypto.sign(null, Buffer.from(payload), privateKey).toString('base64'));
}
try {
  if (command === 'keygen') keygen(arg);
  else if (command === 'sign') sign(arg);
  else throw new Error('USAGE:keygen [dir] | sign <private-key.pem>');
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
