import { requireSupabaseAdmin } from 'lib/admin-auth';
export const access='public';
export const methods=['GET','POST','PUT','DELETE'];
const base=()=>process.env.SUPABASE_URL;
const key=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers=()=>({apikey:key(),Authorization:'Bearer '+key(),'Content-Type':'application/json'});
async function sb(path,opts={}){const r=await fetch(base()+'/rest/v1/'+path,{...opts,headers:{...headers(),...(opts.headers||{})}});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(typeof d==='string'?d:(d?.message||d?.hint||'Supabase request failed'));return d;}
function map(p){return {...p,status:p.published?'published':'draft',sort_order:p.display_order};}
async function deleteStorageUrl(url){if(!url)return;const marker='/storage/v1/object/public/portfolio-images/';const i=String(url).indexOf(marker);if(i<0)return;const path=String(url).slice(i+marker.length);if(!path)return;await fetch(base()+'/storage/v1/object/portfolio-images/'+path,{method:'DELETE',headers:{apikey:key(),Authorization:'Bearer '+key()}}).catch(()=>{});}
export default async function(req,res){
 try{
  const a=await requireSupabaseAdmin(req);if(!a.ok)return res.status(a.status).json({error:a.error});
  if(req.method==='GET'){const rows=await sb('projects?select=*&order=display_order.asc,created_at.asc');return res.json((rows||[]).map(map));}
  const b=req.body||{};
  if(req.method==='POST'){
   if(!b.title||!b.slug)return res.status(400).json({error:'Title and slug are required.'});
   const row={title:b.title,slug:b.slug,short_description:b.short_description||b.subtitle||'',overview:b.overview||b.description||'',role:b.role||'UX Designer',client:b.client||'',year:b.year||'',duration:b.duration||'',category:b.category||'UX / Product Design',cover_image_url:b.cover_image_url||'',hero_image_url:b.hero_image_url||'',featured:b.featured!==undefined?!!b.featured:true,published:b.status==='published',display_order:Number(b.sort_order)||0};
   const d=await sb('projects',{method:'POST',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify(row)});return res.status(201).json(map(d?.[0]||d));
  }
  if(req.method==='PUT'){
   if(!b.id)return res.status(400).json({error:'Missing case study id.'});
   const current=(await sb('projects?select=*&id=eq.'+encodeURIComponent(b.id)+'&limit=1'))?.[0];if(!current)return res.status(404).json({error:'Case study not found.'});
   const row={title:b.title,slug:b.slug,short_description:b.short_description||b.subtitle||'',overview:b.overview||b.description||'',role:b.role||'',client:b.client||'',year:b.year||'',duration:b.duration||'',category:b.category||'',cover_image_url:b.cover_image_url!==undefined?b.cover_image_url:current.cover_image_url,hero_image_url:b.hero_image_url!==undefined?b.hero_image_url:current.hero_image_url,published:b.status==='published',display_order:Number(b.sort_order)||0,updated_at:new Date().toISOString()};
   const d=await sb('projects?id=eq.'+encodeURIComponent(b.id),{method:'PATCH',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify(row)});return res.json(map(d?.[0]||d));
  }
  if(req.method==='DELETE'){
   if(!b.id)return res.status(400).json({error:'Missing case study id.'});
   const current=(await sb('projects?select=*&id=eq.'+encodeURIComponent(b.id)+'&limit=1'))?.[0];if(!current)return res.status(404).json({error:'Case study not found.'});
   const [images]=await Promise.all([sb('project_images?select=image_url&project_id=eq.'+encodeURIComponent(b.id))]);
   for(const img of images||[])await deleteStorageUrl(img.image_url);
   await deleteStorageUrl(current.cover_image_url);await deleteStorageUrl(current.hero_image_url);
   await sb('project_images?project_id=eq.'+encodeURIComponent(b.id),{method:'DELETE'});
   await sb('case_study_sections?project_id=eq.'+encodeURIComponent(b.id),{method:'DELETE'});
   await sb('projects?id=eq.'+encodeURIComponent(b.id),{method:'DELETE'});
   return res.json({ok:true});
  }
  return res.status(405).json({error:'Method not allowed'});
 }catch(e){return res.status(500).json({error:e.message||'Case study operation failed.'});}
}