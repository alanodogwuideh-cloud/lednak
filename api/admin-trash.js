import { tursoQuery, ensureTrashSchema } from 'lib/turso';
import { requireSupabaseAdmin } from 'lib/admin-auth';
import { r2KeyFromPublicUrl, deleteR2Object } from 'lib/r2';

export const access = 'public';
export const methods = ['GET','POST','PUT','DELETE'];

const object = value => value && typeof value === 'object' ? value : {};
function collectR2(value, out = new Set()) {
  if (typeof value === 'string') { const key = r2KeyFromPublicUrl(value); if (key) out.add(key); return out; }
  if (Array.isArray(value)) { for (const item of value) collectR2(item, out); return out; }
  if (value && typeof value === 'object') for (const child of Object.values(value)) collectR2(child, out);
  return out;
}
async function getById(id) {
  const { rows } = await tursoQuery('SELECT * FROM case_studies WHERE id = $1 LIMIT 1', [id]);
  return rows[0] || null;
}
async function permanentDelete(project) {
  const id = String(project.id);
  const keys = collectR2([project.cover_image_url, project.hero_image_url, project.content]);
  const { rows: allRows } = await tursoQuery('SELECT id,content,cover_image_url,hero_image_url FROM case_studies WHERE id <> $1', [id]);
  const referenced = new Set();
  for (const row of allRows) for (const key of collectR2([row.cover_image_url,row.hero_image_url,row.content])) referenced.add(key);
  const failures = [];
  for (const key of keys) {
    if (referenced.has(key)) continue;
    try { await deleteR2Object(key); } catch (error) { failures.push({ key, message: error.message || 'R2 cleanup failed' }); }
  }
  if (failures.length) return { ok: false, id, error: 'Some exclusively owned media could not be removed. The record remains available for a safe retry.', cleanup_failures: failures.length };
  const { rows: removed } = await tursoQuery('DELETE FROM case_studies WHERE id = $1 RETURNING id', [id]);
  if (!removed.length) return { ok: false, id, error: 'Database record was not removed. Refresh and retry.' };
  return { ok: true, id, operation: 'permanent_delete', media_removed: keys.size - [...keys].filter(k=>referenced.has(k)).length };
}
export default async function(req,res) {
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  try {
    await ensureTrashSchema();
    if (req.method === 'GET') {
      const { rows } = await tursoQuery('SELECT * FROM case_studies WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
      return res.json(rows);
    }
    const body = req.body || {};
    if (req.method === 'DELETE' && body.action === 'empty') {
      if (body.confirm !== true) return res.status(400).json({ error: 'Explicit Empty Trash confirmation is required.' });
      const { rows } = await tursoQuery('SELECT * FROM case_studies WHERE deleted_at IS NOT NULL ORDER BY deleted_at ASC');
      const results = [];
      for (const project of rows) {
        try { results.push(await permanentDelete(project)); }
        catch (error) { results.push({ ok:false,id:project.id,error:error.message||'Deletion failed' }); }
      }
      const succeeded = results.filter(x=>x.ok);
      const failed = results.filter(x=>!x.ok);
      return res.status(failed.length ? 207 : 200).json({ ok:failed.length===0,operation:'empty_trash',requested:rows.length,deleted:succeeded.length,failed:failed.map(x=>({id:x.id,error:x.error,cleanup_failures:x.cleanup_failures||0})),remaining:failed.length });
    }
    const id = String(body.id || '');
    if (!id) return res.status(400).json({ error: 'Missing case study id.' });
    const project = await getById(id);
    if (!project) return res.status(404).json({ error: 'Case study not found.' });
    if (req.method === 'POST') {
      if (project.deleted_at) return res.status(409).json({ error: 'Case study is already in Trash.' });
      const { rows } = await tursoQuery("UPDATE case_studies SET deleted_at=CURRENT_TIMESTAMP,deleted_by=$1,previous_status=status,previous_slug=slug,status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND deleted_at IS NULL RETURNING *", [auth.email || auth.user?.email || 'admin', id]);
      if (!rows.length) return res.status(409).json({ error: 'Case study could not be moved to Trash.' });
      return res.json({ ok:true,operation:'move_to_trash',id,project:rows[0] });
    }
    if (req.method === 'PUT') {
      if (!project.deleted_at) return res.status(409).json({ error: 'Case study is not in Trash.' });
      const originalSlug = String(project.previous_slug || project.slug || '');
      const { rows: collision } = await tursoQuery('SELECT id FROM case_studies WHERE slug=$1 AND id<>$2 AND deleted_at IS NULL LIMIT 1',[originalSlug,id]);
      let slug=originalSlug;
      if (collision.length) {
        const base=(originalSlug||'case-study').replace(/-restored(?:-\\d+)?$/,'')+'-restored';
        slug=base;
        for(let n=2;n<100;n++){const {rows}=await tursoQuery('SELECT id FROM case_studies WHERE slug=$1 AND id<>$2 LIMIT 1',[slug,id]);if(!rows.length)break;slug=base+'-'+n;}
      }
      const { rows } = await tursoQuery("UPDATE case_studies SET slug=$1,status='draft',deleted_at=NULL,deleted_by=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND deleted_at IS NOT NULL RETURNING *",[slug,id]);
      if (!rows.length) return res.status(409).json({error:'Restore did not complete. Refresh Trash and retry.'});
      return res.json({ok:true,operation:'restore',id,project:rows[0],slug_changed:slug!==originalSlug,original_slug:originalSlug});
    }
    if (req.method === 'DELETE') {
      if (body.confirm !== true) return res.status(400).json({error:'Explicit permanent-delete confirmation is required.'});
      const result = await permanentDelete(project);
      return result.ok ? res.json(result) : res.status(502).json(result);
    }
    return res.status(405).json({error:'Method not allowed'});
  } catch(error) {
    console.error('admin-trash error',error.message);
    return res.status(500).json({error:error.message||'Trash operation failed.'});
  }
}