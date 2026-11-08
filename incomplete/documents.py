"""Load project documents (PDF, txt, md) and locate text on PDF pages.

Regions use the same convention as the Basis backend: one-based page, and
[left, top, width, height] in PDF points measured from the top-left corner.
"""
import re
from pathlib import Path

import pymupdf

_ZW = dict.fromkeys(map(ord, "\u200b\u200c\u200d\ufeff"), None)


def clean(s):
    return re.sub(r"\s+", " ", s.translate(_ZW).replace("\xa0", " ")).strip()


def _loose(tok):
    return re.sub(r"\W", "", tok.lower())


class Document:
    def __init__(self, path, root, folder):
        self.path = Path(path)
        self.rel = str(self.path.relative_to(root))
        self.folder = folder
        self.kind = "pdf" if self.path.suffix.lower() == ".pdf" else "text"
        self._pdf = pymupdf.open(str(self.path)) if self.kind == "pdf" else None
        self._pages = None
        self._words = {}

    @property
    def page_count(self):
        return len(self._pdf) if self._pdf else 1

    @property
    def pages(self):
        """Cleaned text of every page (index 0 = page 1)."""
        if self._pages is None:
            if self._pdf:
                self._pages = [clean(p.get_text("text")) for p in self._pdf]
            else:
                self._pages = [clean(self.path.read_text(encoding="utf-8", errors="replace"))]
        return self._pages

    def head_text(self, n=3):
        if self._pdf:
            return " ".join(clean(self._pdf[i].get_text("text")) for i in range(min(n, len(self._pdf))))
        return self.pages[0]

    @property
    def has_text(self):
        return any(len(p) > 20 for p in self.pages)

    def _page_words(self, page):
        if page not in self._words:
            if not self._pdf or not 1 <= page <= len(self._pdf):
                self._words[page] = []
            else:
                out = []
                for x0, y0, x1, y1, w, *_ in self._pdf[page - 1].get_text("words"):
                    lw = _loose(clean(w))
                    if lw:
                        out.append((lw, x0, y0, x1, y1))
                self._words[page] = out
        return self._words[page]

    def locate(self, page, phrase):
        """Regions covering `phrase` on `page`, one rectangle per text line; [] if not found."""
        toks = [t for t in (_loose(t) for t in clean(phrase).split()) if t]
        words = self._page_words(page)
        if not toks:
            return []
        for i in range(len(words) - len(toks) + 1):
            if all(words[i + j][0] == toks[j] for j in range(len(toks))):
                return _merge_lines(words[i:i + len(toks)])
        return []

    def find(self, phrase, hint=None):
        """(page, regions) of the first page containing `phrase`; tries `hint` first."""
        order = ([hint] if hint else []) + [p for p in range(1, self.page_count + 1) if p != hint]
        for p in order:
            if p and 1 <= p <= self.page_count:
                regions = self.locate(p, phrase)
                if regions:
                    return p, regions
        return None


def _merge_lines(words):
    lines = []
    for _, x0, y0, x1, y1 in words:
        if lines and abs(lines[-1][1] - y0) < 3:
            ln = lines[-1]
            ln[0], ln[2] = min(ln[0], x0), max(ln[2], x1)
            ln[1], ln[3] = min(ln[1], y0), max(ln[3], y1)
        else:
            lines.append([x0, y0, x1, y1])
    return [[round(a, 1), round(b, 1), round(c - a, 1), round(d - b, 1)] for a, b, c, d in lines]
