import { db } from 'hatchable';
export const access = 'public';
export const methods = ['GET'];
export default async function(req,res){
  const {rows:settings}=await db.query('SELECT * FROM portfolio_settings ORDER BY updated_at DESC LIMIT 1');
  const {rows:projects}=await db.query("SELECT id,slug,title,subtitle,category,year,role,duration,description,cover_image_url,hero_image_url,status,sort_order FROM case_studies WHERE status = 'published' ORDER BY sort_order ASC, created_at ASC");
  res.json({settings:settings[0]||null,projects});
}