"""Reproducible fictional project artifacts. Run with the bundled ReportLab Python.
Official reference PDFs are never generated or modified by this script.
"""
import json, math, subprocess
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.enums import TA_LEFT

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
    "import {projectPackages} from './demo/project-packages.mjs'; process.stdout.write(JSON.stringify(projectPackages))"], cwd=ROOT))
INK, GRAY, BLUE, LINE = map(HexColor, ['#172b39','#526571','#176781','#cad4da'])
STYLE = ParagraphStyle('body',fontName='Helvetica',fontSize=10.5,leading=16,textColor=INK)
SMALL = ParagraphStyle('note',parent=STYLE,fontSize=9,leading=13)

def text(c,s,x,y,w,style=STYLE):
    p=Paragraph(s.replace('&','&amp;'),style); _,h=p.wrap(w,2000);p.drawOn(c,x,y-h);return y-h-15

def table(c,rows,x,y,width,colwidths=None):
    cells=[[Paragraph(str(v),SMALL) for v in row] for row in rows]
    t=Table(cells,colWidths=colwidths or [width/len(rows[0])]*len(rows[0]))
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),HexColor('#e9f0f3')),('GRID',(0,0),(-1,-1),.4,LINE),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
    _,h=t.wrap(width,1000);t.drawOn(c,x,y-h);return y-h-20

def frame(c,p,d,page,count,w,h):
    c.setStrokeColor(LINE);c.setLineWidth(.6);c.rect(24,24,w-48,h-48)
    c.setFillColor(BLUE); c.rect(40,h-62,26,26,fill=1,stroke=0)
    c.setFillColor(white);c.setFont('Helvetica-Bold',11);c.drawCentredString(53,h-53,'C')
    c.setFillColor(INK);c.setFont('Helvetica-Bold',11);c.drawString(76,h-45,'CAIRNFIELD CIVIL STUDIO')
    c.setFont('Helvetica',8);c.drawString(76,h-59,'Civil infrastructure | Design coordination')
    c.setFont('Helvetica',9);c.drawRightString(w-40,h-44,p['projectNumber'])
    c.drawRightString(w-40,h-58,d['date'])
    c.setStrokeColor(LINE);c.line(40,52,w-40,52)
    c.setFillColor(GRAY);c.setFont('Helvetica',7.5)
    c.drawString(40,39,'ISSUED FOR REVIEW | NOT FOR CONSTRUCTION')
    c.drawRightString(w-40,39,f"{d['code']} | Rev {'1' if 'rev1' in d['file'] else '0'} | {page} / {count}")

def title(c,p,d,heading,w,h):
    c.setFillColor(GRAY);c.setFont('Helvetica',10);c.drawString(40,h-94,p['name'])
    return text(c,heading,40,h-110,w-80,ParagraphStyle('heading',parent=STYLE,fontName='Helvetica-Bold',fontSize=19,leading=24))

def line(c,x1,y1,x2,y2,color=INK,width=1):
    c.setStrokeColor(color);c.setLineWidth(width);c.line(x1,y1,x2,y2)

def label(c,s,x,y,size=8):
    c.setFillColor(INK);c.setFont('Helvetica',size);c.drawString(x,y,s)

def north(c,x,y):
    line(c,x,y,x,y+35,INK,1.4);line(c,x,y+35,x-5,y+24);line(c,x,y+35,x+5,y+24);label(c,'N',x-3,y+43,10)

def scale(c,x,y):
    for i in range(4):
        c.setFillColor(INK if i%2==0 else white);c.rect(x+i*28.35,y,28.35,5,stroke=1,fill=1)
    label(c,'0',x,y-12);label(c,'20 m',x+103,y-12);label(c,'Scale 1:500 at 11 x 17 in',x,y-28)

def park_plan(c,grading=False):
    x,y,s=83,160,3.78
    def X(a):return x+a*s
    def Y(a):return y+a*s
    c.setFillColor(HexColor('#f4f6f7'));c.rect(X(-7),Y(-12),98*s,12*s,fill=1,stroke=0)
    label(c,'MUNICIPAL FRONTAGE / EXISTING SERVICES',X(-7),Y(-8),8)
    c.setDash(5,3);c.setStrokeColor(GRAY);c.rect(x,y,84*s,100*s);c.setDash()
    c.setFillColor(HexColor('#e6eef1'));c.setStrokeColor(INK)
    path=c.beginPath();path.moveTo(X(12),Y(24));path.lineTo(X(62),Y(24));path.lineTo(X(62),Y(70));path.lineTo(X(54),Y(70));path.lineTo(X(54),Y(82));path.lineTo(X(12),Y(82));path.close();c.drawPath(path,fill=1)
    label(c,'SIX-STOREY BUILDING',X(16),Y(56));label(c,'92 RESIDENCES',X(16),Y(49));label(c,'1,250 m2 COMMERCIAL',X(16),Y(42))
    if grading:
        for a,b,z in [(4,6,'671.18'),(77,18,'671.300'),(6,90,'672.10'),(75,91,'671.70'),(28,20,'672.05')]:
            c.circle(X(a),Y(b),2,fill=1);label(c,z,X(a)+4,Y(b)+4)
        label(c,'FFE 672.250',X(22),Y(63));label(c,'BM1 671.420',X(2),Y(103))
        for a,b in [(6,28),(76,70),(36,15)]:
            line(c,X(a),Y(b),X(a),Y(b-12),BLUE,1.2);line(c,X(a),Y(b-12),X(a)-3,Y(b-8),BLUE)
    else:
        line(c,X(78),Y(54),X(78),Y(11),HexColor('#964e32'),2)
        label(c,'S1: 200 PVC',X(85),Y(45));label(c,'43 m / 0.30%',X(85),Y(38));label(c,'Limited branch',X(85),Y(31))
        line(c,X(68),Y(38),X(68),Y(0),BLUE,2);label(c,'ST1 300 / 0.25%',X(8),Y(14))
        for a,b,name in [(78,54,'S1-U'),(78,11,'S1-D'),(68,38,'ST1-U'),(68,0,'ST1-D')]:
            c.setFillColor(white);c.setStrokeColor(INK);c.circle(X(a),Y(b),3,stroke=1,fill=1);label(c,name,X(a)-27,Y(b)+7)
        line(c,X(33),Y(24),X(33),Y(-5),HexColor('#964e32'),1.5);label(c,'S2 building service',X(5),Y(3))
        line(c,X(-3),Y(8),X(88),Y(8),BLUE,1);c.circle(X(33),Y(8),5,stroke=1);label(c,'X1',X(35),Y(10))
    north(c,470,520)
    label(c,'Brown: sanitary / Blue: storm or water',78,560,8)
    for i in range(4):
        c.setFillColor(INK if i%2==0 else white);c.rect(78+i*18.9,118,18.9,5,stroke=1,fill=1)
    label(c,'0',78,105);label(c,'20 m',143,105)
    label(c,'Scale 1:750 at 11 x 17 in',78,91)
    label(c,'Figure 1 - Local coordination layout; dimensions in metres',70,71)

def px_profile(c,detail=False):
    x,y=78,205
    if detail:
        line(c,x,y+120,x+295,y+120,INK,1.5);label(c,'FINISHED GRADE 671.300',x,y+132)
        c.setStrokeColor(BLUE);c.circle(x+95,y+30,26,stroke=1);label(c,'ST1 outside crown 669.650',x,y-16)
        line(c,x+170,y+120,x+170,y+56);label(c,'1.650 m COVER',x+180,y+84)
        c.circle(x+250,y+25,15,stroke=1);label(c,'X1: 0.220 m separation',x+155,y-42)
        label(c,'NTS - relative arrangement only',x,y-65)
    else:
        # Profile, H 1:500 / V 1:50, 38 m x 2 m.
        sx,sy=11.34,113.4
        for j in range(5):
            yy=y+j*sy*.5;line(c,x,yy,x+38*sx,yy,LINE,.4);label(c,f'{669.5+j*.5:.1f}',x-32,yy-3)
        ground=[(0,671.35),(18,671.300),(38,671.25)]
        for arr,col in [(ground,INK),([(0,669.695),(18,669.650),(38,669.600)],BLUE)]:
            for (a,b),(aa,bb) in zip(arr,arr[1:]):line(c,x+a*sx,y+(b-669.5)*sy,x+aa*sx,y+(bb-669.5)*sy,col,1.5)
        for a in [0,18,38]:label(c,f'0+{a:03}',x+a*sx-9,y-22)
        label(c,'ST1 outside crown / 0.25%',x,y-43)
        label(c,'H 1:250 / V 1:25 at 11 x 17 in',x,y-62)
        label(c,'Figure 2 - ST1 profile; levels in metres',x,y-82)

def highway_plan(c,staging=False):
    x,y=68,237
    c.setFillColor(HexColor('#e7edf0'));c.rect(x,y,390,68,fill=1,stroke=0)
    c.rect(x+210,y+68,58,110,fill=1,stroke=0)
    line(c,x,y+14,x+390,y+14);line(c,x,y+54,x+390,y+54)
    c.setDash(12,8);line(c,x,y+34,x+390,y+34,BLUE);line(c,x+239,y+68,x+239,y+178,BLUE);c.setDash()
    label(c,'WB THROUGH 3.5 m',x+7,y+43);label(c,'EB THROUGH 3.5 m',x+7,y+22)
    label(c,'2.5 m SHOULDER',x+7,y+60,7);label(c,'2.5 m SHOULDER',x+7,y+3,7)
    label(c,'NORTH INDUSTRIAL ACCESS',x+205,y+192,8)
    for i,a in enumerate(['0+100','0+200','0+300','0+400']):label(c,a,x+i*97.5,y-23)
    label(c,'Figure 1 - Intersection arrangement (NTS)',x,y-48)
    north(c,420,405)
    if staging:
        c.setFillColor(Color(.75,.38,.15,alpha=.35));c.rect(x+250,y+68,18,80,fill=1,stroke=0)
        label(c,'NORTH TIE-IN WORK SPACE',x+110,y-76)
    else:
        label(c,'12.0 m PAVED SURFACE',x+130,y-76)
        label(c,'100 km/h DESIGN / 90 km/h POSTED',x+110,y-95)

def highway_profile(c):
    x,y=80,170;w=380;hh=165
    for i in range(6):
        yy=y+i*hh/5;line(c,x,yy,x+w,yy,LINE,.4);label(c,f'{669+i:.0f}',x-28,yy-3)
    pts=[]
    for i in range(101):
        sta=175+2.5*i;t=sta-175;z=670+.03*t-.06*t*t/500
        pts.append((x+i*w/100,y+(z-669)*hh/5))
    for a,b in zip(pts,pts[1:]):line(c,*a,*b,BLUE,1.6)
    for sta in [175,225,300,375,425]:label(c,f'0+{sta}',x+(sta-175)/250*w-10,y-20)
    label(c,'L = 250 m    g1 = +3.0%    g2 = -3.0%    K = 41.67 m/%',x,y-46)
    label(c,'AVAILABLE SSD 165 m / INITIAL SCREEN 185 m',x,y+hh+25,10)
    label(c,'Figure 2 - Crest profile (schematic axes, not to plotted scale)',x,y-69,8)

def drawing(c,p,d,idx,w,h):
    y=title(c,p,d,d['pages'][idx][0],w,h)
    right=540
    label(c,'DESIGN NOTES',right,h-170,11)
    yy=h-188
    for paragraph in d['pages'][idx][1:]: yy=text(c,paragraph,right,yy,w-right-45,SMALL)
    if d['drawing'].startswith('parkview'):
        if idx==0:park_plan(c,'grading' in d['drawing'])
        else:px_profile(c,'grading' in d['drawing'])
    elif d['drawing']=='highway-geometry' and idx==2:highway_profile(c)
    else:highway_plan(c,d['drawing']=='highway-staging')
    yy=table(c,[['Issue','Status'],['0 / '+d['date'],'Issued for review'],['Prepared / checked','JL / AK'],['Units','SI; elevations in metres']],right,180,w-right-45)
    label(c,'Reference: associated project memorandum and original standards',right,yy,7)

for p in DATA:
    for d in p['documents']:
        path=ROOT/'output/pdf'/d['file'];path.parent.mkdir(parents=True,exist_ok=True)
        w,h=(1224,792) if d.get('drawing') else (612,792)
        c=canvas.Canvas(str(path),pagesize=(w,h),invariant=1,pageCompression=1)
        c.setAuthor('Cairnfield Civil Studio Ltd.');c.setTitle(p['name']+' - '+d['title'])
        pages=d['pages'] if d.get('drawing') else [d['pages'][i:i+2] for i in range(0,len(d['pages']),2)]
        for i,page in enumerate(pages):
            frame(c,p,d,i+1,len(pages),w,h)
            if d.get('drawing'):drawing(c,p,d,i,w,h)
            else:
                yy=title(c,p,d,d['title'],w,h)
                for j,section in enumerate(page):
                    yy=text(c,f'{i*2+j+1}. {section[0]}',40,yy,w-80,ParagraphStyle('sub',parent=STYLE,fontName='Helvetica-Bold',fontSize=12,leading=17))
                    for paragraph in section[1:]: yy=text(c,paragraph,40,yy,w-80)
                if i==0:
                    yy=table(c,[['Project','Issue information'],[p['projectNumber'],d['date']],[p['client'],'Issued for review'],['Prepared / checked','JL / AK']],40,yy-10,w-80,[260,272])
                assert yy>70,(d['file'],i,yy)
            c.showPage()
        c.save();print(path.name,len(pages))
