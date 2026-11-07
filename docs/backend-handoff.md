# Backend handoff

## Direction

Build the backend that best serves engineering document search. The backend engineer should choose the architecture and interface; we will adjust the frontend around that work. Nothing in the current TypeScript fixture types, citation numbering, report layout, routes, or local-storage history is a required server contract.

Recommended starting point: one independently runnable service in `backend/`, with a way to prepare a document collection and a browser-accessible interface for querying it and opening the evidence. A small service and an offline indexing command can be enough for the first real demonstration. Split into workers or additional services only if the chosen processing workflow needs it.

The language, framework, database, search/index technology, model or provider if used, deployment platform, and synchronous versus asynchronous execution are open decisions. There is no need to choose them to match React or the existing demo data.

## What the product needs to accomplish

An engineer asks a project-specific question across reports, specifications, and applicable standards. The useful output is a readable finding that can be checked against the original documents. It should help identify requirements, differences in applicability, missing inputs, and issues needing review. It should not treat a newer publication date alone as proof that one requirement overrides another.

Project location/jurisdiction belongs in project or collection context, rather than requiring it in every question. Project scope and document selection should be available to the search process as context too. How that context is stored or passed is up to the backend engineer.

## Recommended capabilities

These are suggested priorities, not a mandatory backlog. A smaller reliable end-to-end slice is more useful than implementing every row superficially.

| Priority             | Capability                                                      | Useful behavior                                                                                                                                                                                                                                   |
| -------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First working slice  | Prepare a known document collection                             | Import PDFs from a local directory or a repeatable command. Track which documents succeeded or failed. A user-facing upload system is unnecessary for the current demo.                                                                           |
| First working slice  | Extract and retrieve evidence                                   | Preserve a connection between extracted text and the original PDF page. Retrieve relevant passages across several documents, not just one file. Lexical, semantic, hybrid, or another approach is the engineer's choice.                          |
| First working slice  | Answer a question with traceable support                        | Return readable findings and the supporting passages. Clearly represent insufficient evidence instead of filling gaps with unsupported requirements. A search-first response with excerpts is a useful milestone before more elaborate synthesis. |
| First working slice  | Identify and serve sources                                      | Provide document identity, useful metadata, and a way for the browser to fetch the exact PDF used by the result. Include edition/version information when available.                                                                              |
| Next useful addition | Preserve query results                                          | Reopen an earlier question with its result and evidence. Saving a result snapshot and the document versions used avoids silently changing the evidence after re-indexing. Server history can replace the current browser-only history.            |
| Next useful addition | Apply project context                                           | Use jurisdiction, scope, selected collection, and relevant editions. Make scope assumptions available in the response when they affect the finding.                                                                                               |
| Next useful addition | Compare requirements and expose gaps                            | Return both sides of a potential conflict, with citations and applicability details. Distinguish a genuine contradiction from different asset types, project conditions, or editions. Identify missing project inputs.                            |
| When needed          | Processing state, errors, and health                            | Make it possible to distinguish an empty result, unsupported file, incomplete index, temporary failure, and unavailable service. If work takes time, expose progress through whichever job/polling/streaming design fits.                         |
| Later, if worthwhile | OCR, tables, richer anchors, cancellation, exports, permissions | Add these in the order supported by actual documents and users. Accounts, uploads, a settings UI, streaming, and a particular vector database are not prerequisites for the first integration.                                                    |

## Practical implementation recommendations

- Keep document preparation separate from answering a question, so the same PDFs are not reparsed for each request. A repeatable local import/index command is a simple starting point.
- Keep original documents and their metadata alongside the extracted/indexed content. A stable document ID plus a content hash or version is useful for detecting replacements and retaining citation accuracy.
- Treat page mapping as part of extraction, including any OCR or table extraction. Preserve where the evidence came from before normalizing or chunking it.
- Keep retrieval and response construction separable enough to inspect why a passage was returned. Source-based checks are more informative than whether an answer merely sounds plausible.
- A single app with one metadata store, file storage, and the simplest search mechanism that works is a reasonable start. There is no prescribed database or requirement for separate vector storage, queues, or microservices.
- Keep credentials on the server and generated documents/indexes outside the frontend's `public/` directory. The five PDFs already under `public/documents/` are intentionally public demo assets and can be reused for development without moving them.

## Information that will make integration easy

Choose the actual field names, endpoints, payloads, and transport. When sharing an initial implementation, document the following concepts in its own terms:

| Concept              | What the frontend needs to understand                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Question and context | How to submit a question and identify the relevant project/collection or filters.                                                                                                                    |
| Result               | How to obtain the answer or passages, whether immediately or through a job/result identifier. Prose, Markdown with citation anchors, structured sections, or another documented format can all work. |
| Sources              | How to associate evidence with a stable document identity and its original file. The frontend can load documents and metadata separately or receive them with a result.                              |
| Anchors              | How to locate a supporting passage: physical PDF page, excerpt, text offsets with a defined text source, and/or regions. Document whatever locator the extraction pipeline can provide.              |
| State and failure    | How to recognize successful completion, no supported answer, incomplete processing, and errors; whether retry is appropriate.                                                                        |
| History              | How to retrieve earlier results, if server persistence is implemented. Backend-generated IDs and its chosen history model are fine.                                                                  |

There is no need to segment the backend answer into the current frontend's `sentences` array or return fields named `caseId`, `rect`, or `initialReferences`. Likewise, citation IDs do not need to be global integers. A real response example from the chosen backend is a better integration reference than copying the fixture schema.

### Citation precision

Page plus supporting excerpt is an acceptable first milestone. Accurate region highlights are valuable when the extractor supports them; the backend should not need to recreate hand-authored frontend rectangles to start integration.

For any page locator, state whether it is zero- or one-based and distinguish the physical PDF page from the printed page label. For regions, document the origin, units, rectangle representation, page dimensions, and handling of rotation/cropping. Normalized boxes, PDF coordinates, or a documented alternative are all workable. Multiple regions on a page and evidence spanning multiple pages should be representable if encountered.

Text offsets are useful only when we know which page/text representation they refer to. An excerpt and page are helpful fallbacks. If no precise anchor is available, represent that explicitly so the frontend can show the page or excerpt without drawing a misleading highlight.

The current viewer assumes letter-sized pages and top-left PDF-point rectangles for its prepared examples. That is a frontend limitation to fix during integration, not a reason to restrict backend extraction or the supported source documents.

### Browser access and deployment boundary

For the initial implementation, running and deploying the backend independently is the least coupled route. Agree on a development URL and a deployed HTTPS URL when the service is ready. A future frontend adapter can read an agreed public service URL; there is no backend URL setting or network integration wired into this frontend yet.

If the browser calls a different origin, configure CORS for the frontend's localhost and deployed origins, including preview origins when needed. Document the authentication approach if one is added. PDF responses also need to be browser-readable; range support and the relevant exposed response headers help PDF.js work efficiently. Full-file access is sufficient for an initial demo. Signed URLs or authenticated file endpoints are also fine if their lifetime/access behavior is documented.

Do not put private API keys in `VITE_*` variables: those values are available to browser code. A same-origin proxy or separately deployed backend are both options later; no API rewrites or proxy routes have been installed now.

## Keep the existing Vercel frontend deploy working

The frontend remains at the repository root. `vercel.json` explicitly selects Vite, `npm run build`, and `dist` as the static output. The root package and lockfile still belong only to the frontend, and its TypeScript build includes `src/` plus `vite.config.ts`.

| Area                    | Recommended boundary while backend work begins                                                                                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend implementation  | Put its code, dependency manifest/lockfile, tests, migrations, and service configuration inside `backend/`. Use its own install/run/test commands.                                                                                                                             |
| Frontend build          | Keep root npm install/build independent of backend tools, runtime, credentials, database availability, and indexing. Avoid adding backend startup, installs, or indexing to root install/build lifecycle hooks.                                                                |
| Backend hosting         | Choose its own deployment process. If using Vercel too, a separate project rooted at `backend/` can isolate its configuration. Adding root `api/` handlers would introduce functions into the existing frontend project, so treat that as a deliberate later hosting decision. |
| Assets and source code  | Keep server code and generated/private data outside `src/` and `public/`. Do not import server implementations into frontend modules. Vite copies `public/` assets into `dist/`.                                                                                               |
| Tooling                 | Root Oxlint and Prettier exclude `backend/`. Configure backend linting/formatting for its chosen language. Its local environments, caches, and runtime data have their own ignore rules.                                                                                       |
| Vercel project settings | The existing frontend project's Root Directory should remain the repository root. This setting is managed in Vercel, not set by this preparation. Repository build configuration does not prove the dashboard configuration.                                                   |

No root workspace-manager migration, recursive install, backend dependency, API route, rewrite, or backend deployment is required to collaborate in this repo. If the backend engineer later wants a different arrangement, coordinate that change with the frontend deployment rather than accommodating the current mock schema.

The latest pushed commit had a successful Vercel GitHub status when this preparation began. This preparation does not change Vercel dashboard settings or publish a deployment; the next preview deployment remains the place to verify Vercel-specific behavior.

## What the frontend currently does

| File                                                       | Current role; replace or adapt during integration                                                                                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data.ts`, `src/additionalExamples.ts`                 | Five prepared questions, hardcoded document metadata, reports, and citation rectangles. These are fixtures, not server models.                                    |
| `src/App.tsx`                                              | Recognizes the prepared questions and changes viewer state. Its simulated search delay and demo matching can be replaced by a client adapter to the real service. |
| `src/QueryReport.tsx`                                      | Renders prose and maps sentence/citation selection to sources. Can be reshaped around the backend's answer representation.                                        |
| `src/PdfPane.tsx`, `src/DocumentMinimap.tsx`, `src/pdf.ts` | Fetch PDFs and navigate/highlight evidence. Need runtime document records and the actual extraction coordinate convention.                                        |
| `src/history.ts`, `src/QueryHome.tsx`                      | Browser-only history seeded with the demos. Can adopt server-owned query IDs, records, and snapshots.                                                             |

A future frontend client module can translate the backend response into display state where useful. The backend should not import from `src/` or depend on the fixture-only `DocId` union. The UI will accommodate actual result lengths, document counts, processing behavior, and metadata.

## Suggested first handoff

Deliver one repeatable end-to-end example: prepare the supplied PDF collection, ask a real question across multiple documents, retrieve a grounded finding, and open its supporting PDF pages. Include one no-evidence or missing-input case. Any document counts or latency targets can be set after measuring the chosen approach.

For integration, the most useful handoff is:

1. Install/start instructions and the chosen environment variable names, with a non-secret example file if needed.
2. The development/deployed service URL and any browser access/authentication requirements.
3. A real request and response, plus the PDF retrieval mechanism and citation/page conventions. An OpenAPI file is helpful if the chosen stack produces one, but is not required.
4. The chosen processing/error behavior and how persistent IDs/results are reopened, if supported.
5. Known gaps and a few repeatable questions with expected supporting passages.

The examples in [DEMO.md](../DEMO.md) are useful evaluation cases: catch a cover discrepancy before excavation, detect a capacity gap after a layout expands, and identify missing LID performance evidence. Use them to check evidence quality and practical usefulness rather than forcing identical prose or numbers into every answer. Cost/time savings are potential benefits to validate with engineers, not established outcomes of the current frontend.

## References for deployment behavior

- [Vercel static project configuration](https://vercel.com/docs/project-configuration/vercel-json): framework/build/output overrides and automatic root `api/` function discovery.
- [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build): project Root Directory, install/build settings, and static output serving.

These links explain the deployment boundary; they are not a requirement to host the backend on Vercel.
