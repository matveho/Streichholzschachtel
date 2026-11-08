# Project workspace release checks

Verified on 8 November 2026 against the local Windows runtime and deployed Vercel frontend. These are executed checks, not proposed tests.

| Check | Result |
| --- | --- |
| `node --test tests/*.test.mjs` | 136 passed, zero failed |
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
- Root Start basis.cmd reads ignored local configuration and manages this project runtime. Fresh checkouts use 8787/8789 by default.
- Local source lookup, no hosted inference. Prepared source comparisons avoid presentation-time inference latency.
- Immutable local frontend builds preserve the preceding bundle. The earlier API/gateway runtime remains available during rollout; it was not replaced.

## Presentation limits

Public access depends on this device, its network and the quick tunnel. Use the local interface if connectivity fails. A replacement tunnel requires explicitly publishing its hostname from the controls. Keep the control window open for crash recovery.

Issues are prepared evidence-backed review prompts, not a general automatic compliance engine. PDF/folder import is available, with a 12 MB limit per file. Private project artifacts and backend state are excluded from frontend deployment. The prototype uses shared-device logical isolation, not production multi-tenant security. Use one project API instance for normal operation.

Launch and readiness controls are in CONTROLS.md; frontend contracts and persistence boundaries are in PROJECT_API.md. Reset both demo projects before presenting to remove test history and restore open findings.

## Compact workspace update

The project list now uses dense rows. Collection selection uses a searchable dropdown with individually selectable documents, followed by native PDF/folder pickers. Project descriptions can be edited, including protected examples, or regenerated locally from selected document topics and types. Manual descriptions survive later imports. Reset is in Settings; source provenance is available under Source notes.

Executed checks for this update: 135 backend unit tests, local project browser workflow, native folder/PDF import browser workflow (including partial failure/retry and query/PDF highlighting), and import API isolation/restart persistence. Uploaded bytes stay under ignored local project storage; private document IDs differ across projects even for identical PDFs.

Production verification of the compact workspace passed through Vercel: native folder/PDF selection, automatic/manual descriptions, partial import recovery, a real query over an imported PDF, original citation highlighting, and ordinary project deletion. A 3.9 MB published engineering PDF imported and indexed all 159 pages through the public connection. Public checks preserved existing example descriptions and dismissals.

## Demo reset retention

Passed isolated API and browser checks for global reset, imported-file/history cleanup, persisted project retention across restart, opt-out, and built-in persistence locks. The complete backend unit suite passes 136 tests. Settings exposes a muted Keep on reset checkbox; built-in examples are checked and disabled. Destructive reset was not executed against the live workspace during verification.
