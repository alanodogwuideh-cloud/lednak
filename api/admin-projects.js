import { db } from 'hatchable';
import { requireSupabaseAdmin } from 'lib/admin-auth';

export const access = 'public';
export const methods = ['GET', 'POST', 'PUT', 'DELETE'];

function mapProject(p) {
  const content = p?.content && typeof p.content === 'object' && !Array.isArray(p.content) ? p.content : {};
  const meta = content?.case_meta && typeof content.case_meta === 'object' && !Array.isArray(content.case_meta) ? content.case_meta : {};
  return {
    ...p,
    client: p?.client ?? content.client ?? '',
    short_description: p?.subtitle || '',
    overview: p?.description || '',
    platform: meta.platform ?? 'Mobile + Web',
    project_type: meta.project_type ?? 'End-to-end',
    role_label: meta.role_label ?? 'Role',
    duration_label: meta.duration_label ?? 'Duration',
    platform_label: meta.platform_label ?? 'Platform',
    project_type_label: meta.project_type_label ?? 'Project type',
    status: p?.status || 'draft',
    sort_order: Number(p?.sort_order || 0)
  };
}
function payload(body, partial = false) {
  const fields = { title: body.title, slug: body.slug, subtitle: body.short_description ?? body.subtitle, description: body.overview ?? body.description, role: body.role, year: body.year, duration: body.duration, category: body.category, status: body.status, sort_order: body.sort_order === undefined ? undefined : Number(body.sort_order || 0) };
  const out = {}; for (const [k, v] of Object.entries(fields)) if (!partial || v !== undefined) out[k] = v; return out;
}
async function getProject(id) { const { rows } = await db.query(`SELECT * FROM case_studies WHERE id = $1 LIMIT 1`, [id]); return rows?.[0] || null; }
export default async function (req, res) {
  try {
    const auth = await requireSupabaseAdmin(req); if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    if (req.method === 'GET') { const { rows } = await db.query(`SELECT * FROM case_studies ORDER BY sort_order ASC, created_at ASC`); return res.json(rows.map(mapProject)); }
    const body = req.body || {};
    if (req.method === 'POST') { if (!body.title || !body.slug) return res.status(400).json({ error: 'Title and slug are required.' }); const content = { sections: [], client: body.client || '', case_meta: { role_label: body.role_label || 'Role', duration_label: body.duration_label || 'Duration', platform_label: body.platform_label || 'Platform', project_type_label: body.project_type_label || 'Project type', platform: body.platform || 'Mobile + Web', project_type: body.project_type || 'End-to-end' } }; const { rows } = await db.query(`INSERT INTO case_studies (title,slug,subtitle,description,role,year,duration,category,status,sort_order,content,cover_image_url,hero_image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [body.title,body.slug,body.short_description||body.subtitle||'',body.overview||body.description||'',body.role||'',body.year||'',body.duration||'',body.category||'',body.status||'draft',Number(body.sort_order||0),JSON.stringify(content),body.cover_image_url||'',body.hero_image_url||'']); return res.status(201).json(mapProject(rows[0])); }
    if (!body.id) return res.status(400).json({ error: 'Missing case study id.' });
    const existing = await getProject(body.id); if (!existing) return res.status(404).json({ error: 'Case study not found.' });
    if (req.method === 'PUT') {
      const p = payload(body,true);
      const keys = Object.keys(p);
      const vals = Object.values(p);
      const setParts = keys.map((k,i)=>`${k} = $${i+1}`);

      // Build the content JSON once and assign the content column once.
      // Previously client and case_meta each appended their own `content = ...`
      // assignment, which PostgreSQL rejects as "multiple assignments to same
      // column content" when the editor saves both at the same time.
      const hasClient = body.client !== undefined;
      const hasCaseMeta = ['role_label','duration_label','platform_label','project_type_label','platform','project_type'].some(k => body[k] !== undefined);
      if (hasClient || hasCaseMeta) {
        const existingContent = existing?.content && typeof existing.content === 'object' && !Array.isArray(existing.content) ? existing.content : {};
        const nextContent = { ...existingContent };
        if (hasClient) nextContent.client = String(body.client ?? '');
        if (hasCaseMeta) {
          const existingMeta = existingContent?.case_meta && typeof existingContent.case_meta === 'object' && !Array.isArray(existingContent.case_meta) ? existingContent.case_meta : {};
          nextContent.case_meta = {
            role_label: body.role_label ?? existingMeta.role_label ?? 'Role',
            duration_label: body.duration_label ?? existingMeta.duration_label ?? 'Duration',
            platform_label: body.platform_label ?? existingMeta.platform_label ?? 'Platform',
            project_type_label: body.project_type_label ?? existingMeta.project_type_label ?? 'Project type',
            platform: body.platform ?? existingMeta.platform ?? 'Mobile + Web',
            project_type: body.project_type ?? existingMeta.project_type ?? 'End-to-end'
          };
        }
        vals.push(JSON.stringify(nextContent));
        setParts.push(`content = $${vals.length}::jsonb`);
      }
      if (!setParts.length) return res.json(mapProject(existing));
      vals.push(body.id);
      const { rows } = await db.query(`UPDATE case_studies SET ${setParts.join(', ')}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`, vals);
      return res.json(mapProject(rows[0]));
    }
    if (req.method === 'DELETE') { await db.query(`DELETE FROM case_studies WHERE id = $1`, [body.id]); return res.json({ok:true}); }
    return res.status(405).json({error:'Method not allowed'});
  } catch (error) { console.error('admin-projects error', error.message); return res.status(500).json({error:error.message||'Case study operation failed.'}); }
}