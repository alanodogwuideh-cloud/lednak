import { db } from 'hatchable';
import { requireSupabaseAdmin } from 'lib/admin-auth';

export const access = 'public';
export const methods = ['GET', 'POST', 'PUT', 'DELETE'];

const DEFAULT_REFINING_ITEMS = [
  'Designed clear navigation structures with simple, predictable user flows to support low digital literacy users',
  'Applied readable typography, clear visual hierarchy, adequate spacing, and scalable UI elements for an inclusive experience',
  'Ensured key actions — managing orders, payments, and inventory — are easy to locate through consistent layouts and intuitive patterns',
];

function metadataObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {}; }
function normalizeSection(section, index) {
  const metadata = metadataObject(section?.metadata);
  const out = { ...section, id: section?.id || section?._id || `section-${index + 1}`, _id: section?._id || section?.id || `section-${index + 1}`, type: section?.type || section?.section_type || 'content', section_type: section?.section_type || section?.type || 'content', title: section?.title || '', body: section?.body || section?.text || '', text: section?.text || section?.body || '', metadata, images: Array.isArray(section?.images) ? section.images : [], display_order: Number(section?.display_order || index + 1) };
  if (Array.isArray(metadata.items)) out.items = [...metadata.items];
  if (metadata.item_display !== undefined) out.item_display = metadata.item_display;
  if (metadata.quote_text !== undefined) out.quote_text = metadata.quote_text;
  if (metadata.quote_author !== undefined) out.quote_author = metadata.quote_author;
  return out;
}
function normalizeContent(content) { return { ...(content && typeof content === 'object' && !Array.isArray(content) ? content : {}), sections: Array.isArray(content?.sections) ? content.sections.map(normalizeSection) : [] }; }
function refine(section) {
  const metadata = metadataObject(section.metadata);
  if (Array.isArray(section.items)) metadata.items = [...section.items];
  if (section.item_display !== undefined) metadata.item_display = section.item_display;
  if (section.quote_text !== undefined) metadata.quote_text = section.quote_text;
  if (section.quote_author !== undefined) metadata.quote_author = section.quote_author;
  if (/final experience\s*&\s*accessibility/i.test(String(section.title || ''))) {
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
  const sections = incoming.map((s, i) => {
    const x = normalizeSection(s, i);
    x.metadata = refine(x);
    // Card 2 is the replacement representation for the legacy flat list.
    // Do not carry the old `items` array forward, otherwise deleted legacy
    // rows can be reconstructed when the editor is reopened.
    if (x.section_type === 'card2' || x.type === 'card2') {
      x.items = [];
      if (x.metadata && Object.prototype.hasOwnProperty.call(x.metadata, 'items')) delete x.metadata.items;
    }
    return x;
  });
  const content = { ...current, sections };
  const { rows } = await db.query(`UPDATE case_studies SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [JSON.stringify(content), project.id]);
  return rows?.[0] || project;
}
function response(project) { const content = normalizeContent(project.content); const sections = content.sections; const images = sections.flatMap((section, sectionIndex) => (Array.isArray(section.images) ? section.images : []).map((image, imageIndex) => ({ ...image, id: image.id || `${section.id}-image-${imageIndex + 1}`, project_id: project.id, section_id: section.id, section_title: section.title || '', display_order: Number(image.display_order ?? imageIndex) }))); return { ...project, content, sections, images }; }

export default async function (req, res) {
  try {
    const auth = await requireSupabaseAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
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
      const sections = current.sections.filter((s, i) => String(s.id || s._id || `section-${i + 1}`) !== String(body.id));
      if (!body.id) return res.status(400).json({ error: 'Missing section id.' });
      if (!sections.length) return res.status(409).json({ error: 'A case study must retain at least one section.' });
      return res.json(response(await saveSections(project, sections)));
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) { console.error('admin-case-study error', error.message); return res.status(500).json({ error: error.message || 'Case study operation failed.' }); }
}