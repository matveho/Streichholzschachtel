"""Review every discovered document against every selected IFC model."""
import argparse
from collections import Counter
from dataclasses import asdict
from datetime import datetime, timezone
from html import escape
import json
from pathlib import Path
import re
import sys

CATEGORIES = ('reference', 'client requirements', 'design', 'technical reports', 'supporting materials')
ALIASES = {'references': 'reference', 'client requirement': 'client requirements', 'technical report': 'technical reports', 'supporting material': 'supporting materials'}
SUPPORTED = {'.pdf', '.txt', '.md'}


def category(name):
    name = re.sub(r'[_-]+', ' ', name.lower()).strip()
    return ALIASES.get(name, name)


def review(root, ifcs=None, concepts_path=None):
    from .compiler import compile_document, load_concepts
    from .documents import Document
    from .ifc_model import load_ifc
    from .rules import evaluate

    root = Path(root).resolve()
    if not root.is_dir():
        raise ValueError(f'Project folder does not exist: {root}')
    concepts = load_concepts(concepts_path)
    paths = sorted({Path(p).resolve() for p in ifcs}) if ifcs else sorted(p for p in root.rglob('*') if p.suffix.lower() == '.ifc' and p.is_file())
    if not paths:
        raise ValueError('No IFC files found. Place IFC models in the project or use --ifc PATH.')
    report = {'schema_version': 1, 'created_at': datetime.now(timezone.utc).isoformat(), 'root': str(root), 'models': [], 'documents': [], 'issues': [], 'warnings': [], 'folders': {c: {'files': 0} for c in CATEGORIES}}
    models = []
    for path in paths:
        try:
            model = load_ifc(path, root if path.is_relative_to(root) else None)
            models.append(model)
            report['models'].append({'file': model.rel, 'elements': len(model.elements)})
        except Exception as exc:
            report['warnings'].append(f'Cannot read IFC {path}: {exc}')
    if not models:
        raise ValueError('None of the IFC files could be read: ' + '; '.join(report['warnings']))
    found = set()
    for folder in sorted(root.iterdir()):
        cat = category(folder.name)
        if not folder.is_dir() or cat not in CATEGORIES:
            continue
        found.add(cat)
        for path in sorted(folder.rglob('*')):
            if not path.is_file():
                continue
            report['folders'][cat]['files'] += 1
            entry = {'file': str(path.relative_to(root)), 'folder': cat, 'comparisons': []}
            report['documents'].append(entry)
            if path.suffix.lower() not in SUPPORTED:
                entry.update(status='unsupported', reason='Supported formats: PDF, TXT, MD')
                continue
            doc = None
            try:
                doc = Document(path, root, cat)
                rules = compile_document(doc, concepts)
                entry.update(status='reviewed' if rules else 'unreviewed', rules=len(rules), pages=doc.page_count)
                if not doc.has_text:
                    entry.update(status='unreadable', reason='No extractable text; scanned PDFs require OCR')
                elif not rules:
                    entry['reason'] = 'No supported claims found; manual review required'
                for model in models:
                    checked = passed = issue_count = 0
                    for rule in rules:
                        result = evaluate(rule, model)
                        checked += result.checked
                        passed += result.passed
                        if result.checked == 0 and not result.findings:
                            report['issues'].append({'model': model.rel, 'status': 'unverified', 'rule_id': rule.id, 'source': asdict(rule.source), 'message': 'No applicable IFC elements or comparable properties found', 'element': None})
                            issue_count += 1
                        for finding in result.findings:
                            issue_count += 1
                            report['issues'].append({'model': model.rel, 'rule_id': rule.id, 'status': finding.status, 'severity': rule.severity or ('review' if finding.status == 'unverified' else 'medium'), 'source': asdict(rule.source), 'element': {'guid': finding.element.guid, 'name': finding.element.name, 'class': finding.element.ifc_class}, 'additional_elements': [e.guid for e in finding.extra], 'property': finding.key, 'actual': finding.actual, 'expected': finding.expected, 'message': f'{rule.source.label}: {finding.actual}; expected {finding.expected}'})
                    entry['comparisons'].append({'model': model.rel, 'checked': checked, 'passed': passed, 'issues': issue_count})
            except Exception as exc:
                entry.update(status='error', reason=str(exc))
            finally:
                if doc:
                    doc.close()
    for cat in CATEGORIES:
        if cat not in found:
            report['warnings'].append(f'Missing folder: {cat}')
        elif report['folders'][cat]['files'] == 0:
            report['warnings'].append(f'Empty folder: {cat}')
    report['summary'] = {'models': len(models), 'documents': len(report['documents']), 'issues': len(report['issues']), 'by_status': dict(Counter(i['status'] for i in report['issues'])), 'document_status': dict(Counter(d['status'] for d in report['documents']))}
    return report


def write_reports(report, output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    (output / 'issues.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    esc = lambda value: escape(str(value))
    sections = []
    for cat in CATEGORIES:
        rows = []
        for issue in report['issues']:
            source = issue['source']
            if source['folder'] != cat:
                continue
            el = issue.get('element') or {}
            rows.append('<tr>' + ''.join(f'<td>{esc(v)}</td>' for v in (issue['status'], issue['model'], el.get('name', '—'), el.get('guid', '—'), issue['message'], f"{source['file']} · page {source['page']}", source['excerpt'])) + '</tr>')
        coverage = ''.join(f"<li>{esc(d['file'])}: {esc(d['status'])} — {esc(d.get('reason', str(d.get('rules', 0)) + ' extracted rules'))}</li>" for d in report['documents'] if d['folder'] == cat)
        sections.append(f'<h2>{esc(cat.title())}</h2><ul>{coverage}</ul><table><thead><tr><th>Status</th><th>IFC</th><th>Element</th><th>GUID</th><th>Issue</th><th>Source</th><th>Evidence</th></tr></thead><tbody>{"".join(rows)}</tbody></table>')
    warnings = ''.join(f'<li>{esc(w)}</li>' for w in report['warnings'])
    html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>IFC document review</title><style>body{font:15px system-ui;margin:32px;color:#162c36}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:10px;border:1px solid #ccc;text-align:left;overflow-wrap:anywhere}th{background:#edf3f4}h2{margin-top:36px}</style><h1>IFC document review</h1><p>Vocabulary-based property checks. Unreviewed content and unverified checks require manual review. This report does not certify compliance or compare drawing geometry.</p><p>' + esc(json.dumps(report['summary'])) + '</p><ul>' + warnings + '</ul>' + ''.join(sections) + '</html>'
    (output / 'issues.html').write_text(html, encoding='utf-8')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project', type=Path, help='Project containing the five document folders and IFC models')
    parser.add_argument('--ifc', action='append', type=Path, help='Specific IFC model; repeat for multiple models')
    parser.add_argument('--concepts', type=Path, help='Custom concept vocabulary JSON')
    parser.add_argument('--output', type=Path, default=Path('ifc-review'), help='Output directory (default: ifc-review)')
    parser.add_argument('--fail-on-issues', action='store_true', help='Exit 1 on mismatches, missing values, or superseded editions')
    args = parser.parse_args(argv)
    try:
        report = review(args.project, args.ifc, args.concepts)
        write_reports(report, args.output)
    except (ValueError, OSError, ImportError) as exc:
        print(f'Review failed: {exc}', file=sys.stderr)
        return 2
    print(json.dumps(report['summary'], indent=2))
    print(f'Reports: {args.output.resolve() / "issues.html"} and issues.json')
    return 1 if args.fail_on_issues and any(i['status'] != 'unverified' for i in report['issues']) else 0
