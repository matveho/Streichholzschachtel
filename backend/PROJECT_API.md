# Project workspace integration

The frontend uses the keyless `/local-api` gateway. The underlying API requires the device key. This is a single-device prototype with logical project isolation, not production multi-tenant authentication. Processing is local; HTTPS transports requests and documents to this device.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/v1/reference-collections` | Explicit collections, jurisdictions, descriptions, document IDs and metadata |
| GET / POST | `/v1/projects` | List / create with `name`, `client`, `location`, `description`, `collectionIds`, optional `documentIds` |
| GET | `/v1/projects/:project` | Project, documents, query history, issues and selected collections |
| PATCH / DELETE | `/v1/projects/:project` | Update / delete ordinary projects; protected demo deletion returns 403 |
| POST | `/v1/projects/:project/reset` | Targeted restoration of one built-in project (internal compatibility endpoint) |
| POST | `/v1/demo/reset` | Workspace demo reset: delete ordinary projects with `persistOnReset !== true`, their imports and history; restore all protected seeds |
| PATCH | `/v1/projects/:project/issues/:issue` | Persist `{status:"dismissed"}` or `"open"` |
| GET / POST | `/v1/projects/:project/queries` | History / submit `{question,documentIds?,sourceOnly?,id?}`; pollable job |
| GET / PATCH / DELETE | `/v1/projects/:project/queries/:query` | Read / bookmark with `{saved:true}` / cancel |
| PATCH | `/v1/projects/:project/documents/:document` | Change an uploaded document category with `{category}`; returns `{document, project}` |
| POST | `/v1/projects/:project/documents/import` | Upload `{name,content,category?}`; base64 PDF content, optional category |
| GET | `/v1/projects/:project/documents/:document/file` | Original PDF, association/ownership enforced, byte ranges supported |

Citation geometry and the existing PDF renderer are reused. `src/projects.ts` provides frontend contracts; `src/backend.ts` supports scoped submission and reopening jobs. Routes are `#projects`, `#project/ID`, `#project/ID/new`, `#project/ID/query/QUERY`, `#project/ID/document/DOCUMENT`.

Import and category edits accept `reference`, `client`, `design`, `report`, or
`supporting`. Omitting `category` on import preserves filename guessing. For an
uploaded document, `PATCH /v1/projects/:project/documents/:document` with
`{"category":"design"}` returns the updated `document` and `project`. Category
edits persist after reload and reindex, including repeated uploads of identical
PDF bytes in the same project. Other projects' documents return 404; shared
references and seeded documents cannot be recategorized. Uploads remain owned
by their project for every category. Project renaming continues to use the
existing `PATCH /v1/projects/:project` with `{"name":"New name"}`.

Multi-role pipe reviews may include optional `result.projectInputs` with
`kind: "pipe_measurements"`, `origin: "question"`,
`verifiedAgainstDocuments: false`, and a `measurements` array. Entries identify
the main/service role, stated system, diameter/cover/depth, value, unit, compatible
base length value and stated measurement datum where available. They are supplied
query assumptions, not source evidence or unique IFC element identities. Unstated
diameters are not inferred from another role. The normal `report` also includes
a readable input register; these rows do not gain document citation IDs. Empty
evidence scopes retain empty references/documents.

The rehearsed `demo` runtime preserves model-backed comparisons and adds a
registered worked capacity/storage review. Its `mode` is `verified_review`,
with `reviewExample` identifying the scenario/reference scope and
`arithmeticReview` identifying checked calculations. The worksheet reads source
quotations and supplied inputs at request time; it is not a stored model answer.
`applicabilityConfirmed` remains false. Other general queries retain the
extractive path. See [DEMO.md](DEMO.md) for preparation and presentation.

Capacity reviews also accept role-labelled natural wording. `reviewInputs`
identifies the supplied area, five-year runoff and existing sewer capacity,
including normalized flow values; `verifiedAgainstDocuments` remains false.
Missing or conflicting values return `requiredInputs.kind:
"capacity_review_inputs"` with named `fields` and no calculated answer. The
clarification layer presents those fields instead of generic pipe parameters.

## Isolation

IFC comparisons resolve supported explicit SI property units and project-default
units for typed length, area and volume measures. Length comparisons convert
metres, millimetres, centimetres and kilometres. Findings include `unit`,
`modelValue` and `modelUnit`; `actual` and `expected` share the comparison unit.
Unresolved value/unit definitions appear in `comparison.unitDiagnostics` and
scan errors, and are excluded from numeric comparisons. This does not establish
compliance or perform geometric clash detection.

Source-anchored IFC findings expose a `queryId` that opens through the existing
project-query API. The report uses `mode: "ifc_comparison"` and includes
`result.ifcFinding` with model, element, property and compared values. Model
properties and document evidence are shown separately. PDF citations require
valid original passage or extracted table-cell coordinates. Evidence reports
are created on inspection and persist across restarts. Changing model bytes or
the document scope invalidates previous evidence snapshots; a rescan provides
the current link. A finding without anchored source evidence has no query link.
After an engine update, opening a still-current IFC finding regenerates its
report from current anchored evidence. It does not release the obsolete cached
body; changed models or missing evidence still withhold the old snapshot.

Omitted document IDs select project associations. Explicit `[]` selects nothing. Foreign IDs are rejected. Indexes physically contain only selected project documents, passages and layout units. Retrieval, subqueries, expansions, model context and fallback suggestions receive that scoped index. Returned citation/document IDs are checked again. Cache identity includes project, document and engine revisions. Scope changes withhold obsolete cached result bodies. Private artifacts are excluded from legacy global retrieval/files.

Collection membership is explicit. Users can deselect individual documents. Synthetic artifacts have owner projects and cannot be assigned elsewhere. Deleting an ordinary project removes its associations/history without deleting shared reference PDFs.

## Persistence and recovery

Ignored `state/projects.json` stores metadata, associations, dismissals and saved query IDs, using atomic replacement and a previous valid backup. History lives in `state/project-queries/PROJECT/QUERY.json`. Interrupted queries become retryable failures. Stable seeds `demo-mill-creek` and `demo-willow-creek` are restored without duplicates at startup. Tracked originals in `output/pdf` restore runtime copies in `state/demo-documents` at startup/reset. Regulatory PDFs remain in existing local directories. Run one project API at a time during normal use; JSON persistence is not a concurrent multi-server database.

Findings are prepared comparisons, clearly labeled. Exact excerpts must anchor in the original PDFs before they are exposed. No general automatic contradiction detector is claimed. The bridge brief explicitly adopts January 2022 BSDC v9; it does not claim that edition is the newest governing standard. PDF import is supported through `POST /v1/projects/:project/documents/import` with `{name, content}` where content is base64. Each PDF is limited to 12 MB and is indexed before a 201 response. Folder selection queues individual PDFs in the browser. Invalid or unreadable PDFs are rejected, and completed files survive a retry. Private files and manifests live under ignored `state/project-documents/PROJECT/`, outside frontend assets; ordinary project deletion removes them. Identical bytes in different projects receive distinct ownership IDs. No paid inference is required.

## Verification commands

From `backend`: `node --test tests/projects.test.mjs`; against private API 8810: `node --test tests/projects.integration.mjs`; against isolated preview storage: `$env:BASIS_FRONTEND_URL='http://127.0.0.1:8842/app'; node tests/projects.browser.mjs`. HTTP/browser suites create/delete test projects and reset demo state; avoid running them during presentation. Root checks: `npx tsc -b` and `npm run lint`.

Project descriptions default to an automatic local summary of selected collections and imported document topics/types. Editing a description stores a manual override; setting `description` to an empty string regenerates it. Description edits are allowed on protected examples and do not invalidate existing document-scoped query results. Reset restores original descriptions. `BASIS_STATE_DIR` can isolate development storage from the active demo.

`persistOnReset` is a boolean project field (POST/PATCH), defaulting to false for ordinary projects. Protected seeds always return true and reject attempts to set false with 403. This flag does not prevent explicit deletion of an ordinary project. All visible Reset demo controls call the workspace endpoint. Opted-in projects retain documents, history and bookmarks; built-in examples return to their initial state. Reset rejects concurrent imports with 409. Destructive reset tests must run on the isolated 8840/8842 runtime with `BASIS_STATE_DIR` pointing to `state/ui-preview`, never the presenter’s live data.
