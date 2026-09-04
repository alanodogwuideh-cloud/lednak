import { requireSupabaseAdmin } from 'lib/admin-auth';
import { supabaseAdmin } from 'lib/supabase-admin';

export const access = 'public';
export const methods = ['GET', 'POST', 'PUT', 'DELETE'];

const DEFAULT_REFINING_ITEMS = [
  'Designed clear navigation structures with simple, predictable user flows to support low digital literacy users',
  'Applied readable typography, clear visual hierarchy, adequate spacing, and scalable UI elements for an inclusive experience',
  'Ensured key actions — managing orders, payments, and inventory — are easy to locate through consistent layouts and intuitive patterns',
];

function metadataObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function normalizeSection(section, index) {
  const metadata = metadataObject(section?.metadata);
  const out = {
    ...section,
    id: section?.id || section?._id || `section-${index + 1}`,
    _id: section?._id || section?.id || `section-${index + 1}`,
    type: section?.type || section?.section_type || 'content',
    section_type: section?.section_type || section?.type || 'content',
    title: section?.title || '',
    body: section?.body || section?.text || '',
    text: section?.text || section?.body || '',
    metadata,
    images: Array.isArray(section?.images) ? section.images : [],
    display_order: Number(section?.display_order || index + 1),
  };
  if (Array.isArray(metadata.items)) out.items = [...metadata.items];
  if (metadata.item_display !== undefined) out.item_display = metadata.item_display;
  if (metadata.quote_text !== undefined) out.quote_text = metadata.quote_text;
  if (metadata.quote_author !== undefined) out.quote_author = metadata.quote_author;
  return out;
}

function normalizeContent(content) {
  return {
    ...(content && typeof content === 'object' && !Array.isArray(content) ? content : {}),
    sections: Array.isArray(content?.sections) ? content.sections.map(normalizeSection) : [],
  };
}

async function getProject(id) {
  const rows = await supabaseAdmin(`case_studies?id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows?.[0] || null;
}

function refineMetadata(section) {
  const metadata = metadataObject(section.metadata);
  if (Array.isArray(section.items)) metadata.items = [...section.items];
  if (section.item_display !== undefined) metadata.item_display = section.item_display;
  if (section.quote_text !== undefined) metadata.quote_text = section.quote_text;
  if (section.quote_author !== undefined) metadata.quote_author = section.quote_author;
  if (/final experience\s*&\s*accessibility/i.test(String(section.title || ''))) {
    const refining = metadataObject(metadata.refining_design);
    const items = Array.isArray(refining.items) ? [...refining.items] : [];
    DEFAULT_REFINING_ITEMS.forEach((fallback, i) => { if (items[i] == null) items[i] = fallback; });
    refining.items = items.slice(0, 3);
    metadata.refining_design = refining;
  }
  return metadata;
}

function preserveSection(section, index) {
  const normalized = normalizeSection(section, index);
  const result = { ...normalized };
  result.metadata = refineMetadata(normalized);
  return result;
}

async function saveSections(project, incoming) {
  const current = normalizeContent(project.content);
  if (!Array.isArray(incoming) || incoming.length === 0) {
    throw new Error('Refusing to save an empty case study. Existing content was preserved.');
  }
  const sections = incoming.map((section, i) => preserveSection(section, i));
  const content = { ...current, sections };
  const rows = await supabaseAdmin(`case_studies?id=eq.${encodeURIComponent(project.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ content }),
  });
  return rows?.[0] || { ...project, content };
}

function response(project) {
  return { ...project, content: normalizeContent(project.content) };
}

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
    if (req.method === 'PUT' && body.replace_all === true) {
      const saved = await saveSections(project, body.sections);
      return res.json(response(saved));
    }

    if (req.method === 'POST') {
      const sections = [...current.sections, {
        section_type: body.section_type || body.type || 'content',
        type: body.type || body.section_type || 'content',
        title: body.title || '',
        body: body.body || body.text || '',
        text: body.text || body.body || '',
        metadata: body.metadata || {},
        items: Array.isArray(body.items) ? body.items : undefined,
        images: Array.isArray(body.images) ? body.images : [],
      }];
      const saved = await saveSections(project, sections);
      return res.status(201).json(response(saved));
    }

    if (req.method === 'PUT') {
      if (!body.id) return res.status(400).json({ error: 'Missing section id.' });
      const index = current.sections.findIndex((section, i) => String(section.id || section._id || `section-${i + 1}`) === String(body.id));
      if (index < 0) return res.status(404).json({ error: 'Section not found.' });
      const updated = { ...current.sections[index], ...body };
      const sections = current.sections.map((section, i) => i === index ? updated : section);
      const saved = await saveSections(project, sections);
      return res.json(response(saved));
    }

    if (req.method === 'DELETE') {
      if (!body.id) return res.status(400).json({ error: 'Missing section id.' });
      const sections = current.sections.filter((section, i) => String(section.id || section._id || `section-${i + 1}`) !== String(body.id));
      if (!sections.length) return res.status(409).json({ error: 'A case study must retain at least one section.' });
      const saved = await saveSections(project, sections);
      return res.json(response(saved));
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('admin-case-study error', error.message);
    return res.status(500).json({ error: error.message || 'Case study operation failed.' });
  }
}