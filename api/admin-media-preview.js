import { tursoQuery } from 'lib/turso';
import { requireSupabaseAdmin } from 'lib/admin-auth';

// Owner-only CMS preview endpoint. It redirects the browser to the stored
// media URL so large R2 files never pass through Hatchable memory/bandwidth.
export const access = 'public';
export const methods = ['GET'];

function normalizeContent(content) {
  const value = content && typeof content === 'object' && !Array.isArray(content) ? content : {};
  return { ...value, sections: Array.isArray(value.sections) ? value.sections : [] };
}

function findImage(content, id) {
  for (const section of content.sections) {
    const images = Array.isArray(section.images) ? section.images : [];
    const image = images.find(item => String(item?.id) === String(id));
    if (image) return image;
  }
  return null;
}

export default async function (req, res) {
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  try {
    const projectId = String(req.query?.project_id || '');
    const imageId = String(req.query?.image_id || '');
    const fixed = String(req.query?.fixed || '');
    if (!projectId) return res.status(400).send('Missing project_id.');

    const { rows } = await tursoQuery(`SELECT * FROM case_studies WHERE id = $1 LIMIT 1`, [projectId]);
    const project = rows?.[0];
    if (!project) return res.status(404).send('Case study not found.');

    let url = '';
    if (imageId) {
      const image = findImage(normalizeContent(project.content), imageId);
      url = String(image?.image_url || '');
    } else if (fixed === 'cover') {
      url = String(project.cover_image_url || '');
    } else if (fixed === 'hero') {
      url = String(project.hero_image_url || '');
    } else {
      return res.status(400).send('Missing media target.');
    }

    if (!url) return res.status(404).send('Media preview not found.');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    return res.redirect(url);
  } catch (error) {
    return res.status(500).send(error.message || 'Media preview failed.');
  }
}