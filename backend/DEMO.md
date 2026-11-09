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
This remains a bounded worksheet with the same question structure and named
references. Changed engineering conditions or additional tasks use ordinary
retrieval, and an unsupported source condition withholds the worksheet.
Other unqualified general reviews retain source retrieval.

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
