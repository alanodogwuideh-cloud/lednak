import { supabaseAdmin } from 'lib/supabase-admin';

export const access = 'public';
export const methods = ['GET'];

const aliases = { 'outsider-vendor-platform': 'outsider-vendor-app' };

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
    images: Array.isArray(section.images) ? section.images : [],
    display_order: Number(section.display_order || index + 1),
  }));
}

export default async function (req, res) {
  try {
    const slug = String(req.query?.slug || '').trim();
    if (!slug) return res.status(400).json({ error: 'Missing slug' });

    let rows = await supabaseAdmin(`case_studies?slug=eq.${encodeURIComponent(slug)}&limit=1`);
    let project = rows?.[0];
    if (!project && aliases[slug]) {
      rows = await supabaseAdmin(`case_studies?slug=eq.${encodeURIComponent(aliases[slug])}&limit=1`);
      project = rows?.[0];
    }
    if (!project) return res.status(404).json({ error: 'Case study not found' });

    const sections = normalizeSections(project.content);
    return res.json({
      id: project.id,
      slug: project.slug,
      title: project.title || '',
      subtitle: project.subtitle || '',
      description: project.description || '',
      category: project.category || '',
      year: project.year || '',
      role: project.role || '',
      duration: project.duration || '',
      client: project.client || '',
      cover_image_url: project.cover_image_url || '',
      hero_image_url: project.hero_image_url || '',
      content: { sections },
    });
  } catch (error) {
    console.error('case-study error', error.message);
    return res.status(500).json({ error: 'Case study could not be loaded' });
  }
}