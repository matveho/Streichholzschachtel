"""Deterministic rule engine. No model decides pass or fail: rules (hand-written or compiled
from document claims) are evaluated against IFC facts.

Rule shape
  classes     IFC classes the rule applies to (subclasses included); [] means any element
  when        {property: predicate}; the rule applies only if all hold ('A|B' = any alternative)
  require     {property: predicate}; all must hold
  require_any [{property: predicate}, ...]; at least one alternative must hold
Predicates (all given keys must hold): eq ne min max gt lt between in not_in regex
  not_regex contains_all present. Numeric thresholds may carry "unit"; with a unit on both
  sides values are compared after conversion, otherwise as stored in the model.
"""
import math
import re
from dataclasses import dataclass, field

from .units import fmt, unit_info, with_unit

NUMERIC = {"eq", "ne", "min", "max", "gt", "lt", "between"}


@dataclass
class Source:
    folder: str
    file: str
    page: int | None
    regions: list
    excerpt: str
    label: str
    anchor_verified: bool = True


@dataclass
class Rule:
    id: str
    source: Source
    classes: list = field(default_factory=list)
    when: dict = field(default_factory=dict)
    require: dict = field(default_factory=dict)
    require_any: list = field(default_factory=list)
    severity: str | None = None
    kind: str | None = None
    message: str | None = None
    group_missing: bool = False      # report absent properties once per rule, not per element
    edition: dict | None = None      # edition rules use a dedicated check
    verb: str = "requires"


@dataclass
class Finding:
    rule: Rule
    status: str                      # violation | missing | unverified
    element: object
    key: str
    actual: str
    expected: str
    extra: list = field(default_factory=list)   # further elements sharing an 'unverified' finding


@dataclass
class Result:
    findings: list = field(default_factory=list)
    checked: int = 0
    passed: int = 0


# ---------- predicates ----------

def _to_float(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).strip().replace(",", "."))
    except ValueError:
        return None


def _pair(fact, threshold, unit):
    """(actual, threshold) as comparable floats, or (None, None)."""
    a = _to_float(fact.value if fact.dimension else fact.raw)
    t = _to_float(threshold)
    if a is None or t is None:
        return None, None
    info = unit_info(unit)
    if info and fact.dimension == info[0]:
        return a, t * info[1]                    # a is already canonical
    if fact.dimension:                           # no usable pred unit: compare as stored
        a = _to_float(fact.raw)
    return a, t


def _check(key, v, pred, fact):
    unit = pred.get("unit")
    raw = fact.raw
    if key in NUMERIC:
        if isinstance(raw, bool):
            return (raw == bool(v)) if key == "eq" else (raw != bool(v)) if key == "ne" else False
        if key == "between":
            lo, hi = v
            a, l = _pair(fact, lo, unit)
            _, h = _pair(fact, hi, unit)
            return a is not None and l <= a <= h
        a, t = _pair(fact, v, unit)
        if a is None:
            if key in ("eq", "ne"):
                same = str(raw).strip().lower() == str(v).strip().lower()
                return same if key == "eq" else not same
            return False
        tol = pred.get("tol", 0)
        return {
            "eq": math.isclose(a, t, rel_tol=1e-9, abs_tol=max(1e-9, tol)),
            "ne": not math.isclose(a, t, rel_tol=1e-9, abs_tol=max(1e-9, tol)),
            "min": a >= t - 1e-9, "max": a <= t + 1e-9, "gt": a > t, "lt": a < t,
        }[key]
    s = str(raw)
    if key == "in":
        return s.strip().lower() in [str(x).strip().lower() for x in v] or _to_float(raw) in [_to_float(x) for x in v if _to_float(x) is not None]
    if key == "not_in":
        return not _check("in", v, pred, fact)
    if key == "regex":
        return re.search(v, s, re.I) is not None
    if key == "not_regex":
        return re.search(v, s, re.I) is None
    if key == "contains_all":
        return all(re.search(rf"(?<![\w.]){re.escape(str(t))}(?![\w])", s, re.I) for t in v)
    if key == "present":
        return bool(v)
    return True


def eval_pred(pred, fact):
    return all(_check(k, v, pred, fact) for k, v in pred.items() if k not in ("unit", "tol"))


def describe(pred):
    u = f" {pred['unit']}" if pred.get("unit") else ""
    out = []
    for k, v in pred.items():
        if k in ("unit", "tol"):
            continue
        out.append({
            "eq": f"= {fmt(v)}{u}", "ne": f"≠ {fmt(v)}{u}", "min": f"≥ {fmt(v)}{u}", "max": f"≤ {fmt(v)}{u}",
            "gt": f"> {fmt(v)}{u}", "lt": f"< {fmt(v)}{u}",
            "between": f"between {v[0] if k == 'between' else ''} and {v[1] if k == 'between' else ''}{u}",
            "in": f"one of {', '.join(map(str, v)) if k == 'in' else ''}{u}",
            "not_in": f"none of {', '.join(map(str, v)) if k == 'not_in' else ''}",
            "regex": f"matching /{v}/", "not_regex": f"not matching /{v}/",
            "contains_all": f"all of {', '.join(map(str, v)) if k == 'contains_all' else ''}",
            "present": "a value" if v else "no value",
        }[k])
    return " and ".join(out)


def show(fact):
    if fact.unit and isinstance(fact.raw, (int, float)) and not isinstance(fact.raw, bool):
        return with_unit(fact.raw, fact.unit)
    return fmt(fact.raw)


# ---------- evaluation ----------

def _applies(rule, el):
    if rule.classes and not any(el.is_a(c) for c in rule.classes):
        return False
    for key, pred in rule.when.items():
        facts = el.get_all(key)
        if not facts:
            if pred.get("present") is False:
                continue
            return False
        if not any(eval_pred(pred, f) for f in facts):
            return False
    return True


def evaluate(rule, model):
    if rule.edition:
        return _evaluate_edition(rule, model)
    res = Result()
    applicable = [e for e in model.elements if _applies(rule, e)]
    unverified = []
    evaluated_any = False
    for el in applicable:
        failures = []
        absent = []
        for key, pred in rule.require.items():
            fact = el.get(key)
            if fact is None:
                if pred.get("present") is False:
                    continue
                if pred.get("present") is True:
                    failures.append(("missing", key, None, pred))
                else:
                    absent.append(key)
            elif not eval_pred(pred, fact):
                failures.append(("violation", key, fact, pred))
        if rule.require_any:
            ok, seen = False, False
            for alt in rule.require_any:
                alt_ok = True
                for key, pred in alt.items():
                    fact = el.get(key)
                    if fact is None:
                        alt_ok = False
                    else:
                        seen = True
                        alt_ok = alt_ok and eval_pred(pred, fact)
                ok = ok or alt_ok
            if not ok:
                if seen:
                    desc = " or ".join(" and ".join(f"{k} {describe(p)}" for k, p in alt.items()) for alt in rule.require_any)
                    failures.append(("violation", "|".join(k for alt in rule.require_any for k in alt), None, {"_text": desc}))
                else:
                    absent.append("|".join(k for alt in rule.require_any for k in alt))
        if absent and not failures and len(absent) == len(rule.require) + (1 if rule.require_any else 0):
            unverified.append((el, absent[0]))
            continue
        res.checked += 1
        evaluated_any = True
        if not failures:
            res.passed += 1
        for status, key, fact, pred in failures:
            actual = "no value" if fact is None else show(fact)
            expected = pred.get("_text") or describe(pred)
            res.findings.append(Finding(rule, status, el, key, actual, expected))
    if unverified and (not evaluated_any or not rule.group_missing):
        if rule.classes or rule.when:
            keys = ", ".join(sorted({k for _, k in unverified}))
            res.findings.append(Finding(rule, "unverified", unverified[0][0], keys, "not in the model",
                                        "; ".join(f"{k} {describe(p)}" for k, p in rule.require.items())))
            res.findings[-1].extra = [el for el, _ in unverified]
    return res


_VERSION = re.compile(r"(?<![A-Za-z])(?:v|version)\s*0*(\d+(?:\.\d+)?)", re.I)


def _evaluate_edition(rule, model):
    ed = rule.edition
    res = Result()
    for el in model.elements:
        for fact in el.facts.values():
            if not isinstance(fact.raw, str):
                continue
            text = fact.raw.lower()
            named = any(a.lower() in text for a in ed.get("aliases", []))
            words = ed.get("words", [])
            overlap = sum(1 for w in words if re.search(rf"\b{re.escape(w)}\b", text))
            if not (named or (words and overlap >= min(3, len(words)))):
                continue
            m = _VERSION.search(fact.raw)
            if not m:
                continue
            res.checked += 1
            actual, wanted = float(m.group(1)), float(ed["version"])
            if math.isclose(actual, wanted):
                res.passed += 1
                continue
            status = "superseded" if actual < wanted else "violation"
            res.findings.append(Finding(rule, status, el, fact.name, fact.raw, f"edition {ed['label']}"))
    return res
