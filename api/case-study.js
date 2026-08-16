import { db } from 'hatchable';
export const access='public';
export const methods=['GET'];
export default async function(req,res){
 try{
  const slug=req.query?.slug;if(!slug)return res.status(400).json({error:'Missing slug'});
  const {rows}=await db.query('SELECT * FROM case_studies WHERE slug=$1 LIMIT 1',[slug]);
  const study=rows[0];if(!study)return res.status(404).json({error:'Case study not found'});
  const content=study.content&&typeof study.content==='object'?study.content:{sections:[]};
  return res.json({id:study.id,slug:study.slug,title:study.title,subtitle:study.subtitle||'',description:study.description||'',category:study.category||'',year:study.year||'',role:study.role||'',duration:study.duration||'',cover_image_url:study.cover_image_url||'',hero_image_url:study.hero_image_url||'',content:{sections:Array.isArray(content.sections)?content.sections:[]}});
 }catch(e){console.error(e);return res.status(500).json({error:'Case study could not be loaded'});}
}