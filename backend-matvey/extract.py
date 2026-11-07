"""Extract original words and page geometry; stdout is machine-readable JSON."""
import json
import sys
import os
import csv
import io
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
    process = subprocess.run([tesseract, 'stdin', 'stdout', '-l', 'eng', '--psm', '3', 'tsv'],
        input=image.tobytes('png'), capture_output=True, timeout=90,
        env={**os.environ, 'OMP_THREAD_LIMIT': '2'},
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    if process.returncode:
        raise RuntimeError('Local OCR failed for a PDF page.')
    result = []
    for row in csv.DictReader(io.StringIO(process.stdout.decode('utf-8')), delimiter='\t'):
        if row.get('level') != '5' or not row.get('text', '').strip():
            continue
        x, y, width, height = [float(row[key]) * 72 / dpi for key in ['left', 'top', 'width', 'height']]
        result.append([x, y, x+width, y+height, row['text'], int(row['block_num']),
            int(row['par_num'])*1000+int(row['line_num']), float(row['conf'])])
    return result

pages = []
for page in doc:
    # dehyphenation is applied later with a mapping back to the source lines
    words = page.get_text("words", sort=True)
    alphabetic = [word[4] for word in words if word[4].isalpha()]
    fragmented = len(alphabetic) > 50 and sum(len(word) <= 2 for word in alphabetic) / len(alphabetic) > .6
    image_only = len(words) < 25 and bool(page.get_images())
    ocr = fragmented or image_only
    extracted_words = ocr_words(page) if ocr else [[*word[:4], word[4], word[5], word[6], 100] for word in words]
    pages.append({"width": page.rect.width, "height": page.rect.height,
                  "words": extracted_words, "extraction": "ocr" if ocr else "text",
                  "nativeText": ' '.join(word[4] for word in words) if fragmented else '',
                  "label": page.get_label()})
sys.stdout.buffer.write(json.dumps({"pages": pages, "metadata": doc.metadata}, ensure_ascii=False).encode("utf-8"))
