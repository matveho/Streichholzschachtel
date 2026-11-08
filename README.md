# basis

**Where did this number come from?** basis helps civil engineers trace a design decision back to the drawing, report or standard behind it. Open a project, query its drawings, reports and standards, then select a citation to see the highlighted passage in the original PDF.

[Open basis](https://streichholzschachtel.vercel.app/#projects) · Built for natHacks 2026 by team Streichholzschachtel.

## Try a design review

1. Open **Parkview Exchange Redevelopment**. Under **Potential issues**, inspect the sanitary upstream grade finding.
2. Compare the proposed **0.30%** slope on drawing C101 with the EPCOR table in the adjacent viewer. The applicable row depends on the reach being upstream and its peak dry-weather flow. Select the table citation to inspect those conditions yourself.
3. Open **North Ridge Highway Intersection Upgrade** and inspect the traffic and pavement inputs. Here the question is whether two project reports used the same traffic counts. Use **Query Files** to ask a follow-up within this project's documents.

The demonstration projects pair fictional design packages with published engineering guidance. The comparison findings are prepared and linked to their evidence. Fresh queries search the active project's files locally. Engineers can inspect and dismiss a finding after review.

## Run locally

On Windows with **Node.js 24 or newer**, install the dependencies from the repository root:

```powershell
npm ci
npm ci --prefix backend
```

Double-click **Start basis.cmd** and choose **5** to open the workspace. For the full PDF extraction and table-reading setup, see the [backend guide](backend/README.md). The hosted frontend connects to the presentation computer over HTTPS, so that computer and its tunnel must be online for the public demo.

## Inside the repository

- [Frontend](src/) — React and TypeScript workspace with a PDF.js viewer.
- [Backend](backend/) — project storage, local search, indexing and citation coordinates.
- [Project packages](backend/demo/PROJECT-PACKAGES.md) — source provenance, engineering assumptions and the basis for each prepared comparison.
- [API contract](backend/PROJECT_API.md) — project, document, query and finding endpoints.
