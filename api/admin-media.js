import { requireSupabaseAdmin } from 'lib/admin-auth';
import { db } from 'hatchable';
export const access='public';
export const methods=['GET','POST','PATCH','DELETE'];
const base=()=>String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const key=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers=()=>({apikey:key(),Authorization:'Bearer '+key()});
const safeName=n=>String(n||'image').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,160);
function contentOf(p){return p?.content&&typeof p.content==='object'?p.content:{sections:[]}}
function sectionsOf(p){const s=contentOf(p).sections;return Array.isArray(s)?s:[]}
function imageId(projectId,si,ii){return `${projectId}:${si}:${ii}`}
function parseImageId(id){const m=String(id||'').match(/^([^:]+):([0-9]+):([0-9]+)$/);return m?{si:Number(m[2]),ii:Number(m[3])}:null}
function flatten(p){return sectionsOf(p).flatMap((s,si)=>(Array.isArray(s.images)?s.images:[]).map((x,ii)=>({...x,id:imageId(p.id,si,ii),section_id:imageId(p.id,si,0).split(':').slice(0,2).join(':'),section_title:s.title||''})))}
function urlToPath(url){const marker='/storage/v1/object/public/portfolio-images/';const i=String(url||'').indexOf(marker);return i<0?'':String(url).slice(i+marker.length)}
async function deleteUrl(url){const path=urlToPath(url);if(!path)return;await fetch(base()+'/storage/v1/object/portfolio-images/'+path,{method:'DELETE',headers:headers()}).catch(()=>{})}
async function getProject(id){const {rows}=await db.query('SELECT * FROM case_studies WHERE id=$1 LIMIT 1',[id]);return rows[0]||null}
async function saveContent(id,content){const {rows}=await db.query('UPDATE case_studies SET content=$1,updated_at=now() WHERE id=$2 RETURNING *',[content,id]);return rows[0]}
function fixedUrl(p,kind){return kind==='cover'?p?.cover_image_url:p?.hero_image_url}
async function setFixed(id,kind,url){return await db.query(`UPDATE case_studies SET ${kind==='cover'?'cover_image_url':'hero_image_url'}=$1,updated_at=now() WHERE id=$2 RETURNING *`,[url,id])}
const sectionTitle={research:'Research',chinedu_persona:'Who I Designed For',fatima_persona:'Who I Designed For',storyboard:'From Context to Concept',wireframes:'Design Exploration',usability_testing:'What Usability Testing Revealed',mobile_final_ui:'Final Experience & Accessibility',web_final_ui:'Final Experience & Accessibility'};
const allowed=['research','chinedu_persona','fatima_persona','storyboard','wireframes','usability_testing','mobile_final_ui','web_final_ui'];
function sectionIndexForType(p,type){const wanted=sectionTitle[type];return sectionsOf(p).findIndex(s=>String(s.title||'').trim().toLowerCase()===wanted.toLowerCase())}
async function fetchStored(url){const r=await fetch(url);if(!r.ok)throw new Error('Stored media could not be loaded.');return r}
export default async function(req,res){
 try{
  const a=await requireSupabaseAdmin(req);if(!a.ok)return res.status(a.status).json({error:a.error});
  const q=req.query||{},b=req.body||{},projectId=q.project_id||b.project_id;
  if(req.method==='GET'){
   if(!projectId)return res.status(400).json({error:'Missing project_id.'});
   const p=await getProject(projectId);if(!p)return res.status(404).json({error:'Case study not found.'});
   if(q.preview_image_id){const item=flatten(p).find(x=>x.id===String(q.preview_image_id));if(!item?.image_url)return res.status(404).send('Media preview not found.');const r=await fetchStored(item.image_url);res.setHeader('Content-Type',r.headers.get('content-type')||'application/octet-stream');return res.send(Buffer.from(await r.arrayBuffer()));}
   if(q.preview_fixed){if(!['cover','hero'].includes(q.preview_fixed))return res.status(400).send('Invalid fixed media.');const url=fixedUrl(p,q.preview_fixed);if(!url)return res.status(404).send('Media preview not found.');const r=await fetchStored(url);res.setHeader('Content-Type',r.headers.get('content-type')||'application/octet-stream');return res.send(Buffer.from(await r.arrayBuffer()));}
   return res.json({project:p,images:flatten(p),sections:sectionsOf(p).map((s,i)=>({id:`${p.id}:${i}`,title:s.title||'',section_type:s.type||'content',display_order:i+1}))});
  }
  if(req.method==='POST'){
   if(b.action==='prepare_upload'){
    if(!projectId||!b.filename)return res.status(400).json({error:'Choose a case study and file.'});
    const p=await getProject(projectId);if(!p)return res.status(404).json({error:'Case study not found.'});
    const contentType=String(b.content_type||'application/octet-stream').toLowerCase();
    const supported=[...['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'],...['video/mp4','video/webm','video/quicktime']];
    if(!supported.includes(contentType))return res.status(400).json({error:'Unsupported media type.'});
    if(b.replace_fixed&&!['cover','hero'].includes(b.replace_fixed))return res.status(400).json({error:'Invalid fixed replacement target.'});
    if(b.replace_image_id&&!flatten(p).some(x=>x.id===String(b.replace_image_id)))return res.status(404).json({error:'Media item not found.'});
    const path=`portfolio/${p.slug}/${Date.now()}-${safeName(b.filename)}`;
    const signed=await fetch(base()+'/storage/v1/object/upload/sign/portfolio-images/'+path,{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({upsert:true})});
    const text=await signed.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}
    if(!signed.ok||!data?.url)throw new Error(typeof data==='string'?data:(data?.message||'Could not create a signed upload URL.'));
    const raw=String(data.url);const signedUrl=new URL(raw.startsWith('/storage/v1/')?base()+raw:base()+'/storage/v1'+(raw.startsWith('/')?raw:'/'+raw));
    return res.json({signedUrl:signedUrl.toString(),publicUrl:base()+'/storage/v1/object/public/portfolio-images/'+path,contentType,projectId,replaceFixed:b.replace_fixed||null,replaceImageId:b.replace_image_id||null});
   }
   if(b.action==='finalize_upload'){
    if(!projectId||!b.url)return res.status(400).json({error:'Missing uploaded media details.'});
    const p=await getProject(projectId);if(!p)return res.status(404).json({error:'Case study not found.'});
    if(!String(b.url).startsWith(base()+'/storage/v1/object/public/portfolio-images/'))return res.status(400).json({error:'Invalid uploaded media URL.'});
    if(b.replace_fixed){const old=fixedUrl(p,b.replace_fixed);if(!['cover','hero'].includes(b.replace_fixed))return res.status(400).json({error:'Invalid fixed replacement target.'});const saved=(await setFixed(projectId,b.replace_fixed,b.url)).rows[0];await deleteUrl(old);return res.json({kind:b.replace_fixed,url:b.url,project:saved});}
    if(b.replace_image_id){const parsed=parseImageId(b.replace_image_id);const content=contentOf(p);const sections=sectionsOf(p);if(!parsed||!sections[parsed.si]?.images?.[parsed.ii])return res.status(404).json({error:'Media item not found.'});const old=sections[parsed.si].images[parsed.ii].image_url;sections[parsed.si].images[parsed.ii]={...sections[parsed.si].images[parsed.ii],image_url:b.url};const saved=await saveContent(projectId,{...content,sections});await deleteUrl(old);return res.json({kind:'gallery',url:b.url,image:flatten(saved).find(x=>x.id===b.replace_image_id)||null});}
    if(!allowed.includes(b.asset_type))return res.status(400).json({error:'Invalid asset type.'});
    const si=sectionIndexForType(p,b.asset_type);if(si<0)return res.status(400).json({error:`No matching case-study section exists for ${b.asset_type}. Add that section first.`});
    const content=contentOf(p),sections=sectionsOf(p);sections[si].images=Array.isArray(sections[si].images)?sections[si].images:[];sections[si].images.push({image_url:b.url,image_type:b.asset_type,alt_text:String(b.alt_text||''),caption:String(b.caption||''),display_order:Math.max(0,Number(b.display_order||0))});const saved=await saveContent(projectId,{...content,sections});return res.status(201).json({kind:'gallery',url:b.url,image:flatten(saved).find(x=>x.image_url===b.url&&x.image_type===b.asset_type)||null});
   }
   return res.status(400).json({error:'Unknown media action.'});
  }
  if(req.method==='PATCH'){
   if(!b.id)return res.status(400).json({error:'Missing image id.'});const p=await getProject(projectId);if(!p)return res.status(404).json({error:'Case study not found.'});const parsed=parseImageId(b.id),content=contentOf(p),sections=sectionsOf(p);if(!parsed||!sections[parsed.si]?.images?.[parsed.ii])return res.status(404).json({error:'Media item not found.'});const x=sections[parsed.si].images[parsed.ii];sections[parsed.si].images[parsed.ii]={...x,...(b.display_order!==undefined?{display_order:Math.max(0,Number(b.display_order)||0)}:{}),...(b.alt_text!==undefined?{alt_text:String(b.alt_text)}:{}),...(b.caption!==undefined?{caption:String(b.caption)}:{})};const saved=await saveContent(projectId,{...content,sections});return res.json(flatten(saved).find(x=>x.id===b.id));
  }
  if(req.method==='DELETE'){
   const p=await getProject(projectId||b.project_id);if(!p)return res.status(404).json({error:'Case study not found.'});
   if(b.fixed){if(!['cover','hero'].includes(b.fixed))return res.status(400).json({error:'Invalid fixed image.'});const old=fixedUrl(p,b.fixed);const saved=(await setFixed(p.id,b.fixed,'')).rows[0];await deleteUrl(old);return res.json({ok:true,project:saved});}
   const parsed=parseImageId(b.id),content=contentOf(p),sections=sectionsOf(p);if(!parsed||!sections[parsed.si]?.images?.[parsed.ii])return res.status(404).json({error:'Media item not found.'});const old=sections[parsed.si].images[parsed.ii].image_url;sections[parsed.si].images.splice(parsed.ii,1);sections[parsed.si].images.forEach((x,i)=>x.display_order=i+1);await saveContent(p.id,{...content,sections});await deleteUrl(old);return res.json({ok:true});
  }
  return res.status(405).json({error:'Method not allowed'});
 }catch(e){return res.status(500).json({error:e.message||'Media operation failed.'});}
}