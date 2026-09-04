import { requireSupabaseAdmin } from 'lib/admin-auth';
import { supabaseRequest, storageDeleteByUrl, supabaseBase } from 'lib/supabase-admin';
export const access='public';
export const methods=['GET','POST','PATCH','DELETE'];

const safeName=n=>String(n||'image').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,160);
const supported=['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','video/mp4','video/webm','video/quicktime'];
const sectionTypeMap={research:['research'],chinedu_persona:['personas'],fatima_persona:['personas'],storyboard:['process'],paper_wireframe:['process'],low_fi_wireframe:['process'],wireframes:['process'],usability_testing:['usability'],mobile_final_ui:['usability'],web_final_ui:['usability']};
const titleMap={research:'Research',chinedu_persona:'Who I Designed For',fatima_persona:'Who I Designed For',storyboard:'From Context to Concept',paper_wireframe:'Design Exploration',low_fi_wireframe:'Design Exploration',wireframes:'Design Exploration',usability_testing:'What Usability Testing Revealed',mobile_final_ui:'Final Experience & Accessibility',web_final_ui:'Final Experience & Accessibility'};

async function getProject(id){const rows=await supabaseRequest('projects?id=eq.'+encodeURIComponent(id)+'&select=*');return rows?.[0]||null}
async function getSections(id){return await supabaseRequest('case_study_sections?project_id=eq.'+encodeURIComponent(id)+'&select=*&order=display_order.asc,created_at.asc')||[]}
async function getImages(id){return await supabaseRequest('project_images?project_id=eq.'+encodeURIComponent(id)+'&select=*&order=display_order.asc,created_at.asc')||[]}
async function findSection(projectId,type){const wanted=sectionTypeMap[type]||[];let sections=await getSections(projectId);let section=sections.find(s=>wanted.includes(String(s.section_type)));if(!section&&titleMap[type])section=sections.find(s=>String(s.title||'').trim().toLowerCase()===titleMap[type].toLowerCase());return section||null}
function publicUrlForPath(path){return supabaseBase()+'/storage/v1/object/public/portfolio-images/'+path}
async function sendStored(res,url){const r=await fetch(url);if(!r.ok)return res.status(404).send('Media preview not found.');res.setHeader('Content-Type',r.headers.get('content-type')||'application/octet-stream');res.setHeader('Cache-Control','public, max-age=3600');return res.send(Buffer.from(await r.arrayBuffer()));}

export default async function(req,res){
 try{
  const a=await requireSupabaseAdmin(req);if(!a.ok)return res.status(a.status).json({error:a.error});
  const q=req.query||{},b=req.body||{},projectId=q.project_id||b.project_id;
  if(req.method==='GET'){
    if(!projectId)return res.status(400).json({error:'Missing project_id.'});
    const p=await getProject(projectId);if(!p)return res.status(404).json({error:'Case study not found.'});
    if(q.preview_image_id){const rows=await supabaseRequest('project_images?id=eq.'+encodeURIComponent(q.preview_image_id)+'&select=image_url');if(!rows?.[0]?.image_url)return res.status(404).send('Media preview not found.');return sendStored(res,rows[0].image_url)}
    if(q.preview_fixed){if(!['cover','hero'].includes(q.preview_fixed))return res.status(400).send('Invalid fixed media.');const url=p[q.preview_fixed+'_image_url'];if(!url)return res.status(404).send('Media preview not found.');return sendStored(res,url)}
    const [sections,images]=await Promise.all([getSections(projectId),getImages(projectId)]);const titles=Object.fromEntries(sections.map(s=>[s.id,s.title||'']));return res.json({project:p,images:images.map(x=>({...x,section_title:titles[x.section_id]||''})),sections:sections.map((s,i)=>({id:s.id,title:s.title||'',section_type:s.section_type||'content',display_order:s.display_order||i+1}))});
  }

  if(!projectId)return res.status(400).json({error:'Missing project_id.'});
  if(req.method==='POST'&&b.action==='prepare_upload'){
    if(!b.filename)return res.status(400).json({error:'Choose a file.'});
    const p=await getProject(projectId);if(!p)return res.status(404).json({error:'Case study not found.'});
    const contentType=String(b.content_type||'application/octet-stream').toLowerCase();if(!supported.includes(contentType))return res.status(400).json({error:'Unsupported media type.'});
    if(b.replace_fixed&&!['cover','hero'].includes(b.replace_fixed))return res.status(400).json({error:'Invalid fixed replacement target.'});
    if(b.replace_image_id){const old=await supabaseRequest('project_images?id=eq.'+encodeURIComponent(b.replace_image_id)+'&project_id=eq.'+encodeURIComponent(projectId)+'&select=id');if(!old?.[0])return res.status(404).json({error:'Media item not found.'});}
    const path=`portfolio/${p.slug}/${Date.now()}-${safeName(b.filename)}`;
    const signed=await fetch(supabaseBase()+'/storage/v1/object/upload/sign/portfolio-images/'+path,{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({upsert:false})});
    const text=await signed.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}if(!signed.ok||!data?.url)throw new Error(typeof data==='string'?data:(data?.message||'Could not create a Supabase upload URL.'));
    const raw=String(data.url);const signedUrl=new URL(raw.startsWith('/storage/v1/')?supabaseBase()+raw:supabaseBase()+'/storage/v1'+(raw.startsWith('/')?raw:'/'+raw));
    return res.json({signedUrl:signedUrl.toString(),publicUrl:publicUrlForPath(path),contentType,projectId,replaceFixed:b.replace_fixed||null,replaceImageId:b.replace_image_id||null});
  }

  if(req.method==='POST'&&b.action==='finalize_upload'){
    if(!b.url)return res.status(400).json({error:'Missing uploaded media details.'});
    const p=await getProject(projectId);if(!p)return res.status(404).json({error:'Case study not found.'});
    if(!String(b.url).startsWith(supabaseBase()+'/storage/v1/object/public/portfolio-images/'))return res.status(400).json({error:'Invalid Supabase media URL.'});
    if(b.replace_fixed){if(!['cover','hero'].includes(b.replace_fixed))return res.status(400).json({error:'Invalid fixed replacement target.'});const old=p[b.replace_fixed+'_image_url']||'';const rows=await supabaseRequest('projects?id=eq.'+encodeURIComponent(projectId)+'&select=*',{method:'PATCH',headers:{Prefer:'return=representation'},body:{[b.replace_fixed+'_image_url']:b.url,updated_at:new Date().toISOString()}});await storageDeleteByUrl(old);return res.json({kind:b.replace_fixed,url:b.url,project:rows[0]});}
    if(b.replace_image_id){const old=await supabaseRequest('project_images?id=eq.'+encodeURIComponent(b.replace_image_id)+'&project_id=eq.'+encodeURIComponent(projectId)+'&select=image_url');if(!old?.[0])return res.status(404).json({error:'Media item not found.'});const rows=await supabaseRequest('project_images?id=eq.'+encodeURIComponent(b.replace_image_id)+'&project_id=eq.'+encodeURIComponent(projectId)+'&select=*',{method:'PATCH',headers:{Prefer:'return=representation'},body:{image_url:b.url}});await storageDeleteByUrl(old[0].image_url);return res.json({kind:'gallery',url:b.url,image:rows[0]});}
    if(!['research','chinedu_persona','fatima_persona','storyboard','paper_wireframe','low_fi_wireframe','wireframes','usability_testing','mobile_final_ui','web_final_ui'].includes(b.asset_type))return res.status(400).json({error:'Invalid asset type.'});
    const section=await findSection(projectId,b.asset_type);if(!section)return res.status(400).json({error:`No matching case-study section exists for ${b.asset_type}. Add that section first.`});
    const rows=await supabaseRequest('project_images?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:{project_id:projectId,section_id:section.id,image_url:b.url,image_type:b.asset_type,alt_text:String(b.alt_text||''),caption:String(b.caption||''),display_order:Math.max(0,Number(b.display_order||0))}});
    return res.status(201).json({kind:'gallery',url:b.url,image:rows[0]});
  }

  if(req.method==='PATCH'){
    if(!b.id)return res.status(400).json({error:'Missing image id.'});
    const rows=await supabaseRequest('project_images?id=eq.'+encodeURIComponent(b.id)+'&project_id=eq.'+encodeURIComponent(projectId)+'&select=*',{method:'PATCH',headers:{Prefer:'return=representation'},body:{...(b.display_order!==undefined?{display_order:Math.max(0,Number(b.display_order)||0)}:{}),...(b.alt_text!==undefined?{alt_text:String(b.alt_text)}:{}),...(b.caption!==undefined?{caption:String(b.caption)}:{})}});
    if(!rows?.[0])return res.status(404).json({error:'Media item not found.'});return res.json(rows[0]);
  }

  if(req.method==='DELETE'){
    const p=await getProject(projectId);if(!p)return res.status(404).json({error:'Case study not found.'});
    if(b.fixed){if(!['cover','hero'].includes(b.fixed))return res.status(400).json({error:'Invalid fixed image.'});const old=p[b.fixed+'_image_url']||'';await supabaseRequest('projects?id=eq.'+encodeURIComponent(projectId),{method:'PATCH',body:{[b.fixed+'_image_url']:'',updated_at:new Date().toISOString()}});await storageDeleteByUrl(old);return res.json({ok:true});}
    if(!b.id)return res.status(400).json({error:'Missing image id.'});
    const rows=await supabaseRequest('project_images?id=eq.'+encodeURIComponent(b.id)+'&project_id=eq.'+encodeURIComponent(projectId)+'&select=image_url');if(!rows?.[0])return res.status(404).json({error:'Media item not found.'});
    await supabaseRequest('project_images?id=eq.'+encodeURIComponent(b.id)+'&project_id=eq.'+encodeURIComponent(projectId),{method:'DELETE'});await storageDeleteByUrl(rows[0].image_url);return res.json({ok:true});
  }
  return res.status(405).json({error:'Method not allowed'});
 }catch(e){return res.status(500).json({error:e.message||'Media operation failed.'});}
}