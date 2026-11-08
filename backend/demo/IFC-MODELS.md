# Conceptual IFC models

Parkview Exchange and North Ridge each include an IFC4 model, a structured property extract, and a searchable PDF model register. These are fictional project artifacts, issued for review, with no construction approval or professional authentication.

## Use

Open the project and locate **IFC model register** under Supporting materials. Open the register to inspect its object properties, GlobalIds and source traces. **IFC** beside the document, or **Download IFC** inside it, downloads the original model for an external IFC viewer/CAD application. basis currently displays the register, not an interactive 3D scene.

Queries run against the extracted register through the existing project-scoped retrieval and PDF-highlight pipeline. Examples:

- Parkview: `What is the nominal pipe diameter of IFC object S1?`
- Parkview: `What is the cover of IFC object ST1 at chainage 0+018?`
- Parkview: `What is the vertical clearance at IFC crossing X1?`
- North Ridge: `What is the thickness of IFC object PAV-ACP?`
- North Ridge: `What is the design speed of IFC object RD-EB?`

Each project includes a completed extractive IFC-property query in history. Search citations point to register pages extracted from the actual IFC properties; each page preserves its IFC GlobalId and the originating project drawing/report reference. They are model evidence, not independent governing requirements. Regulatory checks still use original standards.

## Contents and limitations

**Parkview:** six named solids: S1 upstream sanitary branch, ST1 terminal storm reach, S2 service at X1, W1 watermain, local finished-grade patch and building envelope. The 0.220 m X1 clearance is represented geometrically. Pipe walls and fittings are unresolved. S2's 200 mm envelope, building height and envelope dimensions, and patch extent are explicitly visualization assumptions.

**North Ridge:** seven named solids: eastbound/westbound through lanes, two shoulders, trial asphalt/base layers and illustrative north access. Roadway geometry follows the documented 250 m crest curve. Through lanes are 3.5 m; trial layers are 110/250 mm. No swept-path, HCM, ESAL adequacy or approved design exception is represented. Access geometry is illustrative. The 2 mm road-surface envelope is a display skin, not a designed pavement layer.

Both use metre units, local engineering coordinates and a 670.000 m vertical datum. They are not georeferenced or certified surveys. GlobalIds are stable across regeneration. Official standards are not embedded or modified.

## Implementation

- `output/models/*.ifc`: original STEP/IFC files, preserved byte-for-byte by Git attributes.
- `output/models/*.json`: object descriptions/property sets extracted back from the actual IFC.
- `output/pdf/*-ifc-register.pdf`: readable registers generated from those extracts, after verifying the IFC checksum.
- `model-documents.mjs`: register/model associations and SHA-256 identities.
- Models and registers restore from tracked originals on startup/reset. The model download route validates the active project's document association and owner. Models remain outside publicly hosted frontend assets.
- `/v1/projects/:projectId/documents/:registerId/model` downloads the associated IFC. The document DTO supplies `model`; the gateway rewrites it like `file` and preserves the download filename. No new retrieval engine or inference service is required.
- This covers the two prepared IFCs. General user IFC import and live model editing are not implemented.

## Regenerate and verify

Optional authoring requirements are in `requirements-models.txt`; they are not required to launch the shipped backend. Use a Python environment containing those packages:

```powershell
python demo/build-ifc-models.py
python demo/build-model-registers.py
python tests/ifc-models.py
```

The IFC generator validates schema and EXPRESS rules, then meshes every solid before extracting properties. Tests independently check source pages, GlobalIds, properties, clearance, lane widths and crest elevation. `tests/ifc.integration.mjs` tests actual scoped downloads and fresh object queries on isolated ports 8840/8842. `tests/ifc.browser.mjs` verifies both download controls, register display and highlighted completed queries; it also supports read-only production verification through `BASIS_FRONTEND_URL`.
