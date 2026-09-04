import { db } from 'hatchable';
import { repairVendorMedia } from 'lib/case-study-media';
export const access='public';
export const methods=['GET'];
export default async function(req,res){
 try{
  const slug=req.query?.slug;if(!slug)return res.status(400).json({error:'Missing slug'});
  const aliases={ 'outsider-vendor-platform':'outsider-vendor-app' }; const lookupSlug=aliases[slug]||slug;
  const {rows}=await db.query('SELECT * FROM case_studies WHERE slug=$1 LIMIT 1',[lookupSlug]);
  const study=rows[0];if(!study)return res.status(404).json({error:'Case study not found'});
  let content=study.content&&typeof study.content==='object'?study.content:{sections:[]};
  const repaired=repairVendorMedia(study);
  if(repaired.changed){
   const saved=await db.query('UPDATE case_studies SET content=$1,updated_at=now() WHERE id=$2 RETURNING *',[repaired.project.content,study.id]);
   content=saved.rows[0]?.content||repaired.project.content;
  }
  return res.json({id:study.id,slug:study.slug,title:study.title,subtitle:study.subtitle||'',description:study.description||'',category:study.category||'',year:study.year||'',role:study.role||'',duration:study.duration||'',cover_image_url:study.cover_image_url||'',hero_image_url:study.hero_image_url||'',content:{sections:Array.isArray(content.sections)?content.sections:[]}});
 }catch(e){console.error(e);return res.status(500).json({error:'Case study could not be loaded'});}
}