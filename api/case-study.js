import { db } from 'hatchable';

export const access = 'public';
export const methods = ['GET'];

const aliases = { 'outsider-vendor-platform': 'outsider-vendor-app' };

function normalizeImage(image) {
  if (!image || typeof image !== 'object') return image;
  const out = { ...image };
  const candidates = [out.image_url, out.url, out.src, out.path, out.storage_path, out.file_path].filter(v => typeof v === 'string' && v.trim());
  const raw = candidates[0] || '';
  if (raw && /^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      const marker = '/storage/v1/object/public/portfolio-images/';
      const idx = u.pathname.indexOf(marker);
      if (idx >= 0) {
        const objectPath = decodeURIComponent(u.pathname.slice(idx + marker.length));
        out.storage_path = objectPath;
        out.image_url = `https://${u.host}${marker}${objectPath.split('/').map(encodeURIComponent).join('/')}`;
      }
    } catch (_) {}
  }
  return out;
}

function normalizeSections(content) {
  const sections = Array.isArray(content?.sections) ? content.sections : [];
  return sections.map((section, index) => ({
    ...section,
    id: section.id || section._id || `section-${index + 1}`,
    _id: section._id || section.id || `section-${index + 1}`,
    type: section.type || section.section_type || 'content',
    section_type: section.section_type || section.type || 'content',
    title: section.title || '',
    body: section.body || section.text || '',
    text: section.text || section.body || '',
    metadata: section.metadata && typeof section.metadata === 'object' && !Array.isArray(section.metadata) ? section.metadata : {},
    images: Array.isArray(section.images) ? section.images.map(normalizeImage) : [],
    display_order: Number(section.display_order || index + 1),
  }));
}

export default async function (req, res) {
  try {
    const slug = String(req.query?.slug || '').trim();
    if (!slug) return res.status(400).json({ error: 'Missing slug' });
    const lookup = aliases[slug] || slug;
    const { rows } = await db.query(`SELECT * FROM case_studies WHERE slug = $1 LIMIT 1`, [lookup]);
    const project = rows?.[0];
    if (!project) return res.status(404).json({ error: 'Case study not found' });
    return res.json({
      id: project.id, slug: project.slug, title: project.title || '', subtitle: project.subtitle || '',
      description: project.description || '', category: project.category || '', year: project.year || '',
      role: project.role || '', duration: project.duration || '', cover_image_url: project.cover_image_url || '',
      hero_image_url: project.hero_image_url || '', content: { sections: normalizeSections(project.content) },
    });
  } catch (error) {
    console.error('case-study error', error.message);
    return res.status(500).json({ error: 'Case study could not be loaded' });
  }
}