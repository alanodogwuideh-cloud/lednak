import { tursoQuery, ensureTrashSchema } from 'lib/turso';
import { requireSupabaseAdmin } from 'lib/admin-auth';
import { r2KeyFromPublicUrl, deleteR2Object } from 'lib/r2';
export const access = 'public';
export const methods = ['GET','POST','PUT','DELETE'];
let schemaReady;
async function ensureSchema(){
 if(!schemaReady) schemaReady=(async()=>{
  for(const [name,type] of [['deleted_at','TEXT'],['deleted_by','TEXT'],['previous_status','TEXT'],['previous_slug','TEXT']]){
   try{await tursoQuery('ALTER TABLE case_studies ADD COLUMN '+name+' '+type)}catch(e){if(!/duplicate column|already exists/i.test(e.message||''))throw e}
  }
 })();
 return schemaReady;
}
const obj=v=>v&&typeof v==='object'?v:{};
function collectR2(value,out=new Set()){
 if(typeof value==='string'){const key=r2KeyFromPublicUrl(value);if(key)out.add(key);return out}
 if(Array.isArray(value)){for(const x of value)collectR2(x,out);return out}
 if(value&&typeof value==='object'){for(const v of Object.values(value))collectR2(v,out)}
 return out;
}
async function getById(id){const {rows}=await tursoQuery('SELECT * FROM case_studies WHERE id = $1 LIMIT 1',[id]);return rows[0]||null}
export default async function(req,res){
 const auth=await requireSupabaseAdmin(req);if(!auth.ok)return res.status(auth.status).json({error:auth.error});
 try{
  await ensureTrashSchema();
  if(req.method==='GET'){
   const {rows}=await tursoQuery('SELECT * FROM case_studies WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
   return res.json(rows);
  }
  const body=req.body||{};const id=String(body.id||'');if(!id)return res.status(400).json({error:'Missing case study id.'});
  const project=await getById(id);if(!project)return res.status(404).json({error:'Case study not found.'});
  if(req.method==='POST'){
   if(project.deleted_at)return res.status(409).json({error:'Case study is already in Trash.'});
   const {rows}=await tursoQuery("UPDATE case_studies SET deleted_at=CURRENT_TIMESTAMP, deleted_by=$1, previous_status=status, previous_slug=slug, status='draft', updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND deleted_at IS NULL RETURNING *",[auth.email||auth.user?.email||'admin',id]);
   if(!rows.length)return res.status(409).json({error:'Case study could not be moved to Trash.'});
   return res.json({ok:true,project:rows[0]});
  }
  if(req.method==='PUT'){
   if(!project.deleted_at)return res.status(409).json({error:'Case study is not in Trash.'});
   const originalSlug=String(project.previous_slug||project.slug||'');
   const {rows:collision}=await tursoQuery('SELECT id FROM case_studies WHERE slug=$1 AND id<>$2 AND deleted_at IS NULL LIMIT 1',[originalSlug,id]);
   let slug=originalSlug;
   if(collision.length){const base=(originalSlug||'case-study').replace(/-restored(?:-\d+)?$/,'')+'-restored';slug=base;for(let n=2;n<100;n++){const {rows}=await tursoQuery('SELECT id FROM case_studies WHERE slug=$1 AND id<>$2 LIMIT 1',[slug,id]);if(!rows.length)break;slug=base+'-'+n}}
   const {rows}=await tursoQuery("UPDATE case_studies SET slug=$1,status='draft',deleted_at=NULL,deleted_by=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND deleted_at IS NOT NULL RETURNING *",[slug,id]);
   return res.json({ok:true,project:rows[0],slug_changed:slug!==originalSlug,original_slug:originalSlug});
  }
  if(req.method==='DELETE'){
   if(!project.deleted_at)return res.status(409).json({error:'Move the case study to Trash before permanently deleting it.'});
   if(body.confirm!==true)return res.status(400).json({error:'Explicit permanent-delete confirmation is required.'});
   const content=obj(project.content);const keys=collectR2([project.cover_image_url,project.hero_image_url,content]);
   const failures=[];
   for(const key of keys){
    const urlLike='%'+key.replace(/[%_\\]/g,c=>'\\'+c)+'%';
    const {rows:refs}=await tursoQuery('SELECT id FROM case_studies WHERE id<>$1 AND (content LIKE $2 OR cover_image_url LIKE $2 OR hero_image_url LIKE $2) LIMIT 1',[id,urlLike]);
    if(refs.length)continue;
    try{await deleteR2Object(key)}catch(e){failures.push(key)}
   }
   if(failures.length)return res.status(502).json({error:'Some media could not be removed. The case study remains in Trash so you can safely retry.',media_cleanup_pending:failures.length});
   const {rows:removed}=await tursoQuery('DELETE FROM case_studies WHERE id=$1 AND deleted_at IS NOT NULL RETURNING id',[id]);
   if(!removed.length)return res.status(409).json({error:'The case study was not removed. Refresh Trash and retry.'});
   return res.json({ok:true,media_cleanup_pending:0});
  }
  return res.status(405).json({error:'Method not allowed'});
 }catch(e){console.error('admin-trash error',e.message);return res.status(500).json({error:e.message||'Trash operation failed.'})}
}