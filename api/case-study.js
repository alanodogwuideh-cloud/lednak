import { tursoQuery } from 'lib/turso';
import { normalizeR2Url } from 'lib/r2';

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

function normalizeSubsectionShowcase(section,parentImages){
  const meta=object(section?.metadata);const raw=Array.isArray(meta.showcase_subsections)?meta.showcase_subsections:[];const map=new Map(parentImages.map(image=>[String(image.id),image]));const valid=new Set(['card1','card2','card3','card4','card5','analytic_card']);
  return raw.map((sub,index)=>{const x=object(sub);const legacy=String(x.image_id||'').trim();const ids=Array.isArray(x.image_ids)?x.image_ids.map(String):legacy?[legacy]:[];const layout=String(x.layout||'grid')==='list'?'list':'grid';const selectedIds=layout==='grid'?ids.slice(0,1):ids;return {id:String(x.id||('showcase-subsection-'+(index+1))),title:String(x.title||''),description:String(x.description||''),image_id:selectedIds[0]||'',image_ids:selectedIds,images:selectedIds.map(id=>map.get(id)).filter(Boolean),image:map.get(selectedIds[0])||null,presentation_style:valid.has(String(x.presentation_style))?String(x.presentation_style):'card1',display_order:Number(x.display_order||index+1)||index+1,layout,desktopColumns:validColumns(x.desktopColumns??2),tabletColumns:validColumns(x.tabletColumns??2),mobileColumns:validColumns(x.mobileColumns??1),singleImageWidth:x.singleImageWidth==='body'||x.single_image_width==='body'?'body':'normal'};});
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
  const usedIds = new Set();
  return sections.map((section, index) => {
    let sectionId = String(section?.id || section?._id || `section-${index + 1}`).trim();
    if (!sectionId || usedIds.has(sectionId)) sectionId = crypto.randomUUID();
    usedIds.add(sectionId);
    const meta = object(section.metadata);
    const rawImages = Array.isArray(section.images) ? section.images : [];
    const images = rawImages.map((image, imageIndex) => ({
      ...image,
      image_url: normalizeR2Url(image.image_url || ''),
      id: image.id || `${sectionId}-image-${imageIndex + 1}`,
      section_id: sectionId,
      display_order: Number(image.display_order ?? imageIndex),
    }));
    const imageLayout = inferImageLayout({ ...section, images, metadata: meta });
    const imageSubsections = normalizeImageSubsections({ ...section, metadata: meta }, images, imageLayout);
    const showcaseSubsections = normalizeSubsectionShowcase({ ...section, metadata: meta }, images);
    return {
      ...section,
      id: sectionId,
      _id: sectionId,
      asset_type: section.asset_type || meta.asset_type || '',
      type: section.type || section.section_type || 'content',
      section_type: section.section_type || section.type || 'content',
      presentation_style: section.presentation_style || meta.presentation_style || meta.card_variant || '',
      title: section.title || '',
      body: section.body || section.text || '',
      text: section.text || section.body || '',
      metadata: { ...meta, image_layout: imageLayout, ...(Object.prototype.hasOwnProperty.call(meta, 'image_subsections') ? { image_subsections: imageSubsections } : {}), ...(showcaseSubsections.length ? { showcase_subsections: showcaseSubsections } : {}) },
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
    const { rows } = await tursoQuery(`SELECT * FROM case_studies WHERE slug = $1 LIMIT 1`, [lookup]);
    const project = rows?.[0];
    if (!project) return res.status(404).json({ error: 'Case study not found' });

    const requestedPreviewToken = String(req.query?.preview || '').trim();
    const contentForAccess = object(project.content);
    const storedPreviewToken = String(contentForAccess.preview_token || '').trim();
    const isPreview = Boolean(requestedPreviewToken && storedPreviewToken && requestedPreviewToken === storedPreviewToken);
    if (String(project.status || 'draft') !== 'published' && !isPreview) {
      return res.status(404).json({ error: 'Case study not found' });
    }

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    const rawContent = object(project.content);
    const { preview_token: _previewToken, ...content } = rawContent;
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
      cover_image_url: normalizeR2Url(project.cover_image_url || ''),
      hero_image_url: normalizeR2Url(project.hero_image_url || ''),
      content: { ...content, sections },
    });
  } catch (error) {
    console.error('case-study error', error.message);
    return res.status(500).json({ error: 'Case study could not be loaded' });
  }
}