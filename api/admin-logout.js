export const access='public';
export const methods=['POST'];
export default async function(req,res){res.setHeader('Set-Cookie','portfolio_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');return res.json({ok:true});}