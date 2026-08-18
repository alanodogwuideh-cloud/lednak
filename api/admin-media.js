import { requireSupabaseAdmin } from 'lib/admin-auth';
import { supabaseAdmin, deleteStorageObject, storagePathFromPublicUrl } from 'lib/supabase-admin';

export const access = 'public';
export const methods = ['GET', 'POST', 'PATCH', 'DELETE'];

const BUCKET = 'portfolio-images';
const base = () => String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = () => ({ apikey: key(), Authorization: `Bearer ${key()}` });
const safeName = n => String(n || 'image').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160);

const allowed = new Set([
  'research', 'chinedu_persona', 'fatima_persona', 'storyboard',
  'paper_wireframe', 'low_fi_wireframe', 'wireframes', 'usability_testing',
  'mobile_final_ui', 'web_final_ui',
]);

function fixedUrl(project, kind) {
  return kind === 'cover' ? project?.cover_image_url : project?.hero_image_url;
}

async function getProject(id) {
  const rows = await supabaseAdmin(`projects?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows?.[0] || null;
}

async function getSections(projectId) {
  return supabaseAdmin(`case_study_sections?project_id=eq.${encodeURIComponent(projectId)}&select=*&order=display_order.asc,created_at.asc`);
}

async function getImages(projectId) {
  return supabaseAdmin(`project_images?project_id=eq.${encodeURIComponent(projectId)}&select=*&order=display_order.asc,created_at.asc`);
}

function sectionForAsset(sections, assetType) {
  if (!assetType) return null;
  if (assetType === 'research') {
    return sections.find(s => /key\s+research\s+findings/i.test(String(s.title || ''))) || sections.find(s => s.section_type === 'research');
  }
  if (assetType === 'chinedu_persona' || assetType === 'fatima_persona') return sections.find(s => s.section_type === 'personas');
  if (['storyboard', 'paper_wireframe', 'low_fi_wireframe', 'wireframes'].includes(assetType)) {
    return sections.find(s => /from\s+context\s+to\s+concept/i.test(String(s.title || ''))) || sections.find(s => s.section_type === 'process');
  }
  if (assetType === 'usability_testing') return sections.find(s => s.section_type === 'usability') || sections.find(s => /usability/i.test(String(s.title || '')));
  if (assetType === 'mobile_final_ui' || assetType === 'web_final_ui') {
    return sections.find(s => /final\s+experience\s*&\s*accessibility/i.test(String(s.title || ''))) || sections.find(s => s.section_type === 'outcome');
  }
  return null;
}

async function signedUpload(path) {
  const response = await fetch(`${base()}/storage/v1/object/upload/sign/${path}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ upsert: true }),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok || !data?.url) throw new Error(typeof data === 'string' ? data : (data?.message || 'Could not create a signed upload URL.'));
  const raw = String(data.url);
  const signedUrl = new URL(raw.startsWith('/storage/v1/') ? base() + raw : base() + '/storage/v1' + (raw.startsWith('/') ? raw : '/' + raw));
  return signedUrl.toString();
}

async function deleteMediaObject(url) {
  const path = storagePathFromPublicUrl(url, BUCKET);
  if (path) await deleteStorageObject(BUCKET, path).catch(() => {});
}

function flatten(project, images, sections) {
  return (images || []).map(image => ({
    ...image,
    section_title: sections.find(s => String(s.id) === String(image.section_id))?.title || '',
  }));
}

export default async function (req, res) {
  try {
    const auth = await requireSupabaseAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const query = req.query || {};
    const body = req.body || {};
    const projectId = query.project_id || body.project_id;

    if (req.method === 'GET') {
      if (!projectId) return res.status(400).json({ error: 'Missing project_id.' });
      const project = await getProject(projectId);
      if (!project) return res.status(404).json({ error: 'Case study not found.' });
      const [sections, images] = await Promise.all([getSections(projectId), getImages(projectId)]);

      if (query.preview_image_id) {
        const item = (images || []).find(x => String(x.id) === String(query.preview_image_id));
        if (!item?.image_url) return res.status(404).send('Media preview not found.');
        const file = await fetch(item.image_url);
        if (!file.ok) return res.status(404).send('Media preview not found.');
        res.setHeader('Content-Type', file.headers.get('content-type') || 'application/octet-stream');
        return res.send(Buffer.from(await file.arrayBuffer()));
      }

      if (query.preview_fixed) {
        if (!['cover', 'hero'].includes(query.preview_fixed)) return res.status(400).send('Invalid fixed media.');
        const url = fixedUrl(project, query.preview_fixed);
        if (!url) return res.status(404).send('Media preview not found.');
        const file = await fetch(url);
        if (!file.ok) return res.status(404).send('Media preview not found.');
        res.setHeader('Content-Type', file.headers.get('content-type') || 'application/octet-stream');
        return res.send(Buffer.from(await file.arrayBuffer()));
      }

      return res.json({ project, images: flatten(project, images, sections), sections: (sections || []).map((s, i) => ({ id: s.id, title: s.title || '', section_type: s.section_type || 'content', display_order: i + 1 })) });
    }

    if (!projectId) return res.status(400).json({ error: 'Missing project_id.' });
    const project = await getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Case study not found.' });

    if (req.method === 'POST') {
      if (body.action === 'prepare_upload') {
        if (!body.filename) return res.status(400).json({ error: 'Choose a case study and file.' });
        const contentType = String(body.content_type || 'application/octet-stream').toLowerCase();
        const supported = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm', 'video/quicktime']);
        if (!supported.has(contentType)) return res.status(400).json({ error: 'Unsupported media type.' });
        if (body.replace_fixed && !['cover', 'hero'].includes(body.replace_fixed)) return res.status(400).json({ error: 'Invalid fixed replacement target.' });
        if (body.replace_image_id) {
          const existing = await supabaseAdmin(`project_images?id=eq.${encodeURIComponent(body.replace_image_id)}&project_id=eq.${encodeURIComponent(projectId)}&select=id&limit=1`);
          if (!existing?.[0]) return res.status(404).json({ error: 'Media item not found.' });
        }
        const path = `portfolio/${project.slug}/${Date.now()}-${safeName(body.filename)}`;
        const signedUrl = await signedUpload(`portfolio-images/${path}`);
        return res.json({ signedUrl, publicUrl: `${base()}/storage/v1/object/public/${BUCKET}/${path}`, contentType, projectId, replaceFixed: body.replace_fixed || null, replaceImageId: body.replace_image_id || null });
      }

      if (body.action === 'finalize_upload') {
        if (!body.url) return res.status(400).json({ error: 'Missing uploaded media details.' });
        const publicPrefix = `${base()}/storage/v1/object/public/${BUCKET}/`;
        if (!String(body.url).startsWith(publicPrefix)) return res.status(400).json({ error: 'Invalid uploaded media URL.' });

        if (body.replace_fixed) {
          if (!['cover', 'hero'].includes(body.replace_fixed)) return res.status(400).json({ error: 'Invalid fixed replacement target.' });
          const old = fixedUrl(project, body.replace_fixed);
          const rows = await supabaseAdmin(`projects?id=eq.${encodeURIComponent(projectId)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(body.replace_fixed === 'cover' ? { cover_image_url: body.url } : { hero_image_url: body.url }),
          });
          await deleteMediaObject(old);
          return res.json({ kind: body.replace_fixed, url: body.url, project: rows?.[0] });
        }

        if (body.replace_image_id) {
          const existing = await supabaseAdmin(`project_images?id=eq.${encodeURIComponent(body.replace_image_id)}&project_id=eq.${encodeURIComponent(projectId)}&select=*&limit=1`);
          const image = existing?.[0];
          if (!image) return res.status(404).json({ error: 'Media item not found.' });
          const rows = await supabaseAdmin(`project_images?id=eq.${encodeURIComponent(body.replace_image_id)}&project_id=eq.${encodeURIComponent(projectId)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify({ image_url: body.url }),
          });
          await deleteMediaObject(image.image_url);
          return res.json({ kind: 'gallery', url: body.url, image: rows?.[0] || null });
        }

        if (!allowed.has(body.asset_type)) return res.status(400).json({ error: 'Invalid asset type.' });
        const sections = await getSections(projectId);
        const section = sectionForAsset(sections || [], body.asset_type);
        if (!section) return res.status(400).json({ error: `No matching case-study section exists for ${body.asset_type}. Add that section first.` });
        const rows = await supabaseAdmin('project_images', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            project_id: projectId,
            section_id: section.id,
            image_url: body.url,
            image_type: body.asset_type,
            alt_text: String(body.alt_text || ''),
            caption: String(body.caption || ''),
            display_order: Math.max(0, Number(body.display_order || 0)),
          }),
        });
        return res.status(201).json({ kind: 'gallery', url: body.url, image: rows?.[0] || null });
      }

      return res.status(400).json({ error: 'Unknown media action.' });
    }

    if (req.method === 'PATCH') {
      if (!body.id) return res.status(400).json({ error: 'Missing image id.' });
      const existing = await supabaseAdmin(`project_images?id=eq.${encodeURIComponent(body.id)}&project_id=eq.${encodeURIComponent(projectId)}&select=*&limit=1`);
      if (!existing?.[0]) return res.status(404).json({ error: 'Media item not found.' });
      const payload = {};
      if (body.display_order !== undefined) payload.display_order = Math.max(0, Number(body.display_order) || 0);
      if (body.alt_text !== undefined) payload.alt_text = String(body.alt_text);
      if (body.caption !== undefined) payload.caption = String(body.caption);
      const rows = await supabaseAdmin(`project_images?id=eq.${encodeURIComponent(body.id)}&project_id=eq.${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      return res.json(rows?.[0] || existing[0]);
    }

    if (req.method === 'DELETE') {
      if (body.fixed) {
        if (!['cover', 'hero'].includes(body.fixed)) return res.status(400).json({ error: 'Invalid fixed image.' });
        const old = fixedUrl(project, body.fixed);
        const rows = await supabaseAdmin(`projects?id=eq.${encodeURIComponent(projectId)}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(body.fixed === 'cover' ? { cover_image_url: '' } : { hero_image_url: '' }),
        });
        await deleteMediaObject(old);
        return res.json({ ok: true, project: rows?.[0] });
      }

      if (!body.id) return res.status(400).json({ error: 'Missing image id.' });
      const existing = await supabaseAdmin(`project_images?id=eq.${encodeURIComponent(body.id)}&project_id=eq.${encodeURIComponent(projectId)}&select=*&limit=1`);
      if (!existing?.[0]) return res.status(404).json({ error: 'Media item not found.' });
      await supabaseAdmin(`project_images?id=eq.${encodeURIComponent(body.id)}&project_id=eq.${encodeURIComponent(projectId)}`, { method: 'DELETE' });
      await deleteMediaObject(existing[0].image_url);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('admin-media error', error.message);
    return res.status(500).json({ error: error.message || 'Media operation failed.' });
  }
}