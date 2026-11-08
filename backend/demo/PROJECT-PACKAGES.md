# Project packages

The first two workspaces are Parkview Exchange Redevelopment (`parkview-exchange`, PX-26017) and North Ridge Highway Intersection Upgrade (`north-ridge-highway`, NRH-26104). Each contains six fictional consultant/client artifacts, four manually prepared source-verified review findings plus a searchable IFC model register, and seven completed query fixtures. Three fixtures per project are produced by the actual offline extractive query engine; the other four are checked cross-document comparisons. Each IFC model is downloadable from its register; see [IFC models](IFC-MODELS.md). Existing Mill Creek and Willow Creek workspaces remain available.

## Source and identity policy

The owners, consultant, initials, site data, traffic counts, drawings and calculations are fictional. PDF pages carry an issued-for-review / not-for-construction status and no professional seals or signatures. Internal `origin: synthetic-project-artifact` metadata records provenance; the project documents do not masquerade as published authorities. Governing EPCOR, City and Alberta PDFs are untouched official publications. No CSA or AASHTO paid publications are required.

`package-provenance.json` records every associated file's SHA-256, actual extracted page count, edition, source URL, query fixtures and finding proof strings. `reference-sources.mjs` adds exact-hash publication identities. The highway collection includes HGDG A/B/C/D/I, TIA guidance, the pavement manual and DB77, DB99, design exceptions and the current 2025 work-zone manual. This is an indexed reference set, not a claim that all active bulletins have been exhausted. Check project applicability and further updates before real design use.

Official discovery sources:

- [EPCOR guides and design standards](https://www.epcor.com/ca/en/ab/edmonton/operations/service-connections/guides-checklists-forms.html)
- [Edmonton design and construction standards](https://www.edmonton.ca/city_government/urban_planning_and_design/city-design-construction-standards)
- [Alberta geometric design guide](https://www.alberta.ca/highway-geometric-design-guide)
- [Alberta design bulletins](https://www.alberta.ca/design-bulletins)
- [Alberta Open Government publications](https://open.alberta.ca/publications)

## Technical review decisions

1. Parkview's 0.34 L/s is assigned only to limited upstream branch S1 serving the 250 m² east retail/frontage component. It is **not** the whole 92-residence development flow. The remaining building service is S2; total development flows and downstream capacity remain explicit hold points. S1 is described as an upstream municipal reach, so Table 1.1 applies subject to acceptance of that classification and flow allocation. The 0.30% grade is below both the general 0.40% and the specific 1.00% criterion.
2. ST1 is explicitly the terminal storm reach, so the separate 0.4% upstream provision applies. Its shallow cover finding retains the insulation alternative: 1.650 m without a detail requires resolution, rather than establishing that every shallow installation is prohibited.
3. X1 concerns a **sewer service below a watermain**. The 300 mm requirement spans EPCOR PDF pages 8–9; evidence opens both source-page fragments. It is not confused with a sewer-to-sewer clearance provision.
4. Lane marking uses Chapter C, February 2022: rural undivided surface wider than 10 m, 3.7 m painted **through** lanes. The 3.5 m auxiliary turn lane is not flagged. Final classification and exceptions require review.
5. SSD evidence cites the complete 100 km/h table row, including 185 m **level-road** design SSD. Available 165 m is preliminary; grade effects, measurement assumptions and accepted design basis must be confirmed. The owner brief independently adopts 185 m as a screening baseline. No automatic unsafe/illegal judgment is made.
6. TIA guidance calls for combined traffic through at least 10- and 20-year horizons from commencement. Opening 2027 / 2037 without 2047 is incomplete.
7. Pavement findings concern unexplained AADT and truck-share differences and method coordination. The two truck-pass calculations are **not ESALs**, and trial thickness is not assessed. Different growth methods may be justified; the manual must be read with DB77.
8. HGDG A is February 2022, not the older April 2018 edition proposed in the research brief. Complete Streets v06 is identified from the original November 2025 publication. Work-zone guidance uses 2025, not the older 2001 file.

## Restore, reproduce and integrate

- Start or restart using the root **Start basis.cmd** controls. New seeds restore idempotently at startup. PDFs are copied from tracked `output/pdf` originals into local runtime storage; checksums repair missing/changed runtime copies.
- Reset from Settings restores all four protected projects and their initial findings/history. Ordinary projects survive only when Keep on reset is enabled. Protection is enforced by the backend.
- Generate the twelve project PDFs with `demo/build-project-packages.py` using Python with ReportLab. It imports the structured package module, produces deterministic PDFs and leaves all official references unchanged. It generates 24 pages across twelve files, including nine drawing sheets.
- Reference PDFs newly downloaded for this package live in tracked `references/`; private user documents remain in ignored local storage. The frontend deployment excludes the backend tree.
- Existing project APIs and citation contracts are unchanged. Use `/v1/projects`, `/v1/projects/:id`, project-scoped document files and queries. New IDs are stable; collection IDs are `edmonton-urban-servicing` and `alberta-highway-design`. Project lookup results include only the active project's associated sources.

## Demonstration

Open Parkview, inspect the sanitary upstream-grade finding, click its original EPCOR table citation, then its C101 evidence. Return to the dashboard and inspect the shallow-cover finding to show the insulation qualification. Open North Ridge and inspect the traffic/pavement coordination finding; three different documents establish the design-basis mismatch. Completed history is immediately available; a fresh pipe-diameter or available-sight-distance question runs locally without hosted inference.

Automated checks: full backend unit suite; `tests/project-packages.integration.mjs` for fresh factual queries and all new fixtures; `tests/presentation.smoke.mjs` for all protected workspaces, every PDF and browser source highlighting. `tests/demo-reset.integration.mjs` exercises restart/reset retention **only** on isolated ports 8840/8842. Never run destructive reset checks against the presenter's live state.
