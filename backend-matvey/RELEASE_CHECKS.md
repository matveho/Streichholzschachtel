# Project workspace release checks

Verified on 8 November 2026 against the local Windows runtime and deployed Vercel frontend. These are executed checks, not proposed tests.

| Check | Result |
| --- | --- |
| `node --test tests/*.test.mjs` | 134 passed, zero failed |
| `node --test tests/projects.integration.mjs` | Four passed: protected seeds, scoped live 450 mm lookup, isolation/cache/files/history, ordinary project lifecycle |
| `node tests/projects.restart.mjs` | Passed: real API restart, ordinary project persistence, query history, issue dismissal, deleted runtime PDF recovery, seed deduplication |
| `node tests/projects.browser.mjs` | Passed against compiled local frontend and production Vercel; overview, documents, citations, findings, persistence, bookmarks, create/edit/delete and responsive layout |
| `node tests/control.integration.mjs` | Passed on separate ports: startup, API and gateway crash recovery, healthy API preservation, manual restart, PDF ranges, stop and exit |
| `node control.mjs --check-demo` | Passed read-only local presentation check: both projects, every associated PDF, prepared results, citation rendering and return navigation |
| `BASIS_FRONTEND_URL=https://streichholzschachtel.vercel.app node tests/presentation.smoke.mjs` | Passed the same read-only presentation check against production |
| `node tests/gateway.integration.mjs` | Passed: three broken PDF upstreams do not crash the gateway |
| `npx tsc -b`, `npm run lint` | Passed |
| Production Vercel build | Passed; public alias reaches project API through HTTPS |
| Six synthetic project PDFs | All eight pages rendered and visually inspected; tracked bytes match working originals |

The project suite covers scoped planner/selector/drafter context with intercepted local model calls, retrieval and source expansion, foreign document rejection, empty scopes, per-project histories and stale-cache body withholding. Prepared issues require original PDF quote anchors. Browser evidence was checked after PDF rendering, not just overlay creation.

Two earlier suite failures were test setup races: one test started before indexing completed; another deliberately deleted a runtime PDF while an independent indexing suite was reading it. The API suite now waits for readiness. Destructive restart checks and full indexing checks were rerun sequentially and passed. Public latency also exposed a real saved-filter reset, now corrected and retested. Retrieval regressions for HDPE/PVC, FAC submission wording and residential speed-limit scope were corrected with tests.

## Demonstrated configuration

- Production: https://streichholzschachtel.vercel.app
- On this device: API 8810; keyless gateway/UI http://127.0.0.1:8812/app/#projects.
- Root Start Basis.cmd reads ignored local configuration and manages this project runtime. Fresh checkouts use 8787/8789 by default.
- Local source lookup, no hosted inference. Prepared source comparisons avoid presentation-time inference latency.
- Immutable local frontend builds preserve the preceding bundle. The earlier API/gateway runtime remains available during rollout; it was not replaced.

## Presentation limits

Public access depends on this device, its network and the quick tunnel. Use the local interface if connectivity fails. A replacement tunnel requires explicitly publishing its hostname from the controls. Keep the control window open for crash recovery.

Issues are prepared evidence-backed review prompts, not a general automatic compliance engine. General uploads are deferred. Private project artifacts and backend state are excluded from frontend deployment. The prototype uses shared-device logical isolation, not production multi-tenant security. Use one project API instance for normal operation.

The repeatable two-minute sequence and reset instructions are in DEMO.md; frontend contracts and persistence boundaries are in PROJECT_API.md. Reset both demo projects before presenting to remove test history and restore open findings.
