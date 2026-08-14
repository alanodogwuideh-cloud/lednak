export const access = 'admin';
export const methods = ['GET','PUT'];

const base=()=>process.env.SUPABASE_URL;
const key=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers=()=>({apikey:key(),Authorization:'Bearer '+key(),'Content-Type':'application/json'});
async function sb(path,opts={}){const r=await fetch(base()+'/rest/v1/'+path,{...opts,headers:{...headers(),...(opts.headers||{})}});const t=await r.text();let d=null;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw new Error(d?.message||'Supabase request failed');return d;}

export default async function(req,res){try{
  if(req.method==='GET'){
    const d=await sb('portfolio_settings?select=*&limit=1');
    return res.json(d?.[0]||null);
  }
  const b=req.body||{};
  const existing=await sb('portfolio_settings?select=id&limit=1');
  const row={
    site_name:b.site_name||'Alan Odogwuideh', role:b.role||'UX Designer', location:b.location||'',
    email:b.email||'', linkedin_url:b.linkedin_url||'', about_image_url:b.about_image_url||'',
    intro:b.intro||'', about_text:b.about_text||'', updated_at:new Date().toISOString()
  };
  let d;
  if(existing?.[0]?.id)d=await sb('portfolio_settings?id=eq.'+existing[0].id,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});
  else d=await sb('portfolio_settings',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});
  return res.json(d?.[0]||d);
}catch(e){return res.status(500).json({error:e.message});}}