export const access='public';
export const methods=['POST'];
const EMAIL='alanodogwuideh@gmail.com';
const SALT='vQeJuS9bvsk5zkiQ_0l-8Q';
const PASSWORD_HASH='La4BVZNUygiHbs2ImAX7wZaJLtT9ncjtgCQJqCIW7Xg';
const SESSION_SECRET='p8Qv2Kx7mN4zR6tY9wL3cF1sH8jD5aB0';
function b64u(b){return Buffer.from(b).toString('base64url')}
function fromB64(s){return Buffer.from(s,'base64url')}
async function derive(password){const enc=new TextEncoder();const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(SALT),iterations:200000,hash:'SHA-256'},key,256);return b64u(Buffer.from(bits))}
async function sign(value){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value));return b64u(Buffer.from(sig))}
export default async function(req,res){try{const b=req.body||{};const email=String(b.email||'').trim().toLowerCase();const password=String(b.password||'');if(email!==EMAIL)return res.status(401).json({error:'Invalid admin email or password.'});const hash=await derive(password);if(hash!==PASSWORD_HASH)return res.status(401).json({error:'Invalid admin email or password.'});const payload=b64u(Buffer.from(JSON.stringify({email,iat:Date.now()})));const sig=await sign(payload);res.setHeader('Set-Cookie',`portfolio_admin=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`);return res.json({ok:true,email});}catch(e){return res.status(500).json({error:'Unable to sign in.'})}}