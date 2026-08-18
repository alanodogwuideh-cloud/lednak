const base=()=>String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const key=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiHeaders=(extra={})=>({apikey:key(),Authorization:'Bearer '+key(),...extra});

export async function supabaseRequest(path, options={}){
  const headers={...apiHeaders(),...(options.headers||{})};
  if(options.body!==undefined && !(options.body instanceof Uint8Array) && typeof options.body!=='string'){
    headers['Content-Type']='application/json';
    options={...options,body:JSON.stringify(options.body)};
  }
  const r=await fetch(base()+'/rest/v1/'+path,{...options,headers});
  const text=await r.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error(typeof data==='string'?data:(data?.message||data?.hint||`Supabase request failed (${r.status})`));
  return data;
}

export async function storageUpload(path,buffer,contentType){
  const r=await fetch(base()+'/storage/v1/object/portfolio-images/'+path,{method:'POST',headers:apiHeaders({'Content-Type':contentType||'application/octet-stream','Cache-Control':'3600','x-upsert':'false'}),body:buffer});
  if(!r.ok){const text=await r.text().catch(()=> '');throw new Error(text||`Supabase Storage upload failed (${r.status})`)}
  return publicStorageUrl(path);
}

export async function storageDeleteByUrl(url){
  const marker='/storage/v1/object/public/portfolio-images/';
  const value=String(url||'');const i=value.indexOf(marker);if(i<0)return;
  const path=value.slice(i+marker.length);
  await fetch(base()+'/storage/v1/object/portfolio-images/'+path,{method:'DELETE',headers:apiHeaders()}).catch(()=>{});
}

export function publicStorageUrl(path){return base()+'/storage/v1/object/public/portfolio-images/'+String(path).replace(/^\//,'');}
export function storagePathFromUrl(url){const marker='/storage/v1/object/public/portfolio-images/';const value=String(url||'');const i=value.indexOf(marker);return i<0?'':value.slice(i+marker.length)}
export function supabaseBase(){return base()}