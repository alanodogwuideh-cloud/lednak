export const access = 'admin';
export const methods = ['GET','POST','PUT','DELETE'];

const base=()=>process.env.SUPABASE_URL;
const key=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers=()=>({apikey:key(),Authorization:'Bearer '+key(),'Content-Type':'application/json'});

async function sb(path,opts={}){
  const r=await fetch(base()+'/rest/v1/'+path,{...opts,headers:{...headers(),...(opts.headers||{})}});
  const text=await r.text();
  let data=null; try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok) throw new Error(typeof data==='string'?data:(data?.message||data?.hint||'Supabase request failed'));
  return data;
}

export default async function(req,res){
  try{
    if(req.method==='GET') return res.json(await sb('projects?select=*&order=display_order.asc,created_at.asc'));
    const b=req.body||{};
    if(req.method==='POST'){
      const row={title:b.title,slug:b.slug,short_description:b.short_description||'',overview:b.overview||'',role:b.role||'UX Designer',client:b.client||'',year:b.year||'',duration:b.duration||'',category:b.category||'UX / Product Design',cover_image_url:b.cover_image_url||'',hero_image_url:b.hero_image_url||'',featured:!!b.featured,published:!!b.published,display_order:Number(b.display_order)||0};
      const data=await sb('projects',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)}); return res.status(201).json(data?.[0]||data);
    }
    if(req.method==='PUT'){
      if(!b.id)return res.status(400).json({error:'Missing id'});
      const row={title:b.title,slug:b.slug,short_description:b.short_description||'',overview:b.overview||'',role:b.role||'',client:b.client||'',year:b.year||'',duration:b.duration||'',category:b.category||'',cover_image_url:b.cover_image_url||'',hero_image_url:b.hero_image_url||'',featured:!!b.featured,published:!!b.published,display_order:Number(b.display_order)||0,updated_at:new Date().toISOString()};
      const data=await sb('projects?id=eq.'+encodeURIComponent(b.id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(row)}); return res.json(data?.[0]||data);
    }
    if(req.method==='DELETE'){
      if(!b.id)return res.status(400).json({error:'Missing id'});
      await sb('projects?id=eq.'+encodeURIComponent(b.id),{method:'DELETE'}); return res.json({ok:true});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(e){return res.status(500).json({error:e.message});}
}