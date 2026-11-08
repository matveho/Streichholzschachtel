"""Render registers from the properties extracted back out of the actual IFCs.
Run after build-ifc-models.py with a Python containing ReportLab.
"""
import json, hashlib, re
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.colors import HexColor, white

ROOT=Path(__file__).resolve().parents[1]
INK=HexColor('#172b39');BLUE=HexColor('#176781');GRAY=HexColor('#526571');LINE=HexColor('#cad4da')
STYLE=ParagraphStyle('body',fontName='Helvetica',fontSize=9.5,leading=13,textColor=INK)
SMALL=ParagraphStyle('small',parent=STYLE,fontSize=8,leading=11)
def para(c,s,x,y,w,style=STYLE):
    p=Paragraph(str(s).replace('&','&amp;'),style);_,h=p.wrap(w,900);p.drawOn(c,x,y-h);return y-h-10
def heading(c,s,x,y,w,size=15):
    return para(c,s,x,y,w,ParagraphStyle('head',parent=STYLE,fontName='Helvetica-Bold',fontSize=size,leading=size+4))
def table(c,rows,x,y,w):
    t=Table([[Paragraph(str(cell).replace('&','&amp;'),SMALL) for cell in row] for row in rows],colWidths=[190,w-190]);t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.4,LINE),('BACKGROUND',(0,0),(0,-1),HexColor('#edf2f4')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]));_,h=t.wrap(w,1000);t.drawOn(c,x,y-h);return y-h-12
def words(s):return re.sub(r'(?<=[a-z])(?=[A-Z])',' ',s)
metadata={}
for project_id,title,code in [('parkview-exchange','Parkview Exchange Redevelopment','PX-IFC-001'),('north-ridge-highway','North Ridge Highway Intersection Upgrade','NRH-IFC-001')]:
    data=json.loads((ROOT/'output/models'/f'{project_id}.json').read_text(encoding='utf8'))
    assert hashlib.sha256((ROOT/'output/models'/data['file']).read_bytes()).hexdigest()==data['sha256']
    filename=project_id+'-ifc-register.pdf';target=ROOT/'output/pdf'/filename
    c=canvas.Canvas(str(target),pagesize=(612,792),invariant=1)
    c.setAuthor('Cairnfield Civil Studio Ltd.');c.setTitle(title+' - IFC model register')
    objects=data['objects'];pages=1+len(objects)
    for page in range(pages):
        c.setStrokeColor(LINE);c.rect(24,24,564,744)
        c.setFillColor(BLUE);c.rect(40,730,26,26,stroke=0,fill=1);c.setFillColor(white);c.setFont('Helvetica-Bold',11);c.drawCentredString(53,739,'C')
        c.setFillColor(INK);c.setFont('Helvetica-Bold',11);c.drawString(76,748,'CAIRNFIELD CIVIL STUDIO')
        c.setFont('Helvetica',8);c.drawString(76,733,'Civil infrastructure | Model coordination')
        c.setFont('Helvetica',9);c.drawRightString(572,748,code);c.drawRightString(572,733,'8 November 2026')
        c.setStrokeColor(LINE);c.line(40,52,572,52);c.setFillColor(GRAY);c.setFont('Helvetica',7.5)
        c.drawString(40,39,'ISSUED FOR REVIEW | NOT FOR CONSTRUCTION');c.drawRightString(572,39,f'{code} | Rev 0 | {page+1} / {pages}')
        y=para(c,title,40,702,532,SMALL)
        if page==0:
            y=heading(c,'IFC model register',40,y,532,20)
            y=para(c,f"Model file: {data['file']}. Schema: {data['schema']}. {len(objects)} named objects. Length units are metres. Local vertical datum is 670.000 m; add this to model Z coordinates to obtain the project elevations.",40,y,532)
            y=para(c,'This register is extracted from the IFC object descriptions and property sets. It is a searchable companion to the conceptual model. Project drawings and governing standards remain the design evidence. Geometry includes explicitly identified visualization assumptions and is not a certified survey or a construction model.',40,y,532)
            y=table(c,[['Object / IFC class','Register page']]+[[o['name']+' / '+o['class'],str(i+2)] for i,o in enumerate(objects)],40,y,532)
            y=para(c,'Model SHA-256: '+data['sha256'],40,y,532,SMALL)
            y=para(c,'Search by object tag, nominal diameter, cover, clearance, lane width, sight distance or pavement layer. Each object page retains its IFC GlobalId and the source drawing or report used for its properties.',40,y,532)
        else:
            o=objects[page-1];e=o['evidence']
            y=heading(c,'IFC object '+o['name'],40,y,532,16)
            y=para(c,o['description'],40,y,532)
            y=table(c,[['IFC class',o['class']],['GlobalId',o['guid']]]+[[words(k),v] for k,v in o['properties'].items()],40,y,532)
            y=heading(c,'Source trace',40,y,532,12)
            y=para(c,e['SourceDocument']+f" · PDF page {e['SourcePage']}. Model status: {e['Status']}.",40,y,532,SMALL)
            if e.get('RelatedSourceDocument'):
                y=para(c,e['RelatedSourceDocument']+f" · PDF page {e['RelatedSourcePage']} (related design basis).",40,y,532,SMALL)
            y=para(c,e['RepresentationLimit'],40,y,532,SMALL)
        assert y>65,(project_id,page,y)
        c.showPage()
    c.save()
    metadata[project_id]={'file':filename,'title':'IFC model register','code':code,'category':'supporting','edition':'Concept model · 8 November 2026','origin':'synthetic-project-artifact','modelFile':data['file'],'modelSha256':data['sha256']}
    print(filename,pages,'pages')
(ROOT/'demo/model-documents.mjs').write_text('export const modelDocuments = '+json.dumps(metadata,indent=2)+'\n',encoding='utf8')
