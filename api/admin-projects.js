import { requireSupabaseAdmin } from 'lib/admin-auth';
import { supabaseAdmin, deleteStorageObject, storagePathFromPublicUrl } from 'lib/supabase-admin';

export const access = 'public';
export const methods = ['GET', 'POST', 'PUT', 'DELETE'];

const BUCKET = 'portfolio-images';

function mapProject(p) {
  return {
    ...p,
    short_description: p?.subtitle || '',
    overview: p?.description || '',
    status: p?.status || 'draft',
    sort_order: Number(p?.sort_order || 0),
  };
}

function projectPayload(body, partial = false) {
  const fields = {
    title: body.title,
    slug: body.slug,
    subtitle: body.short_description ?? body.subtitle,
    description: body.overview ?? body.description,
    role: body.role,
    client: body.client,
    year: body.year,
    duration: body.duration,
    category: body.category,
    status: body.status,
    sort_order: body.sort_order === undefined ? undefined : Number(body.sort_order || 0),
  };
  const out = {};
  for (const [key, value] of Object.entries(fields)) if (!partial || value !== undefined) out[key] = value;
  return out;
}

async function getProject(id) {
  const rows = await supabaseAdmin(`case_studies?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows?.[0] || null;
}

async function deleteProjectMedia(project) {
  for (const url of [project?.cover_image_url, project?.hero_image_url]) {
    const path = storagePathFromPublicUrl(url, BUCKET);
    if (path) await deleteStorageObject(BUCKET, path).catch(() => {});
  }
}

export default async function (req, res) {
  try {
    const auth = await requireSupabaseAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    if (req.method === 'GET') {
      const rows = await supabaseAdmin('case_studies?select=*&order=sort_order.asc,created_at.asc');
      return res.json((rows || []).map(mapProject));
    }

    const body = req.body || {};
    if (req.method === 'POST') {
      if (!body.title || !body.slug) return res.status(400).json({ error: 'Title and slug are required.' });
      const payload = { ...projectPayload(body), cover_image_url: '', hero_image_url: '', content: { sections: [] } };
      const rows = await supabaseAdmin('case_studies', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) });
      return res.status(201).json(mapProject(rows?.[0]));
    }

    if (!body.id) return res.status(400).json({ error: 'Missing case study id.' });
    const existing = await getProject(body.id);
    if (!existing) return res.status(404).json({ error: 'Case study not found.' });

    if (req.method === 'PUT') {
      const rows = await supabaseAdmin(`case_studies?id=eq.${encodeURIComponent(body.id)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(projectPayload(body, true)) });
      return res.json(mapProject(rows?.[0]));
    }

    if (req.method === 'DELETE') {
      await deleteProjectMedia(existing);
      await supabaseAdmin(`case_studies?id=eq.${encodeURIComponent(body.id)}`, { method: 'DELETE' });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('admin-projects error', error.message);
    return res.status(500).json({ error: error.message || 'Case study operation failed.' });
  }
}