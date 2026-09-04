import { requireSupabaseAdmin } from 'lib/admin-auth';
import { supabaseAdmin, deleteStorageObject, storagePathFromPublicUrl } from 'lib/supabase-admin';

export const access = 'public';
export const methods = ['GET', 'POST', 'PUT', 'DELETE'];

const BUCKET = 'portfolio-images';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function sectionFromRow(row, images) {
  const metadata = normalizeMetadata(row.metadata);
  const out = {
    ...row,
    id: row.id,
    _id: row.id,
    type: row.section_type || 'content',
    section_type: row.section_type || 'content',
    display_order: Number(row.display_order || 0),
    body: row.body || '',
    text: row.body || '',
    metadata,
    images: (images || []).filter(x => String(x.section_id) === String(row.id)),
  };
  if (Array.isArray(metadata.items)) out.items = [...metadata.items];
  if (metadata.item_display) out.item_display = metadata.item_display;
  if (metadata.quote_text !== undefined) out.quote_text = metadata.quote_text;
  if (metadata.quote_author !== undefined) out.quote_author = metadata.quote_author;
  return out;
}

async function getProject(id) {
  const rows = await supabaseAdmin(`projects?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows?.[0] || null;
}

async function loadContent(projectId) {
  const [project, sections, images] = await Promise.all([
    getProject(projectId),
    supabaseAdmin(`case_study_sections?project_id=eq.${encodeURIComponent(projectId)}&select=*&order=display_order.asc,created_at.asc`),
    supabaseAdmin(`project_images?project_id=eq.${encodeURIComponent(projectId)}&select=*&order=display_order.asc,created_at.asc`),
  ]);
  if (!project) return null;
  const normalizedSections = (sections || []).map(row => sectionFromRow(row, images || []));
  return {
    project,
    sections: normalizedSections,
    images: images || [],
  };
}

async function repairRefiningDesign(projectId, current) {
  const section = current.sections.find(s => /final experience\s*&\s*accessibility/i.test(String(s.title || '')));
  if (!section) return current;
  const metadata = normalizeMetadata(section.metadata);
  const refining = normalizeMetadata(metadata.refining_design);
  const items = Array.isArray(refining.items) ? [...refining.items] : [];
  let changed = false;
  REFINING_DEFAULT_ITEMS.forEach((fallback, index) => {
    if (items[index] === null || items[index] === undefined) { items[index] = fallback; changed = true; }
  });
  if (!changed) return current;
  refining.items = items.slice(0, 3);
  metadata.refining_design = refining;
  await supabaseAdmin(`case_study_sections?id=eq.${encodeURIComponent(section.id)}&project_id=eq.${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ metadata }),
  });
  return loadContent(projectId);
}

async function migrateLegacyCaptionedCards(projectId, current) {
  const legacy = current.sections.find(section =>
    String(section.section_type || section.type) === 'cards' &&
    Array.isArray(section.metadata?.card2_items) &&
    section.metadata.card2_items.length
  );
  if (!legacy || current.sections.some(section => String(section.section_type || section.type) === 'card2')) return current;

  const captionedItems = legacy.metadata.card2_items
    .map(item => ({ caption: String(item?.caption || '').trim(), description: String(item?.description || '').trim() }))
    .filter(item => item.caption || item.description);
  if (!captionedItems.length) return current;

  const legacyItems = Array.isArray(legacy.items) && legacy.items.length
    ? legacy.items
    : captionedItems.map(item => item.caption && item.description ? `${item.caption}: ${item.description}` : (item.caption || item.description));

  const cleanMetadata = { ...normalizeMetadata(legacy.metadata), items: legacyItems };
  delete cleanMetadata.card2_items;

  await supabaseAdmin(`case_study_sections?id=eq.${encodeURIComponent(legacy.id)}&project_id=eq.${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ section_type: 'cards', metadata: cleanMetadata }),
  });

  await supabaseAdmin('case_study_sections', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      project_id: projectId,
      section_type: 'card2',
      title: '',
      body: '',
      metadata: { card2_items: captionedItems },
      display_order: Number(legacy.display_order || 0),
    }),
  });

  return loadContent(projectId);
}

const REFINING_DEFAULT_ITEMS = [
  'Designed clear navigation structures with simple, predictable user flows to support low digital literacy users',
  'Applied readable typography, clear visual hierarchy, adequate spacing, and scalable UI elements for an inclusive experience',
  'Ensured key actions — managing orders, payments, and inventory — are easy to locate through consistent layouts and intuitive patterns',
];

function metadataFor(section) {
  const metadata = normalizeMetadata(section.metadata);
  if (Array.isArray(section.items)) metadata.items = section.items;
  if (section.item_display !== undefined) metadata.item_display = section.item_display;
  if (section.quote_text !== undefined) metadata.quote_text = section.quote_text;
  if (section.quote_author !== undefined) metadata.quote_author = section.quote_author;
  if (/final experience\s*&\s*accessibility/i.test(String(section.title || ''))) {
    const refining = normalizeMetadata(metadata.refining_design);
    const items = Array.isArray(refining.items) ? [...refining.items] : [];
    REFINING_DEFAULT_ITEMS.forEach((fallback, index) => {
      if (items[index] === null || items[index] === undefined) items[index] = fallback;
    });
    refining.items = items.slice(0, 3);
    metadata.refining_design = refining;
  }
  return metadata;
}

async function removeSectionImages(sectionId, images) {
  for (const image of (images || []).filter(x => String(x.section_id) === String(sectionId))) {
    const path = storagePathFromPublicUrl(image.image_url, BUCKET);
    if (path) await deleteStorageObject(BUCKET, path).catch(() => {});
  }
  await supabaseAdmin(`project_images?section_id=eq.${encodeURIComponent(sectionId)}`, { method: 'DELETE' });
}

async function saveAllSections(projectId, incomingSections) {
  const current = await loadContent(projectId);
  if (!current) throw new Error('Case study not found.');
  const currentIds = new Set(current.sections.map(s => String(s.id)));
  const keptIds = new Set();
  const savedRows = [];

  for (let i = 0; i < incomingSections.length; i += 1) {
    const section = incomingSections[i] || {};
    const sectionType = String(section.section_type || section.type || 'content');
    const existing = current.sections.find(row => UUID_RE.test(String(section.id || '')) && String(row.id) === String(section.id));
    const incomingMetadata = metadataFor(section);
    // Merge metadata with the stored row instead of replacing it wholesale. This prevents an
    // older admin client or a partially populated editor from erasing fields it did not load.
    const payload = {
      project_id: projectId,
      section_type: sectionType,
      title: String(section.title ?? existing?.title ?? ''),
      body: String(section.body ?? section.text ?? existing?.body ?? ''),
      metadata: { ...normalizeMetadata(existing?.metadata), ...incomingMetadata },
      display_order: i + 1,
    };
    if (/final experience\\s*&\\s*accessibility/i.test(String(section.title || existing?.title || ''))) {
      const storedRefining = normalizeMetadata(existing?.metadata?.refining_design);
      const incomingRefining = normalizeMetadata(incomingMetadata.refining_design);
      payload.metadata.refining_design = { ...storedRefining, ...incomingRefining };
      const storedItems = Array.isArray(storedRefining.items) ? [...storedRefining.items] : [];
      const incomingItems = Array.isArray(incomingRefining.items) ? [...incomingRefining.items] : [];
      payload.metadata.refining_design.items = REFINING_DEFAULT_ITEMS.map((fallback, index) => {
        const incomingValue = incomingItems[index];
        const storedValue = storedItems[index];
        return incomingValue !== null && incomingValue !== undefined && incomingValue !== ''
          ? incomingValue
          : (storedValue !== null && storedValue !== undefined && storedValue !== '' ? storedValue : fallback);
      });
    }

    if (UUID_RE.test(String(section.id || '')) && currentIds.has(String(section.id))) {
      const rows = await supabaseAdmin(`case_study_sections?id=eq.${encodeURIComponent(section.id)}&project_id=eq.${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      if (rows?.[0]) savedRows.push(rows[0]);
      keptIds.add(String(section.id));
    } else {
      const rows = await supabaseAdmin('case_study_sections', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      if (rows?.[0]) savedRows.push(rows[0]);
      keptIds.add(String(rows?.[0]?.id || ''));
    }
  }

  for (const currentSection of current.sections) {
    if (!keptIds.has(String(currentSection.id))) {
      await removeSectionImages(currentSection.id, current.images);
      await supabaseAdmin(`case_study_sections?id=eq.${encodeURIComponent(currentSection.id)}&project_id=eq.${encodeURIComponent(projectId)}`, { method: 'DELETE' });
    }
  }

  return loadContent(projectId);
}

export default async function (req, res) {
  try {
    const auth = await requireSupabaseAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const query = req.query || {};
    const body = req.body || {};
    const projectId = query.project_id || body.project_id;
    if (!projectId) return res.status(400).json({ error: 'Missing project_id.' });

    const current = await loadContent(projectId);
    if (!current) return res.status(404).json({ error: 'Case study not found.' });

    if (req.method === 'GET') {
      const repaired = await repairRefiningDesign(projectId, current);
      const migrated = await migrateLegacyCaptionedCards(projectId, repaired);
      return res.json(migrated);
    }

    if (req.method === 'PUT' && body.replace_all === true && Array.isArray(body.sections)) {
      const saved = await saveAllSections(projectId, body.sections);
      return res.json(saved);
    }

    if (req.method === 'POST') {
      const sections = [...current.sections, {
        section_type: body.section_type || 'content',
        title: body.title || '',
        body: body.body || '',
        metadata: body.metadata || {},
        items: Array.isArray(body.items) ? body.items : undefined,
      }];
      const saved = await saveAllSections(projectId, sections);
      return res.status(201).json(saved.sections[saved.sections.length - 1]);
    }

    if (req.method === 'PUT') {
      if (!body.id) return res.status(400).json({ error: 'Missing section id.' });
      const index = current.sections.findIndex(s => String(s.id) === String(body.id));
      if (index < 0) return res.status(404).json({ error: 'Section not found.' });
      const sections = current.sections.map((section, i) => i === index ? { ...section, ...body } : section);
      const saved = await saveAllSections(projectId, sections);
      return res.json(saved.sections.find(s => String(s.id) === String(body.id)) || saved.sections[index]);
    }

    if (req.method === 'DELETE') {
      if (!body.id) return res.status(400).json({ error: 'Missing section id.' });
      if (!current.sections.some(s => String(s.id) === String(body.id))) return res.status(404).json({ error: 'Section not found.' });
      const sections = current.sections.filter(s => String(s.id) !== String(body.id));
      const saved = await saveAllSections(projectId, sections);
      return res.json({ ok: true, ...saved });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('admin-case-study error', error.message);
    return res.status(500).json({ error: error.message || 'Case study section operation failed.' });
  }
}