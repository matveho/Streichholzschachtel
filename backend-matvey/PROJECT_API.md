# Project workspace integration

The frontend uses the keyless `/local-api` gateway. The underlying API requires the device key. This is a single-device prototype with logical project isolation, not production multi-tenant authentication. Processing is local; HTTPS transports requests and documents to this device.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | `/v1/reference-collections` | Explicit collections, jurisdictions, descriptions, document IDs and metadata |
| GET / POST | `/v1/projects` | List / create with `name`, `client`, `location`, `description`, `collectionIds`, optional `documentIds` |
| GET | `/v1/projects/:project` | Project, documents, query history, issues and selected collections |
| PATCH / DELETE | `/v1/projects/:project` | Update / delete ordinary projects; protected demos return 403 |
| POST | `/v1/projects/:project/reset` | Restore demo associations, runtime PDFs, issue states and initial history |
| PATCH | `/v1/projects/:project/issues/:issue` | Persist `{status:"dismissed"}` or `"open"` |
| GET / POST | `/v1/projects/:project/queries` | History / submit `{question,documentIds?,sourceOnly?,id?}`; pollable job |
| GET / PATCH / DELETE | `/v1/projects/:project/queries/:query` | Read / bookmark with `{saved:true}` / cancel |
| GET | `/v1/projects/:project/documents/:document/file` | Original PDF, association/ownership enforced, byte ranges supported |

Citation geometry and the existing PDF renderer are reused. `src/projects.ts` provides frontend contracts; `src/backend.ts` supports scoped submission and reopening jobs. Routes are `#projects`, `#project/ID`, `#project/ID/new`, `#project/ID/query/QUERY`, `#project/ID/document/DOCUMENT`.

## Isolation

Omitted document IDs select project associations. Explicit `[]` selects nothing. Foreign IDs are rejected. Indexes physically contain only selected project documents, passages and layout units. Retrieval, subqueries, expansions, model context and fallback suggestions receive that scoped index. Returned citation/document IDs are checked again. Cache identity includes project, document and engine revisions. Scope changes withhold obsolete cached result bodies. Private artifacts are excluded from legacy global retrieval/files.

Collection membership is explicit. Users can deselect individual documents. Synthetic artifacts have owner projects and cannot be assigned elsewhere. Deleting an ordinary project removes its associations/history without deleting shared reference PDFs.

## Persistence and recovery

Ignored `state/projects.json` stores metadata, associations, dismissals and saved query IDs, using atomic replacement and a previous valid backup. History lives in `state/project-queries/PROJECT/QUERY.json`. Interrupted queries become retryable failures. Stable seeds `demo-mill-creek` and `demo-willow-creek` are restored without duplicates at startup. Tracked originals in `output/pdf` restore runtime copies in `state/demo-documents` at startup/reset. Regulatory PDFs remain in existing local directories. Run one project API at a time during normal use; JSON persistence is not a concurrent multi-server database.

Findings are prepared comparisons, clearly labeled. Exact excerpts must anchor in the original PDFs before they are exposed. No general automatic contradiction detector is claimed. The bridge brief explicitly adopts January 2022 BSDC v9; it does not claim that edition is the newest governing standard. General uploads are deferred. No paid inference is required.

## Verification commands

From `backend-matvey`: `node --test tests/projects.test.mjs`; against private API 8810: `node --test tests/projects.integration.mjs`; against the compiled gateway: `$env:BASIS_FRONTEND_URL='http://127.0.0.1:8812/app'; node tests/projects.browser.mjs`. HTTP/browser suites create/delete test projects and reset demo state; avoid running them during presentation. Root checks: `npx tsc -b` and `npm run lint`.
