import { requireSupabaseAdmin } from 'lib/admin-auth';
import { supabaseRequest, storageDeleteByUrl, publicStorageUrl, supabaseBase } from 'lib/supabase-admin';
import crypto from 'node:crypto';
export const access='public';
export const methods=['GET','PUT','POST','DELETE'];

const SETTING_KEYS=['site_name','headline','location','email','linkedin_url','profile_image_url','bio','availability','favicon_url'];
async function rows(){return await supabaseRequest('site_settings?select=*&order=updated_at.desc')||[]}
async function getMap(){const out={};for(const r of await rows()){if(out[r.setting_key]===undefined)out[r.setting_key]=r.setting_value||''}return out}
async function setSetting(key,value){
  const existing=await supabaseRequest('site_settings?setting_key=eq.'+encodeURIComponent(key)+'&select=id&order=updated_at.desc&limit=1');
  if(existing?.[0])await supabaseRequest('site_settings?id=eq.'+encodeURIComponent(existing[0].id),{method:'PATCH',body:{setting_value:String(value??''),updated_at:new Date().toISOString()}});
  else await supabaseRequest('site_settings?select=*',{method:'POST',headers:{Prefer:'return=minimal'},body:{setting_key:key,setting_value:String(value??'')}});
}
async function removeSetting(key){await supabaseRequest('site_settings?setting_key=eq.'+encodeURIComponent(key),{method:'DELETE'}).catch(()=>{})}
async function uploadSupabaseFile(file,prefix){const safe=String(file.filename||'upload').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,160);const path=`site/${prefix}/${Date.now()}-${crypto.randomUUID()}-${safe}`;const r=await fetch(supabaseBase()+'/storage/v1/object/portfolio-images/'+path,{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':file.contentType||'application/octet-stream','Cache-Control':'3600','x-upsert':'false'},body:Buffer.from(file.buffer)});if(!r.ok)throw new Error((await r.text().catch(()=>''))||`Supabase Storage upload failed (${r.status})`);return publicStorageUrl(path)}

export default async function(req,res){
 try{
  const a=await requireSupabaseAdmin(req);if(!a.ok)return res.status(a.status).json({error:a.error});
  if(req.method==='GET'){
    const s=await getMap();
    return res.json({name:s.site_name||'Alan Odogwuideh',site_name:s.site_name||'Alan Odogwuideh',headline:s.headline||'',role:s.role||'UX Designer',location:s.location||'',email:s.email||'',linkedin_url:s.linkedin_url||'',profile_image_url:s.profile_image_url||'',about_image_url:s.profile_image_url||'',bio:s.bio||'',availability:s.availability||'',favicon_url:s.favicon_url?'/api/favicon':''});
  }
  if(req.method==='POST'){
    const kind=String(req.body?.kind||'about');const file=req.files?.find(x=>x.field==='file')||req.files?.[0];if(!file)return res.status(400).json({error:'Please choose a file.'});
    if(file.buffer.length>6*1024*1024)return res.status(413).json({error:'File is too large. Maximum size is 6 MB.'});
    if(kind==='favicon'){
      const allowed=new Set(['image/png','image/svg+xml','image/x-icon','image/vnd.microsoft.icon','image/webp']);if(!allowed.has(file.contentType))return res.status(415).json({error:'Favicon must be PNG, SVG, ICO, or WebP.'});
      const uploaded=Buffer.from(file.buffer).toString('base64');const type=String(file.contentType);const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><clipPath id="circle"><circle cx="32" cy="32" r="32"/></clipPath></defs><image href="data:${type};base64,${uploaded}" x="0" y="0" width="64" height="64" preserveAspectRatio="xMidYMid slice" clip-path="url(#circle)"/></svg>`;
      const old=(await getMap()).favicon_url||'';const path=`site/favicon/${Date.now()}-${crypto.randomUUID()}.svg`;const r=await fetch(supabaseBase()+'/storage/v1/object/portfolio-images/'+path,{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'image/svg+xml','Cache-Control':'3600','x-upsert':'false'},body:Buffer.from(svg)});if(!r.ok)throw new Error((await r.text().catch(()=>''))||'Favicon upload failed.');const url=publicStorageUrl(path);await setSetting('favicon_url',url);if(old)await storageDeleteByUrl(old);return res.json({url:'/api/favicon?v='+Date.now(),saved:true});
    }
    if(!String(file.contentType||'').startsWith('image/'))return res.status(415).json({error:'Please choose an image file.'});
    const old=(await getMap()).profile_image_url||'';const url=await uploadSupabaseFile(file,'profile');await setSetting('profile_image_url',url);if(old)await storageDeleteByUrl(old);return res.json({url,saved:true});
  }
  if(req.method==='DELETE'){
    const key='favicon_url';const s=await getMap();if(s[key])await storageDeleteByUrl(s[key]);await removeSetting(key);return res.json({ok:true});
  }
  const b=req.body||{};const map={site_name:b.name??b.site_name??'',headline:b.headline??'',location:b.location??'',email:b.email??'',linkedin_url:b.linkedin_url??'',profile_image_url:b.profile_image_url??'',bio:b.bio??'',availability:b.availability??''};
  for(const key of Object.keys(map))if(SETTING_KEYS.includes(key))await setSetting(key,map[key]);
  return res.json(await getMap());
 }catch(e){return res.status(500).json({error:e.message||'Site content operation failed.'});}
}