import { requireSupabaseAdmin } from 'lib/admin-auth';
import { db } from 'hatchable';
export const access='public';
export const methods=['GET'];
async function sendProxy(res,url){const r=await fetch(url);if(!r.ok)return res.status(r.status).send('Media preview could not be loaded.');res.setHeader('Content-Type',r.headers.get('content-type')||'application/octet-stream');res.setHeader('Cache-Control','private, max-age=300');res.send(Buffer.from(await r.arrayBuffer()));}
export default async function(req,res){try{
 const a=await requireSupabaseAdmin(req);if(!a.ok)return res.status(a.status).send(a.error);
 const projectId=String(req.query?.project_id||'');const imageId=String(req.query?.image_id||'');const fixed=String(req.query?.fixed||'');if(!projectId)return res.status(400).send('Missing project_id.');
 const {rows}=await db.query('SELECT * FROM case_studies WHERE id=$1 LIMIT 1',[projectId]);const c=rows[0];if(!c)return res.status(404).send('Case study not found.');let url='';
 if(fixed==='cover'||fixed==='hero')url=c[fixed+'_image_url']||'';
 else if(imageId){const m=String(imageId).match(/^(\d+):(\d+)$/);if(!m)return res.status(400).send('Invalid media id.');const s=c.content?.sections?.[Number(m[1])];url=s?.images?.[Number(m[2])]?.image_url||'';}
 else return res.status(400).send('Missing media target.');
 if(!url)return res.status(404).send('Media preview not found.');return await sendProxy(res,url);
}catch(e){return res.status(500).send(e.message||'Media preview failed.');}}