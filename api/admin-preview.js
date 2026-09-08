import { db } from 'hatchable';
import { requireSupabaseAdmin } from 'lib/admin-auth';

export const access = 'public';
export const methods = ['POST'];

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export default async function (req, res) {
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    const body = req.body || {};
    const projectId = String(body.project_id || '').trim();
    if (!projectId) return res.status(400).json({ error: 'Missing project_id.' });

    const { rows } = await db.query(`SELECT id,slug,content FROM case_studies WHERE id = $1 LIMIT 1`, [projectId]);
    const project = rows?.[0];
    if (!project) return res.status(404).json({ error: 'Case study not found.' });

    const content = object(project.content);
    let token = String(content.preview_token || '').trim();

    if (!token) {
      token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      const nextContent = { ...content, preview_token: token };
      await db.query(`UPDATE case_studies SET content = $1, updated_at = NOW() WHERE id = $2`, [JSON.stringify(nextContent), project.id]);
    }

    const previewUrl = `/case-study.html?slug=${encodeURIComponent(project.slug)}&preview=${encodeURIComponent(token)}`;
    return res.json({ preview_url: previewUrl });
  } catch (error) {
    console.error('admin-preview error', error.message);
    return res.status(500).json({ error: error.message || 'Unable to create preview link.' });
  }
}