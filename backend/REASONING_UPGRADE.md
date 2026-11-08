# Local reasoning upgrade — in validation

The live demo remains extractive while this upgrade is tested on main with isolated state.

## Implemented

- Default local model selection: qwen3:32b-q4_K_M. Explicit OLLAMA_MODEL overrides remain supported.
- LOCAL_REASONING=1 enables reasoning only for calls marked reasoning:true: evidence selection, arithmetic proposals, findings and evidence review. Retrieval planning remains non-thinking.
- LOCAL_REASONING_TOKENS (default 4096) augments each call's output budget; LOCAL_CONTEXT_TOKENS defaults to 16384. Both settings are range-validated. Completion at the token limit remains a failure; incomplete output is not released.
- Ollama endpoints must be loopback, matching the existing llama.cpp restriction. Reasoning traces are excluded from returned results; only parsed final JSON is used.
- Foreign-jurisdiction checks run before local model retrieval/generation. The Toronto/Edmonton regression verifies that neither retrieval nor generation executes. Scope messages no longer describe every reference collection as Edmonton-only.

## Current evidence

Initial baseline after the routing/provider changes: 148/148 unit tests passed, plus isolated project API/import/isolation/restart-persistence tests. Lint and focused provider/jurisdiction regressions pass. Later end-to-end model results must be recorded before live activation.

32B downloaded successfully, digest 030ee887880fc378860c2dd35101da424377520441ae4bfe7be6deff8ade7840. Ollama reports 24,484,700,487 bytes fully GPU resident at 16384 context. Whole-GPU observed memory was 27,458 MiB with utilization 98%. A first structured reasoning request correctly applied the 3-plex-and-larger threshold to a four-dwelling project, in 9.319 seconds including initialization.

Full reasoning benchmark is running using BASIS_BENCH_REASONING=1 node tests/local-model-benchmark.mjs ollama http://127.0.0.1:11435 qwen3:32b-q4_K_M. The benchmark records the reasoning setting and uses a bounded 4096-token total output limit. Full application evaluation, richer check coverage and live activation remain outstanding; one successful model response does not establish engineering correctness.

Runtime thinking API reference: https://docs.ollama.com/capabilities/thinking. Thinking and final content are separate response fields; the backend consumes only final structured content.

## First full reasoning result

32B with thinking passed 22/24 reasoning cases in 117.023 seconds, with two false approvals: absence-is-not-exemption and flattened-formula ambiguity. This is not an improvement over the earlier 14B non-thinking 23/24 result. Do not promote this model based solely on size.

Added conservative claim vetoes for ungrounded exemption language and natural-language operator guesses about flattened PDF equations. Existing literal-equation verification remains. The rules only reject claims and cannot approve them. Their positive controls preserve explicit source exemptions and formulas with actual operators. Full regression after these additions: 150 unit tests passed, zero failed/skipped, plus isolated API/import/isolation/restart persistence checks (backend/state/verification/run-PTUvaW9c/).

The complex API evaluation is running on isolated state backend/state/verification/run-gpu-AsI9vAKd with LOCAL_REASONING=1 and 32B. It began before the latest veto additions; record its result as that initial snapshot, and rerun affected cases after subsequent changes. No changes have been applied to the live extractive services. Next required work: finish complex-case diagnosis, improve evidence completeness/check reporting, validate meaningful capability gains and then enable a tested configuration through the live frontend.

## Coverage and atomic findings

The first initial-snapshot 32B complex case took 183 seconds and failed completeness checks. Its evidence covered pipe diameter and velocity requirements but omitted the roughness table; its generated text also attached an exception to an absolute velocity prohibition. The application-wide 32B run is still in progress and has not qualified the model for live use.

Implemented a configurable 2–8 atomic-finding budget per check (default six), retaining the existing two-finding default for callers of the generic merge helper. Findings must separate absolute limits from conditional design targets. Added a conservative deterministic veto when an exception is attached to a cited absolute lower bound. Pipe-sizing concept expansion and selector instructions include relevant roughness tables, diameter exceptions and velocity bounds without embedding any regulatory numeric values.

Added a structured `review` object and human-readable Review coverage section to locally synthesized results. Each requested check is marked findings_available, evidence_only or unresolved; none implies design approval or complete compliance. When generated conclusions are withheld but validated source provisions exist, the response can retain those originals as source_evidence instead of discarding the entire review.

Regression baseline after these changes: 152/152 unit tests plus isolated API/import/isolation/restart persistence passed, logs under backend/state/verification/run-OAtvK4yg. Additional focused test checks explicit six-finding merge bounds. Targeted model evaluation of this revised snapshot remains required. The live extractive configuration remains unchanged.

## Targeted follow-up

The original all-seven thinking run was intentionally stopped after its known first-case failure and a second question exceeding five minutes, so its later cases are not evaluated; do not report a seven-case score. This was a superseded snapshot, not a runtime crash.

Revised minor-system case with 32B non-thinking completed in 68 seconds versus 183 seconds for the initial thinking run, but still failed completeness: the roughness value was absent. Reasoning mode and pipeline both changed, so this is not a controlled latency comparison. Three sources and eleven audited findings were returned, with one unsupported finding withheld. Raw evidence: backend/test-results/quality-engineering-minor-system.json; state/logs: backend/state/verification/run-gpu-Rlj5IMig. The smooth-wall roughness row exists in the index and passes isProvision; retrieval/selection still needs linked-table coverage. No live model activation has occurred.

## Linked-table coverage fix

Diagnosis confirmed that the smooth-wall roughness row reached the pipe-sizing model context but was omitted during evidence selection. Added bounded linkedTableEvidence retention: explicit same-document table references, or nearby tables in the same specific subsection. A constrained same-page method-term link handles stale extracted section labels; generic terms such as design/pipe do not qualify. Foreign documents, unrelated sections, similarly numbered tables and duplicates are excluded. Multiple tables receive evidence budget before additional rows of one table.

The revised 32B non-thinking minor-system case passed the full unchanged engineering gate in 64 seconds, including the 0.013 roughness value, design frequency/method, diameters and velocity limits. State/logs: backend/state/verification/run-gpu-Vw2Au3Pm. Table candidates are original anchored source units; this retention does not assert their regulatory applicability or manufacture a value.

New evidence helpers and reasoning/context/finding-budget settings now participate in engine fingerprinting, preventing stale answers from being reused after those behaviors change. Quality output is additionally persisted in each isolated state directory as quality-results.json.

Stable-snapshot regression: 157/157 unit tests plus API/import/isolation/restart-persistence checks passed, backend/state/verification/run-wHOVreeg. An earlier persistence run overlapped a deliberate engine-fingerprint source change and correctly withheld stale output; its failure was resolved by rerunning unchanged source, not relaxing assertions.

Full seven-case revised evaluation is running with LOCAL_REASONING=0 on qwen3:32b-q4_K_M in backend/state/verification/run-gpu-Xc6MAUqa; process session 38895. No live activation has occurred. Continue by inspecting that live handle and its logs before starting another model run.

## Completed evaluations and comparison repair (2026-11-08)

The seven-case `run-gpu-Xc6MAUqa` evaluation finished: 2/7 passed (minor-system
and shallow-soil-exemption), with zero timeouts. The other five cases failed
coverage/correctness gates. This older snapshot does not qualify 32B for live
activation. It demonstrates that parameter count alone did not solve the task.

A fresh project-scoped holdout (`run-gpu-1ITUbU5u`) passed 3/4 but failed the
project-versus-standard width comparison: it called the 400 mm project allocation
a minimum and omitted the 450 mm reference rule. This was reproduced through the
real project API with the full OCR corpus.

Added role-balanced comparison retrieval within the existing scoped corpus,
explicit project/reference document roles in selector and drafting contexts,
single-topic planning for narrow questions, and a conservative veto for reversed
numeric bounds. No regulatory value is embedded in these rules. Empty document
roles never become unrestricted searches.

After the repair, `run-gpu-IZa1jaNq` passed all four capability holdouts: width
comparison 31.476 s, changed catchment size 26.168 s, foreign jurisdiction 1.018 s,
and explicit empty scope 1.018 s. Foreign project document selection was rejected
before inference. The actual comparison findings correctly distinguish the
reference minimum (450 mm), project maximum allocation (400 mm), and their
conflict, citing both original documents. This is one verified capability gain,
not evidence that all engineering synthesis is reliable.

Stable regression `run-R0TX44Ds`: 184/184 tests passed, plus isolated project API,
imports, strict isolation and restart persistence. A new full seven-case 32B
non-thinking evaluation is running; inspect `/tmp/basis-reasoning-seven-current.log`
and its reported state directory before starting another GPU job. Live services
remain extractive until a candidate passes broader engineering validation.

## Source-section system scope

The subsequent seven-case run `run-gpu-PYSUeYUF` uses the comparison-repair
snapshot and is still being evaluated. Its first minor-system answer failed
roughness coverage and its original-source table included a generic 3.0 m/s
clause inherited from the sanitary sewer section (Design Guidelines PDF p. 7).
The frost-cover case passed in 73 seconds. Inspect the completed run before
reporting an overall score.

Fixed generic conveyance clauses to inherit the nearest explicit source system
from their heading/ancestor scope. Storm questions cannot select sanitary-only
velocity rules, and synthesis validation independently rejects such recast
claims using the original evidence-unit scope. Explicit mixed-system comparisons
and clauses remain eligible. This fix was added after that GPU run started and
is not covered by its model results. Regression `run-u68RrDUL`: 188/188 tests plus
isolated API/import/isolation/restart checks passed, including the real sanitary
provision being rejected as a storm finding. Live inference remains extractive.
