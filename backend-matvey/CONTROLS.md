# One-click backend controls

Double-click **Start Basis.cmd** in the repository root. Node.js 24 or newer must be installed. The window starts Basis if it is stopped, then presents controls. Closing the window leaves the services running. Choose **3** to stop the backend and gateway.

| Control | Action                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| 1       | Start; keep an already running Basis API intact                                                                    |
| 2       | Build changed frontend source, restart the API, and index newly added documents                                    |
| 3       | Stop the verified Basis API and gateway; leave the user's Ollama service alone                                     |
| 4       | Show API, indexing, failures, gateway and profile status                                                           |
| 5       | Open the local interface, already connected without a key                                                          |
| 6       | Check drive space, extractor, OCR, cache, errors and the public Vercel connection                                  |
| 7       | Open the dedicated controller log folder                                                                           |
| 8       | Rebuild the local frontend without stopping the running API                                                        |
| 9       | Switch between fast offline source search and optional local Ollama review, then restart                           |
| D       | Repair root/backend dependencies from their lockfiles                                                              |
| H       | Reuse an existing gateway tunnel or start an HTTPS tunnel                                                          |
| P       | Verify a newly created tunnel, update the existing Vercel API rewrite and deploy using an authenticated Vercel CLI |
| Q       | Close the controls while leaving the backend running                                                               |

Offline source search is the default for a newly created control configuration. It requires no model download or hosted inference. The local review profile uses the existing loopback Ollama model; if unavailable, the controller reports that it is starting offline source search. It never starts or stops the user's model service on port 11434 and never downloads weights automatically.

The current local interface opens at `http://127.0.0.1:8789/app/#home`. The gateway handles both local `/local-api` requests and Vercel's rewritten requests, keeping the connection key internal. The API listens on 8787. A normal launch keeps existing healthy services intact. Choose **2** to install the current API and gateway; the tunnel hostname is retained. Until an old gateway is upgraded, **5** opens the existing deployed interface instead.

While the control window is open, a watchdog checks the managed API and attempts recovery after three missed checks, capped at three recoveries in ten minutes. Choosing Stop disables recovery. The frontend builds into a separate staging folder and is promoted only after success, preserving the previous bundle. The backend dependency graph is checked before a running API is replaced. Port ownership is checked before stopping a process; unrelated applications are rejected.

New PDFs are picked up with **2**; valid OCR/extraction caches are retained. Cache writes are atomic, and unreadable partial caches are rebuilt, so an interrupted indexing run does not permanently poison the next start. The status screen distinguishes indexing from ready. A service with indexing failures needs inspection even if some documents are available. Logs and process records are local under ignored `backend-matvey/state/`. No connection key is printed in the menu or diagnostic output.

The public Vercel connection also requires the host computer and HTTPS tunnel to remain online. A recreated quick tunnel has a different hostname. **H** reports the address; **P** updates the site when Vercel CLI is installed and signed in. If deployment fails, the local Vercel configuration is restored and the local interface remains available. These are explicit controls, not a claim of reboot-proof public hosting.

For scripted troubleshooting, run `node control.mjs --status`, `--diagnose`, `--start`, `--restart`, `--reindex`, `--stop`, `--build`, `--https` or `--publish` from this folder. Tests can set `BASIS_CONTROL_API_PORT` and `BASIS_CONTROL_GATEWAY_PORT` to spare ports. `BASIS_CONTROL_SKIP_BUILD=1` is for isolated lifecycle tests only.

## Executed verification

- Four focused controller/cache tests pass: reserved ports, process ownership, managed build locations and repair of an interrupted cache.
- `node tests/control.integration.mjs` passed real startup, readiness, forced API termination, automatic recovery, authenticated original-PDF byte ranges through the keyless gateway, explicit stop and clean exit on isolated ports 8820/8822.
- A real immutable frontend build passed on the authorized E-drive cache. The compiled interface on 8802 passed the browser flow from unsupported query through alternative selection, original PDF highlighting, reload and history.
- Root lint passes. The public gateway was left untouched; an additional live-upgrade test was rejected by automatic approval review because it could disrupt the running demo.
