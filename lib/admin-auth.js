const ADMIN_EMAIL='alanodogwuideh@gmail.com';
const base=()=>process.env.SUPABASE_URL;
const serviceKey=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;
export async function requireSupabaseAdmin(req){
  const auth=String(req.headers?.authorization||'');
  const match=auth.match(/^Bearer\s+(.+)$/i);
  if(!match)return {ok:false,status:401,error:'Please sign in to the admin panel.'};
  const token=match[1];
  const r=await fetch(base()+'/auth/v1/user',{headers:{apikey:serviceKey(),Authorization:'Bearer '+token}}).catch(()=>null);
  if(!r||!r.ok)return {ok:false,status:401,error:'Your Supabase session is invalid or expired.'};
  const user=await r.json().catch(()=>null);
  if(!user?.id||String(user.email||'').toLowerCase()!==ADMIN_EMAIL.toLowerCase())return {ok:false,status:403,error:'This Supabase account is not authorized to manage the portfolio.'};
  return {ok:true,email:user.email,id:user.id};
}