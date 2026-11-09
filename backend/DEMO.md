# basis demo runbook

Run before the presentation, while no queries or imports are active:

```bash
scripts/linux/basis mode demo
scripts/linux/basis rebuild-interface
scripts/linux/basis prepare-demo
```

Preparation runs three real reviews and saves them in project history. It prints
their public links and writes `backend/state/demo-rehearsal.json`. Open the
project dashboard and select **Saved**, or use those links. Rerun preparation
after backend or project-document updates; old results can be marked stale.
Repeated preparation reuses fresh, validated reviews with the same questions
and document scopes. Stale results or changed scopes produce new reviews.
Existing history and bookmarks are preserved.

## Three-minute presentation

1. **Parkview Exchange — IFC and evidence.** Open Issues and select **Rescan**.
   Show the property-derived findings, then open the saved storm-main cover
   comparison: the project has 1.65 m cover against a 2.0 m reference criterion,
   giving a checked 0.35 m difference. Click the citations to inspect both
   original documents. The model files remain downloadable.
2. **Mill Creek — cross-document discrepancy.** Open the saved width comparison.
   Show the 400 mm project provision, the 450 mm reference criterion and the
   independently checked 50 mm difference. Open each PDF citation.
3. **Mill Creek — catchment expansion and pond design.** Open the saved worked
   review and select **Expand result panel**. Show the supplied 42 ha scenario,
   the actual source rule, `1.20 × 1.25 = 1.50 m³/s`, and the `0.60 m³/s`
   capacity difference. The next section distinguishes the minor-system
   Rational Method permission from the storage-facility modelling requirement.
   Restore the result panel and open the guideline and manual citations.

Fresh comparison queries use the GPU model; saved results reopen quickly. The
capacity example is a source-verified worksheet (`verified_review`), calculated
from the question and source text at request time. It contains no stored model
answer. Its reference scope and requested checks are curated for this scenario.
For a live what-if, submit the same capacity question with `42 ha` changed to
`55 ha` and `1.20 m³/s` changed to `1600 L/s`. The worksheet reads the source
again and recalculates `2.00 m³/s` and a `1.10 m³/s` capacity difference. Areas
and positive flow values are editable; both `m³/s` and `L/s` are supported.
The question can also be phrased as a practical review request:

> Review storm sewer capacity and detention pond sizing for a 55 ha catchment.
> Five-year runoff: 1600 L/s. Existing sewer capacity: 900 L/s.
> Is the Rational Method suitable?

The worksheet binds values to those named inputs; changing sentence order does
not change their roles. Omitting the runoff asks specifically for the five-year
runoff and its unit. Conflicting inputs withhold calculations. Converted flows
are shown explicitly, and supplied values remain assumptions. This is a bounded
capacity-and-pond-method review against the named references. Unsupported
conditions or approval requests use ordinary retrieval, and an unsupported
source condition withholds the worksheet.
Other unqualified general reviews retain source retrieval.

## Reasoning qualification

The pinned Qwen 3.5 model remains enabled for the tested comparisons. The latest
isolated general-synthesis qualification passed 7 of 8 automated engineering
cases with thinking disabled, compared with 6 of 8 before the reconciliation
step. These scores measure case assertions, not accuracy or safety certification.
The mixed main/service cover case still omitted a service criterion from its
synthesized findings. Manual inspection also found overstatements elsewhere in
the broader infill answer. General synthesis (`LOCAL_SYNTHESIS_POLICY=all`)
remains experimental and is not enabled by the demo policy.

Experimental replacement reviews now plan one separate reconciliation from
already selected obligation and alternative-permission clauses. The generated
confirmation action must cite both actual source anchors, and its evidence
review distinguishes an unresolved design-basis question from a final project
decision. The infill case produced a supported action linking the private-system
obligation to the conditional LID alternative permission. That qualified action
does not qualify the rest of the general answer. A separate guard rejects claims
of alternative permission supported only by an existing-system obligation.

The backend now keeps main and service measurements separate during evidence
review, preserves unknown cover datums, and rejects unsupported insulation or
compliance conclusions. Named-publication requirements must cite that actual
publication. Delivery-vehicle access alone does not establish that traffic was
unnecessary. If optional arithmetic planning fails, independently supported
source findings can still be reviewed; missing calculations are disclosed.
These are rejection safeguards, not proof that every accepted claim is correct.
Known connection clauses also expose separate slope extents, burial locations
and unstated depth datums to drafting and review. A cited side-by-side
construction condition cannot become a project fact from unit count alone;
affirmative query inputs or cited project records must establish it. These are
bounded bindings for recognized clauses, not a general parser of all standards.

Cover reviews also return a **Project inputs to confirm** checklist. Missing
measurement datums and diameter-dependent inputs are bound to the individual
main or service and linked to the actual returned source clauses. The checklist
does not request a diameter when those clauses have no diameter condition, and
does not turn source evidence into a compliance finding. Mixed main/service
cover reviews retrieve clauses separately for each asset. `assetEvidence`
records each asset's source references or explicitly marks its evidence
`not_found`; missing evidence never expands the selected document scope.
Named references and document series remain restricted, and historical queries
retain version-aware lookup. Reconcile the reference basis before applying a
criterion, even after supplying its requested measurements.

Reproduce the broader qualification separately from the presentation runtime:

```bash
BASIS_QUALITY_SUITE=engineering LOCAL_SYNTHESIS_POLICY=all LOCAL_REASONING=0 \
  scripts/linux/test-gpu-quality
scripts/linux/test-backend
```

Explicit-thinking trials exhausted their tested output budgets without a usable
structured review. They are not enabled in the presentation configuration.

IFC findings compare model properties with project/reference records; they are
not geometric clash detection. Supplied scenario figures remain assumptions,
and the results do not establish design approval or a mandatory construction
remedy. Use the demonstrated paths rather than claiming unrestricted analysis.

## Check and recover

```bash
scripts/linux/basis health
scripts/linux/basis status
scripts/linux/basis prepare-demo
# Conservative previous runtime policy:
scripts/linux/basis mode comparisons
# Model-independent source retrieval:
scripts/linux/basis mode extractive
```

The gateway and HTTPS tunnel remain the existing connection. Keep the university
session logged in for the presentation; user-service lingering is not enabled.

To repeat the frontend rehearsal against isolated storage:

```bash
LOCAL_SYNTHESIS_POLICY=demo BASIS_PREPARE_DEMO=1 \
  BASIS_BROWSER_SUITES='demo-review comparisons pipe-measurements' \
  scripts/linux/test-comparisons
```

This builds the current frontend and serves that build from its own verification
directory, then checks submission, calculations, PDF highlights, Saved history,
reloads, IFC findings and preparation of all three stories.

## HTTPS routing and rollback

Vercel forwards `/local-api/:path*` through the destination in `vercel.json` to
the authorized HTTPS tunnel, which reaches the localhost gateway on port 8789.
Do not restart the quick tunnel immediately before presenting: a new tunnel
process can receive a different hostname.

For a later backend move, restore the private project state on the replacement
host, verify readiness and the same project API locally, then establish its
authorized HTTPS gateway endpoint. Change only the rewrite destination and
deploy the frontend. Verify public health, all four projects, a new query,
original PDF highlights and Saved history before retiring the previous endpoint.
Keep the prior rewrite and endpoint available until those checks pass.

To roll back routing, restore the prior destination and redeploy, after verifying
that backend is still reachable. The former Windows backend is currently down;
its old URL alone is not a usable rollback. On this workstation, `basis mode
extractive` preserves the public route and project state while disabling model
inference. A tunnel outage requires restoring the tunnel or publishing a new
authorized endpoint; changing model policy cannot repair it.

## Review tools for the live demonstration

1. On a project dashboard, open **Settings**, then toggle **Show project issues** off and back on.
   Findings and previous dismissals return; each project has its own preference.
2. Run the box-planter comparison and expand **Requirements check**. Show the
   450 mm criterion, 400 mm proposal and independently verified 50 mm difference;
   select a source to inspect its PDF highlight.
3. Open the capacity review, expand **Revise capacity assumptions**, use 55 ha,
   five-year runoff 1600 L/s and existing capacity 0.90 m³/s. Run revised capacity
   check. Expected reference flow: 2.0 m³/s; shortfall: 1.1 m³/s. Original review
   remains in history. Inputs are scenario assumptions, not verified design data.
4. Select **Export review**, inspect the source register, then **Print / save
   PDF**. The brief contains the calculation, scope and source page references.

Keep the pinned model and `demo` policy unchanged. The last 30 minutes before
presentation are for rehearsal and recovery checks only, not new features.
