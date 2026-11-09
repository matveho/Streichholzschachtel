# Local reasoning and comparison runtime

The live demo uses the pinned Qwen3.5 model for explicit project/reference comparisons. General reviews remain extractive; unrestricted synthesis and thinking are not qualified. Historical snapshots below are superseded by the latest release evidence at the end.

## Implemented

- Default local model selection: qwen3.5:35b-a3b-q4_K_M. The demo pins the validated digest through its comparison alias; explicit OLLAMA_MODEL overrides remain supported.
- LOCAL_REASONING=1 enables reasoning only for calls marked reasoning:true: arithmetic proposals, findings and evidence review. Retrieval planning and source-ID selection remain non-thinking.
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


## Newer GPU candidate and acceptance-stage fidelity

Qwen3.5 35B-A3B Q4_K_M is installed in the same user-local Ollama runtime,
manifest digest `72aac7c28be8ff9b81c2a270eb489c88e6d822a76ec0cb7bf34d965768848567`.
Official package: https://ollama.com/library/qwen3.5:35b-a3b-q4_K_M.
It ran fully GPU-resident: 21,598,411,160 bytes at 8192 context and
21,782,960,536 bytes at 16384 context. Whole-GPU observed memory at 16K was
26,891 MiB, including the existing desktop workload.

Raw direct evidence benchmark: 23/24 in 24.508 seconds, with one false approval
for a flattened formula. Both natural-language and symbolic operator guesses are
now conservatively vetoed when the original extraction does not preserve them.
The model is a working infrastructure candidate, not a qualified production
answer provider.

The completed 32B run `run-gpu-PYSUeYUF` passed 2/7 in 446 seconds. The newer
candidate's direct run `run-gpu-9nok18LF` also passed 2/7 in 156 seconds
(minor-system and shallow-soil-exemption). Source-scope code differs between
these snapshots, so these timings are observed run durations, not a controlled
model-only speedup. Completeness, capacity calculations and acceptance-stage
interpretation still require work. Added case IDs, runtime model/provider and
missing-term/source diagnostics without changing the quality gates.

Investigation of the exact-area answer found FAC-only testing rules being
presented as general testing counts/exemptions. New vetoes require preserving
FAC/final-acceptance and CCC/construction-completion qualifiers. Stable regression
`run-N8cVQkP4`: 190/190 tests plus API/import/isolation/restart checks passed.

Thinking over source-ID selection exhausted a 4096-token reasoning budget in
34 seconds (`run-gpu-TTvb7O9b`) and later an 8192-token budget in 193 seconds;
outputs were correctly withheld. Source selection now remains direct even when
LOCAL_REASONING=1; arithmetic, findings and evidence review retain the optional
bounded mode. The 24 real-corpus retrieval tests pass and verify that stage
contract. Targeted decision-only thinking validation is still running; inspect
`/tmp/basis-qwen35-decision-thinking.log` and its state directory before starting
another GPU evaluation. No live switch from extractive inference has occurred.


## Validated comparison release

Deployed model alias: `basis-qwen35-comparisons:72aac7c28be8` (the manifest digest
above is checked before activation). `LOCAL_SYNTHESIS_POLICY=comparisons` enables
explicit project/reference comparisons; general reviews, approval requests,
reference-only scopes and explicit source-only requests stay on the existing
extractive path. `all` remains an experimental evaluation setting.

A dedicated comparison check collates already-selected project and reference
provisions, reports their actual difference using independently verified
arithmetic, and preserves structural position, process, acceptance-stage and
load-input qualifiers. Each derived comparison carries both source roles.
Atomic observations alone do not establish a completed comparison. Missing
bases produce an unresolved comparison with validated source text, not a
one-sided inferred minimum or automatic compliance decision.

Adversarial validation exposed pavement overlay/remaining-asphalt versus new-layer
confusion and selection of ESAL-dependent minima without project design ESALs.
Added explicit vetoes and positive controls; AADT/truck percentage cannot silently
become cumulative axle loading. These are evidence qualification checks, not
embedded regulatory values. Shared source units now retain stable labels and
coverage reports identify reused evidence rather than falsely reporting it absent.

Latest stable regression `run-nZuLBeVb`: 202/202 tests plus isolated
API/import/isolation/restart checks passed. Nine strengthened capability cases
passed in `run-gpu-jocctzBf`; the bounded workflow
is recorded by `/tmp/basis-qwen35-bounded-workflow.log`. Width comparison: 4.455 s;
cover comparison: 5.706 s. Results include a real 50 mm width difference and
0.35 m storm-cover shortfall with both original-source roles. Negative cases
include missing highway design basis even with the proposed value supplied.

Isolated browser `run-browser-53t6QqO7` passed UI submission, the 50 mm arithmetic,
both original PDF highlights, reload/history, offline general review and IFC
findings. The public Vercel browser passed the same comparison (stored query
`26a23197-d810-4da7-afe6-b36a68f70f0e`). Public extractive rollback, restoration of
comparison mode and retained query history were executed successfully.

The decision-only thinking trial completed drafting but exhausted its bounded
review output after 254 seconds. It is not enabled in the release. Broader
engineering synthesis remains unfinished: the seven-case direct candidates
previously scored 2/7. Do not present this bounded comparison release as a
qualified general engineering-design assistant.

## General-review completeness and modality follow-up

Broad construction checks now retain a bounded search for construction-site
controls if the planner omitted that topic. The search contains technical
vocabulary, not regulatory schedules or numeric requirements. The actual corpus
regression verifies that the documented ESC inspection schedule and its original
page coordinates reach the source pool. Review/repair diagnostics now distinguish
unsupported claims from irrelevant ones. A replacement proposal does not make
the existing servicing obligation irrelevant or establish precedence over it.

New interpretation vetoes reject invented waivers/precedence and classification
of an unexplained delivery as unnecessary traffic. Mandatory-claim checking now
also recognizes violation/noncompliance wording: a recommendation cannot become
a mandatory project violation merely by avoiding the word "must".

Test-count completeness is checked separately from source entailment. Approved
findings must answer the requested field/QC count and preserve the requested
acceptance stage; source quotations, placement distances and unrelated QC counts
cannot substitute for that answer. Incomplete results retain verified related
requirements but return `insufficient_evidence` with a specific required input
shown through the existing search-parameter interface. The helper participates
in the engine fingerprint so incompatible cached answers become stale.

The seven-case direct general-review snapshot `run-gpu-UkpsTgWo` passed 4/7
(minor system, infill servicing, shallow-soil exemption and exact-area boundary).
Frost cover omitted the default service-depth provision, expanded capacity
omitted the requested derived flow comparison, and damaged-LID corrective work
remained incomplete after an incorrectly mandatory sediment-control finding was
withheld. This snapshot precedes the final joint field/QC-count and delivery
classification guards. It does not qualify unrestricted synthesis for the demo.

Positive holdout `run-gpu-F6S22BoJ` passed in 20 seconds on the later snapshot:
two field-test locations for a 500 m² facility, a separate QA/QC check within
3 m at the same depth, and the preferred half-depth calculation of 300 mm for
600 mm soil. Findings cite the actual source clauses on PDF page 97. The new
holdout assertion accepts the complete technical name between the count and
"test locations"; its first version incorrectly rejected that valid wording.
The original seven quality gates remain unchanged.

General reviews in production continue to use source retrieval. These changes
are shared safeguards and experimental general-review improvements, not a
promotion of unrestricted generation. Next required work is complete cover-rule
retrieval, applicable capacity calculations, and useful corrective-work findings
without overstating recommendations or unverified project circumstances.

The comparison regression `run-gpu-Axevmu8g` exposed a further missing-basis
failure: a generated "falls short" claim chose the >10-million-ESAL pavement
row without project design ESALs. The existing guard recognized "shortfall" but
missed that relational wording. A shared comparison predicate now covers both,
along with below/above and thicker/thinner comparisons. Focused tests include
the actual failed claim and a positive control with supplied design loading.
All nine capability cases passed in `run-gpu-vaZoYJ2t`, including that adversarial
case (8.314 s), width arithmetic (4.399 s), and storm-cover arithmetic (5.596 s).
This run preceded a diagnostic-order refinement that preserves the existing
undefined-process error when a claim uses only "governing" wording; the actual
missing-ESAL condition is unchanged. The later browser check uses the refined
snapshot.

Final regression `run-Vij9OmQu`: 217/217 unit tests, OCR verification, isolated
project API/import/isolation checks, and metadata/document/query/citation
persistence across a backend restart all passed. Browser verification
`run-browser-sIVS7Odg` passed UI submission, verified comparison arithmetic,
both original PDF highlights, reload/history, extractive general-review routing,
and automatic IFC findings. The model remained fully GPU-resident at 16K context
(21,782,960,536 bytes reported by Ollama).

## Reference criteria, source conditions and measurement datums

Added a deterministic reference-reconciliation register shared by extractive
and generated reports. Closely ranked independent publications supplement the
original retrieval results instead of replacing them. Selected pipe-depth
criteria retain bounded same-system/same-role alternatives from other references.
The register lists original values, explicit measurement datums, source pages
and citations with `review_required` status. Differing values, conditions or
datums do not establish a document conflict or choose publication precedence.
Ambiguous clauses containing several different length quantities remain literal
source evidence rather than having a pipe diameter mislabelled as burial depth.

Offline lookup also checks scoped reference alternatives when its first answer
contains a classifiable depth criterion. It never passes an empty document list
to unrestricted legacy search, never includes foreign project documents, and
keeps an explicit named-publication request limited to that publication. The
existing clarification UI receives `reference_basis` as the specific input
needed; the report can be used without a language model. New fields
`referenceInterfaces` and `requiredInputs` are additive API metadata.

Source validation now handles decimal quantities attached to units (`2.4m` had
incorrectly backtracked to the number `2`). A regression accepts the actual
2.4 m clause and rejects invented 2.5 m and 2.0 m values. Manufacturer-recommended
procedures do not turn an enclosing installation duty into an optional action;
actual "should" recommendations remain advisory. Conditional imperative duties
are recognized without dropping their conditions.

Immediately adjacent feasibility conditions remain linked to mitigation clauses
through source selection, validation, citations and the displayed source text.
Main-pipe findings cannot use service-connection clauses as their proof, and
matching numeric values cannot equate pipe cover with invert-to-curb depth.
The helpers and metadata participate in engine fingerprinting.

Frost-cover holdout `run-gpu-HT2iXnIL` passed in 22 seconds under a strengthened
gate requiring the 2.4 m criterion in an actual finding, not just source text.
Manual review confirmed the separate main insulation duty and retained service
exception. The following eight-case snapshot `run-gpu-JjQ8nd2N` passed 5/8:
minor system, frost cover, shallow exemption, exact-area boundary and the field
test-count holdout. Infill retained source evidence but lost required interpreted
findings; capacity still omitted the qualified derived flow comparison; damaged
LID still omitted testing/corrective-work findings. General generation remains
unqualified. These results precede the final offline supplementation/datum-label
refinement and must not be presented as a full latest-model qualification.

Reference browser `run-browser-JAqzCbvF` passed a real scoped project API query,
the specific clarification, both original PDF highlights and report persistence
after reload. It ran extractively with no model dependency. Comparison capability
run `run-gpu-KYq33ECs` passed all nine cases, including missing pavement design
bases, empty/foreign scope, and the real width/cover differences. Browser
`run-browser-2SqWtsV5` passed UI comparison submission, arithmetic, both PDF
highlights, reload/history, offline general review and automatic IFC findings
after the final datum-label refinement. Default Linux browser checks now include
the reference-reconciliation suite.

## Controlled model comparison and complete multi-check validation

The dense 32B and current 35B models were evaluated with the same loaded source
tree (`e27d4cb7192d95174259d19b3c1f27529b63430c`), eight questions, 16K context,
Q4_K_M weights and reasoning disabled. The dense model was fully GPU-resident
at 24,484,700,487 bytes; the current model used 21,782,960,536 bytes.

| Model | Cases passed | Total query time | State |
| --- | --- | --- | --- |
| qwen3:32b-q4_K_M | 3/8 | 474 s | run-gpu-VR7vI7l4 |
| pinned Qwen3.5 35B-A3B | 5/8 | 198 s | run-gpu-kedY1lgl |

These are end-to-end observations for this suite, including runtime warm-up,
not a parameter-count-only experiment or general accuracy estimate. Both loaded
the pre-fix implementation before the following validation changes. The dense
candidate was not promoted; the verified comparison release retains Qwen3.5.
Generic configuration and Linux evaluation defaults now select the current
model instead of the older 32B/14B defaults. The demo alias/digest is unchanged.

Diagnosis found two application limits that silently lost later checks:

- All locally drafted findings were combined into one section, then validation
  examined only its first 12 claims. It also retained only eight total sections,
  although eight source checks plus their conclusions require nine sections.
  Validation now uses the server's requested check IDs, bounds findings per
  check, and retains every bounded source section. Unknown IDs and excess
  findings cannot borrow another check's budget; legacy unplanned output keeps
  its previous limits.
- Repair received only the first eight errors globally. Later rejected drafts
  consequently appeared to be retained findings. All failed claims now reach
  cache invalidation; feedback is bounded per check and prioritizes its rejected
  drafts before source-only diagnostics. A real mocked-provider regression
  reproduced four unsupported retained drafts before the fix and none after it.

An observed infill run consequently retained findings across all six checks
rather than only the first two (30 versus 9 findings in those snapshots).
These counts include paraphrases and do not establish engineering accuracy.
Conditional design inclusion is also preserved: "if the design includes an
underdrain" does not mandate installing one. A separate conditional sentence
cannot excuse an unconditional installation claim, and a hypothetical question
cannot establish that the component exists.

The review now exposes citation use per selected source provision. Partially
used evidence produces `partial_findings`, with selected/cited/source-only/
unreported counts. Shared sources are credited without duplicate backlogs;
repeated wording on a different page cannot credit the wrong anchor. The report
links source-only provisions under "Selected evidence awaiting interpretation".
It never equates citation use with complete interpretation or design approval,
and does not expose withheld quotations without a public citation.

Quality gates now match finding terms within actual finding sentences. Earlier
whole-report JSON could join unrelated "private" and "storm" statements, or
mistake naming EPCOR for a clarification. Explicit servicing clarification is
required, and evaluation records include a criteria fingerprint. Re-scoring the
stored comparison preserves 3/8 versus 5/8. The post-fix
`run-gpu-hgYjgfpn` also remains 5/8 under the stricter gates: servicing decisions,
qualified capacity arithmetic and damaged-LID testing/corrective work remain
incomplete. Unrestricted general synthesis is still not qualified.

Final regression `run-7uiNaE1n`: 246/246 unit tests, OCR, isolated project API,
imports, isolation and restart persistence passed. Comparison capability run
`run-gpu-Moqr3wK2` passed all nine cases. Browser `run-browser-pZxnl2KQ` passed
actual UI review submission, partial-check coverage, independent source-use
invariants, the pending-source PDF highlight and reload/history. Use
`scripts/linux/test-review-coverage` to reproduce that isolated experimental
workflow without changing the production mode.
