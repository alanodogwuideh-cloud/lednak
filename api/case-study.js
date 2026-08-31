import { db } from 'hatchable';

export const access = 'public';
export const methods = ['GET'];

const aliases = { 'outsider-vendor-platform': 'outsider-vendor-app' };

function inferImageLayout(section) {
  const meta = section?.metadata && typeof section.metadata === 'object' && !Array.isArray(section.metadata) ? section.metadata : {};
  const images = Array.isArray(section?.images) ? section.images : [];
  const saved = meta.image_layout && typeof meta.image_layout === 'object' ? meta.image_layout : {};
  const title = String(section?.title || '');
  const mobileFinal = images.length > 0 && images.every(x => x?.image_type === 'mobile_final_ui');
  const webFinal = images.length > 0 && images.every(x => x?.image_type === 'web_final_ui');
  const matrix = /user\s*research\s*findings\s*matrix/i.test(title);
  let defaults = images.length <= 1 ? [1,1,1] : [2,2,1];
  if (mobileFinal) defaults=[4,4,2]; else if (webFinal || matrix) defaults=[1,1,1];
  return { desktop:[1,2,3,4].includes(Number(saved.desktop))?Number(saved.desktop):defaults[0], tablet:[1,2,3,4].includes(Number(saved.tablet))?Number(saved.tablet):defaults[1], mobile:[1,2,3,4].includes(Number(saved.mobile))?Number(saved.mobile):defaults[2] };
}
function normalizeSections(content) {
  const sections = Array.isArray(content?.sections) ? content.sections : [];
  return sections.map((section, index) => ({
    ...section,
    id: section.id || section._id || `section-${index + 1}`,
    _id: section._id || section.id || `section-${index + 1}`,
    asset_type: section.asset_type || section.metadata?.asset_type || '',
    type: section.type || section.section_type || 'content',
    section_type: section.section_type || section.type || 'content',
    presentation_style: section.presentation_style || section.metadata?.presentation_style || section.metadata?.card_variant || '',
    title: section.title || '',
    body: section.body || section.text || '',
    text: section.text || section.body || '',
    metadata: { ...(section.metadata && typeof section.metadata === 'object' && !Array.isArray(section.metadata) ? section.metadata : {}), image_layout: inferImageLayout(section) },
    images: Array.isArray(section.images) ? section.images : [],
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
    const content = project.content && typeof project.content === 'object' && !Array.isArray(project.content) ? project.content : {};
    const caseMeta = content.case_meta && typeof content.case_meta === 'object' && !Array.isArray(content.case_meta) ? content.case_meta : {};
    return res.json({
      id: project.id, slug: project.slug, title: project.title || '', subtitle: project.subtitle || '',
      description: project.description || '', category: project.category || '', year: project.year || '',
      role: project.role || '', duration: project.duration || '',
      case_meta: {
        role_label: caseMeta.role_label || 'Role',
        duration_label: caseMeta.duration_label || 'Duration',
        platform_label: caseMeta.platform_label || 'Platform',
        project_type_label: caseMeta.project_type_label || 'Project type',
        platform: caseMeta.platform || 'Mobile + Web',
        project_type: caseMeta.project_type || 'End-to-end'
      },
      cover_image_url: project.cover_image_url || '',
      hero_image_url: project.hero_image_url || '', content: { sections: normalizeSections(project.content) },
    });
  } catch (error) {
    console.error('case-study error', error.message);
    return res.status(500).json({ error: 'Case study could not be loaded' });
  }
}