# 12 Threat Model

## Protected assets
Controller state, policy, secrets, journal integrity, Human Gate identity and the exact reviewed candidate.

## Untrusted inputs
Model output, repository text, handoffs, memory, issue text, tool output and worker-produced files are data, never authority.

## Primary attacker paths
- prompt injection attempting capability expansion
- stale controller replay after lease takeover
- candidate mutation after tests or review
- reviewer using builder credentials or writable candidate
- worker access to controller secrets/state
- forged Human Gate approval
- budget exhaustion or retry loops
- tool fallback that silently adds network/filesystem authority

## Journal integrity boundary
The journal HMAC detects worker-side tampering only while the HMAC key and anchor remain protected from that attacker. The reference Windows layout keeps the journal and its integrity material in separate controller-only directories, but a compromise with controller-level access to both can rewrite and re-authenticate history. Do not treat the HMAC chain as protection from a fully compromised Controller.

## Required response
Fail closed. Do not silently downgrade evidence quality or increase capability.
