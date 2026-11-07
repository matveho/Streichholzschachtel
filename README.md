# Construction Intelligence

An engineering document search workspace for finding, comparing, and summarizing requirements across construction documents, technical reports, building codes, and municipal regulations, with precise source citations.

Built for natHacks 2026 by team Streichholzschachtel.

## Current state

A desktop-first engineering query workspace with local PDF documents, a prepared example query, and a consolidated result linked to source passages. There is no backend or live search. Unrecognized queries display an explicit frontend-only state.

### Workspace controls

- Hover or keyboard-focus a finding to trace its source passages across both PDFs. Click to keep that selection; Escape clears it.
- Hover or select an individual citation to reveal its specific passage. Citation tooltips include document, section, printed page, and PDF page.
- Switch between side-by-side documents and a centered, tabbed document view. Each document has independent page and zoom controls; the page field uses PDF page numbers.
- Drag the divider above the result to resize it, or focus the divider and use the arrow keys.
- Use New query to clear the example, or Ctrl/Cmd+K to focus the query field. Enter submits; Shift+Enter inserts a line break.
- Copy exports the consolidated result and its source references.

## Stack

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

- Keep future mock data and service calls separate from UI components so a backend can be connected later.
- Do not commit credentials or private engineering documents. Environment files and the local `uploads/` directory are ignored.
- Commit `package-lock.json` when dependencies change. Use `npm ci` when installing an existing checkout.
- Run `npm run lint` and `npm run build` before opening a pull request.

Vite documentation: https://vite.dev/guide/

## Example sources

Original EPCOR PDFs downloaded on November 6, 2026 and stored unchanged in `public/documents/`:

- [Volume 3-03: Design Guidelines, May 2025](https://www.epcor.com/content/dam/epcor/documents/supporting-documents/volume-3-03-design-guidelines%E2%80%8B%E2%80%8B.pdf). Example references use printed page 4, which is PDF page 10.
- [Volume 3-02: Stormwater Management and Design Manual, April 2025](https://www.epcor.com/content/dam/epcor/documents/supporting-documents/volume-3-02-stormwater-management-and-design-manual.pdf). Example references use printed/PDF pages 12 and 13.

These editions are linked from [EPCOR's guides and standards directory](https://www.epcor.com/ca/en/ab/edmonton/operations/service-connections/guides-checklists-forms.html) as effective August 1, 2025. Source documents remain the property of their publishers.

The 20 ha scenario is illustrative. Its findings are a prepared synthesis of these sources, not a hydraulic calculation or a project approval. The final-diameter limitation is an inference from the required calculation inputs. Highlight rectangles are verified PDF-point coordinates; future retrieval responses should supply document ID, PDF page, and passage coordinates in the same form.

## Browser verification

Start `npm run dev -- --host 127.0.0.1 --port 5173`, then run `npm run test:ui` in another terminal. Google Chrome must be installed. Checks cover PDF rendering, simultaneous source visibility, pin/clear, tabs, citation-driven page changes, zoom, resizing, new-query behavior, unsupported queries, mobile overflow, and uncaught browser errors. Screenshots are saved in ignored `test-results/`.
