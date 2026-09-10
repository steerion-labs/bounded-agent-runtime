# External Repo Adoption — 2026-09-10

Status: BOUNDED_EVALUATION_QUEUE
BAR role: EXECUTION_BOUNDARY

## code-server — GO for evaluation
Evaluate code-server only as optional development infrastructure for the PC-independent engineering target.

Target flow:
`GitHub SoT -> Devcontainer -> Cloud Runtime -> code-server -> check/test/build/smoke -> Evidence -> Human Gate`

This does not change BAR's product role. code-server receives no execution-policy authority and is not part of the bounded runtime decision path.

Required proof before adoption:
- fresh checkout is reproducible
- no absolute Windows paths
- no local-only secrets/services
- Docker and repo-native test support
- Playwright/browser QA where relevant
- authentication, TLS and network-exposure hardening
- resource/cost comparison against Codespaces
- no paid cloud resource starts without explicit Human approval
- no new permission scope is requested without explicit Human approval

Canonical issue: #34.

## Markdoc — GO for documentation evaluation
Evaluate Markdoc for public technical/developer documentation only.

Constraints:
- existing Markdown/governance files remain canonical until a separate migration decision
- no runtime or authority dependency
- compare against plain Markdown/MkDocs on build complexity, maintenance, accessibility and versioning
- no migration without clear value and a separate decision

Canonical issue: #35.

## Rejected / deferred
- ESP32-BlueJammer: REJECTED
- Omarchy: REJECTED for runtime strategy
- Apache Cloudberry: DEFERRED until a real MPP/DWH-scale need exists
- Modular/MAX/Mojo: owned by Cognitive OS as future inference-runtime watch item, not BAR

## Cross-project ownership
- OpenViking + DSPy -> Steerion Cognitive OS
- Firecrawl + AwesomeQuant -> TradePilot
- Open SaaS + OpenPanel + MoneyPrinterTurbo -> Phoenix

## Repo work package
#34 code-server evaluation
#35 Markdoc evaluation
#36 adoption registry
#37 project-loop handoff
#38 Project Control metadata
#39 state/roadmap sync

None of these items weakens BAR's authority boundaries, Human Gates, credential isolation, recovery/evidence requirements or main-promotion gate.
