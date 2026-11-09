# basis backend

The local Node service stores each project's document associations and query history. Before searching, it limits the index to the selected project's files. Answers carry a document ID, PDF page and highlight coordinates so the frontend can take the reader back to the evidence.

## Setup

Install the Node dependencies as described in the [project README](../README.md). For native PDF extraction, run these commands from this directory with Python 3.10 or newer:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

On macOS or Linux, use `.venv/bin/python -m pip install -r requirements.txt`
after creating the virtual environment. Native and fallback PDF extraction use
separate caches, so installing the native extractor automatically rebuilds the
PDF text on the next index run.

Install Tesseract with English language data to search scanned pages. Launch **Start basis.cmd** from the repository root. Choose **2** to restart and reindex, **4** for status, or **T** to check the presentation. [Launcher controls](CONTROLS.md)

### Ubuntu without sudo

From the repository root, with Node.js 24+, Python 3 with virtual-environment
support, and a working user systemd session:

```bash
scripts/linux/install
scripts/linux/install-ocr
scripts/linux/basis rebuild-interface
scripts/linux/basis start
scripts/linux/basis health
```

The installer creates user services and starts with model-independent retrieval.
Backend and gateway listen on localhost ports 8787 and 8789. Native extraction
uses `backend/.venv`; OCR binaries and language data live under
`~/.local/share/basis-ocr`. Project metadata, uploads, indexes and history live in
`backend/state`, which must stay outside version control. Do not rerun the
installer over an active installation: it rewrites its user service definitions.

Optional GPU setup uses the pinned user-local Ollama runtime and model:

```bash
scripts/linux/install-gpu
scripts/linux/basis mode demo
scripts/linux/basis prepare-demo
```

Model preparation downloads weights; check home quota and free GPU memory
first. Port 11435 remains local. `mode extractive` restores model-independent
retrieval. The public HTTPS tunnel and Vercel destination are configured
separately. This workstation has no user-service lingering; keep the session
logged in during the demonstration.

Use `basis status`, `basis logs`, `basis restart`, or `basis reindex` through
`scripts/linux/basis`. Wait for `basis health` to report ready with zero failures
before querying. Run `scripts/linux/test-backend` for isolated API, OCR and
persistence checks. See [demo workflows and recovery](DEMO.md) for browser
rehearsal and the tested inference policy. For storage recovery, stop the backend
during a maintenance window, make a private copy of `backend/state`, restore that
directory to its original location, then start the services and check health.
Never reset presentation storage to run tests.

## Files and data

- `src/` contains the API, project store and retrieval code.
- `demo/`, `references/` and `output/` hold the protected project definitions, official references and generated project artifacts. The model registers support searches over the two prepared IFC models.
- `state/` holds local project data, imports and query history. Use the project editor to associate a private PDF with a project. Vercel serves the frontend and forwards requests to the local gateway.

Run `npm test` here for the backend suite. For frontend development, start the gateway, then run `npm run dev` at the repository root. Set `BASIS_DEV_BACKEND_URL` if the gateway uses a different port from the default 8789.

[API and persistence](PROJECT_API.md) · [IFC models](demo/IFC-MODELS.md)

### IFC document comparison

Project Potential Issues now includes a live property comparison in addition to
prepared demonstration findings. Click **Rescan** to recheck the project. The scan uses
only selected project documents in Reference, Client requirements, Design,
Technical reports and Supporting materials. It reads the project's associated
STEP IFC models (or the original IFC for legacy demo projects).

Supported checks require a document statement with an explicit IFC element name or tag,
a numeric property (including labelled values such as `200 mm`) and matching unit, such as `IND-LOCAL-02 maximum design speed:
40 km/h`. Findings include the actual IFC value, STEP element ID, GlobalId, source
page and excerpt. When a drawing omits the tag, the checker can use an IFC
SourceDocument/SourcePage link for a specific property; generic labels such as
width still need an explicit element identifier. Dismissals survive rescans; document/model changes invalidate
cached results. `POST /v1/projects/:id/compare-ifc` forces a rescan; project GET
responses include the comparison coverage report.

This is a bounded property checker: it does not infer applicability of general
standards, interpret drawing geometry, compare arbitrary tables, or assess
qualitative requirements. The coverage report lists unsupported documents for
review. No findings is not a compliance certification. IFC upload/association
uses the existing model association mechanism; this change does not add an IFC
upload interface.
