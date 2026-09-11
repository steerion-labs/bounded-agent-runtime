# Protected-action handoff

BAR intentionally separates **authorization** from the external system that performs a side effect.

After an exact candidate is verified, reviewed and accepted by the signed Human Gate, an integration can re-check a declared protected action immediately before that effect:

```powershell
bar authorize merge --json
```

The command returns a machine-readable authorization receipt bound to the task, action, candidate commit, tree hash and verified human approval identity.

The receipt is **audit evidence, not a reusable bearer token**. An integration must call BAR again immediately before the side effect and must fail closed if the candidate, evidence or approval no longer matches.

A GitHub, CI or deployment adapter should therefore follow this shape:

```text
external adapter -> BAR authorize <action> -> exact-state re-check -> side effect
```

BAR does not ship a default real merge/deploy/release adapter because credentials and side-effect semantics differ by environment. This boundary is deliberate, not an unfinished implicit auto-merge path.