# IFC document comparison

Run from the repository root with Python 3.10 or newer:

```sh
python3 -m venv .venv
.venv/bin/pip install -r incomplete/requirements.txt
.venv/bin/python -m incomplete /path/to/project --output /path/to/review
```

On Windows use `.venv\Scripts\python.exe` and `.venv\Scripts\pip.exe`.

Expected project structure (documents can be nested):

```text
project/
  model.ifc
  reference/
  client requirements/
  design/
  technical reports/
  supporting materials/
```

Folder names are case insensitive; spaces, underscores and hyphens are accepted, as is `references`. IFC files are discovered recursively. Each document is compared independently with **every** discovered model. To limit model scope, pass `--ifc /path/to/model.ifc` (repeatable). Explicit IFC paths are relative to the working directory. Keep unrelated projects in separate roots.

`issues.html` is a standalone report grouped by document category. `issues.json` contains source excerpts, one-based PDF page numbers, PDF highlight rectangles, IFC filenames, element names and GUIDs, properties, actual values, and expected values. The document inventory records unsupported files, extraction errors, scanned PDFs requiring OCR, and documents with no recognized claims. Missing or empty folders generate warnings.

Checks use `concepts.json`, an editable vocabulary for numerical claims, materials, project metadata, required deliverables and standard editions. Numerical examples include `Span length shall be 30 m`, `Deck width minimum 8000 mm`, and `Design speed maximum 60 km/h`. Recognized units are converted before comparison. Use `--concepts custom.json` to supply another vocabulary with the same structure. Explicit rules can express class filters, applicability conditions and multiple required properties; see `rules.py` for predicates.

This is a deterministic property checker, not a general interpretation of all document content. Conditional numeric statements are left for manual review. Tables, geometry, drawing dimensions, image content and arbitrary prose are not automatically understood. IFC checks use property and quantity sets, including inherited properties; named unit suffixes such as `DeckWidth_m` supply units. Native IFC unit declarations are not yet used. Missing comparable properties are unverified, not proof of compliance. A document marked reviewed means supported claims were checked; it does not certify the rest of the document. Conflicting documents remain separate findings without choosing which source governs.

Exit codes: 0 means the run completed (inspect coverage and warnings); 2 means a fatal input/dependency/output error. With `--fail-on-issues`, detected violations, missing values and superseded editions produce exit code 1. Unverified checks remain review items.

Tests:

```sh
.venv/bin/python -m pytest incomplete/tests -q
```
