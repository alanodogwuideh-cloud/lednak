import { requireSupabaseAdmin } from 'lib/admin-auth';
export const access='public';
export const methods=['GET'];
export default async function(req,res){const a=await requireSupabaseAdmin(req);if(!a.ok)return res.status(a.status).json({ok:false,error:a.error});return res.json({ok:true,email:a.email});}