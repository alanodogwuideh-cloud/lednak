import { requireSupabaseAdmin } from 'lib/admin-auth';
import { db } from 'hatchable';
import { repairVendorMedia } from 'lib/case-study-media';

export const access='public';
export const methods=['GET','POST','PATCH','DELETE'];

const base=()=>process.env.SUPABASE_URL;
const key=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers=()=>({apikey:key(),Authorization:'Bearer '+key()});
const allowed=['cover','hero','research','chinedu_persona','fatima_persona','storyboard','wireframes','usability_testing','mobile_final_ui','web_final_ui'];
const sectionMap={research:'research',chinedu_persona:'personas',fatima_persona:'personas',storyboard:'process',wireframes:'process',usability_testing:'usability',mobile_final_ui:'final',web_final_ui:'final'};
const safeName=n=>String(n||'image').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,160);
const urlToPath=url=>{const marker='/storage/v1/object/public/portfolio-images/';const i=String(url||'').indexOf(marker);return i<0?'':String(url).slice(i+marker.length)};
async function sb(path,opts={}){const r=await fetch(base()+'/rest/v1/'+path,{...opts,headers:{...headers(),...(opts.headers||{})}});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(typeof d==='string'?d:(d?.message||d?.hint||'Supabase request failed'));return d;}
async function deleteUrl(url){const path=urlToPath(url);if(!path)return;await fetch(base()+'/storage/v1/object/portfolio-images/'+path,{method:'DELETE',headers:headers()}).catch(()=>{});}
async function getProject(id){const {rows}=await db.query('SELECT * FROM case_studies WHERE id=$1 LIMIT 1',[id]);const p=rows[0]||null;if(!p)return null;const repaired=repairVendorMedia(p);if(repaired.changed){const saved=await db.query('UPDATE case_studies SET content=$1,updated_at=now() WHERE id=$2 RETURNING *',[repaired.project.content,p.id]);return saved.rows[0]||repaired.project;}return p;}
function sectionsOf(p){return Array.isArray(p?.content?.sections)?p.content.sections:[];}
function flattenImages(p){const out=[];sectionsOf(p).forEach((s,si)=>{(Array.isArray(s.images)?s.images:[]).forEach((img,ii)=>out.push({...img,id:`${p.id}:${si}:${ii}`,section_index:si,image_index:ii,section_id:`${p.id}:${si}`}));});return out.sort((a,b)=>Number(a.display_order||0)-Number(b.display_order||0));}
function fixed(p){return [p?.cover_image_url?{fixed:'cover',url:p.cover_image_url,label:'Project cover'}:null,p?.hero_image_url?{fixed:'hero',url:p.hero_image_url,label:'Case-study hero'}:null].filter(Boolean);}
async function saveContent(id,content){const {rows}=await db.query('UPDATE case_studies SET content=$1,updated_at=now() WHERE id=$2 RETURNING *',[content,id]);return rows[0];}
function sectionForAsset(p,type){const target=sectionMap[type];const ss=sectionsOf(p);let idx=ss.findIndex(s=>(s.section_type||s.type||'content')===target);if(idx<0&&type==='wireframes')idx=ss.findIndex(s=>String(s.title||'').toLowerCase().includes('design exploration'));if(idx<0&&type==='research')idx=ss.findIndex(s=>String(s.title||'').toLowerCase().includes('research'));if(idx<0&&(type==='mobile_final_ui'||type==='web_final_ui'))idx=ss.findIndex(s=>String(s.title||'').toLowerCase().includes('final experience'));return idx;}

export default async function(req,res){
 try{
  const a=await requireSupabaseAdmin(req);if(!a.ok)return res.status(a.status).json({error:a.error});
  const q=req.query||{},b=req.body||{};
  const suppliedId=q.project_id||b.project_id;
  const inferredId=suppliedId||((b.id||'').split(':')[0]||'');
  const id=inferredId;
  if(!id)return res.status(400).json({error:'Missing project_id.'});
  const p=await getProject(id);if(!p)return res.status(404).json({error:'Case study not found.'});

  if(req.method==='GET'){
   const previewId=q.preview_image_id||q.image_id;
   const previewFixed=q.preview_fixed||q.fixed;
   if(previewFixed&&['cover','hero'].includes(previewFixed)){
    const url=previewFixed==='cover'?p.cover_image_url:p.hero_image_url;if(!url)return res.status(404).send('Media preview not found.');
    const r=await fetch(url);if(!r.ok)return res.status(r.status).send('Media preview could not be loaded.');res.setHeader('Content-Type',r.headers.get('content-type')||'application/octet-stream');return res.send(Buffer.from(await r.arrayBuffer()));
   }
   if(previewId){const item=flattenImages(p).find(x=>String(x.id)===String(previewId));if(!item?.image_url)return res.status(404).send('Media preview not found.');const r=await fetch(item.image_url);if(!r.ok)return res.status(r.status).send('Media preview could not be loaded.');res.setHeader('Content-Type',r.headers.get('content-type')||'application/octet-stream');return res.send(Buffer.from(await r.arrayBuffer()));}
   return res.json({project:{...p,images:flattenImages(p)},images:flattenImages(p),sections:sectionsOf(p).map((s,i)=>({id:`${p.id}:${i}`,title:s.title,section_type:s.section_type||s.type||'content',display_order:i+1}))});
  }

  if(req.method==='POST'){
   if(b.action==='prepare_upload'){
    const filename=b.filename,contentType=String(b.content_type||'application/octet-stream').toLowerCase(),type=b.asset_type||b.replace_fixed;
    if(!filename)return res.status(400).json({error:'Missing filename.'});
    if(type&&!allowed.includes(type))return res.status(400).json({error:'Invalid asset type.'});
    const path=`portfolio/${p.slug}/${Date.now()}-${safeName(filename)}`;
    const signed=await sb('storage/v1/object/upload/sign/portfolio-images/'+path,{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({})});
    const signedPath=String(signed?.url||'');if(!signedPath)throw new Error('Supabase did not return a signed upload URL.');
    const signedUrl=new URL(signedPath.startsWith('/storage/v1/')?base()+signedPath:base()+'/storage/v1'+(signedPath.startsWith('/')?signedPath:'/'+signedPath));
    return res.json({signedUrl:signedUrl.toString(),path,publicUrl:base()+'/storage/v1/object/public/portfolio-images/'+path,contentType,projectId:id,replaceFixed:b.replace_fixed||null,replaceImageId:b.replace_image_id||null});
   }
   if(b.action==='finalize_upload'){
    const url=String(b.url||'');if(!url)return res.status(400).json({error:'Missing uploaded media URL.'});
    const replaceFixed=b.replace_fixed,replaceImageId=b.replace_image_id,type=b.asset_type;
    if(replaceFixed){if(!['cover','hero'].includes(replaceFixed))return res.status(400).json({error:'Invalid replacement target.'});const field=replaceFixed==='cover'?'cover_image_url':'hero_image_url';const old=p[field]||'';const {rows}=await db.query(`UPDATE case_studies SET ${field}=$1,updated_at=now() WHERE id=$2 RETURNING *`,[url,id]);await deleteUrl(old);return res.json({kind:replaceFixed,url,project:rows[0]});}
    if(replaceImageId){const parts=String(replaceImageId).split(':');const si=Number(parts[1]),ii=Number(parts[2]);const content={...(p.content||{}),sections:sectionsOf(p).map(s=>({...s}))};const existing=content.sections[si]?.images?.[ii];if(!existing)return res.status(404).json({error:'Media item not found.'});content.sections[si].images=[...(content.sections[si].images||[])];content.sections[si].images[ii]={...existing,image_url:url};await saveContent(id,content);await deleteUrl(existing.image_url);return res.json({kind:'gallery',url,image:{...content.sections[si].images[ii],id:replaceImageId}});}
    if(!allowed.includes(type)||type==='cover'||type==='hero')return res.status(400).json({error:'Invalid gallery asset type.'});
    const si=sectionForAsset(p,type);if(si<0)return res.status(400).json({error:'No matching case-study section exists for '+type+'. Add that section first.'});
    const content={...(p.content||{}),sections:sectionsOf(p).map(s=>({...s}))};content.sections[si].images=[...(content.sections[si].images||[])];content.sections[si].images.push({image_url:url,image_type:type,alt_text:String(b.alt_text||''),caption:String(b.caption||''),display_order:Number(b.display_order||0)});await saveContent(id,content);const ii=content.sections[si].images.length-1;return res.status(201).json({kind:'gallery',url,image:{...content.sections[si].images[ii],id:`${id}:${si}:${ii}`}});
   }
   return res.status(400).json({error:'Unsupported media action.'});
  }

  if(req.method==='PATCH'){
   if(!b.id)return res.status(400).json({error:'Missing image id.'});const parts=String(b.id).split(':');const si=Number(parts[1]),ii=Number(parts[2]);const content={...(p.content||{}),sections:sectionsOf(p).map(s=>({...s}))};const existing=content.sections[si]?.images?.[ii];if(!existing)return res.status(404).json({error:'Media item not found.'});content.sections[si].images=[...(content.sections[si].images||[])];content.sections[si].images[ii]={...existing,...(b.display_order!==undefined?{display_order:Math.max(0,Number(b.display_order)||0)}:{}),...(b.alt_text!==undefined?{alt_text:String(b.alt_text)}:{}),...(b.caption!==undefined?{caption:String(b.caption)}:{})};const saved=await saveContent(id,content);return res.json({...saved.content.sections[si].images[ii],id:b.id});
  }

  if(req.method==='DELETE'){
   if(b.fixed){if(!['cover','hero'].includes(b.fixed))return res.status(400).json({error:'Invalid fixed image.'});const field=b.fixed==='cover'?'cover_image_url':'hero_image_url';const old=p[field]||'';const {rows}=await db.query(`UPDATE case_studies SET ${field}=$1,updated_at=now() WHERE id=$2 RETURNING *`,['',id]);await deleteUrl(old);return res.json({ok:true,project:rows[0]});}
   if(!b.id)return res.status(400).json({error:'Missing image id.'});const parts=String(b.id).split(':');const si=Number(parts[1]),ii=Number(parts[2]);const content={...(p.content||{}),sections:sectionsOf(p).map(s=>({...s,images:Array.isArray(s.images)?[...s.images]:[]}))};const existing=content.sections[si]?.images?.[ii];if(!existing)return res.status(404).json({error:'Media item not found.'});content.sections[si].images.splice(ii,1);await saveContent(id,content);await deleteUrl(existing.image_url);return res.json({ok:true});
  }
  return res.status(405).json({error:'Method not allowed'});
 }catch(e){console.error(e);return res.status(500).json({error:e.message||'Media operation failed.'});}
}