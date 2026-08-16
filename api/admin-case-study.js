import { requireSupabaseAdmin } from 'lib/admin-auth';
import { db } from 'hatchable';
export const access='public';
export const methods=['GET','POST','PUT','DELETE'];
function getSections(project){const s=project?.content?.sections;return Array.isArray(s)?s:[]}
function normalize(project){return getSections(project).map((s,i)=>({...s,id:`${project.id}:${i}`,display_order:i+1,section_type:s.type||'content',body:s.body??s.text??''}));}
async function getProject(id){const {rows}=await db.query('SELECT * FROM case_studies WHERE id=$1 LIMIT 1',[id]);return rows[0]}
const sbBase=()=>process.env.SUPABASE_URL;const sbKey=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;const sbHeaders=()=>({apikey:sbKey(),Authorization:'Bearer '+sbKey()});
async function sb(path){const r=await fetch(sbBase()+'/rest/v1/'+path,{headers:sbHeaders()});if(!r.ok)return [];return await r.json().catch(()=>[])}
async function getImages(project){if(!project)return [];return getSections(project).flatMap((s,si)=>(Array.isArray(s.images)?s.images:[]).map((x,ii)=>({...x,id:`${si}:${ii}`,section_index:si,image_index:ii})));}
async function saveSections(id,sections){const {rows}=await db.query('UPDATE case_studies SET content=$1,updated_at=now() WHERE id=$2 RETURNING *',[{sections},id]);return rows[0]}
export default async function(req,res){
 try{
  const a=await requireSupabaseAdmin(req);if(!a.ok)return res.status(a.status).json({error:a.error});
  const q=req.query||{},b=req.body||{},projectId=q.project_id||b.project_id;
  if(!projectId)return res.status(400).json({error:'Missing project_id.'});
  const project=await getProject(projectId);if(!project)return res.status(404).json({error:'Case study not found.'});
  if(req.method==='GET')return res.json({project,sections:normalize(project),images:await getImages(project)});
  const sections=getSections(project);
  if(req.method==='POST'){
   sections.push({type:b.section_type||'content',title:b.title||'',body:b.body||'',text:b.body||'',items:Array.isArray(b.items)?b.items:undefined,metadata:b.metadata||{},images:[]});
   const saved=await saveSections(projectId,sections);const out=normalize(saved);return res.status(201).json(out[out.length-1]);
  }
  if(req.method==='PUT'){
   if(b.replace_all===true&&Array.isArray(b.sections)){const cleaned=b.sections.map((s,i)=>{const existing=sections[i]||{};return {type:s.section_type||s.type||existing.type||'content',title:s.title??existing.title??'',body:s.body??s.text??existing.body??existing.text??'',text:s.body??s.text??existing.text??existing.body??'',items:Array.isArray(s.items)?s.items:existing.items,metadata:s.metadata??existing.metadata??{},images:Array.isArray(s.images)?s.images:(Array.isArray(existing.images)?existing.images:[])};});const saved=await saveSections(projectId,cleaned);return res.json({project:saved,sections:normalize(saved),images:await getImages(saved)});}
   if(!b.id)return res.status(400).json({error:'Missing section id.'});
   const idx=Number(String(b.id).split(':').pop());if(!Number.isInteger(idx)||idx<0||idx>=sections.length)return res.status(404).json({error:'Section not found.'});
   sections[idx]={...sections[idx],type:b.section_type||sections[idx].type||'content',title:b.title??sections[idx].title,body:b.body??sections[idx].body??sections[idx].text??'',text:b.body??sections[idx].text??sections[idx].body??'',items:Array.isArray(b.items)?b.items:sections[idx].items,metadata:b.metadata??sections[idx].metadata??{}};
   const saved=await saveSections(projectId,sections);return res.json(normalize(saved)[idx]);
  }
  if(req.method==='DELETE'){
   if(!b.id)return res.status(400).json({error:'Missing section id.'});const idx=Number(String(b.id).split(':').pop());if(!Number.isInteger(idx)||idx<0||idx>=sections.length)return res.status(404).json({error:'Section not found.'});
   sections.splice(idx,1);await saveSections(projectId,sections);return res.json({ok:true});
  }
  return res.status(405).json({error:'Method not allowed'});
 }catch(e){return res.status(500).json({error:e.message||'Case study section operation failed.'});}
}