import { db } from 'hatchable';
export const access = 'admin';
export default async function(req,res){
  if(req.method==='GET'){const {rows}=await db.query('SELECT * FROM portfolio_settings ORDER BY updated_at DESC LIMIT 1');return res.json(rows[0]||null)}
  if(req.method==='PUT'){const b=req.body||{}; const {rows}=await db.query('UPDATE portfolio_settings SET site_name=$1,role=$2,intro=$3,about_text=$4,location=$5,linkedin_url=$6,email=$7,about_image_url=$8,updated_at=NOW() WHERE id=(SELECT id FROM portfolio_settings ORDER BY updated_at DESC LIMIT 1) RETURNING *',[b.site_name,b.role,b.intro,b.about_text,b.location,b.linkedin_url,b.email,b.about_image_url]); return res.json(rows[0])}
  return res.status(405).json({error:'Method not allowed'});
}