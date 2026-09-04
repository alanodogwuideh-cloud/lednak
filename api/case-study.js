import { supabaseAdmin } from 'lib/supabase-admin';

export const access = 'public';
export const methods = ['GET'];

function metadataObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export default async function (req, res) {
  try {
    const slug = req.query?.slug;
    if (!slug) return res.status(400).json({ error: 'Missing slug' });

    const aliases = { 'outsider-vendor-app': 'outsider-vendor-platform' };
    let projects = await supabaseAdmin(`projects?slug=eq.${encodeURIComponent(slug)}&limit=1`);
    let project = projects?.[0];
    if (!project && aliases[slug]) {
      projects = await supabaseAdmin(`projects?slug=eq.${encodeURIComponent(aliases[slug])}&limit=1`);
      project = projects?.[0];
    }
    if (!project) return res.status(404).json({ error: 'Case study not found' });

    const [sections, images] = await Promise.all([
      supabaseAdmin(`case_study_sections?project_id=eq.${encodeURIComponent(project.id)}&select=*&order=display_order.asc,created_at.asc`),
      supabaseAdmin(`project_images?project_id=eq.${encodeURIComponent(project.id)}&select=*&order=display_order.asc,created_at.asc`),
    ]);

    const blocks = (sections || []).map(section => {
      const metadata = metadataObject(section.metadata);
      const block = {
        ...section,
        type: section.section_type || 'content',
        section_type: section.section_type || 'content',
        text: section.body || '',
        body: section.body || '',
        metadata,
        images: (images || []).filter(image => String(image.section_id) === String(section.id)),
      };
      if (Array.isArray(metadata.items)) block.items = metadata.items;
      if (metadata.item_display) block.item_display = metadata.item_display;
      if (metadata.quote_text !== undefined) block.quote_text = metadata.quote_text;
      if (metadata.quote_author !== undefined) block.quote_author = metadata.quote_author;
      return block;
    });

    return res.json({
      id: project.id,
      slug: project.slug,
      title: project.title,
      subtitle: project.short_description || '',
      description: project.overview || '',
      category: project.category || '',
      year: project.year || '',
      role: project.role || '',
      duration: project.duration || '',
      client: project.client || '',
      cover_image_url: project.cover_image_url || '',
      hero_image_url: project.hero_image_url || '',
      content: { sections: blocks },
    });
  } catch (error) {
    console.error('case-study error', error.message);
    return res.status(500).json({ error: 'Case study could not be loaded' });
  }
}