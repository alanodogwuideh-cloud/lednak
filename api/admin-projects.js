import { requireSupabaseAdmin } from 'lib/admin-auth';
import { supabaseAdmin, deleteStorageObject, storagePathFromPublicUrl } from 'lib/supabase-admin';

export const access = 'public';
export const methods = ['GET', 'POST', 'PUT', 'DELETE'];

const BUCKET = 'portfolio-images';

function mapProject(p) {
  return {
    ...p,
    short_description: p.short_description || '',
    overview: p.overview || '',
    status: p.published ? 'published' : 'draft',
    sort_order: Number(p.display_order || 0),
  };
}

function projectPayload(body, partial = false) {
  const out = {};
  const fields = {
    title: body.title,
    slug: body.slug,
    short_description: body.short_description,
    overview: body.overview,
    role: body.role,
    client: body.client,
    year: body.year,
    duration: body.duration,
    category: body.category,
    published: body.status === 'published',
    display_order: body.sort_order === undefined ? undefined : Number(body.sort_order || 0),
  };
  for (const [key, value] of Object.entries(fields)) {
    if (!partial || value !== undefined) out[key] = value;
  }
  return out;
}

async function getProject(id) {
  const rows = await supabaseAdmin(`projects?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows?.[0] || null;
}

async function deleteProjectMedia(projectId, project) {
  const images = await supabaseAdmin(`project_images?select=image_url&project_id=eq.${encodeURIComponent(projectId)}`);
  for (const item of images || []) {
    const path = storagePathFromPublicUrl(item.image_url, BUCKET);
    if (path) await deleteStorageObject(BUCKET, path).catch(() => {});
  }
  for (const url of [project?.cover_image_url, project?.hero_image_url]) {
    const path = storagePathFromPublicUrl(url, BUCKET);
    if (path) await deleteStorageObject(BUCKET, path).catch(() => {});
  }
  await supabaseAdmin(`project_images?project_id=eq.${encodeURIComponent(projectId)}`, { method: 'DELETE' });
  await supabaseAdmin(`case_study_sections?project_id=eq.${encodeURIComponent(projectId)}`, { method: 'DELETE' });
}

export default async function (req, res) {
  try {
    const auth = await requireSupabaseAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    if (req.method === 'GET') {
      const rows = await supabaseAdmin('projects?select=*&order=display_order.asc,created_at.asc');
      return res.json((rows || []).map(mapProject));
    }

    const body = req.body || {};

    if (req.method === 'POST') {
      if (!body.title || !body.slug) return res.status(400).json({ error: 'Title and slug are required.' });
      const payload = {
        ...projectPayload(body),
        cover_image_url: '',
        hero_image_url: '',
        featured: false,
      };
      const rows = await supabaseAdmin('projects', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      return res.status(201).json(mapProject(rows?.[0]));
    }

    if (req.method === 'PUT') {
      if (!body.id) return res.status(400).json({ error: 'Missing case study id.' });
      const existing = await getProject(body.id);
      if (!existing) return res.status(404).json({ error: 'Case study not found.' });
      const rows = await supabaseAdmin(`projects?id=eq.${encodeURIComponent(body.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(projectPayload(body, true)),
      });
      return res.json(mapProject(rows?.[0]));
    }

    if (req.method === 'DELETE') {
      if (!body.id) return res.status(400).json({ error: 'Missing case study id.' });
      const existing = await getProject(body.id);
      if (!existing) return res.status(404).json({ error: 'Case study not found.' });
      await deleteProjectMedia(body.id, existing);
      await supabaseAdmin(`projects?id=eq.${encodeURIComponent(body.id)}`, { method: 'DELETE' });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('admin-projects error', error.message);
    return res.status(500).json({ error: error.message || 'Case study operation failed.' });
  }
}