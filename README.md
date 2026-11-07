# Basis

An engineering document search workspace for finding, comparing, and summarizing requirements across construction documents, technical reports, building codes, and municipal regulations, with precise source citations.

Built for natHacks 2026 by team Streichholzschachtel.

## Current state

A desktop-first engineering query workspace with local PDF documents, a prepared example query, and a consolidated result linked to source passages. There is no backend or live search. Unrecognized queries display an explicit frontend-only state.

## Frpmtemd Stack

- React and TypeScript
- Vite for development and production builds
- Oxlint for linting
- PDF.js for local PDF rendering and selectable text, Lucide for icons, locally bundled IBM Plex fonts
- Playwright for browser verification; Prettier for formatting
- npm with a committed lockfile for reproducible installs

## Getting started

Use Node.js 24 LTS and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite (usually http://localhost:5173). Changes in source files update the browser automatically.

No environment variables or backend connection are required.

## Backend development

The backend can be built independently in [`backend/`](backend/README.md). Read the [backend handoff and recommendations](docs/backend-handoff.md) for suggested capabilities, source/citation considerations, and deployment boundaries. The backend engineer owns the stack, API, and data model; the frontend will adapt to their implementation.

The frontend remains at the repository root. `vercel.json` pins its Vite build to `npm run build` with `dist/` output. Backend dependencies, runtime, and deployment should stay independent of that build. No backend service or API connection has been installed.

## Commands

| Command                | Purpose                                                         |
| ---------------------- | --------------------------------------------------------------- |
| `npm run dev`          | Start the development server.                                   |
| `npm run build`        | Type-check and create a production build in `dist/`.            |
| `npm run lint`         | Check source files with Oxlint.                                 |
| `npm run preview`      | Serve the production build locally after building.              |
| `npm run test:ui`      | Verify the running app at port 5173 in installed Google Chrome. |
| `npm run format`       | Format source and configuration files.                          |
| `npm run format:check` | Check formatting without changing files.                        |

## Project layout

```text
src/
  App.tsx       Query, layout, result selection, and resizing
  PdfPane.tsx   PDF rendering, navigation, zoom, and source overlays
  data.ts       Prepared query, findings, source metadata, and PDF rectangles
  main.tsx      React entry point
  index.css     Global styles
index.html      HTML entry point and page metadata
vite.config.ts  Vite configuration
public/documents/ Original published PDFs used by the example
scripts/verify-workspace.mjs Browser interaction checks and screenshots
```

## Development notes

Vite documentation: https://vite.dev/guide/

## Example sources

Original EPCOR PDFs downloaded on November 6, 2026 and stored unchanged in `public/documents/`:

- [Volume 3-03: Design Guidelines, May 2025](https://www.epcor.com/content/dam/epcor/documents/supporting-documents/volume-3-03-design-guidelines%E2%80%8B%E2%80%8B.pdf). Example references use printed page 4, which is PDF page 10.
- [Volume 3-02: Stormwater Management and Design Manual, April 2025](https://www.epcor.com/content/dam/epcor/documents/supporting-documents/volume-3-02-stormwater-management-and-design-manual.pdf). Example references use printed/PDF pages 12 and 13.

These editions are linked from [EPCOR's guides and standards directory](https://www.epcor.com/ca/en/ab/edmonton/operations/service-connections/guides-checklists-forms.html) as effective August 1, 2025. Source documents remain the property of their publishers.

## Query history and source comparison

The root URL opens the original storm-sewer workspace. The Home icon opens `#home`, with filterable previous queries. The five prepared cases have separate prompts, reports, source selections, and citation sets. Submitted queries persist in this browser's local storage; unknown queries retain an explicit unconnected-search state when reopened. History does not imply that arbitrary queries have been processed.

The corner-lot LID example uses three different local PDFs. Document tabs scroll when needed. Compare mode keeps two readable panes and provides a selector for the companion source; clicking a tab replaces the focused pane when necessary. Citations automatically reveal their documents, including sources not yet opened. Each document retains its viewer state while switching within a query; PDFs and minimap thumbnails load on demand and are cached.

Additional original sources:

- [Corner Lot Infill LID Guidelines, May 2024](https://www.edmonton.ca/sites/default/files/public-files/LID-Guidelines-for-Corner-Lot-Infill-Developments.pdf), PDF/printed pages 2 and 18.
- [Drainage Customer Connection Guide, May 2023](https://www.epcor.com/content/dam/epcor/documents/supporting-documents/water-drainage_customer-connection-guide.pdf), PDF page 6 / printed page 5.
- [LID Construction, Inspection & Maintenance Guide, May 2016](https://www.edmonton.ca/sites/default/files/public-files/assets/LID%20CIM%20Guide.pdf), PDF pages 24–25 / printed pages 16–17.

The second report identifies the different editions and scopes explicitly. Its recommendation to confirm the servicing arrangement is a synthesis of the guides, not a determination of project approval. The PDFs are stored unchanged under `public/documents/`.

Run `npm run test:ui` against the development server on port 5173 with Google Chrome installed. It checks both the original workspace and history, persistence, source isolation, three-source navigation, citation highlighting, and mobile overflow.

## Team demo examples

Three decision-focused examples cover shallow sewer cover, drainage capacity after expansion, and LID infiltration acceptance. Open Home to access all five examples. See [DEMO.md](DEMO.md) for a presentation sequence, the potential practical impact, and a proposed engineer validation approach. Project figures are illustrative inputs; the reports distinguish direct requirements, calculated comparisons, scope differences, and decisions needing confirmation.

Additional source passages are in Volume 3-03 printed page 5; Volume 3-02 printed pages 12–13 and 97; the connection guide printed pages 3–4; and the corner-lot guide printed page 30. The existing local PDFs are reused unchanged. `npm run test:ui` includes all example citation paths and numerical conclusions.
