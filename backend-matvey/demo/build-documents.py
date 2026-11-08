"""Reproducible, explicitly synthetic engineering documents for the two demos."""
import json
import subprocess
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Flowable
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab import rl_config
rl_config.invariant = 1  # Identical source content retains its document hash.

ROOT = Path(__file__).resolve().parents[1]
PROJECTS = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    "import {demoProjects} from './demo/manifest.mjs'; process.stdout.write(JSON.stringify(demoProjects))"
], cwd=ROOT, text=True, encoding='utf-8'))
OUT = ROOT / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
INK = colors.HexColor('#173147')
TEAL = colors.HexColor('#19766f')
LIGHT = colors.HexColor('#edf3f5')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='ProjectTitle', fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=INK, spaceAfter=10))
styles.add(ParagraphStyle(name='DocTitle', fontName='Helvetica', fontSize=14, leading=19, textColor=INK, spaceAfter=14))
styles.add(ParagraphStyle(name='Section', fontName='Helvetica-Bold', fontSize=11, leading=15, textColor=TEAL, spaceBefore=15, spaceAfter=5))
styles.add(ParagraphStyle(name='ProjectBody', fontName='Helvetica', fontSize=10, leading=15, textColor=colors.HexColor('#253746'), spaceAfter=4))
styles.add(ParagraphStyle(name='SmallNote', fontName='Helvetica', fontSize=8.5, leading=12, textColor=colors.HexColor('#526575')))

class Detail(Flowable):
    def __init__(self, kind):
        Flowable.__init__(self)
        self.kind = kind
        self.width, self.height = 470, 340
    def draw(self):
        c = self.canv
        c.setStrokeColor(colors.HexColor('#dce7eb'))
        for x in range(0, 471, 20): c.line(x, 0, x, 320)
        for y in range(0, 321, 20): c.line(0, y, 470, y)
        c.setStrokeColor(INK); c.setLineWidth(1.5)
        c.setFillColor(INK); c.setFont('Helvetica-Bold', 12)
        if self.kind == 'planter':
            c.drawString(20, 300, 'P1 / P2 - CONCEPT BOX PLANTER')
            c.setFillColor(colors.HexColor('#e7f3f2')); c.rect(130, 185, 190, 40, fill=1)
            c.setFillColor(colors.HexColor('#d7cab2')); c.rect(130, 90, 190, 95, fill=1)
            c.setFillColor(colors.HexColor('#b6c3ca')); c.rect(130, 35, 190, 55, fill=1)
            c.setFillColor(INK); c.setFont('Helvetica', 9)
            c.drawString(338, 205, 'Ponding 200 mm')
            c.drawString(338, 138, 'Soil media 600 mm')
            c.drawString(338, 55, 'Drainage 350 mm')
            c.line(130, 245, 320, 245); c.line(130, 237, 130, 253); c.line(320, 237, 320, 253)
            c.drawCentredString(225, 259, 'OVERALL WIDTH 400 mm')
            c.circle(225, 57, 10); c.line(235, 57, 310, 57)
            c.drawString(20, 15, '100 mm underdrain -> J1 -> C1 existing combined sewer (unapproved concept)')
        else:
            c.drawString(20, 300, 'SECTION A-A - TANGENT BRIDGE DECK')
            c.setLineWidth(2); c.line(40, 170, 235, 190); c.line(235, 190, 430, 170)
            c.line(40, 160, 235, 180); c.line(235, 180, 430, 160)
            c.rect(30, 170, 10, 40); c.rect(430, 170, 10, 40)
            c.setFont('Helvetica', 10)
            c.drawString(88, 205, '1.0% away from crown'); c.drawString(260, 205, '1.0% away from crown')
            c.drawCentredString(235, 235, 'NOT SUPER-ELEVATED')
            c.setLineWidth(1); c.line(30, 120, 440, 120); c.line(30, 113, 30, 127); c.line(440, 113, 440, 127)
            c.drawCentredString(235, 102, 'Deck 8.4 m / carriageway 8.0 m')
            c.line(45, 45, 425, 58)
            c.drawString(45, 70, 'PROFILE: 24 m span at 0.35% constant grade')
            c.drawString(45, 24, 'Concept geometry only. Structural sizing and flood levels are not established.')

def footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(TEAL); canvas.rect(0, h-29, w, 29, fill=1, stroke=0)
    canvas.setFillColor(colors.white); canvas.setFont('Helvetica-Bold', 8)
    canvas.drawString(48, h-19, 'BASIS  /  SYNTHETIC PROJECT MATERIAL  /  DEMONSTRATION ONLY')
    canvas.setStrokeColor(colors.HexColor('#b4c6cf')); canvas.line(48, 42, w-48, 42)
    canvas.setFont('Helvetica', 7.5); canvas.setFillColor(INK)
    canvas.drawString(48, 28, f'{doc.doc_code}  |  P01  |  6 November 2026  |  Not for construction')
    canvas.drawRightString(w-48, 28, f'{doc.page}')
    canvas.restoreState()

for project in PROJECTS:
    for item in project['documents']:
        path = OUT / item['file']
        doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=48, rightMargin=48, topMargin=61, bottomMargin=60,
            title=f"{project['name']} - {item['title']} - synthetic demonstration", author='Basis demonstration team')
        doc.doc_code = item['code']
        story = [Paragraph(escape(project['name']), styles['ProjectTitle']), Paragraph(escape(item['title']), styles['DocTitle'])]
        facts = [[Paragraph('CLIENT / OWNER', styles['SmallNote']), Paragraph(escape(project['client']), styles['ProjectBody'])],
                 [Paragraph('DOCUMENT / REVISION', styles['SmallNote']), Paragraph(escape(item['code']+' / P01 - preliminary'), styles['ProjectBody'])],
                 [Paragraph('LOCATION / STATUS', styles['SmallNote']), Paragraph(escape(project['location']+' / demonstration concept'), styles['ProjectBody'])]]
        table = Table(facts, colWidths=[125, 365])
        table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),LIGHT),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
        story.append(table)
        for title, body in item['sections']:
            story.extend([Paragraph(escape(title),styles['Section']), Paragraph(escape(body),styles['ProjectBody'])])
        if item.get('drawing'):
            story.extend([PageBreak(),Paragraph(escape(project['name']),styles['ProjectTitle']),Paragraph('Concept detail - not to scale',styles['DocTitle']),Spacer(1,25),Detail(item['drawing']),Spacer(1,15),Paragraph('Synthetic coordination sketch. Read with the schedule and review hold points on page 1. Dimensions are concept assumptions, not proof of an accepted design.',styles['SmallNote'])])
        doc.build(story, onFirstPage=footer, onLaterPages=footer)
        print(path)
