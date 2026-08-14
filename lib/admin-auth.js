export async function requireSupabaseAdmin(req){
  const auth=String(req.headers?.authorization||'');
  const token=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
  if(!token) return {ok:false,status:401,error:'Please sign in to the admin panel.'};
  const base=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_PUBLISHABLE_KEY;
  const h={apikey:key,Authorization:'Bearer '+token};
  const userRes=await fetch(base+'/auth/v1/user',{headers:h});
  if(!userRes.ok) return {ok:false,status:401,error:'Your Supabase session has expired. Please sign in again.'};
  const user=await userRes.json();
  const aboutRes=await fetch(base+'/rest/v1/about?select=email&limit=1',{headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY}});
  const about=aboutRes.ok?await aboutRes.json():[];
  const adminEmail=String(about?.[0]?.email||'').trim().toLowerCase();
  if(!adminEmail || String(user?.email||'').trim().toLowerCase()!==adminEmail){
    return {ok:false,status:403,error:'This Supabase account is not authorized to manage this portfolio.'};
  }
  return {ok:true,user};
}