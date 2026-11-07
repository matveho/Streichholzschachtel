# Basis — Matvey backend

An independent local backend for the existing Basis interface. The main backend in `../backend` remains independent. Vercel continues to build the root Vite frontend; none of this service runs in Vercel Functions.

## Start on this computer

Double-click **Start Backend.cmd** and keep its terminal open. It builds the current frontend into `state/frontend`, prepares the isolated PDF extractor, starts the local API and model runtime, and opens Basis with Matvey's backend selected. On the first run it downloads the configured model into `state/models`. Subsequent starts reuse the model and PDF extraction cache.

The launcher opens the bundled interface at a stable localhost address so this computer's saved query history survives tunnel restarts. It also creates an HTTPS Cloudflare quick tunnel so a deployed HTTPS frontend or a teammate can reach the backend without mixed-content restrictions. The remote URL changes when the tunnel restarts; use the new private remote connection link printed by the launcher. Connection links supply the API URL and key and remove them from the address bar after loading. The bundled interface works before frontend changes are deployed to Vercel.

Home has a **Data source** selector for **Backend (main)**, **Matvey's backend**, and **Static data**. Main and Matvey have separate URLs and connection keys. **Check connection** verifies authenticated document access. Static examples remain available when the local backend is stopped. Main uses the provisional API described below; adapt the frontend adapter when the main engineer chooses its API.

This machine already has Node.js, Python, Ollama, Tesseract and cloudflared. A fresh machine needs Node.js 24+, Python 3.10+, Ollama, cloudflared, Tesseract with English language data for OCR, and the root frontend dependencies (`npm ci` in the repository root). The launcher installs its own npm dependencies and PyMuPDF into this folder. Set `OLLAMA_PATH`, `TESSERACT_PATH` or `CLOUDFLARED_PATH` if their executables are elsewhere.

## Documents

The service reads the five existing original PDFs in `../public/documents` without modifying them. Put additional text-based PDFs in **documents/** and restart to reindex. They stay local and are ignored by Git. There is no upload endpoint. Exact file hashes identify document versions and reuse extraction caches.

The extractor retains page dimensions, text and original page coordinates. Each response citation contains an exact source excerpt, PDF page and line rectangles. The frontend uses these for hover, selection, scrolling and minimap marks. Scanned pages and malformed text layers use local Tesseract OCR. When an existing hidden layer has broken spacing, recovered quotations must also agree with its original characters, quantities and punctuation. Low-confidence OCR is withheld, and OCR citations are identified in the response and result notes. First indexing can take several minutes; subsequent starts reuse caches. Blank or unreadable files produce an explicit indexing failure. `/health` gives the failure count; authenticated `/v1/documents` includes the failed filenames.

## Answering behavior

Queries search the indexed collection, with separate retrieval for independent checks in a long question. Local mode selects numbered original source-line ranges for each requested check. It does not ask the model to write or retype the quoted evidence. Selected ranges are checked against extracted source text and original page geometry, then reviewed for asset, scope and completeness, with unresolved checks identified explicitly. This review uses the same local model and can still miss relevance errors. Hosted synthesis additionally checks generated quantities, units, lexical grounding and semantic support, with one bounded repair pass for citation problems. Source text is evidence, never instructions.

**Current quality status:** the small local models tested on this device did not meet the target for reliable consolidated interpretation. Local mode therefore displays exact verified source wording, labelled **source evidence**, rather than their proposed conclusions. This is a deliberate temporary fallback. The full goal of matching the prepared examples on general queries is still open. Do not treat passing transport, citation or browser tests as proof of answer quality.

An optional hosted adapter is implemented with Vercel AI SDK 7. Set `GENERATION_PROVIDER=gateway`, `AI_GATEWAY_MODEL` and `AI_GATEWAY_API_KEY` in this folder's ignored `.env` to enable it. Questions and retrieved excerpts then leave the device for the selected provider through Vercel AI Gateway; original PDFs and the API remain hosted here. It is disabled by default. Hosted requests require explicit authorization to create a key and spend credits, and have not yet been verified against the quality suite. Never paste credentials into chat or commit them. Use a dedicated budgeted, expiring key and renew it deliberately; the launcher does not buy credits or enable auto top-up.

No suitable or verifiable evidence produces **No supported answer**, with empty document results and no citations. Unrelated collection PDFs are not presented as query results. A model failure produces clearly labelled **source excerpts** rather than a generated conclusion. Source excerpts can be useful for inspection, but are not a completed engineering answer. A valid quote is not proof that every interpretation is correct: this is a document research tool, and engineering decisions still need source review. Document scope and edition remain visible; the service does not infer that an old publication is current law or resolve document precedence automatically.

Jobs run one at a time to fit this device's GPU, with a bounded queue and cancel support. Completed responses persist in `state/queries`; opening a completed query in the same browser and connection restores its snapshot. Changes to documents or the engine invalidate cached results automatically; search again to force a refresh. Browser history and backend settings are stored locally in that browser.

## Configuration

Copy `.env.example` to `.env` for overrides. The default model is `qwen3:4b-instruct-2507-q4_K_M`, served by an isolated Ollama instance on `127.0.0.1:11435`; its models stay under this folder. A new model download requires at least 6 GiB of free disk space; existing models are reused without downloading. Your existing Ollama service on port 11434 is unaffected. To use an existing service, override `OLLAMA_URL` and `OLLAMA_MODEL` and install that model there yourself. `EXTRACTIVE_ONLY=1` disables model selection explicitly.

The API binds to loopback port 8787. `FRONTEND_URL` optionally opens an already deployed frontend instead of the bundled interface. The production Basis origin and localhost are allowed by CORS; add exact preview origins with `ALLOWED_ORIGINS`. Same-origin bundled frontend requests are allowed too. Requests to documents, query history and query endpoints require a random connection key generated in `state/session-token.txt`.

The HTTPS tunnel is publicly routable, but private API data requires the connection key. Anyone with the connection link can access the indexed documents and query history while the service runs. Keep that link private. `state/connection.json` includes it for local reuse and is Git-ignored. To rotate the key, stop the backend and remove only `state/session-token.txt`, then restart. Previously saved PDF links will need a new query after rotation. Public sample PDFs remain public assets of the frontend.

Closing the launcher stops its child services and tunnel. If it attaches to an API or model server you started separately, that separately started service remains your responsibility.

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
