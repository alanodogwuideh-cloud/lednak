import { db } from 'hatchable';

export const access = 'public';
export const methods = ['GET'];

const aliases = { 'outsider-vendor-platform': 'outsider-vendor-app' };
const validColumns = value => [1, 2, 3, 4].includes(Number(value)) ? Number(value) : 1;

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function inferImageLayout(section) {
  const meta = object(section?.metadata);
  const images = Array.isArray(section?.images) ? section.images : [];
  const saved = object(meta.image_layout);
  const title = String(section?.title || '');
  const mobileFinal = images.length > 0 && images.every(x => x?.image_type === 'mobile_final_ui');
  const webFinal = images.length > 0 && images.every(x => x?.image_type === 'web_final_ui');
  const matrix = /user\s*research\s*findings\s*matrix/i.test(title);
  let defaults = images.length <= 1 ? [1, 1, 1] : [2, 2, 1];
  if (mobileFinal) defaults = [4, 4, 2];
  else if (webFinal || matrix) defaults = [1, 1, 1];
  return {
    desktop: validColumns(saved.desktop || defaults[0]),
    tablet: validColumns(saved.tablet || defaults[1]),
    mobile: validColumns(saved.mobile || defaults[2]),
  };
}

function normalizeImageSubsections(section, parentImages, parentLayout) {
  const meta = object(section?.metadata);
  const raw = Array.isArray(meta.image_subsections) ? meta.image_subsections : [];
  if (!raw.length) return [];

  const imageMap = new Map(parentImages.map(image => [String(image.id), image]));
  return raw.map((sub, index) => {
    const x = object(sub);
    const ids = Array.isArray(x.image_ids) ? x.image_ids.map(String) : [];
    const images = ids.map(id => imageMap.get(id)).filter(Boolean);
    const layout = object(x.image_layout);
    return {
      id: String(x.id || `image-subsection-${index + 1}`),
      title: String(x.title || ''),
      headerVisible: x.headerVisible !== undefined ? Boolean(x.headerVisible) : Boolean(x.header_visible),
      dividerVisible: x.dividerVisible !== undefined ? Boolean(x.dividerVisible) : x.divider_visible !== false,
      image_ids: images.map(image => String(image.id)),
      images,
      desktopColumns: validColumns(x.desktopColumns ?? layout.desktop ?? parentLayout.desktop),
      tabletColumns: validColumns(x.tabletColumns ?? layout.tablet ?? parentLayout.tablet),
      mobileColumns: validColumns(x.mobileColumns ?? layout.mobile ?? parentLayout.mobile),
      singleImageWidth: x.singleImageWidth === 'body' || x.single_image_width === 'body' ? 'body' : 'normal',
    };
  });
}

function normalizeSections(content) {
  const sections = Array.isArray(content?.sections) ? content.sections : [];
  return sections.map((section, index) => {
    const meta = object(section.metadata);
    const rawImages = Array.isArray(section.images) ? section.images : [];
    const images = rawImages.map((image, imageIndex) => ({
      ...image,
      id: image.id || `${section.id || section._id || `section-${index + 1}`}-image-${imageIndex + 1}`,
      display_order: Number(image.display_order ?? imageIndex),
    }));
    const imageLayout = inferImageLayout({ ...section, images, metadata: meta });
    const imageSubsections = normalizeImageSubsections({ ...section, metadata: meta }, images, imageLayout);
    return {
      ...section,
      id: section.id || section._id || `section-${index + 1}`,
      _id: section._id || section.id || `section-${index + 1}`,
      asset_type: section.asset_type || meta.asset_type || '',
      type: section.type || section.section_type || 'content',
      section_type: section.section_type || section.type || 'content',
      presentation_style: section.presentation_style || meta.presentation_style || meta.card_variant || '',
      title: section.title || '',
      body: section.body || section.text || '',
      text: section.text || section.body || '',
      metadata: { ...meta, image_layout: imageLayout, ...(imageSubsections.length ? { image_subsections: imageSubsections } : {}) },
      images,
      display_order: Number(section.display_order || index + 1),
    };
  });
}

export default async function (req, res) {
  try {
    const slug = String(req.query?.slug || '').trim();
    if (!slug) return res.status(400).json({ error: 'Missing slug' });
    const lookup = aliases[slug] || slug;
    const { rows } = await db.query(`SELECT * FROM case_studies WHERE slug = $1 LIMIT 1`, [lookup]);
    const project = rows?.[0];
    if (!project) return res.status(404).json({ error: 'Case study not found' });

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    const content = object(project.content);
    const caseMeta = object(content.case_meta);
    const sections = normalizeSections(content);

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
      case_meta: {
        role_label: caseMeta.role_label || 'Role',
        duration_label: caseMeta.duration_label || 'Duration',
        platform_label: caseMeta.platform_label || 'Platform',
        project_type_label: caseMeta.project_type_label || 'Project type',
        platform: caseMeta.platform || 'Mobile + Web',
        project_type: caseMeta.project_type || 'End-to-end',
      },
      cover_image_url: project.cover_image_url || '',
      hero_image_url: project.hero_image_url || '',
      content: { ...content, sections },
    });
  } catch (error) {
    console.error('case-study error', error.message);
    return res.status(500).json({ error: 'Case study could not be loaded' });
  }
}