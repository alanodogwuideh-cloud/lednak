import { storage, db } from 'hatchable';
export const access='public';
export const methods=['GET'];
export default async function(req,res){
  try{
    const {rows}=await db.query('SELECT about_image_url FROM portfolio_settings ORDER BY updated_at DESC LIMIT 1');
    let key=String(rows[0]?.about_image_url||'');
    if(key.startsWith('http')){try{key=new URL(key).pathname.split('/').pop()||''}catch{key=''}}
    if(!key)return res.status(404).send('');
    const asset=await storage.get(key);
    if(!asset?.buffer)return res.status(404).send('');
    res.setHeader('Content-Type',asset.contentType||'image/jpeg');
    res.setHeader('Cache-Control','public, max-age=86400, stale-while-revalidate=604800');
    return res.status(200).send(asset.buffer);
  }catch(e){return res.status(404).send('');}
}