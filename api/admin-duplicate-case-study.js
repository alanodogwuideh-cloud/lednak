import { tursoQuery } from 'lib/turso';
import { requireSupabaseAdmin } from 'lib/admin-auth';
import { r2KeyFromPublicUrl, r2PublicUrl, uploadR2Object, deleteR2Object } from 'lib/r2';

export const access = 'public';
export const methods = ['POST'];

const uuid = () => crypto.randomUUID();
const slugify = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72) || 'case-study';

function remapIds(root) {
  const ids = new Map();
  const collect = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(collect);
    if (typeof value.id === 'string' && value.id) ids.set(value.id, uuid());
    for (const child of Object.values(value)) collect(child);
  };
  collect(root);
  const rewrite = (value, key = '') => {
    if (Array.isArray(value)) return value.map(item => rewrite(item, key));
    if (!value || typeof value !== 'object') {
      if (typeof value === 'string' && (key === 'id' || /_id$/.test(key) || /_ids$/.test(key)) && ids.has(value)) return ids.get(value);
      return value;
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = rewrite(v, k);
    return out;
  };
  return rewrite(root);
}

async function copyMediaUrl(url, newProjectId, copiedKeys) {
  const sourceKey = r2KeyFromPublicUrl(url);
  if (!sourceKey) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not retrieve a source media asset for duplication.');
  const bytes = await response.arrayBuffer();
  const ext = sourceKey.includes('.') ? sourceKey.slice(sourceKey.lastIndexOf('.')).replace(/[^.a-zA-Z0-9]/g, '') : '';
  const targetKey = `case-studies/${newProjectId}/media/${uuid()}${ext}`;
  await uploadR2Object(targetKey, bytes, response.headers.get('content-type') || 'application/octet-stream');
  copiedKeys.push(targetKey);
  return r2PublicUrl(targetKey);
}

async function duplicateMedia(value, projectId, copiedKeys) {
  if (Array.isArray(value)) return Promise.all(value.map(item => duplicateMedia(item, projectId, copiedKeys)));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && /(?:image_url|media_url|video_url|thumbnail_url|cover_image_url|hero_image_url|url)$/i.test(key) && r2KeyFromPublicUrl(child)) {
      out[key] = await copyMediaUrl(child, projectId, copiedKeys);
    } else out[key] = await duplicateMedia(child, projectId, copiedKeys);
  }
  return out;
}

export default async function (req, res) {
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const sourceId = req.body?.id;
  if (!sourceId) return res.status(400).json({ error: 'Missing case study id.' });
  let createdId = null;
  const copiedKeys = [];
  try {
    const { rows: found } = await tursoQuery('SELECT * FROM case_studies WHERE id = $1 LIMIT 1', [sourceId]);
    const source = found?.[0];
    if (!source) return res.status(404).json({ error: 'Case study not found.' });

    const newId = uuid();
    const baseSlug = slugify(source.slug) + '-copy';
    let slug = baseSlug;
    for (let attempt = 0; attempt < 12; attempt++) {
      const suffix = attempt ? '-' + uuid().slice(0, 6) : '';
      const candidate = (baseSlug + suffix).slice(0, 90);
      const { rows } = await tursoQuery('SELECT id FROM case_studies WHERE slug = $1 LIMIT 1', [candidate]);
      if (!rows?.length) { slug = candidate; break; }
      if (attempt === 11) throw new Error('Could not reserve a unique duplicate slug. Please retry.');
    }

    const cloned = remapIds(source.content && typeof source.content === 'object' ? source.content : {});
    const content = await duplicateMedia(cloned, newId, copiedKeys);
    const cover = await copyMediaUrl(source.cover_image_url || '', newId, copiedKeys);
    const hero = await copyMediaUrl(source.hero_image_url || '', newId, copiedKeys);
    const { rows: maxRows } = await tursoQuery('SELECT MAX(sort_order) AS max_order FROM case_studies');
    const sortOrder = Number(maxRows?.[0]?.max_order || 0) + 1;
    const { rows: created } = await tursoQuery(
      'INSERT INTO case_studies (id,title,slug,subtitle,description,role,year,duration,category,status,sort_order,content,cover_image_url,hero_image_url,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *',
      [newId, String(source.title || 'Case study') + ' (Copy)', slug, source.subtitle || '', source.description || '', source.role || '', source.year || '', source.duration || '', source.category || '', 'draft', sortOrder, JSON.stringify(content), cover, hero]
    );
    createdId = created?.[0]?.id || newId;
    return res.status(201).json({ ...created[0], status: 'draft', editor_url: '/admin/' });
  } catch (error) {
    if (createdId) {
      try { await tursoQuery('DELETE FROM case_studies WHERE id = $1', [createdId]); } catch (cleanupError) { console.error('duplicate row cleanup failed', cleanupError.message); }
    }
    for (const key of copiedKeys.reverse()) {
      try { await deleteR2Object(key); } catch (cleanupError) { console.error('duplicate media cleanup failed', cleanupError.message); }
    }
    console.error('admin-duplicate-case-study error', error.message);
    return res.status(500).json({ error: 'Unable to duplicate this case study. The original project was not modified. ' + (error.message || '') });
  }
}