# Verification — version-aware extractive engine, 7 November 2026 (later)

Run on a machine without Ollama, Tesseract or an Anthropic key, so only the offline engine was exercised.

- `npm test`: 47 tests, 45 pass, 2 skipped (the two Infill LID checks need Tesseract OCR; its scanned pages are withheld without it). Includes the 34 demo questions, version-status checks, footnote-superscript extraction and the Claude output validator.
- `npm run demo:api`: 34/34 demo questions pass through the authenticated job API with valid page regions; PDF byte-range returns 206 `%PDF`.
- `node --test tests/api.integration.mjs`: 4/4 pass against a running server.
- Not verified: the Claude layer against the live API (no key on this machine — only its validation logic is unit-tested), the browser checks, `tests/quality.mjs` (written for the Ollama pipeline), and Tesseract OCR.
- The demo set guided tuning, so its pass rate overstates general accuracy. Spot checks on unseen paraphrases were mostly correct (RM runoff, crossing clearance, CB-lead slope, freeboard, PHD pressure, peaking-factor formula); LID checklist-table questions remained weak.
- The water-main question is answered from Vol. 4 Water (December 2024) Table 1.2, which gives minimum invert depth below curb top, not cover depth.

# Verification — 7 November 2026

The backend is integrated and usable for inspecting original source evidence. The broader goal of reliable consolidated answers comparable to the prepared examples is **not complete**.

## Verified behavior

- Seven unit checks pass: all five original PDFs index, malformed infill text is recovered, engineering provisions are retrieved, irrelevant domains are rejected, and fabricated quotations or altered SI units fail validation.
- Four API integration checks pass: authentication/CORS, original PDF byte ranges, malformed query rejection, and cancellation arriving before submission.
- Real Chrome browser checks pass with web security enabled: connection bootstrap removes the key from the address bar; Home switches data sources; a new query is submitted and polled; source highlights and original PDFs render; static examples can be restored.
- The deployed `streichholzschachtel.vercel.app` origin successfully reads authenticated metadata, requests PDF ranges, submits a query and polls over the launcher's HTTPS tunnel. The user explicitly authorized this origin to use the local connection key.
- A live three-part infill query cites the private-servicing rule on PDF page 6 of the connection guide, the combined-sewer restriction on PDF page 20 of the infill guide, and weekly/post-rainfall ESC inspections on PDF page 25 of the construction guide. All three source tabs work; the third source's actual PDF and highlight were visually inspected.
- The root frontend builds and lints. Its three static workspace/history/example regression scripts passed after integration changes. No root dependency, lockfile or Vercel build configuration changes were needed.
- `Start Backend.cmd` was exercised on this device. It builds its frontend under this folder, reuses the isolated model and extraction cache, starts the API/runtime/tunnel, and writes private connection details only under ignored `state/`. Its default browser address is stable localhost; a separate remote link uses HTTPS.

## Answer-quality result

`node tests/quality.mjs` intentionally remains failing: **4 of 9** cases meet the full acceptance criterion, all four being appropriate refusals. Five positive cases do not meet the consolidated-synthesis requirement because local mode only returns source evidence.

Three of those five positive cases satisfy their narrower evidence-content checks: ESC inspection frequency, 300 mm sewer-to-sewer crossing clearance, and 1.0% catch-basin-lead grade. The crossing check specifically requires the sewer-to-sewer provision, rather than accepting any quotation containing 300 mm.

Two positive cases still fail evidence completeness: the detention-pond/Rational Method query lacks the required storage context, and the Guelph Permeameter query is withheld rather than presenting the complete testing and QA requirements. Exact citations and a second review by the same small model cannot establish reliable interpretation. Source relevance and completeness can still vary with question wording.

The optional hosted synthesis adapter is implemented but has not been enabled or quality-tested. Creating an expiring, budgeted Gateway key and spending credits require the user's separate approval. Vercel OAuth approval by itself does not authorize that action. No credits were purchased and auto top-up was not enabled.

## Reproduce

Start the launcher, then run these from `backend-matvey`:

```powershell
npm test
node --test tests/api.integration.mjs
node tests/browser.mjs
node tests/ocr.integration.mjs
node tests/https.integration.mjs
node tests/quality.mjs
```

The HTTPS tests send the local API connection key only to the explicitly authorized Basis origin and this backend's tunnel. Browser checks require installed Chrome and the root Playwright dependency. Screenshots and detailed quality results stay under ignored `test-results/`; they are generated observations, not committed fixtures. `quality.mjs` returns a nonzero exit code until the full quality criteria pass.

## Vercel setup

The official getting-started guide was followed. CLI 65.12.1 is authenticated as `matveho`; the official Vercel plugin is enabled in user scope and its status command is installed. The shared MCP endpoint is `https://mcp.vercel.com`, configured in `C:/Users/Mo/.codex/config.toml`. Documentation search and authenticated team listing both succeed. Reload was unnecessary because the tools are available in the active session. Global setup did not create, link or deploy a project.
