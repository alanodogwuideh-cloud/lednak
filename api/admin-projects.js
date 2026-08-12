import { db, storage } from 'hatchable';
export const access = 'admin';
export default async function(req,res){
  if(req.method==='GET'){
    const {rows}=await db.query('SELECT * FROM case_studies ORDER BY sort_order ASC, created_at ASC');
    return res.json(rows);
  }
  if(req.method==='POST'){
    const b=req.body||{};
    const {rows}=await db.query('INSERT INTO case_studies (slug,title,subtitle,category,year,role,duration,description,cover_image_url,hero_image_url,status,sort_order,content) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *',[b.slug,b.title,b.subtitle||'',b.category||'UX / Product Design',b.year||'2026',b.role||'UX Designer',b.duration||'',b.description||'',b.cover_image_url||'',b.hero_image_url||'',b.status||'draft',Number(b.sort_order)||0,b.content||{}]);
    return res.status(201).json(rows[0]);
  }
  if(req.method==='PUT'){
    const b=req.body||{}; if(!b.id)return res.status(400).json({error:'Missing id'});
    const {rows}=await db.query('UPDATE case_studies SET slug=$1,title=$2,subtitle=$3,category=$4,year=$5,role=$6,duration=$7,description=$8,cover_image_url=$9,hero_image_url=$10,status=$11,sort_order=$12,content=$13,updated_at=NOW() WHERE id=$14 RETURNING *',[b.slug,b.title,b.subtitle||'',b.category||'',b.year||'',b.role||'',b.duration||'',b.description||'',b.cover_image_url||'',b.hero_image_url||'',b.status||'draft',Number(b.sort_order)||0,b.content||{},b.id]);
    return res.json(rows[0]);
  }
  if(req.method==='DELETE'){
    const id=req.body?.id; if(!id)return res.status(400).json({error:'Missing id'});
    await db.query('DELETE FROM case_studies WHERE id=$1',[id]); return res.json({ok:true});
  }
  return res.status(405).json({error:'Method not allowed'});
}