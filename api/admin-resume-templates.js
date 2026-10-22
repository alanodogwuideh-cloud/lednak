import { tursoQuery } from 'lib/turso';
import { requireSupabaseAdmin } from 'lib/admin-auth';
export const access = 'public';
export const methods = ['GET','POST','PUT','DELETE'];
const txt=(v,n=160)=>String(v??'').trim().slice(0,n);
const id=()=>crypto.randomUUID();
const color=(v,fallback='#F8831D')=>/^#[0-9a-fA-F]{6}$/.test(v||'')?v:fallback;
const num=(v,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):fallback));
async function schema(){await tursoQuery("CREATE TABLE IF NOT EXISTS custom_resume_templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', base_template TEXT NOT NULL DEFAULT 'classic', config TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)");await tursoQuery("CREATE TABLE IF NOT EXISTS custom_resume_template_versions (id TEXT PRIMARY KEY, template_id TEXT NOT NULL, version INTEGER NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL, config TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(template_id,version))");}
const validBindings=new Set(['contact.fullName','contact.headline','contact.email','contact.phone','contact.location','contact.links','summary','experience','education','skills','projects','certifications','languages','references','title','company','institution','degree','field','startDate','endDate','description','url','category','items','name','issuer','date','proficiency','email','phone','location','bullets','notes']);
function flattenLayers(layers,out=[]){for(const n of Array.isArray(layers)?layers:[]){if(!n||typeof n!=='object')continue;out.push(n);if(Array.isArray(n.children))flattenLayers(n.children,out);}return out;}
function validBindingPath(path){if(!path)return true;if(validBindings.has(path))return true;const parts=String(path).split('.');return parts.length>1&&(['contact','experience','education','skills','projects','certifications','languages','references'].includes(parts[0])&&parts.slice(1).every(p=>/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(p)));}
function validatePublish(config){const layers=flattenLayers(config?.layout);const errors=[];const bindings=layers.flatMap(n=>[n.binding,n.repeatBinding].filter(Boolean).map(String));if(!bindings.includes('contact.fullName'))errors.push('Required binding missing: Full name (contact.fullName).');if(!bindings.some(x=>['experience','education'].includes(x)||x.startsWith('experience.')||x.startsWith('education.')))errors.push('Add a binding to Experience or Education.');layers.forEach(n=>{for(const b of [n.binding,n.repeatBinding].filter(Boolean).map(String)){if(!validBindingPath(b))errors.push('Unknown resume binding "'+b+'" on layer "'+String(n.name||n.id||'Unnamed layer')+'".');}});if(!layers.some(n=>['text','list','bullets'].includes(n.type)||n.binding))errors.push('Add at least one text, list, or bound-data layer.');return [...new Set(errors)];}
function clean(input){
 const c=input?.config&&typeof input.config==='object'?input.config:{};
 const sections=['summary','experience','education','skills','projects','certifications','languages','references'];
 const layout=Array.isArray(c.layout)?c.layout.slice(0,160).map((n,i)=>({
  id:txt(n?.id,80)||String(i),
  name:txt(n?.name,120),
  type:['shape','line','text','list','image','bullets','container'].includes(n?.type)?(n.type==='bullets'?'list':n.type):'text',
  parentId:txt(n?.parentId,80)||null,
  positionMode:['auto','absolute','document'].includes(n?.positionMode)?n.positionMode:((n?.type==='shape'||n?.type==='line')?'absolute':'auto'),
  binding:txt(n?.binding,120),
  repeatBinding:txt(n?.repeatBinding,120),
  text:String(n?.text??'').slice(0,8000),
  x:num(n?.x,0,100,0),y:num(n?.y,0,100,0),w:num(n?.w,2,100,30),h:num(n?.h,.5,100,10),
  color:color(n?.color,n?.type==='container'?'#24272c':'#F8831D'),
  background:n?.background==='transparent'?'transparent':(/^#[0-9a-fA-F]{6}$/.test(n?.background||'')?n.background:'transparent'),fillType:['solid','transparent','gradient'].includes(n?.fillType)?n.fillType:'solid',gradientFrom:color(n?.gradientFrom),gradientTo:color(n?.gradientTo,'#23395B'),backgroundOpacity:num(n?.backgroundOpacity,0,100,100),bleed:!!n?.bleed,
  opacity:num(n?.opacity,0,100,100),borderColor:color(n?.borderColor,color(n?.color)),borderWeight:num(n?.borderWeight,0,12,0),borderStyle:['solid','dashed'].includes(n?.borderStyle)?n.borderStyle:'solid',borderTop:num(n?.borderTop,0,12,n?.borderWeight||0),borderRight:num(n?.borderRight,0,12,n?.borderWeight||0),borderBottom:num(n?.borderBottom,0,12,n?.borderWeight||0),borderLeft:num(n?.borderLeft,0,12,n?.borderWeight||0),radius:num(n?.radius,0,80,8),hideIfEmpty:n?.hideIfEmpty!==false,fontFamily:txt(n?.fontFamily,80),sizing:['hug','fill','fixed'].includes(n?.sizing)?n.sizing:'hug',
  shapeKind:['rect','rounded','ellipse','triangle','diamond','star'].includes(n?.shapeKind)?n.shapeKind:'rect',weight:num(n?.weight,1,12,1),
  fontSize:num(n?.fontSize,7,48,11),fontWeight:num(n?.fontWeight,100,900,400),lineHeight:num(n?.lineHeight,.8,3,1.35),letterSpacing:num(n?.letterSpacing,-2,10,0),rotation:num(n?.rotation,-360,360,0),
  textAlign:['left','center','right'].includes(n?.textAlign)?n.textAlign:'left',textTransform:['none','uppercase','capitalize'].includes(n?.textTransform)?n.textTransform:'none',
  heightMode:['auto','min','fixed'].includes(n?.heightMode)?n.heightMode:'auto',
  layout:['vertical','row','grid','columns2','columns3','free'].includes(n?.layout)?n.layout:'vertical',
  columns:num(n?.columns,1,6,2),gap:num(n?.gap,0,60,8),rowGap:num(n?.rowGap,0,60,8),padding:num(n?.padding,0,60,8),paddingX:num(n?.paddingX,0,60,8),paddingY:num(n?.paddingY,0,60,8),paddingTop:num(n?.paddingTop,0,100,n?.padding||0),paddingRight:num(n?.paddingRight,0,100,n?.padding||0),paddingBottom:num(n?.paddingBottom,0,100,n?.padding||0),paddingLeft:num(n?.paddingLeft,0,100,n?.padding||0),
  align:['stretch','start','center','end'].includes(n?.align)?n.align:'stretch',justify:['start','center','end','between'].includes(n?.justify)?n.justify:'start',
  locked:!!n?.locked,visible:n?.visible!==false,bullet:['disc','circle','square','number'].includes(n?.bullet)?n.bullet:'disc',layer:num(n?.layer,-100,100,i)
 })): [];
 return {name:txt(input?.name,80)||'Untitled template',description:txt(input?.description,240),baseTemplate:/^t(?:[1-9]|1[0-9]|2[0-7])$/.test(input?.baseTemplate)?input.baseTemplate:'t1',config:{
  accent:color(c.accent),font:['Arial','Georgia','Helvetica','Verdana','Trebuchet MS','Times New Roman'].includes(c.font)?c.font:'Arial',
  bodySize:num(c.bodySize,9,12,10),nameSize:num(c.nameSize,20,32,24),spacing:num(c.spacing,8,22,15),
  headingStyle:['underline','plain','accent-block'].includes(c.headingStyle)?c.headingStyle:'underline',headerAlign:['left','center'].includes(c.headerAlign)?c.headerAlign:'center',
  skillStyle:['pills','plain'].includes(c.skillStyle)?c.skillStyle:'pills',pageSize:['letter','a4'].includes(c.pageSize)?c.pageSize:'letter',
  documentLayout:Array.isArray(c.documentLayout)?c.documentLayout.filter((x,i,a)=>sections.includes(x)&&a.indexOf(x)===i):sections,
  documentModelVersion:num(c.documentModelVersion,1,2,1),useCustomDocumentLayout:c.useCustomDocumentLayout===true,layout
 }};
}
export default async function(req,res){
 const auth=await requireSupabaseAdmin(req);if(!auth.ok)return res.status(auth.status).json({error:auth.error});
 try{await schema();
 if(req.method==='GET'&&req.query?.id&&req.query?.versions==='1'){const templateId=txt(req.query.id,80);const {rows}=await tursoQuery('SELECT id,template_id,version,name,status,config,created_at FROM custom_resume_template_versions WHERE template_id=$1 ORDER BY version DESC',[templateId]);return res.json(rows.map(r=>({...r,config:typeof r.config==='string'?JSON.parse(r.config):r.config})));}
 if(req.method==='GET'){const {rows}=await tursoQuery('SELECT id,name,description,status,base_template,config,created_at,updated_at FROM custom_resume_templates ORDER BY updated_at DESC');return res.json(rows.map(r=>({...r,config:typeof r.config==='string'?JSON.parse(r.config):r.config})))}
 if(req.method==='POST'){const v=clean(req.body);const key=id();const status=req.body?.status==='published'?'published':'draft';if(status==='published'){const errors=validatePublish(v.config);if(errors.length)return res.status(422).json({error:'Template cannot be published.',errors});}const configJson=JSON.stringify(v.config);await tursoQuery('INSERT INTO custom_resume_templates (id,name,description,status,base_template,config,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',[key,v.name,v.description,status,v.baseTemplate,configJson]);if(status==='published'){await tursoQuery('INSERT INTO custom_resume_template_versions (id,template_id,version,name,status,config,created_at) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)',[id(),key,1,v.name,'published',configJson]);}return res.status(201).json({id:key,...v,status})}
 const key=txt(req.query?.id||req.body?.id,80);if(!key)return res.status(400).json({error:'Template ID is required.'});
 if(req.method==='DELETE'){const {rows}=await tursoQuery('DELETE FROM custom_resume_templates WHERE id=$1 RETURNING id',[key]);if(!rows.length)return res.status(404).json({error:'Template not found.'});return res.json({ok:true,id:key})}
 const v=clean(req.body);const status=req.body?.status==='published'?'published':'draft';if(status==='published'){const errors=validatePublish(v.config);if(errors.length)return res.status(422).json({error:'Template cannot be published.',errors});}const configJson=JSON.stringify(v.config);const {rows}=await tursoQuery('UPDATE custom_resume_templates SET name=$1,description=$2,status=$3,base_template=$4,config=$5,updated_at=CURRENT_TIMESTAMP WHERE id=$6 RETURNING id,name,description,status,base_template,config,created_at,updated_at',[v.name,v.description,status,v.baseTemplate,configJson,key]);if(!rows.length)return res.status(404).json({error:'Template not found.'});if(status==='published'){const {rows:versions}=await tursoQuery('SELECT COALESCE(MAX(version),0) AS latest FROM custom_resume_template_versions WHERE template_id=$1',[key]);const next=Number(versions[0]?.latest||0)+1;await tursoQuery('INSERT INTO custom_resume_template_versions (id,template_id,version,name,status,config,created_at) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)',[id(),key,next,v.name,'published',configJson]);}return res.json({...rows[0],config:JSON.parse(rows[0].config)});
 }catch(e){console.error('Resume template editor API failed:',e?.message);return res.status(500).json({error:'Template storage is unavailable. Please try again.'})}
}