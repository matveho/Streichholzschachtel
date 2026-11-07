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
