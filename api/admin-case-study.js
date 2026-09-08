import { db } from 'hatchable';
import { requireSupabaseAdmin } from 'lib/admin-auth';

// Owner-only CMS endpoint authenticated by the portfolio's Supabase admin account.
export const access = 'public';
export const methods = ['GET', 'POST', 'PUT', 'DELETE'];

const DEFAULT_REFINING_ITEMS = [
  'Designed clear navigation structures with simple, predictable user flows to support low digital literacy users',
  'Applied readable typography, clear visual hierarchy, adequate spacing, and scalable UI elements for an inclusive experience',
  'Ensured key actions — managing orders, payments, and inventory — are easy to locate through consistent layouts and intuitive patterns',
];

function metadataObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {}; }
function inferImageLayout(section) {
  const meta = metadataObject(section?.metadata); const images = Array.isArray(section?.images) ? section.images : [];
  const saved = meta.image_layout && typeof meta.image_layout === 'object' ? meta.image_layout : {};
  const title = String(section?.title || ''); const types = new Set(images.map(x => String(x?.image_type || '')).filter(Boolean));
  const isMobileFinal = images.length > 0 && images.every(x => x?.image_type === 'mobile_final_ui');
  const isWebFinal = images.length > 0 && images.every(x => x?.image_type === 'web_final_ui');
  const isResearchMatrix = /user\s*research\s*findings\s*matrix/i.test(title) || images.some(x => /user\s*research\s*findings\s*matrix/i.test(`${x?.caption || ''} ${x?.alt_text || ''}`));
  const isDesign = /design\s*exploration/i.test(title);
  const isLowfi = images.some(x => x?.image_type === 'low_fi_wireframe' || (x?.image_type === 'wireframes' && /lowfi\s*wireframe.*offline\s*order\s*flow|offline\s*order\s*flow.*lowfi\s*wireframe/i.test(String(x?.caption || ''))));
  let defaults = images.length <= 1 ? [1, 1, 1] : [2, 2, 1];
  if (isMobileFinal) defaults = [4, 4, 2];
  else if (isWebFinal || isResearchMatrix) defaults = [1, 1, 1];
  else if (isDesign && (types.has('paper_wireframe') || isLowfi)) defaults = [2, 2, 1];
  else if (isDesign && types.has('wireframes')) defaults = [1, 1, 1];
  return { desktop: [1,2,3,4].includes(Number(saved.desktop)) ? Number(saved.desktop) : defaults[0], tablet: [1,2,3,4].includes(Number(saved.tablet)) ? Number(saved.tablet) : defaults[1], mobile: [1,2,3,4].includes(Number(saved.mobile)) ? Number(saved.mobile) : defaults[2] };
}
const ASSET_TYPES = ['Project Cover','Case-study Hero','Project Overview','The Challenge','The Goal','My Role','Project Context','Research Overview','Research Methods','Research Findings','Key Insights','User Personas','User Needs','Problem Statement','Ideation','Information Architecture','User Flow','Wireframing','Low-Fidelity Prototype','High-Fidelity Prototype','Heuristic Review','Usability Testing','Design Decisions','Design Iteration','Design Refinement','Visual Design','Design System','Accessibility','Responsive Design','Final Solution','Outcome','Learnings','Next Steps','Sitemap','Paper Wireframe','Digital Wireframe','Desktop Before Heuristic Review','Desktop After Heuristic Review','Mobile Before Heuristic Review','Mobile After Heuristic Review','Final Desktop Screens','Final Tablet Screens','Final Mobile Screens','High-Fidelity Desktop Onboarding Flow','High-Fidelity Mobile Onboarding Flow','Prototype Buttons Section'];
const PRESENTATIONS = new Set(['text_box','card','list','quote','prototype_buttons']);
const PROTOTYPE_BUTTON_TYPES = new Set(['primary','secondary','outline','ghost','custom']);
function normalizePrototypeButtons(metadata) {
  const meta = metadataObject(metadata);
  if (!Array.isArray(meta.prototype_buttons)) return meta;
  const used = new Set();
  meta.prototype_buttons = meta.prototype_buttons.map((item, index) => {
    const x = metadataObject(item);
    let id = String(x.id || '').trim();
    if (!id || used.has(id)) id = crypto.randomUUID();
    used.add(id);
    const type = PROTOTYPE_BUTTON_TYPES.has(String(x.type || '').toLowerCase()) ? String(x.type).toLowerCase() : 'primary';
    const radius = Number(x.radius);
    return {
      ...x,
      id,
      label: String(x.label || ''),
      url: String(x.url || ''),
      type,
      backgroundColor: String(x.backgroundColor || x.background_color || '#000000'),
      textColor: String(x.textColor || x.text_color || '#FFFFFF'),
      radius: Number.isFinite(radius) ? Math.max(0, Math.min(999, radius)) : 12,
      enabled: x.enabled !== false,
      order: Number.isFinite(Number(x.order)) ? Number(x.order) : index + 1,
      openBehavior: String(x.openBehavior || x.open_behavior || 'modal'),
      modalBehavior: String(x.modalBehavior || x.modal_behavior || 'embed')
    };
  }).sort((a,b) => a.order - b.order).map((x,i) => ({...x, order:i+1}));
  return meta;
}
const STYLE_VALUES = new Set(['card1','card2','card3','card4','card5','analytic_card']);
function inferAssetType(section) {
  const title=String(section?.title||'').trim(); const old=String(section?.section_type||section?.type||'');
  const direct=ASSET_TYPES.find(x=>x.toLowerCase()===title.toLowerCase()); if(direct)return direct;
  const rules=[[/project\s*snapshot/i,'Project Overview'],[/challenge/i,'The Challenge'],[/goal/i,'The Goal'],[/my\s*role/i,'My Role'],[/project\s*context|understanding\s*the\s*product/i,'Project Context'],[/research\s*overview|^research$/i,'Research Overview'],[/research\s*method/i,'Research Methods'],[/key\s*research\s*findings|research\s*findings/i,'Research Findings'],[/key\s*insights/i,'Key Insights'],[/who\s*i\s*designed\s*for|persona/i,'User Personas'],[/user\s*needs/i,'User Needs'],[/problem\s*statement/i,'Problem Statement'],[/ideation/i,'Ideation'],[/information\s*architecture/i,'Information Architecture'],[/user\s*flow/i,'User Flow'],[/wireframing|wireframe/i,'Wireframing'],[/from\s*context\s*to\s*concept|ideation/i,'Ideation'],[/prototyping/i,'High-Fidelity Prototype'],[/low[- ]fi/i,'Low-Fidelity Prototype'],[/high[- ]fidelity/i,'High-Fidelity Prototype'],[/heuristic/i,'Heuristic Review'],[/usability\s*testing|what\s*usability\s*testing/i,'Usability Testing'],[/pain\s*point|user\s*needs/i,'User Needs'],[/key\s*product\s*decisions|design\s*decisions/i,'Design Decisions'],[/design\s*iteration/i,'Design Iteration'],[/design\s*refinement/i,'Design Refinement'],[/visual\s*design/i,'Visual Design'],[/design\s*system/i,'Design System'],[/accessibility/i,'Accessibility'],[/responsive/i,'Responsive Design'],[/final\s*experience|final\s*solution/i,'Final Solution'],[/impact|outcome|takeaways/i,'Outcome'],[/what\s*i\s*learned|learnings/i,'Learnings'],[/next\s*steps/i,'Next Steps'],[/sitemap/i,'Sitemap'],[/paper\s*wireframe/i,'Paper Wireframe'],[/digital\s*wireframe/i,'Digital Wireframe']];
  const hit=rules.find(([re])=>re.test(title)); if(hit)return hit[1];
  if(old==='research')return 'Research Overview'; if(old==='process')return 'Design Exploration'; if(old==='usability')return 'Usability Testing'; if(old==='quote')return 'User Needs';
  return title||'Project Context';
}
function inferPresentation(section) {
  const old=String(section?.section_type||section?.type||''); const meta=metadataObject(section?.metadata);
  const style=String(section?.presentation_style||meta.presentation_style||meta.card_variant||'');
  if(PRESENTATIONS.has(old)) return old;
  if(old==='quote') return 'quote';
  if(['card2','card4','card3','cards','card1','card5','analytic_card'].includes(old)) return 'card';
  if(old==='list') return 'list';
  if(PRESENTATIONS.has(meta.presentation_type) && meta.presentation_type!=='text_box') return meta.presentation_type;
  if(STYLE_VALUES.has(style)) return 'card';
  if(['list','card1','card3','cards'].includes(String(meta.item_display||'')) && (Array.isArray(section?.items)||Array.isArray(meta.items))) return 'list';
  return 'text_box';
}
function inferStyle(section) {
  const old=String(section?.section_type||section?.type||''); const meta=metadataObject(section?.metadata);
  if(STYLE_VALUES.has(old)) return old; if(STYLE_VALUES.has(meta.presentation_style)) return meta.presentation_style; if(meta.card_variant==='card4')return 'card4'; if(meta.card_variant==='card3')return 'card3'; if(meta.card_variant==='card1')return 'card1'; if(meta.card_variant==='analytic_card')return 'analytic_card'; if(Array.isArray(meta.card4_items)&&meta.card4_items.length)return 'card4'; if(Array.isArray(meta.card2_items)&&meta.card2_items.length)return 'card2'; return '';
}
function assetKey(value){const raw=String(value||'').trim();if(!raw)return '';const key=raw.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');const canonical=ASSET_TYPES.find(x=>x.toLowerCase()===raw.toLowerCase());return canonical?canonical.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g):key;}
function resolveAssetType(section){
  const saved=[section?.asset_type, section?.metadata?.asset_type].map(v=>String(v||'').trim()).find(Boolean);
  if(saved){
    const key=assetKey(saved);
    const known=ASSET_TYPES.some(label=>assetKey(label)===key);
    return known?key:saved;
  }
  const inferred=inferAssetType(section);
  return assetKey(inferred);
}
function normalizeCardItems(metadata){
  const meta=metadataObject(metadata);
  for(const key of ['card2_items','card4_items']){
    if(!Array.isArray(meta[key])) continue;
    const used=new Set();
    meta[key]=meta[key].map((item,index)=>{
      const x=metadataObject(item); let id=String(x.id||'').trim();
      if(!id||used.has(id)) id=crypto.randomUUID(); used.add(id);
      return {...x,id};
    });
  }
  return meta;
}
function normalizeImageSubsections(section, imageLayout) {
  const meta = metadataObject(section?.metadata);
  const images = Array.isArray(section?.images) ? section.images : [];
  const validCols = value => [1,2,3,4].includes(Number(value)) ? Number(value) : 1;
  const normalizeOne = (sub, fallbackImages, fallbackTitle = '') => {
    const x = metadataObject(sub);
    const hasImageIds = Array.isArray(x.image_ids);
    const ids = new Set((hasImageIds ? x.image_ids : (Array.isArray(x.images) ? x.images.map(img => img?.id).filter(Boolean) : [])).map(String));
    // image_ids is the authoritative subsection assignment. The embedded
    // `images` array can be stale because it is a hydrated/rendering copy;
    // never let it repopulate a subsection after an image is unselected.
    const byId = new Map(fallbackImages.map(img => [String(img.id), img]));
    const resolved = [...ids].map(id => byId.get(String(id))).filter(Boolean);
    const layout = x.image_layout && typeof x.image_layout === 'object' ? x.image_layout : imageLayout;
    return {
      id: String(x.id || crypto.randomUUID()),
      title: String(x.title || fallbackTitle || ''),
      headerVisible: x.headerVisible !== undefined ? Boolean(x.headerVisible) : (x.header_visible !== undefined ? Boolean(x.header_visible) : false),
      dividerVisible: x.dividerVisible !== undefined ? Boolean(x.dividerVisible) : (x.divider_visible !== undefined ? Boolean(x.divider_visible) : true),
      images: resolved.map((img, i) => ({ ...img, display_order: Number(img.display_order ?? i) })),
      image_ids: resolved.map(img => String(img.id)),
      desktopColumns: validCols(x.desktopColumns ?? layout?.desktop ?? 1),
      tabletColumns: validCols(x.tabletColumns ?? layout?.tablet ?? 1),
      mobileColumns: validCols(x.mobileColumns ?? layout?.mobile ?? 1),
      singleImageWidth: x.singleImageWidth === 'body' || x.single_image_width === 'body' ? 'body' : 'normal'
    };
  };
  if (Object.prototype.hasOwnProperty.call(meta, 'image_subsections') && Array.isArray(meta.image_subsections)) {
    return meta.image_subsections.map(sub => normalizeOne(sub, images.filter(img => (sub.image_ids || []).map(String).includes(String(img.id)))));
  }
  if (!images.length) return [];
  const title = String(section?.title || '');
  const groups = [];
  const addGroup = (groupImages, groupTitle, visible = true) => { if (groupImages.length) groups.push(normalizeOne({ title: groupTitle, headerVisible: visible, dividerVisible: true, image_ids: groupImages.map(x => x.id), image_layout: imageLayout }, groupImages, groupTitle)); };
  if (/final experience\s*&\s*accessibility/i.test(title)) {
    addGroup(images.filter(x => x.image_type === 'mobile_final_ui'), 'Mobile Final UI');
    addGroup(images.filter(x => x.image_type === 'web_final_ui'), 'Web Final UI');
    addGroup(images.filter(x => !['mobile_final_ui','web_final_ui'].includes(x.image_type)), '');
  } else if (/design exploration/i.test(title)) {
    const paper = images.filter(x => x.image_type === 'paper_wireframe');
    const lowfi = images.filter(x => x.image_type === 'low_fi_wireframe' || (x.image_type === 'wireframes' && /lowfi\s*wireframe.*offline\s*order\s*flow|offline\s*order\s*flow.*lowfi\s*wireframe/i.test(String(x.caption || ''))));
    addGroup(paper, 'Paper Wireframe Explorations'); addGroup(lowfi, 'Low-Fi Wireframe Explorations'); addGroup(images.filter(x => !paper.includes(x) && !lowfi.includes(x)), 'Other Design Media');
  } else if (images.some(x => ['marketing_desktop_final','marketing_tablet_final','marketing_mobile_final'].includes(x.image_type))) {
    addGroup(images.filter(x => x.image_type === 'marketing_desktop_final'), 'Final Desktop Screens');
    addGroup(images.filter(x => x.image_type === 'marketing_tablet_final'), 'Final Tablet Screens');
    addGroup(images.filter(x => x.image_type === 'marketing_mobile_final'), 'Final Mobile Screens');
    addGroup(images.filter(x => !['marketing_desktop_final','marketing_tablet_final','marketing_mobile_final'].includes(x.image_type)), '', false);
  } else if (/from\s*sitemap\s*to\s*responsive\s*wireframes/i.test(title) || images.some(x => ['marketing_sitemap','marketing_paper_wireframe','marketing_digital_wireframe'].includes(x.image_type))) {
    addGroup(images.filter(x => x.image_type === 'marketing_paper_wireframe'), 'Paper Wireframe');
    addGroup(images.filter(x => x.image_type === 'marketing_tablet_final'), 'Final Tablet Screens');
    images.filter(x => !['marketing_paper_wireframe','marketing_tablet_final'].includes(x.image_type)).forEach(x => addGroup([x], String(x.caption || x.alt_text || 'Project image')));
  } else if (types.has('storyboard') && types.has('wireframes')) {
    addGroup(images.filter(x => x.image_type === 'storyboard'), 'Storyboarding');
    addGroup(images.filter(x => x.image_type === 'wireframes'), 'Design Exploration');
    addGroup(images.filter(x => !['storyboard','wireframes'].includes(x.image_type)), 'Other Design Media');
  } else {
    addGroup(images, '', false);
  }
  return groups;
}
function normalizeSection(section, index) {
  let metadata = normalizePrototypeButtons(normalizeCardItems(section?.metadata)); const assetType=resolveAssetType({...section,metadata}); const presentation=section?.section_type&&PRESENTATIONS.has(section.section_type)?section.section_type:inferPresentation(section); const style=section?.presentation_style||metadata.presentation_style||inferStyle(section);
  metadata.asset_type=assetType; metadata.presentation_type=presentation; if(style)metadata.presentation_style=style;
  metadata.image_layout = inferImageLayout(section);
  metadata.image_subsections = normalizeImageSubsections(section, metadata.image_layout);
  const out = { ...section, id: section?.id || section?._id || `section-${index + 1}`, _id: section?._id || section?.id || `section-${index + 1}`, asset_type:assetType, type:presentation, section_type:presentation, presentation_style:style, title: section?.title || '', body: section?.body || section?.text || '', text: section?.text || section?.body || '', metadata, images: Array.isArray(section?.images) ? section.images : [], display_order: Number(section?.display_order || index + 1) };
  if (Array.isArray(metadata.items)) out.items = [...metadata.items]; if (metadata.item_display !== undefined) out.item_display = metadata.item_display; if (metadata.quote_text !== undefined) out.quote_text = metadata.quote_text; if (metadata.quote_author !== undefined) out.quote_author = metadata.quote_author;
  return out;
}
function normalizeContent(content) {
  const base = content && typeof content === 'object' && !Array.isArray(content) ? content : {};
  const rawSections = Array.isArray(base.sections) ? base.sections : [];
  const usedIds = new Set();
  const sections = rawSections.map((section, index) => {
    const normalized = normalizeSection(section, index);
    let id = String(normalized.id || normalized._id || '').trim();
    if (!id || usedIds.has(id)) id = crypto.randomUUID();
    usedIds.add(id);
    return { ...normalized, id, _id: id };
  });
  return { ...base, sections };
}
function refine(section) {
  const metadata = metadataObject(section.metadata);
  if (Array.isArray(section.items)) metadata.items = [...section.items];
  if (section.item_display !== undefined) metadata.item_display = section.item_display;
  if (section.quote_text !== undefined) metadata.quote_text = section.quote_text;
  if (section.quote_author !== undefined) metadata.quote_author = section.quote_author;
  if (/final experience\s*&\s*accessibility/i.test(String(section.title || '')) || /refining\s+the\s+design|design\s+refinement/i.test(String(section.title || ''))) {
    const refining = metadataObject(metadata.refining_design);
    const items = Array.isArray(refining.items) ? [...refining.items] : [];
    DEFAULT_REFINING_ITEMS.forEach((fallback, i) => { if (items[i] == null) items[i] = fallback; });
    refining.items = items.slice(0, 3); metadata.refining_design = refining;
  }
  return metadata;
}
async function getProject(id) { const { rows } = await db.query(`SELECT * FROM case_studies WHERE id = $1 LIMIT 1`, [id]); return rows?.[0] || null; }
async function saveSections(project, incoming, caseMeta) {
  if (!Array.isArray(incoming) || !incoming.length) throw new Error('Refusing to save an empty case study. Existing content was preserved.');
  const current = normalizeContent(project.content);
  if (caseMeta && typeof caseMeta === 'object' && !Array.isArray(caseMeta)) {
    const currentMeta = current.case_meta && typeof current.case_meta === 'object' && !Array.isArray(current.case_meta) ? current.case_meta : {};
    current.case_meta = {
      role_label: caseMeta.role_label ?? currentMeta.role_label ?? 'Role',
      duration_label: caseMeta.duration_label ?? currentMeta.duration_label ?? 'Duration',
      platform_label: caseMeta.platform_label ?? currentMeta.platform_label ?? 'Platform',
      project_type_label: caseMeta.project_type_label ?? currentMeta.project_type_label ?? 'Project type',
      platform: caseMeta.platform ?? currentMeta.platform ?? 'Mobile + Web',
      project_type: caseMeta.project_type ?? currentMeta.project_type ?? 'End-to-end'
    };
  }
  const existingById = new Map(current.sections.map((s, i) => [String(s.id || s._id || `section-${i + 1}`), s]));
  const sections = incoming.map((s, i) => {
    const existingSection = existingById.get(String(s?.id || s?._id || `section-${i + 1}`));
    const source = (s?.asset_type || s?.metadata?.asset_type) ? s : { ...s, asset_type: existingSection?.asset_type || existingSection?.metadata?.asset_type || s?.asset_type };
    const x = normalizeSection(source, i);
    x.metadata = refine(x);
    // Preserve all item collections exactly as supplied by the editor. Card 2/Card 4
    // content lives in their dedicated metadata collections and must never be cleared here.
    return x;
  });
  const content = { ...current, sections };
  const { rows } = await db.query(`UPDATE case_studies SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [JSON.stringify(content), project.id]);
  return rows?.[0] || project;
}
function response(project) { const content = normalizeContent(project.content); const sections = content.sections; const images = sections.flatMap((section, sectionIndex) => (Array.isArray(section.images) ? section.images : []).map((image, imageIndex) => ({ ...image, id: image.id || `${section.id}-image-${imageIndex + 1}`, project_id: project.id, section_id: section.id, section_title: section.title || '', display_order: Number(image.display_order ?? imageIndex) }))); return { ...project, content, sections, images }; }

export default async function (req, res) {
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  try {
    const body = req.body || {};
    const projectId = req.query?.project_id || body.project_id || body.id;
    if (!projectId) return res.status(400).json({ error: 'Missing project_id.' });
    const project = await getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Case study not found.' });
    if (req.method === 'GET') return res.json(response(project));
    const current = normalizeContent(project.content);
    if (req.method === 'PUT' && body.replace_all === true) return res.json(response(await saveSections(project, body.sections, body.case_meta)));
    if (req.method === 'POST') {
      const sections = [...current.sections, { type: body.type || body.section_type || 'content', section_type: body.section_type || body.type || 'content', title: body.title || '', body: body.body || body.text || '', text: body.text || body.body || '', metadata: body.metadata || {}, items: body.items, images: body.images || [] }];
      return res.status(201).json(response(await saveSections(project, sections)));
    }
    if (req.method === 'PUT') {
      if (!body.id) return res.status(400).json({ error: 'Missing section id.' });
      const index = current.sections.findIndex((s, i) => String(s.id || s._id || `section-${i + 1}`) === String(body.id));
      if (index < 0) return res.status(404).json({ error: 'Section not found.' });
      const sections = current.sections.map((s, i) => i === index ? { ...s, ...body } : s);
      return res.json(response(await saveSections(project, sections)));
    }
    if (req.method === 'DELETE') {
      if (!body.id) return res.status(400).json({ error: 'Missing section id.' });
      const sections = current.sections.filter((s, i) => String(s.id || s._id || `section-${i + 1}`) !== String(body.id));
      if (sections.length === current.sections.length) return res.status(404).json({ error: 'Section not found.' });
      if (!sections.length) return res.status(409).json({ error: 'A case study must retain at least one section.' });

      // Delete the requested section directly from the stored case-study
      // document. This is intentionally separate from the general save path:
      // a delete must be an atomic persisted operation, not merely a client-side
      // array mutation that can be overwritten by a later save/reload.
      const content = { ...current, sections: sections.map((s, i) => ({ ...s, display_order: i + 1 })) };
      const { rows } = await db.query(
        `UPDATE case_studies SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [JSON.stringify(content), project.id]
      );
      return res.json(response(rows?.[0] || project));
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) { console.error('admin-case-study error', error.message); return res.status(500).json({ error: error.message || 'Case study operation failed.' }); }
}