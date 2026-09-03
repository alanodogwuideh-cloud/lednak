import { supabaseAdmin, deleteStorageObject, storagePathFromPublicUrl } from 'lib/supabase-admin';
import { db } from 'hatchable';
import { requireSupabaseAdmin } from 'lib/admin-auth';

// Owner-only CMS endpoint authenticated by the portfolio's Supabase admin account.
export const access = 'public';
export const methods = ['GET', 'POST', 'PATCH', 'DELETE'];

const BUCKET = 'portfolio-images';
const base = () => String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = () => ({ apikey: serviceKey(), Authorization: `Bearer ${serviceKey()}` });
const safeName = n => String(n || 'image').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160);
const uuid = () => crypto.randomUUID();

const allowed = new Set(['project_cover','case_study_hero','project_overview','the_challenge','the_goal','my_role','project_context','research_overview','research_methods','research_findings','key_insights','user_personas','user_needs','problem_statement','ideation','information_architecture','user_flow','wireframing','low_fidelity_prototype','high_fidelity_prototype','heuristic_review','usability_testing','design_decisions','design_iteration','design_refinement','visual_design','design_system','accessibility','responsive_design','final_solution','outcome','learnings','next_steps','sitemap','paper_wireframe','digital_wireframe','design_exploration','desktop_before_heuristic','desktop_after_heuristic','mobile_before_heuristic','mobile_after_heuristic','final_desktop_screens','final_tablet_screens','final_mobile_screens','hifi_desktop_onboarding','hifi_mobile_onboarding','research','storyboard','wireframes_legacy','mobile_final_ui','web_final_ui','cover','hero','chinedu_persona','fatima_persona','low_fi_wireframe','wireframes','marketing_sitemap','marketing_paper_wireframe','marketing_digital_wireframe','marketing_desktop_before','marketing_desktop_after','marketing_mobile_before','marketing_mobile_after','marketing_desktop_final','marketing_tablet_final','marketing_mobile_final','marketing_hifi_desktop','marketing_hifi_mobile']);

function normalizeContent(content) {
  const base = content && typeof content === 'object' && !Array.isArray(content) ? content : {};
  const rawSections = Array.isArray(base.sections) ? base.sections : [];
  const usedIds = new Set();
  const sections = rawSections.map((s, i) => {
    let id = String(s?.id || s?._id || `section-${i + 1}`).trim();
    if (!id || usedIds.has(id)) id = crypto.randomUUID();
    usedIds.add(id);
    const images = Array.isArray(s?.images) ? s.images.map(image => ({ ...image, section_id: id })) : [];
    return { ...s, id, _id: id, images };
  });
  return { ...base, sections };
}

async function getProject(id) {
  const { rows } = await db.query(`SELECT * FROM case_studies WHERE id = $1 LIMIT 1`, [id]);
  return rows?.[0] || null;
}

function sectionForAsset(sections, assetType) {
  const normalized=String(assetType||'').toLowerCase();
  const byAsset=sections.find(s=>String(s.asset_type||s.metadata?.asset_type||'').toLowerCase()===normalized); if(byAsset)return byAsset;
  const title=(re)=>sections.find(s=>re.test(String(s.title||'')));
  const rules={project_overview:/project\s*snapshot|project\s*overview/i,the_challenge:/challenge/i,the_goal:/goal/i,my_role:/my\s*role/i,project_context:/project\s*context|understanding\s*the\s*product/i,research_overview:/research/i,research_methods:/research\s*method/i,research_findings:/key\s*research\s*findings|research\s*findings/i,key_insights:/key\s*insights/i,user_personas:/who\s*i\s*designed\s*for|persona/i,information_architecture:/information\s*architecture|sitemap/i,user_flow:/user\s*flow/i,wireframing:/wireframing|wireframe/i,usability_testing:/usability\s*testing/i,heuristic_review:/heuristic/i,design_decisions:/key\s*product\s*decisions|design\s*decisions/i,final_solution:/final\s*experience|final\s*solution|high-fidelity/i,outcome:/impact|outcome|takeaways/i,learnings:/what\s*i\s*learned|learnings/i,next_steps:/next\s*steps/i};
  if(rules[normalized])return title(rules[normalized]);
  const legacy={research:'research',chinedu_persona:'personas',fatima_persona:'personas',storyboard:'process',paper_wireframe:'process',low_fi_wireframe:'process',wireframes:'process',usability_testing:'usability',mobile_final_ui:'final',web_final_ui:'final',marketing_sitemap:'sitemap|wireframe',marketing_paper_wireframe:'sitemap|wireframe',marketing_digital_wireframe:'sitemap|wireframe',marketing_desktop_before:'design\\s+validation|heuristic',marketing_desktop_after:'design\\s+validation|heuristic',marketing_mobile_before:'design\\s+validation|heuristic',marketing_mobile_after:'design\\s+validation|heuristic',marketing_desktop_final:'high-fidelity|accessibility',marketing_tablet_final:'high-fidelity|accessibility',marketing_mobile_final:'high-fidelity|accessibility',marketing_hifi_desktop:'high-fidelity',marketing_hifi_mobile:'high-fidelity'};
  if(legacy[assetType]){const pattern=legacy[assetType];return sections.find(s=>new RegExp(pattern,'i').test(String(s.title||'')))||sections.find(s=>String(s.section_type||s.type||'').toLowerCase()===pattern.toLowerCase());}
  return null;
}

function flatten(project) {
  const content = normalizeContent(project.content);
  const images = [];
  content.sections.forEach((section, sectionIndex) => {
    section.images.forEach((image, index) => images.push({
      ...image,
      asset_type: image.asset_type || image.image_type || '',
      id: image.id || `${section.id}-image-${index + 1}`,
      project_id: project.id,
      section_id: section.id,
      section_index: sectionIndex,
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
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
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
      return res.json({ project, images: flatten(project), sections: content.sections.map((s, i) => ({ id: s.id, index: i, title: s.title || '', asset_type: s.asset_type || s.metadata?.asset_type || '', section_type: s.section_type || s.type || 'content', presentation_style: s.presentation_style || s.metadata?.presentation_style || s.metadata?.card_variant || '', display_order: Number(s.display_order || i + 1) })) });
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

        // Cover and hero are fixed case-study assets, not section media. The
        // Media tab exposes them as normal upload choices, so a fresh upload
        // must update the corresponding case_studies column directly instead
        // of trying to find a section for it. Replacement uploads already use
        // replace_fixed; this also makes first-time cover/hero uploads work.
        if (body.asset_type === 'cover' || body.asset_type === 'hero' || body.asset_type === 'project_cover' || body.asset_type === 'case_study_hero') {
          const column = body.asset_type === 'cover' || body.asset_type === 'project_cover' ? 'cover_image_url' : 'hero_image_url';
          const saved = await db.query(`UPDATE case_studies SET ${column} = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [body.url, project.id]);
          return res.status(201).json({ kind: body.asset_type, url: body.url, project: saved.rows?.[0] || project });
        }

        const section = body.section_id ? content.sections.find(s => String(s.id) === String(body.section_id)) : sectionForAsset(content.sections, body.asset_type);
        if (!section) return res.status(400).json({ error: `No matching case-study section exists for ${body.asset_type}.` });
        const image = { id: uuid(), image_url: body.url, image_type: body.asset_type, asset_type: body.asset_type, alt_text: String(body.alt_text || ''), caption: String(body.caption || ''), display_order: Math.max(0, Number(body.display_order || section.images.length)), project_id: project.id, section_id: section.id };
        section.images = [...section.images, image];
        const sectionMeta = section.metadata && typeof section.metadata === 'object' && !Array.isArray(section.metadata) ? section.metadata : (section.metadata = {});
        if (Array.isArray(sectionMeta.image_subsections) && sectionMeta.image_subsections.length) {
          const first = sectionMeta.image_subsections[0];
          first.image_ids = Array.isArray(first.image_ids) ? [...first.image_ids, String(image.id)] : [String(image.id)];
        }
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
      if (body.display_order !== undefined) {
        const requested = Math.max(0, Number(body.display_order) || 0);
        const siblings = [...found.section.images].sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0));
        const currentIndex = siblings.findIndex(item => String(item.id) === String(body.id));
        if (currentIndex >= 0) {
          const targetIndex = Math.min(requested, siblings.length - 1);
          siblings.splice(currentIndex, 1);
          siblings.splice(targetIndex, 0, image);
          siblings.forEach((item, index) => { item.display_order = index; });
          found.section.images = siblings;
          await saveContent(project, content);
          return res.json({ ...image, id: body.id, project_id: project.id, section_id: found.section.id, display_order: targetIndex });
        }
        image.display_order = requested;
      }
      if (body.alt_text !== undefined) image.alt_text = String(body.alt_text);
      if (body.caption !== undefined) image.caption = String(body.caption);
      const requestedSectionId = body.section_id !== undefined ? String(body.section_id || '') : '';
      const requestedSectionIndex = body.section_index !== undefined ? String(body.section_index || '') : '';
      if (requestedSectionId || requestedSectionIndex) {
        const target = requestedSectionId
          ? content.sections.find(section => String(section.id) === requestedSectionId)
          : content.sections[Number(requestedSectionIndex)];
        if (!target) return res.status(400).json({ error: 'Selected case-study section not found.' });
        const targetIndex = content.sections.indexOf(target);
        if (target === found.section) {
          image.section_id = target.id;
          found.section.images[found.index] = image;
          await saveContent(project, content);
          return res.json({ ...image, id: body.id, project_id: project.id, section_id: found.section.id, section_index: targetIndex });
        }
        found.section.images.splice(found.index, 1);
        image.section_id = target.id;
        image.project_id = project.id;
        image.display_order = Math.max(0, target.images.length);
        target.images.push(image);
        await saveContent(project, content);
        return res.json({ ...image, id: body.id, project_id: project.id, section_id: target.id, section_index: targetIndex });
      }
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
      const deletedUrl = String(found.image?.image_url || '');
      found.section.images.splice(found.index, 1);
      await saveContent(project, content);

      // Media Library deletion is the only CMS action that permanently removes
      // an uploaded object. Do not remove the storage object when it is still
      // referenced by another case study or by another fixed asset.
      if (deletedUrl) {
        const marker = `/storage/v1/object/public/${BUCKET}/`;
        const { rows: otherRefs } = await db.query(
          `SELECT id FROM case_studies WHERE id <> $1 AND (cover_image_url = $2 OR hero_image_url = $2 OR content::text LIKE $3) LIMIT 1`,
          [project.id, deletedUrl, `%${deletedUrl}%`]
        );
        if (!otherRefs?.length) {
          const storagePath = storagePathFromPublicUrl(deletedUrl, BUCKET);
          if (storagePath) await deleteStorageObject(BUCKET, storagePath);
        }
      }
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('admin-media error', error.message);
    return res.status(500).json({ error: error.message || 'Media operation failed.' });
  }
}