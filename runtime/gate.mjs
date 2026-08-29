import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadState, canonicalGatePayload } from './core.mjs';

const command = process.argv[2];
const arg = process.argv[3];

function keygen(dir = '.human-gate') {
  fs.mkdirSync(dir, { recursive: true });
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(path.join(dir, 'public.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
  fs.writeFileSync(path.join(dir, 'private.pem'), privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  console.log(`HUMAN_GATE_KEYS_CREATED ${path.resolve(dir)}`);
  console.log('Protect private.pem. Never commit it.');
}

function sign(privateKeyFile) {
  if (!privateKeyFile) throw new Error('PRIVATE_KEY_FILE_REQUIRED');
  const state = loadState();
  if (state.state !== 'HUMAN_GATE' || !state.gate_challenge) throw new Error('NO_ACTIVE_HUMAN_GATE');
  const privateKey = fs.readFileSync(privateKeyFile, 'utf8');
  const signature = crypto.sign(null, Buffer.from(canonicalGatePayload(state.gate_challenge)), privateKey);
  console.log(signature.toString('base64'));
}

try {
  if (command === 'keygen') keygen(arg);
  else if (command === 'sign') sign(arg);
  else throw new Error('USAGE:keygen [dir] | sign <private-key.pem>');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
