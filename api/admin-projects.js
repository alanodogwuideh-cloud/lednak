import { tursoQuery, ensureTrashSchema } from 'lib/turso';
import { normalizeR2Url } from 'lib/r2';
import { requireSupabaseAdmin } from 'lib/admin-auth';

// Owner-only CMS endpoint. Authentication is handled by the portfolio's
// Supabase admin account, so the CMS does not depend on Hatchable console login.
export const access = 'public';
export const methods = ['GET', 'POST', 'PUT', 'DELETE'];

function mapProject(p) {
  const content = p?.content && typeof p.content === 'object' && !Array.isArray(p.content) ? p.content : {};
  const meta = content?.case_meta && typeof content.case_meta === 'object' && !Array.isArray(content.case_meta) ? content.case_meta : {};
  return {
    ...p,
    cover_image_url: normalizeR2Url(p?.cover_image_url || ''),
    hero_image_url: normalizeR2Url(p?.hero_image_url || ''),
    client: p?.client ?? content.client ?? '',
    short_description: p?.subtitle || '',
    overview: p?.description || '',
    platform: meta.platform ?? 'Mobile + Web',
    project_type: meta.project_type ?? 'End-to-end',
    role_label: meta.role_label ?? 'Role',
    duration_label: meta.duration_label ?? 'Duration',
    platform_label: meta.platform_label ?? 'Platform',
    project_type_label: meta.project_type_label ?? 'Project type',
    display_category: ['mobile','web'].includes(String(meta.display_category||'').toLowerCase()) ? String(meta.display_category).toLowerCase() : 'all',
    status: p?.status || 'draft',
    sort_order: Number(p?.sort_order || 0)
  };
}
function payload(body, partial = false) {
  const fields = { title: body.title, slug: body.slug, subtitle: body.short_description ?? body.subtitle, description: body.overview ?? body.description, role: body.role, year: body.year, duration: body.duration, category: body.category, status: body.status, sort_order: body.sort_order === undefined ? undefined : Number(body.sort_order || 0) };
  const out = {}; for (const [k, v] of Object.entries(fields)) if (!partial || v !== undefined) out[k] = v; return out;
}
async function getProject(id) { const { rows } = await tursoQuery(`SELECT * FROM case_studies WHERE id = $1 LIMIT 1`, [id]); return rows?.[0] || null; }
function normalizeSlug(value) { return String(value || '').normalize('NFKD').replace(/\p{M}+/gu,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').replace(/^-+|-+$/g,'').slice(0,90); }
const reservedSlugs = new Set(['admin','api','about','work','contact','login','logout','media','trash','case-study','case-studies','assets','favicon']);
async function validateSlug(raw,id='',auto=false) {
 let slug=normalizeSlug(raw);
 if(!slug)throw new Error('Enter a valid title and slug before saving.');
 if(reservedSlugs.has(slug)){if(!auto)throw new Error('This slug is reserved for a portfolio route. Choose another slug.');slug=(slug+'-project').slice(0,90)}
 const base=slug;for(let n=2;n<100;n++){const {rows}=await tursoQuery('SELECT id FROM case_studies WHERE slug=$1 AND id<>$2 LIMIT 1',[slug,id||'']);if(!rows.length)return slug;if(!auto)throw new Error('This slug is already in use. Customize it to make it unique.');const suffix='-'+n;slug=base.slice(0,90-suffix.length)+suffix}
 throw new Error('Could not generate a unique slug. Please customize it and retry.');
}
export default async function (req, res) {
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  try {
    await ensureTrashSchema();
    if (req.method === 'GET') { const { rows } = await tursoQuery(`SELECT * FROM case_studies WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC`); return res.json(rows.map(mapProject)); }
    const body = req.body || {};
    if (req.method === 'PUT' && body.action === 'reorder') {
      const orderedIds = Array.isArray(body.ordered_ids) ? body.ordered_ids.map(String) : [];
      if (!orderedIds.length) return res.status(400).json({ error: 'Provide at least one case study to reorder.' });
      const { rows: currentRows } = await tursoQuery('SELECT id FROM case_studies WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC');
      const currentIds = currentRows.map(row => String(row.id));
      if (orderedIds.length !== currentIds.length || new Set(orderedIds).size !== currentIds.length || orderedIds.some(id => !currentIds.includes(id))) {
        return res.status(409).json({ error: 'The case study list changed. Refresh the CMS and try reordering again.' });
      }
      for (let index = 0; index < orderedIds.length; index++) {
        await tursoQuery('UPDATE case_studies SET sort_order=$1, updated_at=NOW() WHERE id=$2 AND deleted_at IS NULL', [index, orderedIds[index]]);
      }
      const { rows } = await tursoQuery('SELECT * FROM case_studies WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC');
      return res.json({ ok: true, projects: rows.map(mapProject) });
    }
    if (req.method === 'POST') { body.title = String(body.title || '').trim() || 'Untitled Case Study'; const requestedSlug = normalizeSlug(body.slug) || normalizeSlug(body.title) || 'untitled-case-study'; body.slug = await validateSlug(requestedSlug,'',true); const content = { sections: [], client: body.client || '', case_meta: { role_label: body.role_label || 'Role', duration_label: body.duration_label || 'Duration', platform_label: body.platform_label || 'Platform', project_type_label: body.project_type_label || 'Project type', platform: body.platform || 'Mobile + Web', project_type: body.project_type || 'End-to-end', display_category: ['mobile','web'].includes(String(body.display_category||'').toLowerCase()) ? String(body.display_category).toLowerCase() : 'all' } }; const newId = crypto.randomUUID(); const { rows } = await tursoQuery(`INSERT INTO case_studies (id,title,slug,subtitle,description,role,year,duration,category,status,sort_order,content,cover_image_url,hero_image_url,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *`, [newId,body.title,body.slug,body.short_description||body.subtitle||'',body.overview||body.description||'',body.role||'',body.year||'',body.duration||'',body.category||'',body.status||'draft',Number(body.sort_order||0),JSON.stringify(content),body.cover_image_url||'',body.hero_image_url||'']); return res.status(201).json(mapProject(rows[0])); }
    if (!body.id) return res.status(400).json({ error: 'Missing case study id.' });
    const existing = await getProject(body.id); if (!existing) return res.status(404).json({ error: 'Case study not found.' });
    if (req.method === 'PUT') {
      const p = payload(body,true);
      if (p.slug !== undefined) p.slug = await validateSlug(p.slug, body.id, body.slug_auto===true); else if (p.status === 'published') await validateSlug(existing.slug,body.id,false);
      const keys = Object.keys(p);
      const vals = Object.values(p);
      const setParts = keys.map((k,i)=>`${k} = $${i+1}`);

      // Build the content JSON once and assign the content column once.
      // Previously client and case_meta each appended their own `content = ...`
      // assignment, which PostgreSQL rejects as "multiple assignments to same
      // column content" when the editor saves both at the same time.
      const hasClient = body.client !== undefined;
      const hasCaseMeta = ['role_label','duration_label','platform_label','project_type_label','platform','project_type','display_category'].some(k => body[k] !== undefined);
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
            project_type: body.project_type ?? existingMeta.project_type ?? 'End-to-end',
            display_category: ['mobile','web'].includes(String(body.display_category ?? existingMeta.display_category ?? '').toLowerCase()) ? String(body.display_category ?? existingMeta.display_category).toLowerCase() : 'all'
          };
        }
        vals.push(JSON.stringify(nextContent));
        setParts.push(`content = $${vals.length}::jsonb`);
      }
      if (!setParts.length) return res.json(mapProject(existing));
      vals.push(body.id);
      const { rows } = await tursoQuery(`UPDATE case_studies SET ${setParts.join(', ')}, updated_at = NOW() WHERE id = $${vals.length} RETURNING *`, vals);
      return res.json(mapProject(rows[0]));
    }
    if (req.method === 'DELETE') { const { rows } = await tursoQuery("UPDATE case_studies SET deleted_at=CURRENT_TIMESTAMP, deleted_by=$1, previous_status=status, previous_slug=slug, status='draft', updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND deleted_at IS NULL RETURNING id", [auth.email||'admin',body.id]); return rows.length?res.json({ok:true}):res.status(409).json({error:'Case study is already in Trash.'}); }
    return res.status(405).json({error:'Method not allowed'});
  } catch (error) { console.error('admin-projects error', error.message); return res.status(500).json({error:error.message||'Case study operation failed.'}); }
}