"""Recover ruled multi-column table geometry; never rewrite source text."""
import json
import sys
from contextlib import redirect_stdout
import pymupdf

document = pymupdf.open(sys.argv[1])
pages = {}
for number, page in enumerate(document):
    # Dense sequencing/inspection matrices are not readable in horizontal
    # line order. Leave simple two/three-column numeric tables unchanged.
    paths = page.get_drawings()
    vertical, horizontal = set(), set()
    for path in paths:
        for item in path['items']:
            if item[0] == 'l':
                a, b = item[1:3]
                if abs(a.x - b.x) < 1 and abs(a.y - b.y) > 30:
                    vertical.add(round(a.x))
                if abs(a.y - b.y) < 1 and abs(a.x - b.x) > 40:
                    horizontal.add(round(a.y))
            elif item[0] == 're':
                r = item[1]
                if r.height > 30:
                    vertical.update((round(r.x0), round(r.x1)))
                if r.width > 40:
                    horizontal.update((round(r.y0), round(r.y1)))
    if len(vertical) < 6 or len(horizontal) < 3 or len(paths) > 3000:
        continue
    with redirect_stdout(sys.stderr):
        tables = page.find_tables(paths=paths).tables
    found = []
    for table in tables:
        if table.col_count < 6 or table.row_count < 2:
            continue
        rows = [[list(cell) if cell else None for cell in row.cells] for row in table.rows]
        found.append({'rect': list(table.bbox), 'rows': rows})
    if found:
        pages[str(number)] = found
sys.stdout.buffer.write(json.dumps(pages).encode('utf-8'))
