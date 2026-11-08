"""Rebuild the synthetic QA models and PDFs. Requires backend/requirements.txt."""
from pathlib import Path
import json
import uuid
import pymupdf

ROOT = Path(__file__).resolve().parent
ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$'

def guid(name):
    value = uuid.uuid5(uuid.NAMESPACE_URL, 'basis/ifc-contradictions/' + name).int
    result = ''
    for _ in range(22):
        result = ALPHABET[value % 64] + result
        value //= 64
    return result

def model(contradictory):
    entities = []
    def add(value):
        entities.append(f'#{len(entities) + 1}={value};')
        return f'#{len(entities)}'
    unit = add('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)')
    units = add(f'IFCUNITASSIGNMENT(({unit}))')
    project = add(f"IFCPROJECT('{guid('project')}',$,'Synthetic contradiction QA',$,$,$,$,$,{units})")
    elements = []
    values = [
        ('R1', [('DesignSpeed_kph', 60 if contradictory else 40), ('Length_m', 100)]),
        ('S1', [('NominalPipeDiameter_mm', 200 if contradictory else 250), ('Length_m', 35 if contradictory else 43)]),
        ('D1', [('Width_m', 0.9 if contradictory else 1.2)]),
    ]
    for name, properties in values:
        element = add(f"IFCBUILDINGELEMENTPROXY('{guid(name)}',$,'{name}',$,$,$,$,'{name}',.NOTDEFINED.)")
        elements.append(element)
        refs = [add(f"IFCPROPERTYSINGLEVALUE('{key}',$,IFCREAL({float(value)}),$)") for key, value in properties]
        pset = add(f"IFCPROPERTYSET('{guid(name + '/properties')}',$,'QA_DesignValues',$,({','.join(refs)}))")
        add(f"IFCRELDEFINESBYPROPERTIES('{guid(name + '/relation')}',$,$,$,({element}),{pset})")
    add(f"IFCRELAGGREGATES('{guid('aggregation')}',$,$,$,{project},({','.join(elements)}))")
    return "\n".join([
        'ISO-10303-21;', 'HEADER;',
        "FILE_DESCRIPTION(('Synthetic property comparison QA; no geometry'),'2;1');",
        "FILE_NAME('model.ifc','2026-11-08T00:00:00',('basis QA'),('Synthetic test fixture'),'basis','basis','');",
        "FILE_SCHEMA(('IFC4'));", 'ENDSEC;', 'DATA;', *entities, 'ENDSEC;', 'END-ISO-10303-21;', '',
    ])

sources = [
    ('reference', 'speed-standard.pdf', ['R1 maximum design speed: 50 km/h.']),
    ('client requirements', 'client-brief.pdf', ['S1 minimum nominal pipe diameter: 250 mm.']),
    ('design', 'pipe-schedule.pdf', ['Synthetic design package. Dimensional requirements are on page 2.', 'S1 length: 43 m.']),
    ('technical reports', 'access-review.pdf', ['D1 minimum width: 1.2 m.']),
    ('supporting materials', 'model-register.pdf', ['R1 design speed: 40 km/h. R1 length: 100 m.']),
    ('supporting materials', 'qualitative-review.pdf', ['Materials shall be appropriate for the intended environment.']),
]
for folder, name, pages in sources:
    target = ROOT / folder / name
    target.parent.mkdir(parents=True, exist_ok=True)
    pdf = pymupdf.open()
    for number, body in enumerate(pages, 1):
        page = pdf.new_page(width=612, height=792)
        page.insert_text((50, 65), 'SYNTHETIC QA ONLY - NOT A GOVERNING STANDARD', fontsize=10)
        page.insert_text((50, 95), name, fontsize=14)
        page.insert_textbox(pymupdf.Rect(50, 130, 562, 650), body, fontsize=12)
        page.insert_text((50, 750), f'Page {number}', fontsize=10)
    pdf.set_metadata({'title': name, 'author': 'basis synthetic QA', 'creationDate': 'D:20261108000000Z', 'modDate': 'D:20261108000000Z'})
    pdf.save(target, no_new_id=True)
    pdf.close()

(ROOT / 'models').mkdir(exist_ok=True)
for name, contradictory in [('contradictory.ifc', True), ('compliant.ifc', False)]:
    (ROOT / 'models' / name).write_text(model(contradictory), encoding='utf-8')

expected = [
    dict(category='reference', file='speed-standard.pdf', element='R1', property='DesignSpeed_kph', actual=60, expected=50, comparison='max', page=1),
    dict(category='client', file='client-brief.pdf', element='S1', property='NominalPipeDiameter_mm', actual=200, expected=250, comparison='min', page=1),
    dict(category='design', file='pipe-schedule.pdf', element='S1', property='Length_m', actual=35, expected=43, comparison='exact', page=2),
    dict(category='report', file='access-review.pdf', element='D1', property='Width_m', actual=0.9, expected=1.2, comparison='min', page=1),
    dict(category='supporting', file='model-register.pdf', element='R1', property='DesignSpeed_kph', actual=60, expected=40, comparison='exact', page=1),
]
(ROOT / 'expected.json').write_text(json.dumps(expected, indent=2) + '\n', encoding='utf-8')
print('Generated 2 IFC models, 6 PDFs, and expected.json')
