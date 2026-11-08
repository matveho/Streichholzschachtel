"""Run with backend/.venv/bin/python backend/tests/ocr-output.test.py."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import pymupdf


class OcrOutputTests(unittest.TestCase):
    def test_plain_text_success_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            source = pymupdf.open()
            page = source.new_page(width=200, height=200)
            page.insert_text((10, 30), 'Scanned engineering requirement')
            image = page.get_pixmap().tobytes('png')
            scan = pymupdf.open()
            page = scan.new_page(width=200, height=200)
            page.insert_image(page.rect, stream=image)
            pdf = directory / 'scan.pdf'
            scan.save(pdf)
            fake = directory / 'tesseract'
            fake.write_text('#!/bin/sh\nprintf "Plain text without word coordinates\\n"\n')
            fake.chmod(0o700)
            result = subprocess.run(
                [os.sys.executable, str(Path(__file__).resolve().parents[1] / 'extract.py'), str(pdf)],
                env={**os.environ, 'TESSERACT_PATH': str(fake)}, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('required TSV word geometry', result.stderr)


if __name__ == '__main__':
    unittest.main()
