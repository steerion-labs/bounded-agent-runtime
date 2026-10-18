# Security evidence index

BAR treats security evidence as **exact-head evidence**. A green result from another commit is context, not proof for the current candidate.

This page is an index and reproduction guide. It is not a security certification.

## Minimum exact-head evidence

Record the commit first:

```bash
git rev-parse HEAD
git status --porcelain
```

Then run the local evidence that applies to the host:

```bash
npm test
npm run demo:attack
npm run quickstart
```

When Docker is available:

```bash
npm run test:container
```

For adapter/host evidence:

```bash
bar doctor --json
bar agents --json
```

For protected deployments, also capture the host identity/access boundary, worker egress boundary, candidate commit/tree, evidence hashes, Human Gate policy and external side-effect adapter checks.

## Public CI evidence

The repository contains:

- Node 20 tests
- Node 22 tests
- Container E2E
- CodeQL JavaScript analysis
- off-host durability proof

A workflow badge or green historical run is useful evidence only when its `head_sha` matches the revision being assessed.

## Open assurance work

The following public issues intentionally remain part of BAR's trust story until independently satisfied:

- [#85 — Exact-head assurance matrix and evidence reconciliation](https://github.com/steerion-labs/bounded-agent-runtime/issues/85)
- [#86 — Isolated real-agent adversarial boundary benchmark](https://github.com/steerion-labs/bounded-agent-runtime/issues/86)
- [#87 — Prove credential, filesystem and host isolation at real boundaries](https://github.com/steerion-labs/bounded-agent-runtime/issues/87)
- [#88 — Reproducible security evidence pack for external review](https://github.com/steerion-labs/bounded-agent-runtime/issues/88)

Do not close these because documentation looks good. Close them only when the acceptance evidence in the issue is satisfied.

## Secret hygiene

Public examples must remain synthetic. Never commit:

- real access tokens or API keys
- private keys
- customer or proprietary source
- private project data
- personal machine paths that disclose private information
- production credentials

See [SECURITY.md](../SECURITY.md) for vulnerability reporting and the deployment threat boundary.

## Release gate

A release that makes stronger security claims should include:

1. exact candidate commit and tree;
2. local/CI test evidence tied to that exact candidate;
3. attack-demo output;
4. CodeQL status for the exact candidate;
5. required boundary proofs from #85–#88;
6. independent review;
7. explicit Human Gate for release.

No single badge substitutes for this evidence chain.
