"""Unit handling. Property names carry their unit as a suffix (Slope_percent, Diameter_mm)."""
import re

# unit -> (dimension, factor to the canonical unit of that dimension)
FACTORS = {
    "mm": ("length", 0.001), "cm": ("length", 0.01), "m": ("length", 1.0), "km": ("length", 1000.0),
    "kph": ("speed", 1.0), "km/h": ("speed", 1.0),
    "percent": ("percent", 1.0), "%": ("percent", 1.0),
    "kpa": ("pressure", 1.0), "mpa": ("pressure", 1000.0),
    "year": ("time", 1.0), "years": ("time", 1.0),
}
_SUFFIX = re.compile(r"^(?P<base>.+?)_(?P<unit>mm|cm|m|km|kph|percent|kpa|mpa|years?)$", re.I)


def unit_info(unit):
    return FACTORS.get(unit.lower()) if unit else None


def split_suffix(name):
    m = _SUFFIX.match(name)
    return (m["base"], m["unit"].lower()) if m else (name, None)


def norm(name):
    """Normalised property key: unit suffix removed, lowercase alphanumerics only."""
    return re.sub(r"[^a-z0-9]", "", split_suffix(name)[0].lower())


def fmt(v):
    if isinstance(v, bool):
        return "yes" if v else "no"
    if isinstance(v, float):
        return f"{v:.6g}"
    return str(v)


def with_unit(v, unit):
    if not unit:
        return fmt(v)
    u = {"percent": "%", "kph": "km/h"}.get(unit.lower(), unit)
    return f"{fmt(v)} {u}"
