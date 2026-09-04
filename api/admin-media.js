import { requireSupabaseAdmin } from 'lib/admin-auth';
import { db } from 'hatchable';

export const access='public';
export const methods=['GET','POST','PATCH','DELETE'];

const base=()=>process.env.SUPABASE_URL;
const key=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;
const h=()=>({apikey:key(),Authorization:'Bearer '+key()});
const sectionMap={research:'research',chinedu_persona:'personas',fatima_persona:'personas',storyboard:'process',wireframes:'process',usability_testing:'usability',mobile_final_ui:'final',web_final_ui:'final'};
const allowed=['research','chinedu_persona','fatima_persona','storyboard','wireframes','usability_testing','mobile_final_ui','web_final_ui'];

function safeName(n){return String(n||'image').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,160)}
function imageId(si,ii){return `${si}:${ii}`}
function parseImageId(id){const m=String(id||'').match(/^(\d+):(\d+)$/);return m?{si:Number(m[1]),ii:Number(m[2])}:null}
function publicUrl(path){return base()+'/storage/v1/object/public/portfolio-images/'+path}
async function deleteUrl(url){const marker='/storage/v1/object/public/portfolio-images/';const i=String(url||'').indexOf(marker);if(i<0)return;const path=String(url).slice(i+marker.length);await fetch(base()+'/storage/v1/object/portfolio-images/'+path,{method:'DELETE',headers:h()}).catch(()=>{});}
async function getCase(id){const {rows}=await db.query('SELECT * FROM case_studies WHERE id=$1 LIMIT 1',[id]);return rows[0]||null}
function mediaFromCase(c){const sections=Array.isArray(c?.content?.sections)?c.content.sections:[];const images=[];sections.forEach((s,si)=>{(Array.isArray(s.images)?s.images:[]).forEach((x,ii)=>images.push({...x,id:imageId(si,ii),section_index:si,image_index:ii}))});return images}
function updateSections(c,sections){return {...c.content,sections};}
async function saveContent(id,content){const {rows}=await db.query('UPDATE case_studies SET content=$1,updated_at=now() WHERE id=$2 RETURNING *',[content,id]);return rows[0]||null;}
async function storageSigned(path){const r=await fetch(base()+'/storage/v1/object/upload/sign/portfolio-images/'+path,{method:'POST',headers:{...h(),'Content-Type':'application/json'},body:JSON.stringify({upsert:true})});const text=await r.text();let d=null;try{d=text?JSON.parse(text):null}catch{d=text}if(!r.ok)throw Error(typeof d==='string'?d:(d?.message||d?.error||'Could not create a signed upload URL.'));const raw=String(d?.url||'');if(!raw)throw Error('Supabase did not return a signed upload URL.');const signedUrl=new URL(raw.startsWith('/storage/v1/')?base()+raw:base()+'/storage/v1'+(raw.startsWith('/')?raw:'/'+raw));return signedUrl.toString();}

export default async function(req,res){
 try{
  const a=await requireSupabaseAdmin(req);if(!a.ok)return res.status(a.status).json({error:a.error});
  if(req.method==='GET'){
   const id=String(req.query?.project_id||'');if(!id)return res.status(400).json({error:'Missing project_id.'});
   const c=await getCase(id);if(!c)return res.status(404).json({error:'Case study not found.'});
   return res.json({project:c,images:mediaFromCase(c),sections:(c.content?.sections||[]).map((s,i)=>({id:`section-${i}`,title:s.title,section_type:s.type||s.section_type||'content',display_order:i}))});
  }
  if(req.method==='POST'){
   const action=req.body?.action;
   if(action==='prepare_upload'){
    const id=String(req.body?.project_id||'');const filename=req.body?.filename;const contentType=String(req.body?.content_type||'application/octet-stream').toLowerCase();
    if(!id||!filename)return res.status(400).json({error:'Please choose a case study and file.'});
    const c=await getCase(id);if(!c)return res.status(404).json({error:'Case study not found.'});
    const supported=['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','video/mp4','video/webm','video/quicktime'];if(!supported.includes(contentType))return res.status(400).json({error:'Unsupported media type. Use PNG, JPG, WebP, GIF, SVG, MP4, WebM, or MOV.'});
    const path=`portfolio/${c.slug}/${Date.now()}-${safeName(filename)}`;const signedUrl=await storageSigned(path);
    return res.json({signedUrl,path,publicUrl:publicUrl(path),contentType,projectId:id,replaceFixed:req.body?.replace_fixed||null,replaceImageId:req.body?.replace_image_id||null});
   }
   if(action==='finalize_upload'){
    const id=String(req.body?.project_id||'');const url=String(req.body?.url||'');const type=String(req.body?.asset_type||'');const alt=String(req.body?.alt_text||'');const caption=String(req.body?.caption||'');const order=Math.max(0,Number(req.body?.display_order||0));const replaceFixed=req.body?.replace_fixed;const replaceImageId=req.body?.replace_image_id;
    if(!id||!url)return res.status(400).json({error:'Missing uploaded media details.'});const c=await getCase(id);if(!c)return res.status(404).json({error:'Case study not found.'});
    if(replaceFixed){if(!['cover','hero'].includes(replaceFixed))return res.status(400).json({error:'Invalid replacement target.'});const field=replaceFixed+'_image_url';const old=c[field]||'';const {rows}=await db.query(`UPDATE case_studies SET ${field}=$1,updated_at=now() WHERE id=$2 RETURNING *`,[url,id]);await deleteUrl(old);return res.json({kind:replaceFixed,url,project:rows[0]});}
    const parsed=parseImageId(replaceImageId);if(replaceImageId&&!parsed)return res.status(400).json({error:'Invalid media item.'});
    let sections=Array.isArray(c.content?.sections)?c.content.sections.map(s=>({...s,images:Array.isArray(s.images)?s.images.slice():[]})):[];
    if(replaceImageId){const s=sections[parsed.si];const old=s?.images?.[parsed.ii];if(!old)return res.status(404).json({error:'Media item not found.'});s.images[parsed.ii]={...old,image_url:url};await saveContent(id,updateSections(c,sections));await deleteUrl(old.image_url);return res.json({kind:'gallery',url,image:{...s.images[parsed.ii],id:replaceImageId}});}
    if(!allowed.includes(type))return res.status(400).json({error:'Invalid asset type.'});const target=sectionMap[type];let si=sections.findIndex(s=>(s.section_type||s.type)===target);if(si<0)si=sections.findIndex(s=>String(s.title||'').toLowerCase().includes(target));if(si<0)return res.status(400).json({error:'No matching case-study section exists for '+type+'. Add that section first.'});
    const imgs=sections[si].images||[];imgs.push({image_url:url,image_type:type,alt_text:alt,caption,display_order:order});imgs.sort((a,b)=>Number(a.display_order||0)-Number(b.display_order||0));sections[si].images=imgs;const saved=await saveContent(id,updateSections(c,sections));const ii=sections[si].images.findIndex(x=>x.image_url===url);return res.status(201).json({kind:'gallery',url,image:{...sections[si].images[ii],id:imageId(si,ii)},project:saved});
   }
   const file=req.files?.find(x=>x.field==='file')||req.files?.[0];return res.status(400).json({error:file?'Use the upload flow provided by the admin panel.':'Please choose a file.'});
  }
  if(req.method==='PATCH'){
   const id=String(req.body?.id||'');const parsed=parseImageId(id);if(!parsed)return res.status(400).json({error:'Missing or invalid image id.'});
   const projectId=String(req.body?.project_id||'');let c=projectId?await getCase(projectId):null;
   if(!c){const {rows}=await db.query('SELECT * FROM case_studies WHERE content->\'sections\' @> $1::jsonb LIMIT 1',[JSON.stringify([{images:[]}])]).catch(()=>({rows:[]}));c=rows[0]||null;}
   if(!c)return res.status(400).json({error:'Case study is required to edit this media.'});
   const sections=Array.isArray(c.content?.sections)?c.content.sections.map(s=>({...s,images:Array.isArray(s.images)?s.images.slice():[]})):[];const x=sections[parsed.si]?.images?.[parsed.ii];if(!x)return res.status(404).json({error:'Media item not found.'});
   if(req.body.caption!==undefined)x.caption=String(req.body.caption);if(req.body.alt_text!==undefined)x.alt_text=String(req.body.alt_text);if(req.body.display_order!==undefined)x.display_order=Math.max(0,Number(req.body.display_order)||0);sections[parsed.si].images.sort((a,b)=>Number(a.display_order||0)-Number(b.display_order||0));const saved=await saveContent(c.id,updateSections(c,sections));const all=mediaFromCase(saved);return res.json(all.find(m=>m.image_url===x.image_url)||x);
  }
  if(req.method==='DELETE'){
   const fixed=req.body?.fixed;const projectId=String(req.body?.project_id||'');if(fixed&&projectId){if(!['cover','hero'].includes(fixed))return res.status(400).json({error:'Invalid fixed image.'});const c=await getCase(projectId);if(!c)return res.status(404).json({error:'Case study not found.'});const field=fixed+'_image_url';const old=c[field]||'';await db.query(`UPDATE case_studies SET ${field}=$1,updated_at=now() WHERE id=$2`,['',projectId]);await deleteUrl(old);return res.json({ok:true});}
   const parsed=parseImageId(req.body?.id);if(!parsed)return res.status(400).json({error:'Missing image id.'});const c=projectId?await getCase(projectId):null;if(!c)return res.status(400).json({error:'Case study is required to delete this media.'});const sections=Array.isArray(c.content?.sections)?c.content.sections.map(s=>({...s,images:Array.isArray(s.images)?s.images.slice():[]})):[];const old=sections[parsed.si]?.images?.[parsed.ii];if(!old)return res.status(404).json({error:'Media item not found.'});sections[parsed.si].images.splice(parsed.ii,1);await saveContent(c.id,updateSections(c,sections));await deleteUrl(old.image_url);return res.json({ok:true});
  }
  return res.status(405).json({error:'Method not allowed'});
 }catch(e){return res.status(500).json({error:e.message||'Media operation failed.'});}
}