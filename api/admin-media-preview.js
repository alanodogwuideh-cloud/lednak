import { db } from 'hatchable';
export const access='public';
export const methods=['GET'];
async function sendProxy(res,url){const r=await fetch(url);if(!r.ok){res.status(r.status).send('Media preview could not be loaded.');return}res.setHeader('Content-Type',r.headers.get('content-type')||'application/octet-stream');res.setHeader('Cache-Control','public, max-age=300');res.send(Buffer.from(await r.arrayBuffer()));}
export default async function(req,res){try{
 const projectId=String(req.query?.project_id||''),imageId=String(req.query?.image_id||''),fixed=String(req.query?.fixed||'');
 if(!projectId)return res.status(400).send('Missing project_id.');
 const {rows}=await db.query('SELECT * FROM case_studies WHERE id=$1 LIMIT 1',[projectId]);const p=rows[0];if(!p)return res.status(404).send('Case study not found.');
 let url='';
 if(fixed==='cover'||fixed==='hero')url=fixed==='cover'?p.cover_image_url:p.hero_image_url;
 else if(imageId){const parts=imageId.split(':');const si=Number(parts[1]),ii=Number(parts[2]);url=p.content?.sections?.[si]?.images?.[ii]?.image_url||'';}
 else return res.status(400).send('Missing media target.');
 if(!url)return res.status(404).send('Media preview not found.');
 return await sendProxy(res,url);
}catch(e){return res.status(500).send(e.message||'Media preview failed.');}}