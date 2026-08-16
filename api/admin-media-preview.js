export const access='public';
export const methods=['GET'];
const base=()=>process.env.SUPABASE_URL;
const key=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers=()=>({apikey:key(),Authorization:'Bearer '+key()});
async function sb(path){const r=await fetch(base()+'/rest/v1/'+path,{headers:headers()});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!r.ok)throw Error(typeof data==='string'?data:(data?.message||'Supabase request failed'));return data;}
function sendProxy(res,url){return fetch(url).then(async r=>{if(!r.ok){res.status(r.status).send('Media preview could not be loaded.');return}res.setHeader('Content-Type',r.headers.get('content-type')||'application/octet-stream');res.setHeader('Cache-Control','public, max-age=300');res.send(Buffer.from(await r.arrayBuffer()));});}
export default async function(req,res){try{
 const projectId=String(req.query?.project_id||'');
 const imageId=String(req.query?.image_id||'');
 const fixed=String(req.query?.fixed||'');
 if(!projectId)return res.status(400).send('Missing project_id.');
 let url='';
 if(imageId){
  const rows=await sb('project_images?select=image_url,project_id&id=eq.'+encodeURIComponent(imageId)+'&project_id=eq.'+encodeURIComponent(projectId)+'&limit=1');
  url=rows?.[0]?.image_url||'';
 }else if(fixed==='cover'||fixed==='hero'){
  const field=fixed+'_image_url';
  const rows=await sb('projects?select='+field+'&id=eq.'+encodeURIComponent(projectId)+'&limit=1');
  url=rows?.[0]?.[field]||'';
 }else return res.status(400).send('Missing media target.');
 if(!url)return res.status(404).send('Media preview not found.');
 return await sendProxy(res,url);
}catch(e){return res.status(500).send(e.message||'Media preview failed.');}}