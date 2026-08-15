import { storage } from 'hatchable';
export const access = 'admin';
export const methods = ['POST'];
export default async function(req,res){
  const file=req.files?.[0];
  if(!file)return res.status(400).json({error:'No file uploaded'});
  const safe=file.filename.replace(/[^a-zA-Z0-9._-]/g,'-');
  const key=`portfolio/${Date.now()}-${safe}`;
  const url=await storage.put(key,file.buffer,file.contentType||'application/octet-stream');
  res.status(201).json({url,key,filename:file.filename});
}