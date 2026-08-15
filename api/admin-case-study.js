import { requireSupabaseAdmin } from 'lib/admin-auth';
export const access='public';
export const methods=['GET','POST','PUT','DELETE'];
const base=()=>process.env.SUPABASE_URL;const key=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;const headers=()=>({apikey:key(),Authorization:'Bearer '+key(),'Content-Type':'application/json'});
async function sb(path,opts={}){const r=await fetch(base()+'/rest/v1/'+path,{...opts,headers:{...headers(),...(opts.headers||{})}});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(typeof d==='string'?d:(d?.message||d?.hint||'Supabase request failed'));return d;}
export default async function(req,res){try{
 const a=await requireSupabaseAdmin(req);if(!a.ok)return res.status(a.status).json({error:a.error});
 const q=req.query||{},b=req.body||{},projectId=q.project_id||b.project_id;
 if(req.method==='GET'){
  if(!projectId)return res.status(400).json({error:'Missing project_id.'});
  const project=(await sb('projects?select=*&id=eq.'+encodeURIComponent(projectId)+'&limit=1'))?.[0];if(!project)return res.status(404).json({error:'Case study not found.'});
  const [sections,images]=await Promise.all([sb('case_study_sections?select=*&project_id=eq.'+encodeURIComponent(projectId)+'&order=display_order.asc,created_at.asc'),sb('project_images?select=*&project_id=eq.'+encodeURIComponent(projectId)+'&order=display_order.asc,created_at.asc')]);
  return res.json({project,sections,images});
 }
 if(req.method==='POST'){
  if(!projectId)return res.status(400).json({error:'Missing project_id.'});
  const row={project_id:projectId,section_type:b.section_type||'content',title:b.title||'',body:b.body||'',metadata:b.metadata||{},display_order:Number(b.display_order)||0};
  const d=await sb('case_study_sections',{method:'POST',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify(row)});return res.status(201).json(d?.[0]||d);
 }
 if(req.method==='PUT'){
  if(!b.id)return res.status(400).json({error:'Missing section id.'});
  const row={section_type:b.section_type||'content',title:b.title||'',body:b.body||'',metadata:b.metadata||{},display_order:Number(b.display_order)||0,updated_at:new Date().toISOString()};
  const d=await sb('case_study_sections?id=eq.'+encodeURIComponent(b.id),{method:'PATCH',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify(row)});return res.json(d?.[0]||d);
 }
 if(req.method==='DELETE'){
  if(!b.id)return res.status(400).json({error:'Missing section id.'});
  await sb('case_study_sections?id=eq.'+encodeURIComponent(b.id),{method:'DELETE'});return res.json({ok:true});
 }
 return res.status(405).json({error:'Method not allowed'});
}catch(e){return res.status(500).json({error:e.message||'Case study section operation failed.'});}}