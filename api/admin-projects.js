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
    if(req.method==='GET') return res.json(await sb('case_studies?select=*&order=sort_order.asc,created_at.asc'));
    const b=req.body||{};
    const content=b.content || {sections:[]};

    if(req.method==='POST'){
      const row={
        title:b.title, slug:b.slug, subtitle:b.subtitle||'', category:b.category||'UX / Product Design',
        year:b.year||'', role:b.role||'UX Designer', duration:b.duration||'',
        description:b.description||'', cover_image_url:b.cover_image_url||'', hero_image_url:b.hero_image_url||'',
        status:b.status||'draft', sort_order:Number(b.sort_order)||0, content
      };
      const data=await sb('case_studies',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});
      return res.status(201).json(data?.[0]||data);
    }

    if(req.method==='PUT'){
      if(!b.id)return res.status(400).json({error:'Missing id'});
      const row={
        title:b.title, slug:b.slug, subtitle:b.subtitle||'', category:b.category||'', year:b.year||'',
        role:b.role||'', duration:b.duration||'', description:b.description||'',
        cover_image_url:b.cover_image_url||'', hero_image_url:b.hero_image_url||'',
        status:b.status||'draft', sort_order:Number(b.sort_order)||0, content, updated_at:new Date().toISOString()
      };
      const data=await sb('case_studies?id=eq.'+encodeURIComponent(b.id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});
      return res.json(data?.[0]||data);
    }

    if(req.method==='DELETE'){
      if(!b.id)return res.status(400).json({error:'Missing id'});
      await sb('case_studies?id=eq.'+encodeURIComponent(b.id),{method:'DELETE'});
      return res.json({ok:true});
    }

    return res.status(405).json({error:'Method not allowed'});
  }catch(e){return res.status(500).json({error:e.message});}
}