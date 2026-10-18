# 60-second BAR demo

The fastest way to understand BAR is to watch it refuse authority the worker does not have.

## Attack demo

From a checkout:

```bash
npm install
npm run demo:attack
```

Expected result:

```text
BAR ATTACK DEMO — deterministic authority boundary
BLOCKED  default-branch write
BLOCKED  arbitrary branch escape
BLOCKED  protected merge request
BLOCKED  request tampering
RESULT   4/4 ATTACKS BLOCKED
```

The demo is intentionally synthetic. It uses no credentials, makes no network request and performs no real GitHub mutation.

It directly exercises BAR's candidate-publication contract and proves four narrow properties:

1. a worker cannot target the default branch through the candidate-publication path;
2. a worker cannot publish to an arbitrary branch outside the `bar-candidate/` namespace;
3. a worker cannot widen publication authority into `merge`;
4. a request changed after controller binding fails its integrity check.

It does **not** prove that an arbitrary host, Docker daemon, operating system, credential store or external side-effect adapter is secure. Those are separate deployment boundaries.

## Human Gate demo

Run:

```bash
npm run quickstart
```

Expected stop:

```text
4/4 PASS: HUMAN_GATE_REQUIRED
```

The reference quickstart creates an isolated synthetic task, runs the Builder/verification/Reviewer path and proves that BAR stops before a protected remote action.

## Both proofs

```bash
npm run demo
```

This runs the attack demo first and the Human Gate quickstart second.

## Real bounded work

After the synthetic proofs, inspect the resolved authority before doing real work:

```bash
bar work \
  --repo /path/to/repo \
  --goal "Fix the failing parser test" \
  --allow src \
  --allow test \
  --builder auto \
  --reviewer auto \
  --verify npm \
  --verify-arg test \
  --dry-run
```

Remove `--dry-run` only after the paths, adapters and verification command are what you intended.

BAR does not automatically merge, deploy or release.
