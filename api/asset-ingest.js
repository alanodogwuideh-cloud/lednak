import { storage } from 'hatchable';
export const access = 'public';
export const methods = ['POST'];
const TOKEN = 'outsider-image-import-2026-08-14';
export default async function(req,res){
  try {
    if(req.body?.token !== TOKEN) return res.status(403).json({error:'Forbidden'});
    const {filename,contentType,data} = req.body || {};
    if(!filename || !data) return res.status(400).json({error:'Missing filename or data'});
    const safe=String(filename).replace(/[^a-zA-Z0-9._-]/g,'-');
    const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
    const key=`portfolio/outsider/${Date.now()}-${safe}`;
    const url=await storage.put(key,bytes,contentType||'application/octet-stream');
    return res.status(201).json({url,key,filename:safe});
  } catch(e){ return res.status(500).json({error:e.message}); }
}