# Vercel → Ubuntu integration (not approved for cutover)

Current frontend: https://streichholzschachtel.vercel.app. The repository forwards /local-api/:path* to the existing Windows gateway through composed-bbs-uses-favorites.trycloudflare.com. Do not change that production destination during validation.

## Verified so far

2026-11-08: public /local-api/health returned HTTP 200 and ready=true. Vercel project discovery identified streichholzschachtel (prj_mJUvmSa3lsucD9PxCb1es9wgBXir), team team_EhdSoWpO4O3snM37cWGVDSdG. Detailed account inspection returned HTTP 403, requiring team-access consent. No project settings were changed.

Run `BASIS_BROWSER_SUITES=vercel-boundary scripts/linux/test-browser`. It creates disposable Ubuntu state and a loopback API/gateway, loads real HTML/assets/PDF.js from the production Vercel frontend, and intercepts only its /local-api requests in Playwright to direct them to Ubuntu. The first run passed with 25 routed requests: all four projects, associated PDFs and ranges, prepared findings, original highlights/text layers and navigation. Evidence: backend/state/verification/run-browser-W6lZdkRh/vercel-boundary.log.

This proves deployed-frontend compatibility with Ubuntu through browser routing. It does not prove Vercel CDN external rewrites, tunnel TLS, upstream authentication, upload limits, latency or availability. No workstation traffic was exposed externally.

Gateway defect fixed: model-description strings were rewritten as though they were model download URLs. The gateway now rewrites only document file/model API paths and strips their token query strings. Regression checks cover original description, PDF/IFC URLs and interrupted streaming.

## Connection strategy

Keep same-origin /local-api in the browser. A candidate deployment must forward it over HTTPS to an approved stable origin. Avoid shipping the backend token in Vite environment variables, frontend code, URLs or vercel.json. Preserve streamed range responses and no-store behavior. Do not move 12 MB base64 PDF imports through a new serverless proxy without verifying its request-size limit.

The existing gateway is a keyless single-device demonstration gateway with write/delete/reset capabilities. A public origin needs an identity-aware access layer covering both frontend and API, plus origin authentication preventing direct access around that layer. A random tunnel hostname and CORS do not provide authentication. A stable named outbound tunnel is an option only after institutional permission, protected ingress and access controls have been established. No quick tunnel will be opened by this work.

The workstation is suitable for local integration testing. Reliable public hosting is not established: user lingering is disabled; logout lifetime, institutional workload/network permission, storage retention and administrative quotas are unconfirmed. If those cannot be guaranteed, put the persistent backend on an approved always-on host and retain this machine for local development/inference. Do not change university-wide settings.

## Preview gate, cutover and rollback

1. Obtain team-account access and institution-approved hosting conditions. Record current production deployment ID, immutable URL, rewrite target and state backup before changes.
2. Use disposable backend state for preview. Add authenticated HTTPS ingress at the approved origin and validate unauthenticated rejection/direct-origin bypass rejection. Verify TLS, streaming, range/416 handling, large and invalid uploads, project isolation and timeouts through the real Vercel preview.
3. Deploy a protected preview in the verified team/project, without promoting or assigning the production alias. A public preview connected to this university machine requires authorization even though production is unchanged.
4. Run project CRUD, collection/empty selections, folder/PDF imports, query history, issue dismissal, original PDF highlights/ranges, IFC downloads/register search and service restart persistence through that preview. Verify no credentials are visible in responses, browser bundles or logs. Confirm no stale caching of private APIs.
5. Present the exact deployment, approved origin, test evidence, limitations and rollback deployment for final cutover approval. Do not promote before approval.
6. At an approved cutover, pause writes on Windows, back up and securely transfer its actual state/imports/history, validate restored ownership and counts, then promote the verified deployment. Do not assume this workstation's seeded state includes current Windows user data.
7. Rollback: pause writes, restore the recorded production deployment/alias and original rewrite target. Preserve Ubuntu post-cutover writes for reconciliation before resuming Windows writes. Never overwrite either state store blindly. Confirm health, all projects, query, PDF range/highlight and import after rollback.

Source for external rewrites and rewrite caching: https://vercel.com/docs/routing/rewrites. Use current account/documentation evidence before choosing any serverless request proxy or changing platform routing.

## Ownership and outage update

The user has shut down the previous backend and assigned full backend ownership to this Ubuntu agent. Public /local-api/health subsequently returned HTTP 530; Ubuntu localhost health remained READY with 57 documents and zero failures. The earlier preservation requirement now means restoring a verified replacement rather than assuming Windows remains available. This does not grant institutional permission to expose the university workstation, nor supply the old machine's private state. Do not point production at a localhost URL or claim that browser interception restores public service.

Extended deployed-UI check: `BASIS_VERCEL_UI=1 BASIS_BROWSER_SUITES='projects project-editor' scripts/linux/test-browser` passed both suites using real Vercel HTML/JS and disposable Ubuntu state. Covers project editing/deletion, collection selection, explicit empty scopes, saved history, dismissals, native folder/PDF imports, indexing, and document navigation. Source highlight verification clicks the actual citation control; it does not assume automatic source selection when entering a report. Evidence: backend/state/verification/run-browser-oCczev3E/. All test pages, including cleanup pages, use context-level API routing and block service workers; requests never reach the production backend.

Optional origin gate implemented: set BASIS_GATEWAY_INGRESS_KEY on the candidate gateway and have a trusted authenticated proxy inject X-basis-Ingress-Key. Missing or wrong keys return 401/no-store before routing. Tests cover rejection, valid forwarding with the backend key, model/PDF URL rewriting and interrupted streams. Keep this separate from the backend device token. Generate a strong value in a private environment file; never place it in browser code or vercel.json. This gate provides machine authentication only; a public frontend still needs user authorization. It is not enabled on the localhost demonstration service.

## Authorized demo cutover — 2026-11-08

The user confirmed institutional permission and instructed proceeding, after explicitly waiving additional user authentication for this demo. A pinned/checksummed cloudflared 2026.10.7 now runs as the user service basis-tunnel, exposing only the existing gateway through outbound HTTPS. No system network configuration or firewall was changed.

Active origin: https://deck-mall-route-sender.trycloudflare.com.
Public frontend: https://streichholzschachtel.vercel.app.

The existing frontend deployment dpl_J7dBi6vJnRL2mAds73MdFVCPrpUS was preserved (source commit 11232d391bdbaac9c2a6a90f06a6d9fc58de24d0). Vercel project-level routing rule 4adcd324-1e9b-4f7f-9dfb-42a94aac30fc now rewrites ^/local-api(?:/(.*))?$ to the new origin /$1. This rule takes precedence over the deployment's older vercel.json rewrite. The repository vercel.json has also been updated for future deployments; no frontend rebuild was needed for this cutover.

First promoted conditional route version ee867141-c85f-4c86-b507-a5b698aab18c required x-basis-preview: ubuntu-demo. After real-edge tests passed, route version 0d381abd-6b0e-47a9-baa1-da1f8623b7ff removed that condition. Health returned HTTP 200/READY for normal public requests.

Real-network validation, without browser interception: the presentation suite checked all four protected projects, every associated PDF and HTTP 206 range response, anchored prepared findings and browser PDF highlights/navigation. Separate temporary projects verified CRUD, private PDF import, citation-bearing search, explicit empty scope and foreign-project isolation via Vercel → Cloudflare → Ubuntu. Temporary projects were deleted. Test logs: /tmp/basis-real-edge-preview.log, /tmp/basis-edge-lifecycle.log and /tmp/basis-production-ubuntu-smoke.log.

Reproduce preview verification: BASIS_EDGE_PREVIEW=1 BASIS_FRONTEND_URL=https://streichholzschachtel.vercel.app node backend/tests/presentation.smoke.mjs (only while conditional preview routing is installed). Normal production verification: BASIS_FRONTEND_URL=https://streichholzschachtel.vercel.app node backend/tests/presentation.smoke.mjs.

Operations: scripts/linux/install-tunnel installs the pinned binary and user unit. Use systemctl --user start|stop|status basis-tunnel and journalctl --user -u basis-tunnel. Backend/gateway management remains scripts/linux/basis. Keep the login session active during the demo. This is a temporary Quick Tunnel: a tunnel restart can change its hostname. If that happens, discover the new URL, verify its /health, stage the existing Vercel route ID with the new destination, verify with a conditional header, then promote. Updating vercel.json alone does not override the active project-level rule.

Rollback: restoring route version ee867141-c85f-4c86-b507-a5b698aab18c reinstates preview-only Ubuntu access and sends normal requests to the old deployment's destination. That old backend is down, so it is not a working availability fallback. For a working rollback, first restore an approved backend/backup, validate it, then stage/promote this same route to its reachable HTTPS origin. Preserve Ubuntu writes before moving state. To remove external access immediately, stop basis-tunnel. No guarantee of uptime across logout/reboot or Quick Tunnel URL stability is made. The localhost data consists of the seeded corpus and local state; any additional Windows state still needs the home-agent backup handoff.
