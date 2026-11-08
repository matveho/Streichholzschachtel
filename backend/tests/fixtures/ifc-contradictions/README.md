# IFC contradiction test folder

Synthetic QA files only. These documents are not published standards or real
project requirements. The IFC4 models contain element properties and stable
GlobalIds, with no 3D geometry. They exercise the existing comparison engine;
this folder does not add IFC upload support or modify a live project.

Run from the repository root:

```sh
npm run test:ifc-contradictions --prefix backend
node --test backend/tests/ifc-contradictions.test.mjs
```

The runner extracts text from the actual PDFs using the backend's PDF extractor,
reads the actual IFC property sets, compares each document independently, and
asserts the results against `expected.json`. The native extractor uses
`backend/.venv`; the existing PDF.js fallback is also supported.

| Folder / document                       | Element / property       | Contradictory IFC | Document requirement |
| --------------------------------------- | ------------------------ | ----------------: | -------------------- |
| reference/speed-standard.pdf            | R1 design speed          |           60 km/h | Maximum 50 km/h      |
| client requirements/client-brief.pdf    | S1 nominal pipe diameter |            200 mm | Minimum 250 mm       |
| design/pipe-schedule.pdf, page 2        | S1 length                |              35 m | Exactly 43 m         |
| technical reports/access-review.pdf     | D1 width                 |             0.9 m | Minimum 1.2 m        |
| supporting materials/model-register.pdf | R1 design speed          |           60 km/h | Exactly 40 km/h      |

`models/contradictory.ifc` must produce exactly **five issues**.
`models/compliant.ifc` must produce **zero issues**: speed 40 km/h, diameter
250 mm, length 43 m, and width 1.2 m. Both models have R1 length 100 m, matching
the supporting register, as a further check against false positives.

`supporting materials/qualitative-review.pdf` has an unsupported qualitative
requirement. It must remain marked `needs-review` for both models. A zero-issue
control does not certify unsupported requirements.

The automated tests also repair R1's speed and confirm that both speed findings
clear while the other three discrepancies remain.

Reports are written to the ignored `results/` directory:

- `issues.html`: readable findings, document excerpts/pages, and IFC identifiers.
- `issues.json`: full findings and coverage for both models.

The assertion manifest and generated model/document files are kept in source
control. To rebuild the same fixture inputs after editing the generator:

```sh
backend/.venv/bin/python backend/tests/fixtures/ifc-contradictions/generate.py
```

The generator requires PyMuPDF from `backend/requirements.txt`; on Windows, use
`backend\.venv\Scripts\python.exe`.
