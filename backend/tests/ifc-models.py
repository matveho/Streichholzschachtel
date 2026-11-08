"""Validate shipped IFCs, source traces, dimensional checks and register identity."""
import hashlib,json,math
from pathlib import Path
import ifcopenshell,ifcopenshell.geom,ifcopenshell.util.element,ifcopenshell.validate
import pymupdf
ROOT=Path(__file__).resolve().parents[1]
all_guids=set()
def bounds(obj):
    shape=ifcopenshell.geom.create_shape(ifcopenshell.geom.settings(),obj)
    coords=list(zip(*[iter(shape.geometry.verts)]*3))
    return [(min(p[i] for p in coords),max(p[i] for p in coords)) for i in range(3)]
for name,count in [('parkview-exchange',6),('north-ridge-highway',7)]:
    path=ROOT/'output/models'/f'{name}.ifc';record=json.loads(path.with_suffix('.json').read_text(encoding='utf8'))
    f=ifcopenshell.open(path)
    assert f.schema=='IFC4'
    log=ifcopenshell.validate.json_logger();ifcopenshell.validate.validate(f,log,express_rules=True)
    assert not [s for s in log.statements if s.get('level')=='error'],log.statements
    assert hashlib.sha256(path.read_bytes()).hexdigest()==record['sha256']
    assert len(f.by_type('IfcElement'))==count==len(record['objects'])
    register=pymupdf.open(ROOT/'output/pdf'/f'{name}-ifc-register.pdf')
    text=' '.join(p.get_text() for p in register)
    assert record['sha256'] in ''.join(text.split())
    by_tag={obj.Tag:obj for obj in f.by_type('IfcElement')}
    for o in record['objects']:
        assert o['guid'] not in all_guids;all_guids.add(o['guid'])
        obj=f.by_guid(o['guid']);ps=ifcopenshell.util.element.get_psets(obj)
        assert obj.Name==o['name'] and obj.is_a()==o['class']
        for key,value in o['properties'].items():assert ps['Basis_Design'][key]==value
        for field,pagefield in [('SourceDocument','SourcePage'),('RelatedSourceDocument','RelatedSourcePage')]:
            if field not in o['evidence']:continue
            doc=pymupdf.open(ROOT/'output/pdf'/o['evidence'][field]);assert 1<=o['evidence'][pagefield]<=len(doc)
        assert o['guid'] in text
        b=bounds(obj);assert all(high>low for low,high in b)
    if name=='parkview-exchange':
        assert math.isclose(bounds(by_tag['S1'])[1][1]-bounds(by_tag['S1'])[1][0],43,abs_tol=.001)
        # Outside-to-outside X1 gap, independent of property strings.
        assert math.isclose(bounds(by_tag['W1'])[2][0]-bounds(by_tag['S2'])[2][1],.220,abs_tol=1e-5)
    else:
        assert math.isclose(bounds(by_tag['RD-EB'])[1][1]-bounds(by_tag['RD-EB'])[1][0],3.5)
        assert math.isclose(bounds(by_tag['RD-WB'])[1][1]-bounds(by_tag['RD-WB'])[1][0],3.5)
        # At the crest the trial asphalt top coincides with the model road surface.
        assert math.isclose(bounds(by_tag['PAV-ACP'])[2][1],1.875)
    print('PASS',name,'schema, every solid, properties, source pages, GlobalIds and dimensional checks')
