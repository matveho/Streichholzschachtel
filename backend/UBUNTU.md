# Ubuntu deployment

Run from the repository root with Node 24+, Python 3 with venv, and a working
`systemd --user` session. All dependencies and services are user-owned; no sudo.

```bash
scripts/linux/install
scripts/linux/install-ocr
scripts/linux/basis start
scripts/linux/basis health
npx playwright install chromium
scripts/linux/basis check
```

The installer installs Node/Python dependencies, builds the frontend, and writes
backend/gateway user units. A fresh installation uses extractive retrieval.
Existing state and mode drop-ins survive reinstallation. Open
http://127.0.0.1:8789/app after health reports ready. Backend 8787 and gateway
8789 listen on loopback. Reinstall after moving the checkout or replacing its
selected NVM Node executable. Services are not automatically enabled at login.

## Management

```bash
scripts/linux/basis start
scripts/linux/basis stop
scripts/linux/basis restart
scripts/linux/basis status
scripts/linux/basis logs
scripts/linux/basis reindex
scripts/linux/basis health
scripts/linux/basis check
```

Reindex restarts the backend and reuses immutable PDF caches. Do not delete state
to troubleshoot a presentation. Logs also use `journalctl --user -u basis-backend
-u basis-gateway`. The gateway and backend must use the same BASIS_STATE_DIR and
session credentials. Reinstalling preserves the frontend bundle in backend/state.

## GPU comparisons and reliable source fallback

The current demo uses Qwen3.5 35B-A3B Q4_K_M for explicit project/reference
comparisons. General engineering reviews and approval requests retain the
extractive workflow. This is a research comparison capability, not a compliance
or construction-approval system. Unrestricted synthesis remains experimental.

```bash
scripts/linux/install-gpu
systemctl --user start basis-ollama
OLLAMA_HOST=127.0.0.1:11435 ~/.local/share/basis-runtime/ollama-0.40.15/bin/ollama pull qwen3.5:35b-a3b-q4_K_M
scripts/linux/test-comparisons
scripts/linux/basis mode comparisons
scripts/linux/basis health
```

The preparation helper checks the evaluated manifest digest, creates the local
alias `basis-qwen35-comparisons:72aac7c28be8`, runs a structured readiness request,
and checks GPU residency before changing the backend mode. Weights require about
22 GB storage. Verified inference used 21.78 GB VRAM at 16K context. The pinned
Ollama runtime is 0.40.15, private on 127.0.0.1:11435 with cloud disabled, one
loaded model and one concurrent inference request. No system CUDA toolkit or
driver changes are needed.

Immediate rollback, independent of model availability:

```bash
scripts/linux/basis mode extractive
scripts/linux/basis health
```

Both mode commands restart only the backend, preserving project data, query
history, the gateway and the active tunnel. Mode is stored in the user unit's
`basis-backend.service.d/mode.conf`; normal start/restart retains it. Changing
mode invalidates incompatible cached answers while retaining history records.
Returning to the same engine/configuration restores compatible cached results.
Public rollback and restoration were executed and verified.

## Current verification

All 59 supplied PDF files are accounted for by 57 unique hashes, including 20
protected project artifacts. The two duplicate standards retain filename aliases.
Indexing is READY with zero failures. User-local Tesseract 5.3.4 and PyMuPDF 1.26.7
provide OCR, original word geometry and table extraction.

- 246 Node tests pass, plus OCR, isolated project API/import/isolation/restart checks.
- Nine comparison capability cases cover two real numeric comparisons, verified
  arithmetic, unsupported/missing design bases, foreign jurisdiction, empty and
  foreign document scopes, and extractive routing for general reviews.
- Browser verification submits the comparison through the UI, checks the 50 mm
  result, opens both original PDFs with highlights, reloads stored history and
  verifies general reviews stay extractive.
- Public Vercel browser verification passed for the same comparison and both
  highlighted citations. IFC scanning still reports 13 potential Parkview issues.
- Existing project/editor/package/IFC browser suites cover CRUD, collections,
  folder/PDF uploads, private imports, issue dismissal and model-register search.
- Reference reconciliation works in offline lookup: differing service-depth
  criteria are listed with their measurement datums and original PDF citations.
  The browser suite checks both highlights, the required design-basis input and
  persistence. A request naming one publication remains limited to that source.
- Multi-check review validation and repair are bounded per requested check,
  preserving later findings instead of silently dropping them. Source-use
  coverage distinguishes partial findings from source evidence still requiring
  interpretation and links those provisions to their original PDFs.

```bash
scripts/linux/test-backend
scripts/linux/test-browser
scripts/linux/test-comparisons
LOCAL_SYNTHESIS_POLICY=comparisons scripts/linux/test-reasoning-capabilities qwen3.5:35b-a3b-q4_K_M
```

To check reference reconciliation alone, run
`BASIS_BROWSER_SUITES=reference-criteria scripts/linux/test-browser`.
For example, select the Connection Guide and Construction Specifications and ask
"What is the minimum depth of a storm service at the property line?" The report
separates the 2.4 m connection criterion from the 2.0 m invert-to-curb criterion;
it requests a design-basis/datum decision instead of equating those values.
This register identifies provisions to reconcile, not proven document conflicts.

`scripts/linux/test-review-coverage` tests the generated multi-check coverage
display in an isolated experimental backend. It does not enable unrestricted
generation in the demo. General review quality remains incomplete; production
keeps the pinned comparison configuration and extractive general-query path.

Test runners use disposable state under backend/state/verification. They reserve
8810, 8814 or 8840/8842; do not run runners sharing a port concurrently. Browser
runners may reset/delete their disposable projects. Never redirect those tests
to the live state. Results remain in their reported state directories.

Project dashboards automatically scan associated IFC models and explicit
classification-table limits. Rescan revalidates prepared evidence and IFC
checks while preserving dismissals. Source pages, object identifiers and table
coordinates are retained. Unsupported properties, geometry and qualitative
requirements still need engineering review; zero findings does not prove
compliance. `/compare-ifc` remains compatible; the UI uses `/rescan`.

## Persistence, backup and recovery

Preserve backend/state, backend/output and the matching repository revision.
State contains metadata, imports, history, indexes and session credentials; keep
backups private. During a coordinated write pause, stop backend/gateway, archive
these directories, then start again. Restore first into an isolated checkout of
the matching revision, install dependencies, copy the saved data, and verify
health/protected projects before routing traffic. Do not merge independently
modified projects.json stores. No private Windows history was copied implicitly.

Protected repository project documents recover automatically. User imports and
history require the state backup. Stored evidence is invalidated when source,
extraction, generation policy, model alias or engine fingerprints change.

## Public access and workstation limits

The public frontend forwards `/local-api` through a Vercel project-level route
to the Ubuntu gateway's outbound HTTPS Quick Tunnel. Check the active route in
Vercel when diagnosing connectivity. If the tunnel hostname changes, validate
the new origin before promoting the updated route. For rollback, preserve any
new project writes, verify the replacement backend and its data, and route
traffic to its reachable origin. The former Windows destination is offline.
Verify project loading and a cited PDF through the public site after switching.

Verified workstation: Ubuntu 24.04, Node 24.22.2, Python 3.12.3, RTX PRO 5000
Blackwell with NVIDIA 580.95.05. User services work, but Linger=no: keep the login
session active for the demo. Logout/reboot persistence, retention guarantees and
administrative quotas are unconfirmed. Do not force logout/reboot on this shared
machine. A tunnel restart can change its hostname; routine backend mode changes
leave it running. This workstation is verified for the authorized demo, not
uninterrupted public hosting.
