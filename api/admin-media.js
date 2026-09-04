import { supabaseAdmin } from 'lib/supabase-admin';
import { db } from 'hatchable';

// Owner-only CMS endpoint. Edge auth avoids the Supabase Auth server dependency.
export const access = 'admin';
export const methods = ['GET', 'POST', 'PATCH', 'DELETE'];

const BUCKET = 'portfolio-images';
const base = () => String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = () => ({ apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}` });
const safeName = n => String(n || 'image').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160);
const uuid = () => crypto.randomUUID();

const allowed = new Set([
  'cover', 'hero',
  'research', 'chinedu_persona', 'fatima_persona', 'storyboard',
  'paper_wireframe', 'low_fi_wireframe', 'wireframes', 'usability_testing',
  'mobile_final_ui', 'web_final_ui',
  'marketing_sitemap', 'marketing_paper_wireframe', 'marketing_digital_wireframe',
  'marketing_desktop_before', 'marketing_desktop_after', 'marketing_mobile_before',
  'marketing_mobile_after', 'marketing_desktop_final', 'marketing_tablet_final',
  'marketing_mobile_final', 'marketing_hifi_desktop', 'marketing_hifi_mobile',
]);

function normalizeContent(content) {
  return {
    ...(content && typeof content === 'object' && !Array.isArray(content) ? content : {}),
    sections: Array.isArray(content?.sections) ? content.sections.map((s, i) => ({
      ...s,
      id: s.id || s._id || `section-${i + 1}`,
      _id: s._id || s.id || `section-${i + 1}`,
      images: Array.isArray(s.images) ? s.images : [],
    })) : [],
  };
}

async function getProject(id) {
  const { rows } = await db.query(`SELECT * FROM case_studies WHERE id = $1 LIMIT 1`, [id]);
  return rows?.[0] || null;
}

function sectionForAsset(sections, assetType) {
  if (assetType === 'research') return sections.find(s => /key\s+research\s+findings/i.test(String(s.title || ''))) || sections.find(s => s.section_type === 'research' || s.type === 'research');
  if (assetType === 'chinedu_persona' || assetType === 'fatima_persona') return sections.find(s => s.section_type === 'personas' || s.type === 'personas');
  if (assetType === 'storyboard') return sections.find(s => /from\s+context\s+to\s+concept/i.test(String(s.title || ''))) || sections.find(s => s.section_type === 'process' || s.type === 'process');
  if (['paper_wireframe', 'low_fi_wireframe', 'wireframes'].includes(assetType)) return sections.find(s => /design\s+exploration|low-fi\s+wireframe/i.test(String(s.title || ''))) || sections.find(s => s.section_type === 'process' || s.type === 'process');
  if (assetType === 'usability_testing') return sections.find(s => s.section_type === 'usability' || s.type === 'usability' || /usability/i.test(String(s.title || '')));
  if (assetType === 'mobile_final_ui' || assetType === 'web_final_ui') return sections.find(s => /final\s+experience\s*&\s*accessibility/i.test(String(s.title || ''))) || sections.find(s => s.section_type === 'final' || s.type === 'final' || s.section_type === 'outcome' || s.type === 'outcome');
  const marketingSection = (pattern) => sections.find(s => pattern.test(String(s.title || '')));
  if (assetType === 'marketing_sitemap' || assetType === 'marketing_paper_wireframe' || assetType === 'marketing_digital_wireframe') return marketingSection(/sitemap|wireframe/i);
  if (assetType === 'marketing_desktop_before' || assetType === 'marketing_desktop_after' || assetType === 'marketing_mobile_before' || assetType === 'marketing_mobile_after') return marketingSection(/design\s+validation|heuristic/i);
  if (assetType === 'marketing_desktop_final' || assetType === 'marketing_tablet_final' || assetType === 'marketing_mobile_final') return marketingSection(/high-fidelity|accessibility/i);
  if (assetType === 'marketing_hifi_desktop' || assetType === 'marketing_hifi_mobile') return marketingSection(/high-fidelity/i);
  return null;
}

function flatten(project) {
  const content = normalizeContent(project.content);
  const images = [];
  content.sections.forEach(section => {
    section.images.forEach((image, index) => images.push({
      ...image,
      id: image.id || `${section.id}-image-${index + 1}`,
      project_id: project.id,
      section_id: section.id,
      section_title: section.title || '',
      display_order: Number(image.display_order ?? index),
    }));
  });
  return images;
}

async function signedUpload(path) {
  const response = await fetch(`${base()}/storage/v1/object/upload/sign/${path}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ upsert: true }),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok || !data?.url || !data?.token) throw new Error(data?.message || 'Could not create a Supabase upload URL.');
  const raw = String(data.url);
  const url = new URL(raw.startsWith('/storage/v1/') ? base() + raw : base() + '/storage/v1' + (raw.startsWith('/') ? raw : '/' + raw)).toString();
  return { url, token: String(data.token) };
}

async function saveContent(project, content) {
  const { rows } = await db.query(`UPDATE case_studies SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [JSON.stringify(content), project.id]);
  return rows?.[0] || project;
}

function findImage(content, id) {
  for (const section of content.sections) {
    const index = section.images.findIndex(x => String(x.id) === String(id));
    if (index >= 0) return { section, index, image: section.images[index] };
  }
  return null;
}

export default async function (req, res) {
  try {
    const query = req.query || {};
    const body = req.body || {};
    let projectId = query.project_id || body.project_id;

    if (!projectId && (req.method === 'PATCH' || req.method === 'DELETE') && body.id) {
      const { rows } = await db.query(`SELECT id FROM case_studies WHERE content::text LIKE $1 LIMIT 1`, [`%${String(body.id)}%`]);
      projectId = rows?.[0]?.id || '';
    }
    if (!projectId) return res.status(400).json({ error: 'Missing project_id.' });

    const project = await getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Case study not found.' });
    const content = normalizeContent(project.content);

    if (req.method === 'GET') {
      if (query.preview_image_id) {
        const item = findImage(content, query.preview_image_id)?.image;
        if (!item?.image_url) return res.status(404).send('Media preview not found.');
        const file = await fetch(item.image_url);
        if (!file.ok) return res.status(404).send('Media preview not found.');
        res.setHeader('Content-Type', file.headers.get('content-type') || 'application/octet-stream');
        return res.send(Buffer.from(await file.arrayBuffer()));
      }
      if (query.preview_fixed) {
        const url = query.preview_fixed === 'cover' ? project.cover_image_url : query.preview_fixed === 'hero' ? project.hero_image_url : '';
        if (!url) return res.status(404).send('Media preview not found.');
        const file = await fetch(url);
        if (!file.ok) return res.status(404).send('Media preview not found.');
        res.setHeader('Content-Type', file.headers.get('content-type') || 'application/octet-stream');
        return res.send(Buffer.from(await file.arrayBuffer()));
      }
      return res.json({ project, images: flatten(project), sections: content.sections.map((s, i) => ({ id: s.id, title: s.title || '', section_type: s.section_type || s.type || 'content', display_order: Number(s.display_order || i + 1) })) });
    }

    if (req.method === 'POST') {
      if (body.action === 'prepare_upload') {
        if (!body.filename) return res.status(400).json({ error: 'Choose a file.' });
        const contentType = String(body.content_type || 'application/octet-stream').toLowerCase();
        const supported = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm', 'video/quicktime']);
        if (!supported.has(contentType)) return res.status(400).json({ error: 'Unsupported media type.' });
        if (body.replace_image_id && !findImage(content, body.replace_image_id)) return res.status(404).json({ error: 'Media item not found in this case study.' });
        const path = `portfolio/${project.slug}/${Date.now()}-${safeName(body.filename)}`;
        const signed = await signedUpload(`portfolio-images/${path}`);
        const storageHost = base().replace(/\.supabase\.co$/i, '.storage.supabase.co');
        return res.json({ signedUrl: signed.url, uploadToken: signed.token, resumableEndpoint: `${storageHost}/storage/v1/upload/resumable`, objectPath: path, bucketName: BUCKET, publicUrl: `${base()}/storage/v1/object/public/${BUCKET}/${path}`, contentType, projectId, replaceFixed: body.replace_fixed || null, replaceImageId: body.replace_image_id || null });
      }

      if (body.action === 'finalize_upload') {
        const publicPrefix = `${base()}/storage/v1/object/public/${BUCKET}/`;
        if (!body.url || !String(body.url).startsWith(publicPrefix)) return res.status(400).json({ error: 'Invalid Supabase Storage URL.' });

        if (body.replace_fixed) {
          if (!['cover', 'hero'].includes(body.replace_fixed)) return res.status(400).json({ error: 'Invalid fixed replacement target.' });
          const saved = await db.query(`UPDATE case_studies SET ${body.replace_fixed === 'cover' ? 'cover_image_url' : 'hero_image_url'} = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [body.url, project.id]);
          return res.json({ kind: body.replace_fixed, url: body.url, project: saved.rows?.[0] || project });
        }

        if (body.replace_image_id) {
          const found = findImage(content, body.replace_image_id);
          if (!found) return res.status(404).json({ error: 'Media item not found.' });
          found.section.images[found.index] = { ...found.image, image_url: body.url };
          await saveContent(project, content);
          return res.json({ kind: 'gallery', url: body.url, image: { ...found.section.images[found.index], id: body.replace_image_id, project_id: project.id, section_id: found.section.id } });
        }

        if (!allowed.has(body.asset_type)) return res.status(400).json({ error: 'Invalid asset type.' });
        const section = body.section_id ? content.sections.find(s => String(s.id) === String(body.section_id)) : sectionForAsset(content.sections, body.asset_type);
        if (!section) return res.status(400).json({ error: `No matching case-study section exists for ${body.asset_type}.` });
        const image = { id: uuid(), image_url: body.url, image_type: body.asset_type, alt_text: String(body.alt_text || ''), caption: String(body.caption || ''), display_order: Math.max(0, Number(body.display_order || section.images.length)), project_id: project.id, section_id: section.id };
        section.images = [...section.images, image];
        await saveContent(project, content);
        return res.status(201).json({ kind: 'gallery', url: body.url, image });
      }
      return res.status(400).json({ error: 'Unknown media action.' });
    }

    if (req.method === 'PATCH') {
      if (!body.id) return res.status(400).json({ error: 'Missing image id.' });
      const found = findImage(content, body.id);
      if (!found) return res.status(404).json({ error: 'Media item not found.' });
      const image = { ...found.image };
      if (body.display_order !== undefined) image.display_order = Math.max(0, Number(body.display_order) || 0);
      if (body.alt_text !== undefined) image.alt_text = String(body.alt_text);
      if (body.caption !== undefined) image.caption = String(body.caption);
      found.section.images[found.index] = image;
      await saveContent(project, content);
      return res.json({ ...image, id: body.id, project_id: project.id, section_id: found.section.id });
    }

    if (req.method === 'DELETE') {
      if (body.fixed) {
        if (!['cover', 'hero'].includes(body.fixed)) return res.status(400).json({ error: 'Invalid fixed image.' });
        const saved = await db.query(`UPDATE case_studies SET ${body.fixed === 'cover' ? 'cover_image_url' : 'hero_image_url'} = '', updated_at = NOW() WHERE id = $1 RETURNING *`, [project.id]);
        return res.json({ ok: true, project: saved.rows?.[0] || project });
      }
      if (!body.id) return res.status(400).json({ error: 'Missing image id.' });
      const found = findImage(content, body.id);
      if (!found) return res.status(404).json({ error: 'Media item not found.' });
      found.section.images.splice(found.index, 1);
      await saveContent(project, content);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('admin-media error', error.message);
    return res.status(500).json({ error: error.message || 'Media operation failed.' });
  }
}