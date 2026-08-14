export const access='public';
export const methods=['GET'];
export default async function(req,res){
  res.json({url:process.env.SUPABASE_URL,publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY});
}