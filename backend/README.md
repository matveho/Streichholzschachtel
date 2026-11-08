# Basis backend

The local Node service stores each project's document associations and query history. Before searching, it limits the index to the selected project's files. Answers carry a document ID, PDF page and highlight coordinates so the frontend can take the reader back to the evidence.

## Setup

Install the Node dependencies as described in the [project README](../README.md). For native PDF extraction, run these commands from this directory with Python 3.10 or newer:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Install Tesseract with English language data to search scanned pages. Launch **Start Basis.cmd** from the repository root. Choose **2** to restart and reindex, **4** for status, or **T** to check the presentation. [Launcher controls](CONTROLS.md)

## Files and data

- `src/` contains the API, project store and retrieval code.
- `demo/`, `references/` and `output/` hold the protected project definitions, official references and generated project artifacts. The model registers support searches over the two prepared IFC models.
- `state/` holds local project data, imports and query history. Use the project editor to associate a private PDF with a project. Vercel serves the frontend and forwards requests to the local gateway.

Run `npm test` here for the backend suite. For frontend development, start the gateway, then run `npm run dev` at the repository root. Set `BASIS_DEV_BACKEND_URL` if the gateway uses a different port from the default 8789.

[API and persistence](PROJECT_API.md) · [IFC models](demo/IFC-MODELS.md)
