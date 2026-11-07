# Construction Intelligence

An engineering document search workspace for finding, comparing, and summarizing requirements across construction documents, technical reports, building codes, and municipal regulations, with precise source citations.

Built for natHacks 2026 by team Streichholzschachtel.

## Current state

Frontend foundation only. The app intentionally displays a blank white page. Backend services, document processing, search, and product screens will be added later.

## Stack

- React and TypeScript
- Vite for development and production builds
- Oxlint for linting
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

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Type-check and create a production build in `dist/`. |
| `npm run lint` | Check source files with Oxlint. |
| `npm run preview` | Serve the production build locally after building. |

## Project layout

```text
src/
  App.tsx       Application root (currently empty)
  main.tsx      React entry point
  index.css     Global styles
index.html      HTML entry point and page metadata
vite.config.ts  Vite configuration
```

## Development notes

- Keep future mock data and service calls separate from UI components so a backend can be connected later.
- Do not commit credentials or private engineering documents. Environment files and the local `uploads/` directory are ignored.
- Commit `package-lock.json` when dependencies change. Use `npm ci` when installing an existing checkout.
- Run `npm run lint` and `npm run build` before opening a pull request.

Vite documentation: https://vite.dev/guide/
