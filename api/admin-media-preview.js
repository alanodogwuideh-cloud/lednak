import { requireSupabaseAdmin } from 'lib/admin-auth';
import { supabaseAdmin } from 'lib/supabase-admin';

export const access = 'public';
export const methods = ['GET'];

async function sendProxy(res, url) {
  // Supabase Storage is already public for these portfolio assets. Redirecting
  // avoids loading multi-megabyte GIF/video files into the 128 MB isolate heap.
  res.setHeader('Cache-Control', 'private, max-age=300');
  return res.redirect(url);
}

export default async function (req, res) {
  try {
    const auth = await requireSupabaseAdmin(req);
    if (!auth.ok) return res.status(auth.status).send(auth.error);
    const projectId = String(req.query?.project_id || '');
    if (!projectId) return res.status(400).send('Missing project_id.');

    const projects = await supabaseAdmin(`projects?id=eq.${encodeURIComponent(projectId)}&select=cover_image_url,hero_image_url&limit=1`);
    const project = projects?.[0];
    if (!project) return res.status(404).send('Case study not found.');

    let url = '';
    const imageId = String(req.query?.image_id || '');
    const fixed = String(req.query?.fixed || '');
    if (imageId) {
      const images = await supabaseAdmin(`project_images?id=eq.${encodeURIComponent(imageId)}&project_id=eq.${encodeURIComponent(projectId)}&select=image_url&limit=1`);
      url = images?.[0]?.image_url || '';
    } else if (fixed === 'cover' || fixed === 'hero') {
      url = project[fixed + '_image_url'] || '';
    } else {
      return res.status(400).send('Missing media target.');
    }

    if (!url) return res.status(404).send('Media preview not found.');
    return sendProxy(res, url);
  } catch (error) {
    return res.status(500).send(error.message || 'Media preview failed.');
  }
}