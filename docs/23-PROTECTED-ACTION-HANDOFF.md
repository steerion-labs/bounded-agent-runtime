# Protected-action handoff

BAR separates **authorization** from the external system that performs a real side effect.

Human approval is signed over the exact task, candidate commit, tree hash, state version, nonce and a hash of the complete declared `protected_actions` set. One Human Gate approval therefore covers only that exact declared action scope. Keep `protected_actions` minimal per task.

Before a side effect, an integration can perform a read-only re-check:

```powershell
bar verify-authorization merge --json
```

To issue an auditable handoff receipt:

```powershell
bar authorize merge --json
```

The receipt contains a unique `receipt_id`, `issued_at`, task/candidate/tree identity, requested action, signed approval scope, state/fencing identity, source repo/ref metadata and a controller Ed25519 signature. Receipt issuance is written to the authenticated BAR journal.

The concrete `requested_action` is policy-checked against the human-signed protected-action scope. It is not separately signed by the human. The receipt itself is controller-signed so an external adapter can detect tampering.

Export the controller receipt public key from a trusted BAR runtime with `bar receipt pubkey --json`, pin its fingerprint out of band, then verify a saved receipt with `bar receipt verify <receipt.json> --pubkey <public.pem> --json`. Never trust a key or fingerprint supplied only by an untrusted receipt.

The receipt is not a bearer capability. The external adapter must still verify its own target repository/ref and side-effect semantics, and should call `bar verify-authorization <action>` immediately before the effect.

BAR's controller-created `candidate_sha` normally exists in the isolated Builder workspace, not automatically in the source repository or a remote Git ref. A GitHub/CI integration must explicitly export the candidate as a reviewed patch, bundle or staging ref before a real merge. `source_remote_url`, `source_ref` and `source_head_sha` identify the source side of that handoff; they do not imply the candidate has already been pushed.

```text
external adapter -> BAR read-only verify -> BAR signed receipt -> export/stage candidate -> adapter target checks -> side effect
```

BAR ships no default real merge/deploy/release adapter because credentials and side-effect semantics differ by environment. This boundary is deliberate.
