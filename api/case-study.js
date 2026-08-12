import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];
export default async function(req,res){
  const slug=req.query?.slug || req.params?.slug;
  if(!slug)return res.status(400).json({error:'Missing slug'});
  const {rows}=await db.query('SELECT * FROM case_studies WHERE slug = $1 AND status = \'published\' LIMIT 1',[slug]);
  if(!rows[0])return res.status(404).json({error:'Case study not found'});
  res.json(rows[0]);
}