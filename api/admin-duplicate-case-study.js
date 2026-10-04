import { tursoQuery } from 'lib/turso';
import { requireSupabaseAdmin } from 'lib/admin-auth';
export const access = 'public';
export const methods = ['POST'];
function slugify(value) { return String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'case-study'; }
function cloneContent(raw) {
  const content = raw && typeof raw === 'object' && !Array.isArray(raw) ? JSON.parse(JSON.stringify(raw)) : {};
  if (Array.isArray(content.sections)) content.sections = content.sections.map((section, index) => {
    const copy = { ...section, id: crypto.randomUUID(), display_order: index + 1 };
    if (Array.isArray(section.images)) copy.images = section.images.map(image => ({ ...image, id: crypto.randomUUID() }));
    if (copy.metadata && Array.isArray(copy.metadata.card2_items)) copy.metadata.card2_items = copy.metadata.card2_items.map(item => ({ ...item, id: crypto.randomUUID() }));
    if (copy.metadata && Array.isArray(copy.metadata.card4_items)) copy.metadata.card4_items = copy.metadata.card4_items.map(item => ({ ...item, id: crypto.randomUUID() }));
    return copy;
  });
  return content;
}
export default async function (req, res) {
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  try {
    const sourceId = req.body?.id;
    if (!sourceId) return res.status(400).json({ error: 'Missing case study id.' });
    const { rows: found } = await tursoQuery('SELECT * FROM case_studies WHERE id = $1 LIMIT 1', [sourceId]);
    const source = found?.[0];
    if (!source) return res.status(404).json({ error: 'Case study not found.' });
    const baseSlug = slugify(source.slug) + '-copy';
    let slug = baseSlug;
    for (let i = 2; i < 100; i++) {
      const { rows } = await tursoQuery('SELECT id FROM case_studies WHERE slug = $1 LIMIT 1', [slug]);
      if (!rows?.length) break;
      slug = baseSlug + '-' + i;
    }
    const { rows: maxRows } = await tursoQuery('SELECT MAX(sort_order) AS max_order FROM case_studies');
    const content = cloneContent(source.content);
    const { rows: created } = await tursoQuery('INSERT INTO case_studies (title,slug,subtitle,description,role,year,duration,category,status,sort_order,content,cover_image_url,hero_image_url,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *', [String(source.title || 'Case study') + ' (Copy)', slug, source.subtitle || '', source.description || '', source.role || '', source.year || '', source.duration || '', source.category || '', 'draft', Number(maxRows?.[0]?.max_order || 0) + 1, JSON.stringify(content), source.cover_image_url || '', source.hero_image_url || '']);
    return res.status(201).json({ ...created[0], status: 'draft' });
  } catch (error) {
    console.error('admin-duplicate-case-study error', error.message);
    return res.status(500).json({ error: error.message || 'Unable to duplicate case study.' });
  }
}