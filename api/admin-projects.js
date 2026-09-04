import { requireSupabaseAdmin } from 'lib/admin-auth';
import { db } from 'hatchable';
export const access='public';
export const methods=['GET','POST','PUT','DELETE'];
function map(r){return {...r,short_description:r.subtitle||'',overview:r.description||'',status:r.status||'draft',sort_order:r.sort_order};}
export default async function(req,res){
 try{
  const a=await requireSupabaseAdmin(req);if(!a.ok)return res.status(a.status).json({error:a.error});
  if(req.method==='GET'){const {rows}=await db.query('SELECT * FROM case_studies ORDER BY sort_order ASC, created_at ASC');return res.json(rows.map(map));}
  const b=req.body||{};
  if(req.method==='POST'){
   if(!b.title||!b.slug)return res.status(400).json({error:'Title and slug are required.'});
   const {rows}=await db.query(`INSERT INTO case_studies (title,slug,subtitle,category,year,role,duration,description,status,sort_order,content) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[b.title,b.slug,b.short_description||'',b.category||'',b.year||'',b.role||'',b.duration||'',b.overview||'',b.status||'draft',Number(b.sort_order)||0,{sections:[]}]);
   return res.status(201).json(map(rows[0]));
  }
  if(req.method==='PUT'){
   if(!b.id)return res.status(400).json({error:'Missing case study id.'});
   const {rows}=await db.query(`UPDATE case_studies SET title=COALESCE($1,title),slug=COALESCE($2,slug),subtitle=COALESCE($3,subtitle),category=COALESCE($4,category),year=COALESCE($5,year),role=COALESCE($6,role),duration=COALESCE($7,duration),description=COALESCE($8,description),status=COALESCE($9,status),sort_order=COALESCE($10,sort_order),updated_at=now() WHERE id=$11 RETURNING *`,[b.title,b.slug,b.short_description,b.category,b.year,b.role,b.duration,b.overview,b.status,b.sort_order===undefined?undefined:Number(b.sort_order),b.id]);
   if(!rows[0])return res.status(404).json({error:'Case study not found.'});return res.json(map(rows[0]));
  }
  if(req.method==='DELETE'){
   if(!b.id)return res.status(400).json({error:'Missing case study id.'});
   await db.query('DELETE FROM case_studies WHERE id=$1',[b.id]);return res.json({ok:true});
  }
  return res.status(405).json({error:'Method not allowed'});
 }catch(e){return res.status(500).json({error:e.message||'Case study operation failed.'});}
}