"""Extract original words and page geometry; stdout is machine-readable JSON."""
import json
import sys
import os
import csv
import io
import re
import shutil
import subprocess
from pathlib import Path
import pymupdf

doc = pymupdf.open(sys.argv[1])
tesseract = os.environ.get('TESSERACT_PATH') or shutil.which('tesseract')
if not tesseract and Path('C:/Program Files/Tesseract-OCR/tesseract.exe').is_file():
    tesseract = 'C:/Program Files/Tesseract-OCR/tesseract.exe'

def ocr_words(page):
    if not tesseract:
        raise RuntimeError('This PDF needs OCR. Install Tesseract or set TESSERACT_PATH.')
    dpi = 200
    image = page.get_pixmap(dpi=dpi, alpha=False)
    process = subprocess.run([tesseract, 'stdin', 'stdout', '-l', 'eng', '--psm', '3', '-c', 'tessedit_create_tsv=1'],
        input=image.tobytes('png'), capture_output=True, timeout=90,
        env={**os.environ, 'OMP_THREAD_LIMIT': '2'},
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    if process.returncode:
        raise RuntimeError('Local OCR failed for a PDF page.')
    reader = csv.DictReader(io.StringIO(process.stdout.decode('utf-8')), delimiter='\t')
    if not {'level', 'text', 'left', 'top', 'width', 'height', 'conf'}.issubset(reader.fieldnames or []):
        raise RuntimeError('Local OCR did not return the required TSV word geometry.')
    result = []
    for row in reader:
        if row.get('level') != '5' or not row.get('text', '').strip():
            continue
        x, y, width, height = [float(row[key]) * 72 / dpi for key in ['left', 'top', 'width', 'height']]
        result.append([x, y, x+width, y+height, row['text'], int(row['block_num']),
            int(row['par_num'])*1000+int(row['line_num']), float(row['conf'])])
    return result

UNIT_BEFORE_EXPONENT = re.compile(r'(?:^|[^A-Za-z])(?:mm|cm|km|m|ft)$')

def text_words(page):
    """Words with footnote superscripts split out as separate "[n]" markers.

    Plain text extraction merges a table value and its footnote reference
    ("0.7" + superscript "4" -> "0.74"). Unit exponents such as m3 stay attached.
    """
    words = []
    for block_no, block in enumerate(page.get_text('rawdict')['blocks']):
        if block.get('type') != 0:
            continue
        for line_no, line in enumerate(block['lines']):
            current = []
            def flush():
                if current:
                    text = ''.join(c['c'] for c in current)
                    if text.strip():
                        xs0 = [c['bbox'][0] for c in current]; ys0 = [c['bbox'][1] for c in current]
                        xs1 = [c['bbox'][2] for c in current]; ys1 = [c['bbox'][3] for c in current]
                        words.append([min(xs0), min(ys0), max(xs1), max(ys1), text, block_no, line_no, 100])
                    current.clear()
            for span in line['spans']:
                chars = span['chars']
                text = ''.join(c['c'] for c in chars).strip()
                footnote = (span['flags'] & 1 and re.fullmatch(r'\d{1,2}(?:,\d{1,2})*', text)
                            and not UNIT_BEFORE_EXPONENT.search(''.join(c['c'] for c in current)))
                if footnote:
                    flush()
                    marked = [c for c in chars if c['c'].strip()]
                    current.extend([{**marked[0], 'c': '['}, *marked, {**marked[-1], 'c': ']'}])
                    flush()
                    continue
                for c in chars:
                    if c['c'].isspace():
                        flush()
                    else:
                        current.append(c)
            flush()
    return words

pages = []
for page in doc:
    # dehyphenation is applied later with a mapping back to the source lines
    words = page.get_text("words", sort=True)
    alphabetic = [word[4] for word in words if word[4].isalpha()]
    fragmented = len(alphabetic) > 50 and sum(len(word) <= 2 for word in alphabetic) / len(alphabetic) > .6
    image_only = len(words) < 25 and bool(page.get_images())
    ocr = fragmented or image_only
    if ocr and not tesseract:
        # Without OCR, withhold this page instead of failing the whole document.
        pages.append({"width": page.rect.width, "height": page.rect.height, "words": [],
                      "extraction": "ocr-unavailable", "nativeText": '', "label": page.get_label()})
        continue
    extracted_words = ocr_words(page) if ocr else text_words(page)
    pages.append({"width": page.rect.width, "height": page.rect.height,
                  "words": extracted_words, "extraction": "ocr" if ocr else "text",
                  "nativeText": ' '.join(word[4] for word in words) if fragmented else '',
                  "label": page.get_label()})
sys.stdout.buffer.write(json.dumps({"pages": pages, "metadata": doc.metadata}, ensure_ascii=False).encode("utf-8"))
