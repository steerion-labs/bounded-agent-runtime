# 06 Human Gate

A notification is not an approval. Silence is not approval. Editable state is not approval.

The reference Human Gate uses Ed25519 and binds the decision to:

```yaml
task_id: <id>
candidate_sha: <git commit>
tree_hash: <git tree>
state_version: <version>
protected_actions_hash: <sha256 of sorted declared protected_actions>
nonce: <one-time nonce>
decision: ACCEPT
decision_identity: <configured identity>
public_key_fingerprint: <pinned SHA-256 fingerprint>
```

The signature itself, decision identity, public-key fingerprint and signed-payload hash are persisted in the approval record.

The nonce is consumed in a controller secret ledger protected by an HMAC. Replacing `state.json` with an older Human Gate state does not make an already consumed approval reusable.

Before a protected action is authorized, the controller re-verifies the approval signature, key fingerprint, decision identity, nonce consumption, task/candidate/tree binding, the exact declared protected-action scope, current evidence integrity and current workspace Git identity.

After state reaches `ACCEPTED`, lease expiry alone does not invalidate the human decision. BAR still requires the persisted fencing generation/token, candidate, evidence and approval binding to remain unchanged.

Production systems should keep the trusted public key or signer configuration outside worker-writable state and use a protected identity/signing service where appropriate.
