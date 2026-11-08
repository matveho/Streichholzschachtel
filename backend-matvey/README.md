# Basis — Matvey backend

An independent local backend for the existing Basis interface. The main backend in `../backend` remains independent. Vercel continues to build the root Vite frontend; none of this service runs in Vercel Functions.

## Start on this computer

For the team presentation, use **Start Demo.cmd** and [DEMO.md](DEMO.md). This device has a saved demo engine and frontend under ignored `state/`; the demo uses port 8787 while development uses port 8788.

**Start Backend.cmd** prepares the current backend, PDF extractor and local model runtime. On the first run it downloads the configured model into `state/models`. Subsequent starts reuse the model and PDF extraction cache. The current frontend expects the `/local-api` gateway; the launcher does not yet recreate that public gateway automatically, so use the running deployed demo for team testing.

The deployed frontend connects automatically through Vercel's `/local-api` rewrite to `demo-gateway.mjs` on port 8789, which authenticates internally to the API on port 8787. The gateway's HTTPS quick tunnel must remain running. Its URL changes when recreated and then requires updating the Vercel rewrite. The launcher also creates a separate private API tunnel; that private connection link is no longer used by the current frontend.

Home has five labelled static **Example** queries in history. New queries use Matvey's backend automatically, without a source selector or connection-key entry.

This machine already has Node.js, Python, Ollama, Tesseract and cloudflared. A fresh machine needs Node.js 24+, Python 3.10+, Ollama, cloudflared, Tesseract with English language data for OCR, and the root frontend dependencies (`npm ci` in the repository root). The launcher installs its own npm dependencies and PyMuPDF into this folder. Set `OLLAMA_PATH`, `TESSERACT_PATH` or `CLOUDFLARED_PATH` if their executables are elsewhere.

## Documents

The service reads PDFs in `../public/documents` and **documents/** without modifying them. Put additional PDFs in **documents/** and restart to reindex. That folder stays local and is ignored by Git. PDFs under the frontend's `public` folder can be published with the site. There is no upload endpoint. Exact file hashes deduplicate copies and reuse extraction caches. The current collection contains nine unique documents.

The extractor retains page dimensions, text and original page coordinates. Each response citation contains an exact source excerpt, PDF page and line rectangles. The frontend uses these for hover, selection, scrolling and minimap marks. Scanned pages and malformed text layers use local Tesseract OCR. When an existing hidden layer has broken spacing, recovered quotations must also agree with its original characters, quantities and punctuation. Low-confidence OCR is withheld, and OCR citations are identified in the response and result notes. First indexing can take several minutes; subsequent starts reuse caches. Blank or unreadable files produce an explicit indexing failure. `/health` gives the failure count; authenticated `/v1/documents` includes the failed filenames.

## Answering behavior

Queries search the indexed collection, with separate retrieval for independent checks in a long question. Local mode selects numbered original source-line ranges for each requested check. It does not ask the model to write or retype the quoted evidence. Selected ranges are checked against extracted source text and original page geometry, then reviewed for asset, scope and completeness, with unresolved checks identified explicitly. This review uses the same local model and can still miss relevance errors. Hosted synthesis additionally checks generated quantities, units, lexical grounding and semantic support, with one bounded repair pass for citation problems. Source text is evidence, never instructions.

**Current quality status:** direct source lookups and experimental local synthesis are integrated with the frontend. Exact numeric lookups can answer without generation; local synthesis selects source provisions per topic, applies numeric conditions, checks derived arithmetic and verifies the generated conclusion. Set `LOCAL_SYNTHESIS=1` to enable that path; it is enabled in this device's ignored `.env`. Some complex queries are still incomplete or withheld. The full goal of matching the prepared examples on general queries remains open. Do not treat passing transport, citation or browser tests as proof of answer quality.

An optional hosted adapter exists, but the user chose **local processing**. It remains disabled; no hosted key was created and no credits were spent. The active service uses Ollama on this device. Do not enable hosted processing as part of ongoing development without a new user instruction.

No suitable or verifiable evidence produces **No supported answer**, with empty document results and no citations. Development local synthesis also withholds results when analysis fails. The frozen demo uses an earlier engine. A valid quote is not proof that every interpretation is correct: engineering decisions still need source review. Document scope and edition remain visible; the service does not infer that an old publication is current law or resolve document precedence automatically.

Jobs run one at a time to fit this device's GPU, with a bounded queue and cancel support. Completed responses persist in `state/queries`; opening a completed query in the same browser and connection restores its snapshot. Changes to documents or the engine invalidate cached results automatically; search again to force a refresh. Browser history and backend settings are stored locally in that browser.

## Configuration

Copy `.env.example` to `.env` for overrides. The default model is `qwen3:4b-instruct-2507-q4_K_M`, served by an isolated Ollama instance on `127.0.0.1:11435`; its models stay under this folder. A new model download requires at least 6 GiB of free disk space; existing models are reused without downloading. Your existing Ollama service on port 11434 is unaffected. To use an existing service, override `OLLAMA_URL` and `OLLAMA_MODEL` and install that model there yourself. `EXTRACTIVE_ONLY=1` disables model selection explicitly.

The API binds to loopback port 8787. `FRONTEND_URL` optionally opens an already deployed frontend instead of the bundled interface. The production Basis origin and localhost are allowed by CORS; add exact preview origins with `ALLOWED_ORIGINS`. Same-origin bundled frontend requests are allowed too. Requests to documents, query history and query endpoints require a random connection key generated in `state/session-token.txt`.

The private API requires its connection key. The separately exposed demo gateway intentionally allows public document access and query submission, as requested for school testing; it does not expose the full query-history listing. `state/connection.json` contains private connection details and is Git-ignored. Public sample PDFs remain public assets of the frontend.

Closing the launcher stops its child services and tunnel. If it attaches to an API or model server you started separately, that separately started service remains your responsibility.

The optional contradiction verifier uses the authorized E-drive cache. See [VERIFIER.md](VERIFIER.md) for reproducible setup and its measured limits. It is enabled in development, not in the frozen demo snapshot.

An optional generation runtime is being evaluated separately; see [LOCAL_RUNTIME.md](LOCAL_RUNTIME.md). The default launcher and deployed demo have not been switched to it.

## API and development

Run commands from this folder:

```powershell
npm ci
npm run index
npm start
npm test
node --test tests/api.integration.mjs
node tests/quality.mjs
node tests/browser.mjs
```

The integration and quality checks require the API to be running. The browser check uses the bundled frontend and a current tunnel from the launcher. Root static UI regression checks still use the root dev server on port 5173. Reports and screenshots go into `test-results/`. Never commit `state/`, connection keys, PDFs added to `documents/`, model weights, virtual environments or dependency directories.

| Endpoint                     | Behavior                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /health`                | Public readiness, document and passage counts, configured model, index failures                 |
| `GET /v1/documents`          | Authenticated metadata and PDF file URLs                                                        |
| `GET /v1/documents/:id/file` | Original PDF, supports byte ranges; bearer header or `?token=`                                  |
| `POST /v1/queries`           | JSON `{ "question": "…" }`; returns asynchronous job, HTTP 202                                  |
| `GET /v1/queries/:id`        | Poll `queued`, `running`, `completed`, `failed` or `cancelled`; completed jobs include `result` |
| `DELETE /v1/queries/:id`     | Cancel pending/running work                                                                     |
| `GET /v1/queries`            | Latest completed query summaries                                                                |

Use `Authorization: Bearer <connection key>`. `result` contains `documents`, `references`, `report`, `mode` and `notes`. Document file URLs are relative to the API. References use one-based PDF pages and top-left coordinates in PDF points; `regions` is an array of `[left, top, width, height]`. Report blocks have optional `heading` and `sentences: [{ text, refs? }]`. This adapter is isolated in `../src/backend.ts` so the main backend can adopt a different contract later.

## Implementation map

- `src/indexer.mjs`, `extract.py`: faithful text and coordinate extraction, versioned caches.
- `src/search.mjs`: lexical retrieval, phrase matching, engineering concept expansion and evidence relevance gates.
- `src/local-evidence.mjs`: per-check selection of original source-line ranges, without model-written claims.
- `src/model.mjs`: isolated local runtime and optional hosted provider adapters.
- `src/answer.mjs`: grounded synthesis, citation checks, review and refusal/excerpt modes.
- `src/server.mjs`: authenticated API, job queue, persistence, range PDFs, CORS and bundled frontend serving.
- `launch.mjs`, `Start Backend.cmd`: isolated setup, frontend bundle, local services and HTTPS tunnel.

No server code or model credentials are imported into the frontend bundle. New backend dependencies are scoped to this folder.
