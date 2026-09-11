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

The receipt contains a unique `receipt_id`, `issued_at`, task/candidate/tree identity, requested action, signed approval scope, state/lease identity and a controller Ed25519 signature. Receipt issuance is also written to the authenticated BAR journal.

The concrete `requested_action` is policy-checked against the human-signed protected-action scope. It is not separately signed by the human. The receipt itself is controller-signed so an external adapter can detect tampering.

A remote adapter must pin the controller receipt public-key fingerprint from a trusted channel and verify the receipt signature before trusting the handoff. Do not trust a public key supplied inside an untrusted receipt.

The receipt is not a bearer capability. The external adapter must still verify its own target repository/ref and side-effect semantics, and should call `bar verify-authorization <action>` immediately before the effect.

```text
external adapter -> BAR read-only verify -> BAR signed receipt -> adapter target checks -> side effect
```

BAR ships no default real merge/deploy/release adapter because credentials and side-effect semantics differ by environment. This boundary is deliberate.