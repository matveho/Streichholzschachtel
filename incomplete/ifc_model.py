"""Read an IFC file into flat, unit-aware facts (one fact per property)."""
from dataclasses import dataclass, field
from pathlib import Path

import ifcopenshell
import ifcopenshell.util.element as E

from .units import norm, split_suffix, unit_info


@dataclass
class Fact:
    name: str            # original property name
    key: str             # normalised key
    raw: object          # value as stored
    unit: str | None     # unit from the name suffix
    dimension: str | None
    value: object        # canonical numeric value (raw for text and booleans)


@dataclass
class Element:
    guid: str
    name: str
    ifc_class: str
    entity: object
    facts: dict = field(default_factory=dict)

    def is_a(self, cls):
        try:
            return bool(self.entity.is_a(cls))
        except Exception:
            return False

    def get(self, spec):
        """First fact matching one of the 'A|B' alternatives, or None."""
        for alt in spec.split("|"):
            f = self.facts.get(norm(alt))
            if f is not None:
                return f
        return None

    def get_all(self, spec):
        return [f for alt in spec.split("|") if (f := self.facts.get(norm(alt))) is not None]


@dataclass
class IfcModel:
    path: Path
    rel: str
    elements: list


def make_fact(name, raw):
    _, unit = split_suffix(name)
    info = unit_info(unit)
    if isinstance(raw, bool) or not isinstance(raw, (int, float)):
        return Fact(name, norm(name), raw, unit, None, raw)
    if info:
        return Fact(name, norm(name), raw, unit, info[0], raw * info[1])
    return Fact(name, norm(name), raw, unit, None, raw)


def load_ifc(path, root=None):
    path = Path(path)
    f = ifcopenshell.open(str(path))
    elements = []
    for ent in f.by_type("IfcProduct"):
        el = Element(ent.GlobalId, ent.Name or ent.GlobalId, ent.is_a(), ent)
        for props in E.get_psets(ent).values():
            for k, v in props.items():
                if k == "id" or v is None:
                    continue
                fact = make_fact(k, v)
                el.facts.setdefault(fact.key, fact)
        elements.append(el)
    rel = str(path.relative_to(root)) if root else path.name
    return IfcModel(path, rel, elements)
