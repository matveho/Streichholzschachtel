# Verification — version-aware extractive engine, 7 November 2026 (later)

Run on a machine without Ollama, Tesseract or an Anthropic key, so only the offline engine was exercised.

- `npm test`: 47 tests, 45 pass, 2 skipped (the two Infill LID checks need Tesseract OCR; its scanned pages are withheld without it). Includes the 34 demo questions, version-status checks, footnote-superscript extraction and the Claude output validator.
- `npm run demo:api`: 34/34 demo questions pass through the authenticated job API with valid page regions; PDF byte-range returns 206 `%PDF`.
- `node --test tests/api.integration.mjs`: 4/4 pass against a running server.
- Not verified: the Claude layer against the live API (no key on this machine — only its validation logic is unit-tested), the browser checks, `tests/quality.mjs` (written for the Ollama pipeline), and Tesseract OCR.
- The demo set guided tuning, so its pass rate overstates general accuracy. Spot checks on unseen paraphrases were mostly correct (RM runoff, crossing clearance, CB-lead slope, freeboard, PHD pressure, peaking-factor formula); LID checklist-table questions remained weak.
- The water-main question is answered from Vol. 4 Water (December 2024) Table 1.2, which gives minimum invert depth below curb top, not cover depth.

# Verification — 7 November 2026

The deployed frontend connects to the saved local demo. The goal of reliable consolidated answers comparable to the prepared examples is **not complete**. Development changes have not replaced the public demo engine.

## Verified checks

- **77 unit tests pass**, run serially with `node --test --test-concurrency=1 tests/*.test.mjs`. Coverage includes original PDF anchors, table geometry and row scope, quantities, calculations bound to each finding's evidence, section retrieval, recommendation wording, optional component conditions, bounded review batches, complete unique verdicts and scoped repair.
- Root `npm run lint` passes.
- The real local-runtime integration passed both checks: memory is released before the independent verifier initializes, and subsequent generation reloads the model and obeys the strict JSON schema. The pinned llama.cpp build requires `response_format.json_schema.schema`; its older top-level `schema` form silently failed the actual enforcement probe.
- The development API passed four transport checks. These do not establish answer accuracy.
- The last deployed-browser checks passed automatic connection without a selector or connection key, five labelled examples, a live crossing query, original PDF highlighting and an unsupported-query response.
- The last HTTPS checks passed same-origin query submission and polling, metadata, original PDF byte ranges and an unsupported answer without citations. Public responses contain no private connection key; bulk query history is not exposed.

## Answer quality

The latest targeted infill test on engine `8a4bc88b872a336e53faa74ab39f55e502718bb3585321cf1c00537ba32e60c9` completed in 257 seconds and passed its then-current automated coverage checks. **Manual inspection still failed it:** the summary did not resolve the servicing interface, and a finding made an optional underdrain into a design condition. An occurrence of “approval process” had incorrectly satisfied the interface check.

The interface check is now stricter. A new validation guard rejects turning “if a component is present” into a requirement to install that component, while retaining duties for explicitly supplied project components. Its regression tests pass. The running engineering suite started before these last changes; it evaluates the earlier engine and criteria. A fresh API restart and quality run are required to evaluate the new guard.

The complete seven-case engineering suite is running against the experimental local engine. There is no current full-suite pass to report. Earlier engines passed subsets of the engineering cases and a ten-case smoke suite, with different code and weaker coverage checks. Those results do not qualify this engine for promotion.

Quality reports record engine and corpus versions. Coverage regexes are only a first gate: surviving findings must also be inspected for source scope, conditions, omitted exceptions, arithmetic meaning and whether the main question was answered. Unsupported or insufficient queries must return an explicit unsupported answer without document citations.

## Local models and memory

All inference remains local. The user authorized `E:\Basis-model-cache` for weights, runtime binaries and the optional verifier environment; source changes remain in `backend-matvey`. Downloads are pinned and SHA-256 verified. See [LOCAL_RUNTIME.md](LOCAL_RUNTIME.md) and [VERIFIER.md](VERIFIER.md).

The independent verifier passed 15 of 16 offline cases, with one false approval of an incorrect numeric comparison. It is **veto-only**: a strong contradiction can reject a claim, but entailment never approves one. Numeric, applicability, exact-source and model-review checks still apply. Oversized inputs abstain instead of losing qualifications to truncation. A configured verifier failure withholds an answer.

Generation and verification cannot reliably hold both models in memory together on this device while the existing demo model remains loaded. The experimental llama.cpp runtime sleeps after one idle second; the API waits for that release before starting verification. It wakes for the next generation. The real integration test exercised this handoff. Keep the paired sleep/release settings in the runtime instructions.

Hosted synthesis remains disabled. No Gateway key was created, no credits were purchased or spent, and auto top-up was not enabled.

## Demo and development separation

- Public demo: API **8787**, gateway **8789**, saved engine and interface under ignored `state/demo-engine` and `state/demo-frontend`. Last verified index: **9 unique documents, 1,889 passages, zero failures**.
- Experimental development: API **8788**, separate authenticated loopback runtime **11436**, table-aware index with **9 documents and 1,891 passages**. The user's Ollama runtime on 11434 is untouched.
- Vercel rewrites `/local-api` to the gateway's temporary HTTPS tunnel. The gateway authenticates internally and returns same-origin document URLs. The tunnel and host computer must remain running.
- Recreating the tunnel changes its hostname and requires a Vercel rewrite update. The current launcher also needs reconciliation with the frontend's `/local-api` connection and separate gateway. **Reboot-proof one-click public access is not verified.** The experimental runtime is not a finished replacement.

## Reproduce

From `backend-matvey`, with the appropriate API and runtime running:

```powershell
node --test --test-concurrency=1 tests/*.test.mjs
$env:BASIS_TEST_URL='http://127.0.0.1:8788'
node --test tests/api.integration.mjs
node --test tests/local-runtime.integration.mjs
node tests/quality.mjs
$env:BASIS_QUALITY_SUITE='engineering'
node tests/quality.mjs
```

Use the environment variables in [LOCAL_RUNTIME.md](LOCAL_RUNTIME.md) for the runtime integration test. Deployed checks are `node tests/auto-connect.mjs` and `node tests/https.integration.mjs`. Run `npm run lint` from the repository root. Passing unit or transport checks does not establish engineering answer quality.
