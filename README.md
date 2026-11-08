# Basis

A project-based engineering document workspace with local processing, scoped research and original-source verification. Built for natHacks 2026 by team Streichholzschachtel.

## Run

Install Node.js 24 or newer, then double-click **Start Basis.cmd**. It starts the local backend and gateway and provides restart/reindex, status, troubleshooting, logs, dependency repair and HTTPS controls. Choose **5** to open the compiled interface without entering a connection key. Keep the controls open for crash recovery; closing the window leaves services running.

Choose **T** for a read-only presentation check of both projects, all associated PDFs and rendered source citations. Automatic recovery covers both API and gateway failures; a gateway-only recovery keeps the healthy API running.

On this presentation device the project API uses **8810**, and the local interface is **http://127.0.0.1:8812/app/#projects**. A fresh checkout defaults to API 8787 / gateway 8789; local `.env` overrides are ignored by Git. Choose **D** to install missing dependencies and **8** to build the interface. See [backend controls](backend-matvey/CONTROLS.md).

The deployed frontend is https://streichholzschachtel.vercel.app. Its `/local-api` rewrite reaches the device through HTTPS. Public access requires the device and tunnel online; the local interface is the presentation fallback. Backend state, private project PDFs and model assets are excluded from Vercel uploads.

## Working product

- Project overview, creation, collection selection and individual document selection.
- Protected permanent Mill Creek drainage and Willow Creek bridge demonstration projects.
- Dashboard documents grouped by role, metadata, filtering and original PDF navigation.
- Project-specific queries/history, saved findings, side-by-side PDFs, exact citations, highlights and minimap markers.
- Two evidence-anchored prepared potential issues per demonstration project, with inspect, dismiss, restore and reset.
- Backend-enforced project scope through retrieval, expansions, model context, citations, caches and history. Empty selections stay empty.
- Ordinary project deletion preserves shared reference PDFs. Startup restores missing demo projects and disposable demo PDF copies.

Prepared comparisons are labeled, grounded in actual standards and clearly distinguished from live queries. Synthetic client/design/calculation PDFs are labeled demonstration documents and not for construction. Findings require engineering review. General uploads and general automatic discrepancy detection are deferred. This shared-device prototype does not provide production multi-tenant authentication.

## Development and integration

React, TypeScript and Vite provide the frontend. PDF.js renders original files; local fonts and Lucide provide the interface assets. The local Node backend in `backend-matvey` uses indexed PDF evidence and JSON persistence. Offline source lookup is the launcher default; optional model review is local. No hosted inference is required.

For frontend development: `npm ci`, then `npm run dev`. Set `BASIS_DEV_BACKEND_URL` to the local gateway if using nondefault ports. The independent `backend/` directory remains available for the other backend implementation.

- [API contract and persistence](backend-matvey/PROJECT_API.md)
- [Two-minute presentation and recovery](backend-matvey/DEMO.md)
- [Original backend handoff](docs/backend-handoff.md)

## Verification

Root: `npx tsc -b`, `npm run lint`, `npm run build`.

From `backend-matvey`:

- `node --test tests/*.test.mjs` — backend unit/retrieval/project tests.
- `node --test tests/projects.integration.mjs` — actual API workflow on isolated 8810.
- `node tests/projects.restart.mjs` — restarts isolated 8810/8812 and checks recovery/persistence.
- `node tests/projects.browser.mjs` — project browser workflow; accepts `BASIS_FRONTEND_URL` for compiled or deployed frontend.
- `node tests/control.integration.mjs` — separate launcher lifecycle/crash-recovery test on 8820/8822.

Integration/browser suites modify and reset demonstration state; run them outside a presentation. Earlier `npm run test:ui` scripts target the legacy query screen and are retained as legacy checks, not the project-workspace acceptance suite.

Original reference PDFs retain their issuing authority and publication metadata. Reference Collections describe the supplied editions and do not establish legal applicability or guarantee the latest published edition.
