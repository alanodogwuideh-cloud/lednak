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
    const base64=file.buffer.toString('base64');
    const safeType=String(file.contentType).replace(/[^a-z0-9.+-]/gi,'');
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><clipPath id="circle"><circle cx="32" cy="32" r="32"/></clipPath></defs><image href="data:${safeType};base64,${base64}" x="0" y="0" width="64" height="64" preserveAspectRatio="xMidYMid slice" clip-path="url(#circle)"/></svg>`;
    const key='site-branding/favicon-'+Date.now()+'-'+crypto.randomUUID()+'.svg';
    await storage.put(key,Buffer.from(svg,'utf8'),'image/svg+xml');
    const existing=(await db.query('SELECT id, favicon_key FROM site_branding ORDER BY updated_at DESC LIMIT 1')).rows[0];
    if(existing?.favicon_key)await storage.del(existing.favicon_key).catch(()=>{});
    if(existing?.id)await db.query('UPDATE site_branding SET favicon_key=$1, updated_at=NOW() WHERE id=$2',[key,existing.id]);
    else await db.query('INSERT INTO site_branding (favicon_key) VALUES ($1)',[key]);
    return res.json({url:await storage.urlPermanent(key),key});
  }
  const url=await storage.put('portfolio-about-'+Date.now()+'-'+String(file.filename||'profile.jpg').replace(/[^a-zA-Z0-9._-]/g,'-'),file.buffer,file.contentType||'image/jpeg');
  const existing=await sb('about?select=id&limit=1');const row={profile_image_url:url,updated_at:new Date().toISOString()};if(existing?.[0]?.id)await sb('about?id=eq.'+existing[0].id,{method:'PATCH',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify(row)});else await sb('about',{method:'POST',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify(row)});return res.json({url});
}
if(req.method==='DELETE'){
  const existing=(await db.query('SELECT id, favicon_key FROM site_branding ORDER BY updated_at DESC LIMIT 1')).rows[0];
  if(existing?.favicon_key)await storage.del(existing.favicon_key).catch(()=>{});
  if(existing?.id)await db.query('UPDATE site_branding SET favicon_key=$1, updated_at=NOW() WHERE id=$2',['',existing.id]);
  return res.json({ok:true});
}
if(req.method==='GET'){
  const [d,branding]=await Promise.all([sb('about?select=*&limit=1'),db.query('SELECT favicon_key FROM site_branding ORDER BY updated_at DESC LIMIT 1')]);
  const row=d?.[0]||{};const key=branding.rows[0]?.favicon_key||'';return res.json({...row,favicon_url:key?await storage.urlPermanent(key):''});
}
const b=req.body||{};const existing=await sb('about?select=id&limit=1');const row={name:b.name||'',headline:b.headline||'',bio:b.bio||'',location:b.location||'',profile_image_url:b.profile_image_url||'',linkedin_url:b.linkedin_url||'',email:b.email||'',availability:b.availability||'',updated_at:new Date().toISOString()};let d;if(existing?.[0]?.id)d=await sb('about?id=eq.'+existing[0].id,{method:'PATCH',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify(row)});else d=await sb('about',{method:'POST',headers:{...headers(),Prefer:'return=representation'},body:JSON.stringify(row)});return res.json(d?.[0]||d);
}catch(e){return res.status(500).json({error:e.message||'Site content operation failed.'});}}