# Ubuntu deployment

From repository root with Node 24+ and Python 3 with venv:

```bash
scripts/linux/install
scripts/linux/install-ocr
scripts/linux/basis start
scripts/linux/basis health
npx playwright install chromium
scripts/linux/basis check
```

Open http://127.0.0.1:8789/app after health reports ready. Management commands: start, stop, restart, reindex, status, logs, health, check. Services bind to loopback and use extractive retrieval. Installer writes user systemd units; no sudo or automatic boot enablement. It uses the currently selected Node executable; rerun after moving the checkout or removing that Node version.

State, original imports, history and indexes remain in backend/state; generated protected artifacts also live under backend/output. Stop both services before backing up these directories and preserve the complete checkout. Restore into the same revision before starting. Never delete state to troubleshoot a live presentation. The gateway and backend now use the same configuration/token loader. If overriding BASIS_STATE_DIR or BASIS_TOKEN, supply identical settings to both services. The Linux installer retains backend/state, including the frontend bundle.

To refresh indexing, restart the backend; its index builder reuses content caches. For isolated tests use a separate checkout/state, particularly browser tests that reset or delete projects. The read-only presentation smoke test is available as `basis check`.

## Verified workstation constraints

Ubuntu 24.04, Node 24.22.2, Python 3.12.3; PyMuPDF 1.26.7 installed. RTX PRO 5000 is visible with driver 580.95.05; CUDA inference has been validated with both 4B and 14B models. Physical free space approximately 1.7 TB; mount has no visible quota options, but administrative quotas and retention policy are unconfirmed. systemd user manager runs; Linger=no. Do not promise service after logout or reboot. University workload authorization and retention guarantees require institutional confirmation before public hosting.

Tesseract 5.3.4 with English data is installed in user space using scripts/linux/install-ocr. The workstation already supplies libtesseract5 and its shared dependencies. The full corpus indexes with zero failures. Existing caches marked ocr-unavailable were moved into backend/state/pre-ocr-cache for regeneration. Initial tests before the local Python environment existed: 75 passed, 71 failed. Native extraction improved the suite to 135 passed and 11 failed. With corrected OCR, portable path assertion, and the normal test configuration (no forced EXTRACTIVE_ONLY override), all 146 tests pass. Frontend production build passes. Two Qwen models are installed; the optional inference service is stopped by default after evaluation.

## Public migration and rollback

Do not change vercel.json or establish a tunnel during local validation. First pass browser/API, isolation, persistence, OCR, IFC and inference checks; obtain institutional permission and confirm uptime/storage guarantees. Back up the Windows state during a coordinated write pause, transfer it securely, verify matching protected projects and user data on an isolated Ubuntu instance, then arrange an authorized authenticated HTTPS gateway. Only then review a separate frontend destination change. Retain the Windows endpoint and backup. Roll back the frontend destination if health or workflow checks fail; reconcile writes made after cutover before resuming Windows writes. No public routing has been changed here.

## Validation commands

`scripts/linux/test-backend` runs the Python OCR regression, the complete Node unit suite sequentially, and the existing project API integration suite against port 8810 with a new isolated state directory. Results remain under backend/state/verification/run-*/. Run after the working backend completes indexing to reuse its PDF caches. Do not run other test servers on port 8810 concurrently. `scripts/linux/basis check` checks all four protected projects through the gateway and bundled Playwright Chromium. Set BASIS_BROWSER_CHANNEL=chrome only when intentionally using an installed Chrome.

The OCR fix requests TSV directly through tessedit_create_tsv=1 and rejects missing coordinate columns. Merely checking Tesseract's exit code is insufficient: missing config files can produce plain text with exit status zero. Verified on the 35-page Infill LID PDF: 8,294 extracted words, including combined-sewer requirements. The extraction script fingerprint automatically invalidates prior caches.

## Corpus accounting

The checkout supplies 59 PDF files with 57 distinct SHA-256 hashes. design-guidelines.pdf is byte-identical to volume-3-03-design-guidelines__.pdf; stormwater-manual.pdf is byte-identical to volume-3-02-stormwater-management-and-design-manual.pdf. The indexer consolidates matching hashes while retaining filename aliases. Therefore 57 indexed documents, with zero failures, accounts for all 59 files.

## Verified baseline — 2026-11-08

- Health: READY, 57 unique documents, zero extraction failures; 20 protected project artifacts.
- Full Node unit suite: 146 passed, zero failed/skipped (37.4 seconds).
- Existing project API integration suite: 4 passed, zero failed/skipped.
- New Linux lifecycle check: PDF import/search, explicit empty selection, foreign/global private-file rejection, metadata/PDF/history/citations across process restart, ordinary project deletion.
- Presentation browser check: all four protected projects, every associated original PDF with byte ranges, prepared source evidence, rendered highlights/text layers and dashboard navigation; no browser errors.
- OCR malformed-output regression and gateway isolated-auth/interrupted-stream regression passed.
- Logs: backend/state/verification/run-HDet8fGT/ and /tmp/basis-presentation.log (local only).

These checks establish the extractive backend baseline. GPU evaluation and extended browser workflows are complete, with the limitations below. Public hosting remains conditional on institutional policy, retention and process-lifetime guarantees.

## GPU validation — initial model

Pinned Ollama 0.40.15 installed in ~/.local/share/basis-runtime; release archive SHA-256 verified. Optional installer: scripts/linux/install-gpu. Service: systemctl --user start|stop|status basis-ollama; logs: journalctl --user -u basis-ollama. Binds 127.0.0.1:11435, cloud disabled, one model and one concurrent request. Backend remains extractive.

Qwen3 4B Instruct 2507 Q4_K_M (digest 0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0) downloaded and executed on CUDA compute 12.0. Ollama reports 3,180,247,121 bytes entirely in GPU memory. Whole-GPU observed peak 7,083 MiB including desktop sessions; utilization peaked at 91%. Reasoning benchmark: 21/24 passed in 34.778 seconds including cold load; one false approval. Failed formula ambiguity, verified arithmetic and dwelling threshold cases. This model is not approved as an independent correctness verifier. Raw evidence: backend/test-results/local-reasoning-qwen3-4b.json and /tmp/basis-gpu-samples.csv.

Sources: https://docs.ollama.com/gpu and https://docs.ollama.com/linux. Documentation support was verified against actual runtime CUDA detection and model residency; no system drivers/toolkit were modified.

## Extended browser verification

`scripts/linux/test-browser` starts an isolated extractive API/gateway on 8840/8842 and runs the existing projects, project-editor, project-packages and IFC browser suites using bundled Chromium. All four passed on 2026-11-08, including native folder/PDF imports, searchable imported content, explicit document selection, issue dismissal, saved history, both IFC downloads and model-register searches with source highlights. Evidence is in backend/state/verification/run-browser-2hSD63ZC/. This runner resets only its disposable project state; do not reuse those ports for a presentation service.

Qwen3 14B Q4_K_M comparison: 23/24 reasoning cases passed, one false approval (flattened formula ambiguity), 24.554 seconds including load. Ollama reports 9,656,839,699 bytes entirely in VRAM at 4096 context. This improves on 4B but does not qualify the model as an independent verifier. The existing synthesis/evidence pipeline was tested using scripts/linux/test-gpu-quality qwen3:14b; default application configuration remains extractive.

## GPU operating decision

The Qwen3 14B API smoke suite passed 8/10 cases. It incorrectly described Edmonton provisions as Toronto requirements, despite anchored citations. This is a real applicability failure: citation geometry alone does not establish jurisdiction. The bridge-cover no-answer case also failed; current indexed bridge standards contain relevant cover provisions, so that expectation needs corpus-aware review. No assertions were weakened. Preserve extractive mode for demonstrations; GPU synthesis is experimental and is not automatically enabled by installation.

To reproduce GPU evaluation without changing the working application:

```bash
scripts/linux/install-gpu
systemctl --user start basis-ollama
OLLAMA_HOST=127.0.0.1:11435 ~/.local/share/basis-runtime/ollama-0.40.15/bin/ollama pull qwen3:14b
(cd backend && node tests/local-model-benchmark.mjs ollama http://127.0.0.1:11435 qwen3:14b)
scripts/linux/test-gpu-quality qwen3:14b
BASIS_QUALITY_SUITE=engineering scripts/linux/test-gpu-quality qwen3:14b
systemctl --user stop basis-ollama
```

The quality runner starts and stops a separate API on 8814 with disposable state, EXTRACTIVE_ONLY=0, GENERATION_PROVIDER=ollama, LOCAL_SYNTHESIS=1 and localhost OLLAMA_URL. Existing backend and gateway services retain their extractive settings. Stop the optional Ollama service when finished to release GPU resources immediately. No lingering or boot-start configuration has been changed. Tests create no external tunnels and call no paid inference services.

Complex-engineering GPU suite completed: 3/7 passed in 209 seconds. Raw cases remain in backend/test-results/quality-engineering.json; isolated server logs under backend/state/verification/run-gpu-dJxFEDeb. Failed outputs include incomplete minor-system, servicing-replacement, capacity-expansion and damaged-LID reasoning. The GPU hardware/runtime is feasible, but this model/pipeline combination is not qualified for default use. No further model downloads are justified for this migration.

Primary backend warm service restart: ready with 57 documents and zero failures in 5.712 seconds; the four-project presentation browser check passed again afterward.

## Installation and recovery audit

All three delivered installers were executed successfully on this workstation after implementation: install (npm ci twice, pinned PyMuPDF, frontend build, user units), install-ocr (user-local packages/language discovery), and install-gpu (pinned digest and user unit). GPU service remains stopped. Only backend 8787 and gateway 8789 are listening, both on 127.0.0.1. No Vercel configuration or dependency lockfiles changed.

For a consistent backup, stop the services with `scripts/linux/basis stop`, archive `backend/state` and `backend/output` into a private user-owned backup directory, then start again. Keep the branch revision with the archive. Recovery should first restore into a separate checkout of that revision: install dependencies, copy the saved state/output, and verify health and protected projects before using it. Do not merge two independently modified projects.json stores. Session credentials are inside state; protect backup permissions. For migration from Windows, copy its current state during a coordinated write pause; this local installation currently contains repository-provided projects and its own local state, not an unrequested copy of private Windows documents/history.

Final recommendation: use this machine for local demonstrations, development and GPU experiments. Uninterrupted public hosting is not established: Linger=no, university authorization, home retention and any administrative quotas remain unconfirmed. No logout or workstation reboot was forced because other users have active sessions. Nothing was exposed publicly.

The installer audit exposed and fixed invalid quoting of systemd WorkingDirectory. The corrected installer now validates generated units with systemd-analyze before reload. Reinstallation, service start, zero-failure readiness and the complete presentation browser check then passed using the generated units.

## Acceptance evidence and remaining boundaries

| Requirement | Evidence/result |
| --- | --- |
| All protected projects and original engineering PDFs | 59 files/57 unique hashes; zero failures; all-four-project presentation browser suite |
| Project CRUD, collections, individual/empty scopes | 146-unit suite, 4 API integration cases and projects/editor browser suites |
| Imports, folder imports, private ownership | Linux lifecycle API test and project-editor browser suite; foreign and global private-PDF access rejected |
| Citations, byte ranges, highlights and source navigation | Presentation, projects, researched-packages and IFC browser checks; extraction/retrieval anchor tests |
| Persistent metadata/history/imports | Linux lifecycle test stops and restarts its API, then validates stored query evidence and original PDF |
| Findings, dismissals, protected-content repair | Projects browser and project-store unit tests; prepared evidence anchored to originals |
| IFC downloads/register search | Both model downloads, actual property search and highlighted sources passed IFC browser suite |
| Startup/recovery/logs/health | Executed installers, generated-unit validation, stop/start, warm restart, journal logs and health exit status |
| GPU compatibility/performance/quality | CUDA 12.0 architecture detected; 4B/14B fully GPU resident; measured utilization/VRAM; reasoning, smoke and engineering results recorded above |
| Reliable default despite inference limits | Deployed services force extractive mode; inference service stopped; final browser/health checks pass without it |
| Existing deployment preservation | No vercel.json or Windows launcher changes; no pushes, public tunnels, public listeners, driver changes or privileged commands |
| Public migration/rollback | Procedure above; cutover intentionally not performed |

Repository changes comprise Linux installers/management/test runners, explicit TSV OCR validation with regression coverage, shared gateway token configuration, portable test paths/browser selection, and this operational record. No frontend production behavior or API contract was replaced. All changes are on deployment/ubuntu-gpu. Runtime state, test artifacts, secrets and model weights remain ignored/untracked outside commits.

This completes local deployment and GPU feasibility evaluation. Public hosting authorization, institution-managed persistence/quotas and post-logout uptime are external prerequisites for a later public cutover, not verified properties of this local installation. Current synthesis quality is a documented limitation, not a passing result.
