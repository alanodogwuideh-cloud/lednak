import { requireSupabaseAdmin } from 'lib/admin-auth';

export const access='public';
export const methods=['GET'];
export default async function(req,res){
  const auth=await requireSupabaseAdmin(req);
  if(!auth.ok)return res.status(auth.status).json({error:auth.error});
  return res.json({ok:true,email:auth.email||'',id:auth.id||''});
}