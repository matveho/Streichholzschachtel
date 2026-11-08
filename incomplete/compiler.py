"""Conservative, vocabulary-based claim extraction; unsupported prose stays unreviewed."""
import hashlib
import json
import re
from pathlib import Path

from .rules import Rule, Source
from .units import unit_info

NUMBER = r"[-+]?\d+(?:\.\d+)?"
UNIT = r"km/h|kph|mm|cm|km|m|%|percent|MPa|kPa|years?"


def load_concepts(path=None):
    return json.loads(Path(path or Path(__file__).with_name('concepts.json')).read_text())['concepts']


def compile_document(doc, concepts):
    rules = []
    for page, text in enumerate(doc.pages, 1):
        # Keep sentence context: never borrow a threshold from another sentence.
        for sentence in re.split(r'(?<=[.;!?])\s+|[\r\n]+', text):
            for concept in concepts:
                kind = concept['kind']
                matches = []
                if kind == 'numeric':
                    aliases = '|'.join(re.escape(a) for a in sorted(concept['aliases'], key=len, reverse=True))
                    pattern = rf'\b(?:{aliases})\b(?P<gap>[^.;!?\d]{{0,55}})(?P<v>{NUMBER})\s*(?P<unit>{UNIT})?(?!\w)'
                    matches = list(re.finditer(pattern, sentence, re.I))
                else:
                    matches = list(re.finditer(concept['regex'], sentence, 0 if kind in ('edition', 'categorical') else re.I))
                for match in matches:
                    excerpt = sentence.strip()
                    source = Source(doc.folder, doc.rel, page, doc.locate(page, excerpt), excerpt, concept['label'], doc.kind != 'pdf' or bool(doc.locate(page, excerpt)))
                    identity = f'{doc.rel}:{page}:{concept["id"]}:{match.start()}:{excerpt}'
                    base = dict(id=hashlib.sha256(identity.encode()).hexdigest()[:16], source=source)
                    mapping = concept.get('ifc', {})
                    key = '|'.join(mapping.get('properties', []))
                    classes = mapping.get('classes', [])
                    if kind == 'numeric':
                        unit = match['unit']
                        if not concept.get('unitless') and (not unit_info(unit) or unit_info(unit)[0] != concept.get('dimension')):
                            continue
                        # Conditional and qualified statements need explicit rules.
                        if re.search(r'\b(if|unless|depending|subject to|approximately|about|between|not equal|less than|more than)\b', sentence, re.I):
                            continue
                        gap = match['gap'].lower()
                        prefix = sentence[max(0, match.start()-20):match.start()].lower() + gap
                        op = 'min' if re.search(r'minimum|at least|not less than|>=|≥', prefix) else 'max' if re.search(r'maximum|at most|not more than|<=|≤', prefix) else 'eq'
                        pred = {op: float(match['v'])}
                        if unit:
                            pred['unit'] = unit
                        rules.append(Rule(**base, classes=classes, require={key: pred}))
                    elif kind == 'categorical':
                        value = match['v']
                        pred = {'regex': re.escape(value)} if concept.get('mode') == 'contains' else {'eq': value}
                        rules.append(Rule(**base, classes=classes, require={key: pred}))
                    elif kind == 'set':
                        rules.append(Rule(**base, classes=classes, require={key: {'contains_all': re.findall(concept['token_regex'], match[0])}}))
                    elif kind == 'rule':
                        for i, spec in enumerate(concept['rules']):
                            rules.append(Rule(**{**base, 'id': base['id'] + f'-{i}'}, **spec))
                    elif kind == 'edition':
                        rules.append(Rule(**base, edition={'aliases': [match['subject']], 'version': match['ver'], 'label': match['ver']}))
    return rules
