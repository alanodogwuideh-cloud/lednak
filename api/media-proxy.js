export const access='public';
const ALLOWED_HOST='bblwinhdbwldwvxrfwlt.supabase.co';
export default async function(req,res){
  const raw=String(req.query?.url||'');
  if(!raw)return res.status(400).json({error:'Missing media URL.'});
  let u;try{u=new URL(raw)}catch{return res.status(400).json({error:'Invalid media URL.'})}
  if(u.protocol!=='https:'||u.hostname!==ALLOWED_HOST||!u.pathname.startsWith('/storage/v1/object/public/portfolio-images/'))return res.status(403).json({error:'Media source not allowed.'});
  const r=await fetch(u.toString());
  if(!r.ok)return res.status(r.status).json({error:`Media unavailable (${r.status}).`});
  const type=r.headers.get('content-type')||'application/octet-stream';
  const data=await r.arrayBuffer();
  res.setHeader('Content-Type',type);res.setHeader('Cache-Control','public, max-age=31536000, immutable');
  return res.send(Buffer.from(data));
}