from pathlib import Path
from types import SimpleNamespace

from incomplete.cli import CATEGORIES, review, write_reports
from incomplete.compiler import compile_document, load_concepts
from incomplete.documents import Document
from incomplete.rules import Rule, Source, evaluate

REPO = Path(__file__).resolve().parents[2]
MODEL = REPO / 'backend/IFC/Willow_Creek_Bridge_Renewal.ifc'


def test_full_review(tmp_path):
    for folder in CATEGORIES:
        directory = tmp_path / folder
        directory.mkdir()
        (directory / 'brief.md').write_text('Span length shall be 30 m. Steel girders. Deck width minimum 8 m.')
    (tmp_path / 'design' / 'nested').mkdir()
    (tmp_path / 'design' / 'nested' / 'unhandled.dwg').write_text('drawing')
    (tmp_path / 'supporting materials' / 'notes.txt').write_text('This needs an engineer to interpret it.')
    report = review(tmp_path, [MODEL])
    assert len(report['documents']) == 7
    assert {i['source']['folder'] for i in report['issues']} == set(CATEGORIES)
    assert any(i.get('actual') == '27.5 m' and i['status'] == 'violation' for i in report['issues'])
    assert all(i['source']['excerpt'] for i in report['issues'])
    assert any(d['status'] == 'unsupported' for d in report['documents'])
    assert any(d['status'] == 'unreviewed' for d in report['documents'])
    write_reports(report, tmp_path / 'report')
    assert (tmp_path / 'report/issues.json').is_file()
    assert 'IFC document review' in (tmp_path / 'report/issues.html').read_text()


def test_extraction_and_units(tmp_path):
    path = tmp_path / 'brief.txt'
    path.write_text('Deck width minimum 8000 mm. Design speed shall be 60 km/h. If wet, deck width shall be 9 m.')
    doc = Document(path, tmp_path, 'design')
    rules = compile_document(doc, load_concepts())
    assert len(rules) == 2
    assert rules[0].require == {'DeckWidth': {'min': 8000.0, 'unit': 'mm'}}
    from incomplete.ifc_model import load_ifc
    result = evaluate(rules[0], load_ifc(MODEL))
    assert result.findings[0].status == 'violation'
    doc.close()


def test_partial_missing_is_not_passed():
    from incomplete.ifc_model import make_fact
    class Element:
        def get(self, key):
            return make_fact('Width_m', 8) if key == 'Width' else None
    rule = Rule('test', Source('design', 'file', 1, [], 'text', 'label'), require={'Width': {'min': 7}, 'Height': {'min': 2}})
    result = evaluate(rule, SimpleNamespace(elements=[Element()]))
    assert result.passed == 0
    assert result.findings[0].status == 'unverified'


def test_pdf_citations(tmp_path):
    import pymupdf
    path = tmp_path / 'requirements.pdf'
    with pymupdf.open() as pdf:
        page = pdf.new_page()
        page.insert_text((72, 72), 'Span length shall be 30 m.')
        pdf.save(path)
    doc = Document(path, tmp_path, 'client requirements')
    rules = compile_document(doc, load_concepts())
    assert rules[0].source.page == 1
    assert rules[0].source.regions
    assert rules[0].source.anchor_verified
    doc.close()


def test_missing_folders_and_multiple_models(tmp_path):
    import shutil
    shutil.copyfile(MODEL, tmp_path / 'first.ifc')
    shutil.copyfile(MODEL, tmp_path / 'second.ifc')
    (tmp_path / 'Client_Requirements').mkdir()
    (tmp_path / 'Client_Requirements/brief.txt').write_text('Span length shall be 30 m.')
    report = review(tmp_path)
    assert len(report['models']) == 2
    assert len(report['documents'][0]['comparisons']) == 2
    assert len(report['warnings']) == 4
