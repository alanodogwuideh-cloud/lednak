export const access='admin';
export const methods=['GET'];
export default async function(req,res){
  const member=req.member;
  return res.json({ok:true,email:member?.email||'',id:member?.id||''});
}