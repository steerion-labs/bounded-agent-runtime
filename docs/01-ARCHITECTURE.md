# 01 Architecture

## Non-negotiable invariant

```text
ONE CONTROLLER
ONE TASK MODEL
ONE JOURNAL
ONE EVIDENCE MODEL
ONE BUDGET MODEL
ONE HUMAN GATE
```

## Control loop

```text
Task Intake
  -> Controller classifies and authorizes
  -> Builder receives bounded workspace capability
  -> Verifier tests exact candidate
  -> Controller validates evidence
  -> Separate Reviewer execution inspects the exact candidate; BAR does not infer organizational/model independence
  -> Controller validates review
  -> Human Gate for protected transition
  -> Controller performs allowed mutation
```

## Authority rule

Agents may propose actions. They do not grant themselves permission. Authority comes only from current task state, deterministic policy, explicit capabilities, fresh evidence and, where required, a human decision.