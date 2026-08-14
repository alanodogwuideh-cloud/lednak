export const access='public';
export const methods=['GET'];
const PUBLISHABLE_KEY='sb_publishable_FZq8JYuG1dGZuzsVjCc_pA_QA3-Psyu';
export default async function(req,res){
  res.json({url:process.env.SUPABASE_URL,publishableKey:PUBLISHABLE_KEY});
}