# Verification — 7 November 2026

The demo frontend is integrated and running locally. The broader goal of reliable consolidated answers comparable to every prepared example is **not complete**.

## Current verified state

- **35 unit tests pass**, covering original PDF indexing and anchors, OCR recovery, source-unit preservation, applicability boundaries, omitted revision-history rules, false numerical comparisons, modality preservation, source citation alignment, checked arithmetic and independent rejection of unsupported findings.
- The frontend browser check passes against the demo service: authenticated connection bootstrap, mode switching, an explicit unsupported query with no PDF results, a new 300 mm sewer-crossing lookup, rendered original PDF/highlight, and restoration of a static scenario.
- Authenticated HTTPS requests from the deployed Basis origin pass for metadata, original PDF byte ranges, JSON query submission and polling. The bundled HTTPS interface also passes its connection and unsupported-query flow. The user authorized the Basis origin to use the local connection key.
- The root frontend builds and lints. Its prepared examples remain available under Static data.
- The running demo uses port 8787. Its code, extractor and built interface are saved under ignored `state/demo-engine` and `state/demo-frontend`; `Start Demo.cmd` can restart that snapshot. Development uses port 8788 and must not restart the demo service.

## Quality limits

The general-answer quality suite remains a development gate. Development engine `668cea46d5` passed all nine smoke cases after switching to independently cited findings. Manual inspection still found irrelevant source provisions in some reports, so this is not broad quality completion. An experimental additional source filter removed valid clauses and was reverted after direct testing. The longer engineering suite remains a separate gate; the saved demo snapshot has not been replaced by these development changes.

Direct source lookups are accepted for narrow factual questions when the complete requested provision is found. This does not relax the requirements for the complex engineering scenarios, which still require consolidated answers and their expected factual coverage.

The user chose local processing. Hosted synthesis is disabled. No Gateway key was created, no credits were purchased or spent, and auto top-up was not enabled.

## Reproduce

From `backend-matvey`, with the appropriate API running:

```powershell
npm test
node --test tests/api.integration.mjs
node tests/browser.mjs
node tests/https.integration.mjs
node tests/quality.mjs
$env:BASIS_QUALITY_SUITE='engineering'
node tests/quality.mjs
```

Set `BASIS_TEST_URL=http://127.0.0.1:8788` for development quality tests. Quality reports record engine and corpus versions. Passing unit, transport or browser tests does not establish broad engineering answer quality. The full quality target must remain open until the complex cases and unseen variants are verified.

Vercel CLI 65.12.1 and the shared Codex MCP connection were authenticated and verified. The official plugin is enabled. Global setup did not create or link a project. Commit `f504d40` (`add local backend`) was pushed to `origin/main` before further development.
