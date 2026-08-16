import { requireSupabaseAdmin } from 'lib/admin-auth';
import { storage, db } from 'hatchable';
import crypto from 'node:crypto';
export const access='public';
export const methods=['GET','PUT','POST','DELETE'];
const base=()=>process.env.SUPABASE_URL;const key=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;const headers=()=>({apikey:key(),Authorization:'Bearer '+key(),'Content-Type':'application/json'});
async function sb(path,opts={}){const r=await fetch(base()+'/rest/v1/'+path,{...opts,headers:{...headers(),...(opts.headers||{})}});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(typeof d==='string'?d:(d?.message||d?.hint||'Supabase request failed'));return d;}
export default async function(req,res){try{const a=await requireSupabaseAdmin(req);if(!a.ok)return res.status(a.status).json({error:a.error});
if(req.method==='POST'){
  const kind=String(req.body?.kind||'about');
  const file=req.files?.find(x=>x.field==='file')||req.files?.[0];
  if(!file||!String(file.contentType||'').startsWith('image/'))return res.status(400).json({error:'Please choose an image file.'});
  if(file.buffer.length>5*1024*1024)return res.status(413).json({error:'Image is too large. Maximum size is 5 MB.'});
  if(kind==='favicon'){
    const allowed=new Set(['image/png','image/svg+xml','image/x-icon','image/vnd.microsoft.icon','image/webp']);
    if(!allowed.has(file.contentType))return res.status(415).json({error:'Favicon must be PNG, SVG, ICO, or WebP.'});
    // Always store the favicon as a true circular SVG wrapper. CSS cannot control
    // the shape of a browser-tab favicon, so the transparency has to be baked into
    // the favicon asset itself. The uploaded file is embedded inside a 64x64 circle.
    const uploadedBuffer=Buffer.from(file.buffer);
    const base64=uploadedBuffer.toString('base64');
    const safeType=String(file.contentType);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><clipPath id="circle"><circle cx="32" cy="32" r="32"/></clipPath></defs><image href="data:${safeType};base64,${base64}" x="0" y="0" width="64" height="64" preserveAspectRatio="xMidYMid slice" clip-path="url(#circle)"/></svg>`;
    const key='site-branding/favicon-'+Date.now()+'-'+crypto.randomUUID()+'.svg';
    await storage.put(key,Buffer.from(svg,'utf8'),'image/svg+xml');
    const existing=(await db.query('SELECT id, favicon_key FROM site_branding ORDER BY updated_at DESC LIMIT 1')).rows[0];
    if(existing?.id)await db.query('UPDATE site_branding SET favicon_key=$1, updated_at=NOW() WHERE id=$2',[key,existing.id]);
    else await db.query('INSERT INTO site_branding (favicon_key) VALUES ($1)',[key]);
    if(existing?.favicon_key&&existing.favicon_key!==key)await storage.del(existing.favicon_key).catch(()=>{});
    return res.json({url:'/api/favicon?v='+Date.now(),key,saved:true});
  }
  const storageKey='portfolio-about-'+Date.now()+'-'+crypto.randomUUID()+'-'+String(file.filename||'profile.jpg').replace(/[^a-zA-Z0-9._-]/g,'-');
  await storage.put(storageKey,file.buffer,file.contentType||'image/jpeg');
  const existing=(await db.query('SELECT id,about_image_url FROM portfolio_settings ORDER BY updated_at DESC LIMIT 1')).rows[0];
  if(existing?.id)await db.query('UPDATE portfolio_settings SET about_image_url=$1, updated_at=NOW() WHERE id=$2',[storageKey,existing.id]);
  else await db.query('INSERT INTO portfolio_settings (about_image_url) VALUES ($1)',[storageKey]);
  if(existing?.about_image_url){let oldKey=String(existing.about_image_url);if(oldKey.startsWith('http')){try{oldKey=new URL(oldKey).pathname.split('/').pop()||''}catch{oldKey=''}}if(oldKey&&oldKey!==storageKey)await storage.del(oldKey).catch(()=>{});}
  return res.json({url:'/api/about-image?v='+Date.now(),key:storageKey,saved:true});
}
if(req.method==='DELETE'){
  const existing=(await db.query('SELECT id, favicon_key FROM site_branding ORDER BY updated_at DESC LIMIT 1')).rows[0];
  if(existing?.favicon_key)await storage.del(existing.favicon_key).catch(()=>{});
  if(existing?.id)await db.query('UPDATE site_branding SET favicon_key=$1, updated_at=NOW() WHERE id=$2',['',existing.id]);
  return res.json({ok:true});
}
if(req.method==='GET'){
  const [settings,branding]=await Promise.all([db.query('SELECT * FROM portfolio_settings ORDER BY updated_at DESC LIMIT 1'),db.query('SELECT favicon_key FROM site_branding ORDER BY updated_at DESC LIMIT 1')]);
  const row=settings.rows[0]||{};const key=branding.rows[0]?.favicon_key||'';const aboutUrl=row.about_image_url?'/api/about-image?v='+encodeURIComponent(row.updated_at||Date.now()):'';return res.json({...row,name:row.site_name||'',headline:row.intro||'',bio:row.about_text||'',profile_image_url:aboutUrl,about_image_url:aboutUrl,favicon_url:key?'/api/favicon':''});
}
const b=req.body||{};const existing=(await db.query('SELECT id,about_image_url FROM portfolio_settings ORDER BY updated_at DESC LIMIT 1')).rows[0];const submittedImage=String(b.profile_image_url||b.about_image_url||'');const aboutKey=submittedImage.includes('/api/about-image')?(existing?.about_image_url||''):submittedImage;const row={site_name:b.name||b.site_name||'Alan Odogwuideh',role:b.role||'UX Designer',intro:b.headline||b.intro||'',about_text:b.bio||b.about_text||'',location:b.location||'',about_image_url:aboutKey,linkedin_url:b.linkedin_url||'',email:b.email||'',updated_at:new Date().toISOString()};let d;if(existing?.id)d=await db.query('UPDATE portfolio_settings SET site_name=$1,role=$2,intro=$3,about_text=$4,location=$5,about_image_url=$6,linkedin_url=$7,email=$8,updated_at=NOW() WHERE id=$9 RETURNING *',[row.site_name,row.role,row.intro,row.about_text,row.location,row.about_image_url,row.linkedin_url,row.email,existing.id]);else d=await db.query('INSERT INTO portfolio_settings (site_name,role,intro,about_text,location,about_image_url,linkedin_url,email) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[row.site_name,row.role,row.intro,row.about_text,row.location,row.about_image_url,row.linkedin_url,row.email]);return res.json({...d.rows[0],profile_image_url:d.rows[0].about_image_url||''});
}catch(e){return res.status(500).json({error:e.message||'Site content operation failed.'});}}