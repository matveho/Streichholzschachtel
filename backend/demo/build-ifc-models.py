"""Build conceptual IFC4 civil models and extract their searchable registers.
Generation only: .venv Python needs ifcopenshell==0.8.4. PDF registers use
ReportLab via the bundled Python. No IFC dependency is needed by the server.
"""
import hashlib, json, math, uuid
from pathlib import Path
import ifcopenshell
import ifcopenshell.api as api
import ifcopenshell.util.element
import ifcopenshell.geom
import ifcopenshell.validate

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/models';OUT.mkdir(parents=True,exist_ok=True)
NS=uuid.UUID('7b9b9f4c-ff03-4c90-862a-fab5f5891716')
def guid(name):return ifcopenshell.guid.compress(uuid.uuid5(NS,name).hex)
def box(x,y,z,dx,dy,dz):
    v=[(x,y,z),(x+dx,y,z),(x+dx,y+dy,z),(x,y+dy,z),(x,y,z+dz),(x+dx,y,z+dz),(x+dx,y+dy,z+dz),(x,y+dy,z+dz)]
    return v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
def pipe(a,b,r,n=24):
    import numpy as np
    a,b=np.array(a,dtype=float),np.array(b,dtype=float);d=b-a;d/=np.linalg.norm(d)
    ref=np.array([0.,0.,1.]) if abs(d[2])<.9 else np.array([1.,0.,0.])
    u=np.cross(d,ref);u/=np.linalg.norm(u);v=np.cross(d,u)
    verts=[tuple(p+r*(math.cos(i*2*math.pi/n)*u+math.sin(i*2*math.pi/n)*v)) for p in (a,b) for i in range(n)]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return verts,faces
def road(y,width,zoffset,thickness):
    # Parabolic crest: BVC 175/670, +3/-3%, L250. Tangents either side.
    def level(s):
        if s<175:return .03*(s-175)
        if s>425:return -.03*(s-425)
        t=s-175;return .03*t-.06*t*t/500
    vertices=[]
    for s in range(100,501,5):
        z=level(s)+zoffset
        vertices.extend([(s,y,z),(s,y+width,z),(s,y+width,z-thickness),(s,y,z-thickness)])
    faces=[(3,2,1,0),(320,321,322,323)]
    for i in range(80):
        a=i*4;b=a+4
        faces.extend([(a,b,b+1,a+1),(a+1,b+1,b+2,a+2),(a+2,b+2,b+3,a+3),(a+3,b+3,b,a)])
    return vertices,faces

def create(project_id,name,number,filename):
    f=api.run('project.create_file',version='IFC4')
    project=api.run('root.create_entity',f,ifc_class='IfcProject',name=name)
    project.GlobalId=guid(project_id);project.Description='Conceptual issued-for-review civil coordination model. Local coordinates; not for construction.'
    unit=api.run('unit.add_si_unit',f,unit_type='LENGTHUNIT')
    api.run('unit.assign_unit',f,units=[unit])
    context=api.run('context.add_context',f,context_type='Model')
    body=api.run('context.add_context',f,context_type='Model',context_identifier='Body',target_view='MODEL_VIEW',parent=context)
    site=api.run('root.create_entity',f,ifc_class='IfcSite',name=number+' civil works')
    site.GlobalId=guid(project_id+'/site')
    api.run('aggregate.assign_object',f,products=[site],relating_object=project)
    pset=api.run('pset.add_pset',f,product=project,name='Basis_ModelProvenance')
    api.run('pset.edit_pset',f,pset=pset,properties={'ProjectId':project_id,'ProjectNumber':number,'Status':'Issued for review - not for construction','Origin':'Synthetic project artifact','CoordinateSystem':'Local engineering coordinates; no georeferencing or survey certification','ElevationDatumMeters':670.0,'GeometryLimitations':'Simplified envelopes; pipe walls, fittings and final structural details are not resolved.'})
    objects=[]
    def add(tag,label,ifc_class,shape,properties,source,page,search,color):
        obj=api.run('root.create_entity',f,ifc_class=ifc_class,name=f'{tag} - {label}')
        obj.GlobalId=guid(project_id+'/'+tag)
        if obj.is_a('IfcElement'):obj.Tag=tag
        obj.Description=search
        api.run('spatial.assign_container',f,products=[obj],relating_structure=site)
        representation=api.run('geometry.add_mesh_representation',f,context=body,vertices=[shape[0]],faces=[shape[1]])
        api.run('geometry.assign_representation',f,product=obj,representation=representation)
        api.run('geometry.edit_object_placement',f,product=obj)
        style=api.run('style.add_style',f,name=label)
        api.run('style.add_surface_style',f,style=style,attributes={'SurfaceColour':dict(zip(['Red','Green','Blue'],color)),'Transparency':0.15 if tag=='BLDG' else 0.0})
        api.run('style.assign_representation_styles',f,shape_representation=representation,styles=[style])
        for ps,values in [('Basis_Design',properties),('Basis_Evidence',{'SourceDocument':source,'SourcePage':page,'Status':'Issued for review','SearchText':search,'RepresentationLimit':'Concept geometry; verify against cited design documents.'})]:
            if ps=='Basis_Evidence' and tag=='BLDG':
                values.update(RelatedSourceDocument='pxr_site-grading-plan_ifr_2026-10-02.pdf',RelatedSourcePage=1)
            if ps=='Basis_Evidence' and tag in ('ST1','RD-EB'):
                values.update(RelatedSourceDocument=source,RelatedSourcePage=1)
            pset=api.run('pset.add_pset',f,product=obj,name=ps)
            api.run('pset.edit_pset',f,pset=pset,properties=values)
        objects.append(obj)
    return f,add,objects

def finish(f,objects,project_id,filename):
    # Stable IDs for every relationship, property set and element, not random IDs.
    for entity in f.by_type('IfcRoot'):
        if entity not in objects and not entity.is_a('IfcProject') and not entity.is_a('IfcSite'):
            entity.GlobalId=guid(project_id+'/'+entity.is_a()+'/'+str(entity.id()))
    f.header.file_name.name=filename
    f.header.file_name.time_stamp='2026-11-08T12:00:00'
    f.header.file_name.author=('Cairnfield Civil Studio Ltd.',)
    f.header.file_name.organization=('Cairnfield Civil Studio Ltd.',)
    f.header.file_name.preprocessor_version='basis conceptual IFC generator / IfcOpenShell 0.8.4'
    f.header.file_name.originating_system='basis'
    f.header.file_name.authorization='Issued for review - not for construction'
    path=OUT/filename;f.write(path)
    parsed=ifcopenshell.open(path)
    logger=ifcopenshell.validate.json_logger();ifcopenshell.validate.validate(parsed,logger,express_rules=True)
    errors=[x for x in logger.statements if x.get('level')=='error']
    if errors:raise ValueError(errors)
    extracted=[]
    settings=ifcopenshell.geom.settings()
    for obj in parsed.by_type('IfcElement'):
        shape=ifcopenshell.geom.create_shape(settings,obj)
        assert shape.geometry.verts and shape.geometry.faces,obj.Name
        ps=ifcopenshell.util.element.get_psets(obj)
        extracted.append({'guid':obj.GlobalId,'tag':obj.Tag,'name':obj.Name,'class':obj.is_a(),'description':obj.Description,'properties':{k:v for k,v in ps['Basis_Design'].items() if k!='id'},'evidence':{k:v for k,v in ps['Basis_Evidence'].items() if k!='id'}})
    datum=ifcopenshell.util.element.get_psets(parsed.by_type('IfcProject')[0])['Basis_ModelProvenance']['ElevationDatumMeters']
    record={'projectId':project_id,'file':filename,'schema':parsed.schema,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'datumMeters':datum,'origin':'synthetic-project-artifact','objects':extracted}
    (OUT/(path.stem+'.json')).write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
    print(filename,len(extracted),'objects; schema and geometry valid')

f,add,objects=create('parkview-exchange','Parkview Exchange Redevelopment','PX-26017','parkview-exchange.ifc')
source='pxr_site-servicing-plan_ifr_2026-10-02.pdf'
add('S1','Upstream sanitary branch','IfcPipeSegment',pipe((78,54,-1.52+.1),(78,11,-1.649+.1),.1),{'NominalPipeDiameter':'200 mm','Length':'43 m','Slope':'0.30%','PeakDryWeatherFlow':'0.34 L/s','UpstreamInvertElevation':'668.480 m','DownstreamInvertElevation':'668.351 m','FlowScope':'250 m² east retail/frontage only; excludes remaining building service'},source,1,'IFC object S1 is the upstream sanitary branch. The nominal pipe diameter of IFC object S1 is 200 mm. Its length is 43 m and proposed slope is 0.30%. Peak dry-weather flow is 0.34 L/s for the limited branch only. The model cylinder uses nominal diameter; wall thickness is unresolved.',(.58,.26,.16))
add('ST1','Terminal storm reach','IfcPipeSegment',pipe((68,38,-.305-.15),(68,0,-.400-.15),.15),{'NominalPipeDiameter':'300 mm','Length':'38 m','Slope':'0.25%','CoverAtChainage018':'1.650 m','Insulation':'No insulation detail included','OutsideCrownAt018':'669.650 m'},source,2,'IFC object ST1 is the terminal storm reach. The cover of IFC object ST1 at chainage 0+018 is 1.650 m. Its nominal diameter is 300 mm and slope is 0.25%. No insulation detail is included. The cylinder follows the documented outside crown; nominal diameter is used as a simplified envelope.',(.12,.45,.7))
add('S2','Sewer service at crossing X1','IfcPipeSegment',pipe((33,24,-1.620-.1),(33,-5,-1.620-.1),.1),{'Crossing':'X1','OutsideCrownElevation':'668.380 m','VerticalClearance':'0.220 m','EnvelopeDiameter':'200 mm - visualization assumption; service sizing not established'},source,2,'IFC object S2 is the sewer service at crossing X1. The vertical clearance at IFC crossing X1 is 0.220 m between sewer outside crown 668.380 m and watermain underside 668.600 m. The sewer cylinder diameter is a visualization assumption, not a confirmed design size.',(.58,.26,.16))
add('W1','Existing watermain at X1','IfcPipeSegment',pipe((-3,8,-1.4+.075),(88,8,-1.4+.075),.075),{'NominalPipeDiameter':'150 mm','UndersideElevation':'668.600 m','Crossing':'X1','Envelope':'Nominal diameter, wall thickness unresolved'},source,2,'IFC object W1 is the 150 mm watermain at crossing X1. Its underside elevation is 668.600 m. The sewer service below it has 0.220 m clearance. Utility exposure remains required.',(.12,.65,.72))
add('FG-ST1','Finished-grade cover check','IfcBuildingElementProxy',box(65,17,1.275,6,2,.025),{'FinishedGradeElevation':'671.300 m','Chainage':'0+018','SurfaceExtent':'6 m by 2 m local visualization patch only'},'pxr_site-grading-plan_ifr_2026-10-02.pdf',2,'IFC object FG-ST1 is the local finished-grade patch above storm reach ST1 at chainage 0+018. Finished grade is 671.300 m and storm outside crown is 669.650 m. Cover is 1.650 m. Patch extents are illustrative and do not represent a surveyed terrain surface.',(.35,.55,.3))
add('BLDG','Building envelope','IfcBuildingElementProxy',box(12,24,2.250,50,58,20),{'FinishedFloorElevation':'672.250 m','ResidentialUnits':92,'CommercialFloorArea':'1,250 m²','Storeys':6,'EnvelopeHeight':'20 m - visualization assumption'},'pxr_client-design-brief_rev0_2026-09-18.pdf',1,'IFC object BLDG is a simplified six-storey building envelope with 92 residences and 1,250 m² commercial area. Its model finished floor is 672.250 m, as recorded in C201. Envelope dimensions and 20 m height are illustrative; they are not architectural design commitments.',(.6,.65,.7))
finish(f,objects,'parkview-exchange','parkview-exchange.ifc')

f,add,objects=create('north-ridge-highway','North Ridge Highway Intersection Upgrade','NRH-26104','north-ridge-highway.ifc')
source='nrh_geometric-design-plan-profile_ifr_2026-09-12.pdf'
for tag,y,width,label in [('RD-EB',-3.5,3.5,'Eastbound through lane'),('RD-WB',0,3.5,'Westbound through lane'),('SH-S',-6,2.5,'South paved shoulder'),('SH-N',3.5,2.5,'North paved shoulder')]:
    add(tag,label,'IfcCivilElement',road(y,width,0,.002),{'Width':f'{width} m','DesignSpeed':'100 km/h','PavedSurfaceWidth':'12.0 m','AvailableEastboundSSD':'165 m','InitialSSDscreen':'185 m, level-road basis; grade effects outstanding','Profile':'L250 m; grades +3% / -3%; K41.67 m/%','Geometry':'Station 0+100 to 0+500; surface display thickness 2 mm is illustrative'},source,3 if tag=='RD-EB' else 1,f'IFC object {tag} is the {label.lower()}. Its width is {width} m on the 12.0 m paved surface. The design speed of IFC object {tag} is 100 km/h. Available eastbound stopping sight distance is 165 m. The profile crest is 671.875 m at chainage 0+300. Final geometry and grade-corrected SSD require review.',(.25,.28,.3) if tag.startswith('RD') else (.5,.5,.48))
add('PAV-ACP','Trial asphalt layer','IfcCivilElement',road(-6,12,0,.110),{'Thickness':'110 mm','Status':'Trial option; structural adequacy not established','TrafficAADT':7200,'TruckShare':'10%','Growth':'1.0% annual non-compounded','SubgradeCBR':'5%'},'nrh_pavement-design-memo_rev0_2026-09-19.pdf',1,'IFC object PAV-ACP is the trial asphalt layer. The thickness of IFC object PAV-ACP is 110 mm. Pavement draft inputs are 7,200 AADT, 10% trucks and 1.0% annual non-compounded growth. This trial section is not a verified structural design.',(.15,.16,.17))
add('PAV-BASE','Trial granular base','IfcCivilElement',road(-6,12,-.110,.250),{'Thickness':'250 mm','Status':'Trial option; structural adequacy not established','TrafficAADT':7200,'TruckShare':'10%','Growth':'1.0% annual non-compounded'},'nrh_pavement-design-memo_rev0_2026-09-19.pdf',1,'IFC object PAV-BASE is the trial granular base layer. Its thickness is 250 mm below the trial 110 mm asphalt layer. Loading must be reconciled with the traffic assessment; no ESAL-based adequacy is claimed.',(.7,.55,.32))
add('ACC-N','Industrial access context','IfcCivilElement',box(289,6,1.8,22,55,.025),{'Arrangement':'North T-intersection; no south access','Station':'0+300','Geometry':'Illustrative access envelope; levels, throat width and tie-in unresolved','TIAAADT':7800,'TIAHeavyVehicles':'14%','TIAGrowth':'2.0% annual non-compounded','TIAMissingHorizon':'2047'},'nrh_traffic-impact-assessment_rev1_2026-09-15.pdf',1,'IFC object ACC-N is the illustrative north industrial access. Traffic assessment inputs are 7,800 AADT, 14% heavy vehicles and 2.0% annual non-compounded growth. The 2047 twenty-year combined traffic horizon is missing. Access geometry is illustrative and has not been designed.',(.4,.43,.45))
finish(f,objects,'north-ridge-highway','north-ridge-highway.ifc')
