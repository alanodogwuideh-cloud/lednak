/**
 * Cloudflare-only API implementation.
 *
 * Keep this file independent from Hatchable's api/ and lib/ runtime. All
 * credentials are supplied through Cloudflare Pages environment variables.
 */
import { signR2Put, verifyR2Object, uploadR2Object, deleteR2Object, r2KeyFromPublicUrl } from './r2.js';

const PUBLIC_R2_BASE = 'https://pub-05b8c3177ce444d385936988156c52c2.r2.dev';

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
});
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const normalizeR2Url = value => {
  const raw = String(value || '');
  if (!raw) return '';
  if (raw.startsWith(PUBLIC_R2_BASE + '/')) return raw;
  if (raw.startsWith('portfolio/')) return PUBLIC_R2_BASE + '/' + raw.split('/').map(encodeURIComponent).join('/');
  return raw;
};
const r2PublicUrl = key => PUBLIC_R2_BASE + '/' + String(key || '').replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');

function decodeCell(cell) {
  if (cell == null || typeof cell !== 'object' || !('type' in cell)) return cell ?? null;
  if (cell.type === 'null') return null;
  if (cell.type === 'integer' || cell.type === 'float') return Number(cell.value);
  return cell.value ?? null;
}
function resultRows(result) {
  const cols = result?.response?.result?.cols || [];
  const rows = result?.response?.result?.rows || [];
  return rows.map(row => {
    const out = {};
    cols.forEach((col, index) => { out[col.name] = decodeCell(row[index]); });
    if (typeof out.content === 'string') {
      try { out.content = JSON.parse(out.content); } catch {}
    }
    return out;
  });
}
async function tursoQuery(env, sql, params = []) {
  const url = String(env.TURSO_DATABASE_URL || '').replace(/\/$/, '').replace(/^libsql:/i, 'https:');
  const token = String(env.TURSO_AUTH_TOKEN || '');
  if (!url || !token) throw new Error('Cloudflare Turso environment variables are not configured.');
  const normalizedSql = String(sql).replace(/::jsonb\b/gi, '').replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP').replace(/\$(\d+)/g, '?');
  const args = params.map(value => {
    if (value === null || value === undefined) return { type: 'null' };
    if (typeof value === 'boolean') return { type: 'integer', value: value ? '1' : '0' };
    if (typeof value === 'number') return Number.isInteger(value) ? { type: 'integer', value: String(value) } : { type: 'float', value: String(value) };
    return { type: 'text', value: String(value) };
  });
  const response = await fetch(url + '/v2/pipeline', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: args.length ? { sql: normalizedSql, args } : { sql: normalizedSql } }, { type: 'close' }] })
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error('Turso returned invalid JSON.'); }
  if (!response.ok) throw new Error(payload?.error || 'Turso request failed.');
  const first = payload?.results?.[0];
  if (first?.type === 'error') throw new Error(first.error?.message || 'Turso query failed.');
  if (!first?.response?.result) throw new Error('Turso returned no query result.');
  return { rows: resultRows(first), changes: Number(first.response.result.affected_row_count || 0) };
}
async function ensureTrashSchema(env) {
  for (const [name, type] of [['deleted_at','TEXT'],['deleted_by','TEXT'],['previous_status','TEXT'],['previous_slug','TEXT']]) {
    await tursoQuery(env, 'ALTER TABLE case_studies ADD COLUMN ' + name + ' ' + type).catch(error => {
      if (!/duplicate column|already exists/i.test(error.message || '')) throw error;
    });
  }
}
async function requireSupabaseAdmin(request, env) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, status: 401, error: 'Please sign in to the admin panel.' };
  const supabaseUrl = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  const adminEmail = String(env.ADMIN_EMAIL || 'alanodogwuideh@gmail.com').toLowerCase();
  if (!supabaseUrl || !serviceKey) return { ok: false, status: 503, error: 'Cloudflare Supabase authentication is not configured.' };
  const response = await fetch(supabaseUrl + '/auth/v1/user', {
    headers: { apikey: serviceKey, authorization: 'Bearer ' + match[1] }
  }).catch(() => null);
  if (!response?.ok) return { ok: false, status: 401, error: 'Your Supabase session is invalid or expired.' };
  const user = await response.json().catch(() => null);
  if (!user?.id || String(user.email || '').toLowerCase() !== adminEmail) {
    return { ok: false, status: 403, error: 'This Supabase account is not authorized to manage the portfolio.' };
  }
  return { ok: true, email: user.email, id: user.id };
}
function normalizeSections(content) {
  const raw = Array.isArray(object(content).sections) ? content.sections : [];
  return raw.map((section, index) => {
    const s = object(section);
    const meta = object(s.metadata);
    const images = (Array.isArray(s.images) ? s.images : []).map((image, imageIndex) => ({
      ...object(image),
      id: image?.id || String(s.id || 'section-' + (index + 1)) + '-image-' + (imageIndex + 1),
      image_url: normalizeR2Url(image?.image_url || ''),
      display_order: Number(image?.display_order ?? imageIndex)
    }));
    return {
      ...s,
      id: s.id || s._id || 'section-' + (index + 1),
      _id: s._id || s.id || 'section-' + (index + 1),
      type: s.type || s.section_type || 'content',
      section_type: s.section_type || s.type || 'content',
      title: s.title || '',
      subtitle: s.subtitle || s.sub_title || meta.subtitle || '',
      body: s.body || s.text || '',
      text: s.text || s.body || '',
      metadata: meta,
      images,
      display_order: Number(s.display_order || index + 1)
    };
  });
}
async function ensureResumeSchema(env) {
  for (const [name, type] of [['resume_key','TEXT'],['resume_display_name','TEXT']]) {
    await tursoQuery(env, 'ALTER TABLE site_branding ADD COLUMN ' + name + ' ' + type).catch(error => {
      if (!/duplicate column|already exists/i.test(error.message || '')) throw error;
    });
  }
}

async function portfolio(request, env) {
  await ensureTrashSchema(env);
  await ensureResumeSchema(env);
  const [settingsResult, projectsResult, brandingResult] = await Promise.all([
    tursoQuery(env, 'SELECT * FROM portfolio_settings LIMIT 1'),
    tursoQuery(env, "SELECT id,title,slug,subtitle,description,role,year,duration,category,content,cover_image_url,hero_image_url,status,sort_order,updated_at FROM case_studies WHERE status = $1 AND (deleted_at IS NULL OR deleted_at = '') ORDER BY sort_order ASC, created_at ASC", ['published']),
    tursoQuery(env, 'SELECT favicon_key,updated_at,resume_key,resume_display_name FROM site_branding LIMIT 1')
  ]);
  const settings = settingsResult.rows[0] || {};
  const branding = brandingResult.rows[0] || {};
  const faviconKey = String(branding.favicon_key || '');
  return json({
    settings: {
      site_name: settings.site_name || 'Alan Odogwuideh',
      role: settings.role || 'UX Designer',
      intro: settings.intro || '',
      about_text: settings.about_text || '',
      location: settings.location || 'Abuja, Nigeria',
      linkedin_url: settings.linkedin_url || '',
      email: settings.email || '',
      about_image_url: (() => { const imageUrl = String(settings.about_image_url || ''); const fallback = 'https://pub-05b8c3177ce444d385936988156c52c2.r2.dev/site/profile/1789656022670-0fbb5a1e-5d51-4d39-a286-0e226949f2ee-Alan.png'; return !imageUrl || imageUrl.toLowerCase().split(/[?#]/)[0].endsWith('.pdf') ? fallback : imageUrl; })(),
      resume_url: branding.resume_key ? (String(branding.resume_key).startsWith('http') ? branding.resume_key : r2PublicUrl(branding.resume_key)) : '',
      resume_display_name: branding.resume_display_name || 'My Resume',
      favicon_url: faviconKey ? (faviconKey.startsWith('http') ? faviconKey : (faviconKey.startsWith('site/') ? r2PublicUrl(faviconKey) : '')) : '',
      favicon_updated_at: branding.updated_at || ''
    },
    projects: projectsResult.rows.map(project => {
      // The homepage filters need the saved category from case_meta. Without
      // this field, the frontend defaults every Cloudflare-served project to 'all'.
      const content = object(project.content);
      const meta = object(content.case_meta);
      const savedDisplayCategory = String(meta.display_category || '').toLowerCase();
      const display_category = ['mobile', 'web', 'both'].includes(savedDisplayCategory)
        ? savedDisplayCategory
        : 'all';
      return {
        ...project,
        display_category,
        cover_image_url: normalizeR2Url(project.cover_image_url || ''),
        hero_image_url: normalizeR2Url(project.hero_image_url || ''),
        short_description: project.subtitle || project.description || '',
        status: project.status || 'draft',
        sort_order: Number(project.sort_order || 0)
      };
    })
  });
}
async function caseStudy(request, env) {
  await ensureTrashSchema(env);
  const url = new URL(request.url);
  const slug = String(url.searchParams.get('slug') || '').trim();
  if (!slug) return json({ error: 'Missing case study slug.' }, 400);
  const { rows } = await tursoQuery(env, "SELECT * FROM case_studies WHERE slug = $1 AND status = 'published' AND (deleted_at IS NULL OR deleted_at = '') LIMIT 1", [slug]);
  const project = rows[0];
  if (!project) return json({ error: 'Case study not found.' }, 404);
  const content = object(project.content);
  const sections = normalizeSections(content);
  const images = sections.flatMap((section, sectionIndex) => section.images.map((image, imageIndex) => ({
    ...image,
    project_id: project.id,
    section_id: section.id,
    section_title: section.title || '',
    display_order: Number(image.display_order ?? imageIndex),
    section_index: sectionIndex
  })));
  return json({
    ...project,
    cover_image_url: normalizeR2Url(project.cover_image_url || ''),
    hero_image_url: normalizeR2Url(project.hero_image_url || ''),
    content: { ...content, sections },
    sections,
    images
  });
}
async function adminProjects(request, env, auth) {
  const method = request.method.toUpperCase();
  for (const [name, type] of [['deleted_at','TEXT'],['deleted_by','TEXT'],['previous_status','TEXT'],['previous_slug','TEXT']]) {
    await tursoQuery(env, 'ALTER TABLE case_studies ADD COLUMN ' + name + ' ' + type).catch(error => {
      if (!/duplicate column|already exists/i.test(error.message || '')) throw error;
    });
  }
  const mapProject = project => {
    const content = object(project.content);
    const meta = object(content.case_meta);
    return { ...project, cover_image_url: normalizeR2Url(project.cover_image_url || ''), hero_image_url: normalizeR2Url(project.hero_image_url || ''), client: project.client ?? content.client ?? '', short_description: project.subtitle || '', overview: project.description || '', platform: meta.platform ?? 'Mobile + Web', project_type: meta.project_type ?? 'End-to-end', role_label: meta.role_label ?? 'Role', duration_label: meta.duration_label ?? 'Duration', platform_label: meta.platform_label ?? 'Platform', project_type_label: meta.project_type_label ?? 'Project type', status: project.status || 'draft', sort_order: Number(project.sort_order || 0) };
  };
  const slugify = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-+$/g, '').slice(0, 90);
  const reserved = new Set(['admin','api','about','work','contact','login','logout','media','trash','case-study','case-studies','assets','favicon']);
  const uniqueSlug = async (raw, id = '', auto = false) => {
    let slug = slugify(raw);
    if (!slug) throw new Error('Enter a valid title and slug before saving.');
    if (reserved.has(slug)) { if (!auto) throw new Error('This slug is reserved for a portfolio route.'); slug = (slug + '-project').slice(0, 90); }
    const base = slug;
    for (let n = 2; n < 100; n++) {
      const { rows } = await tursoQuery(env, 'SELECT id FROM case_studies WHERE slug=$1 AND id<>$2 LIMIT 1', [slug, id || '']);
      if (!rows.length) return slug;
      if (!auto) throw new Error('This slug is already in use. Customize it to make it unique.');
      const suffix = '-' + n; slug = base.slice(0, 90 - suffix.length) + suffix;
    }
    throw new Error('Could not generate a unique slug.');
  };
  if (method === 'GET') {
    const { rows } = await tursoQuery(env, 'SELECT * FROM case_studies WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC');
    return json(rows.map(mapProject));
  }
  const body = await request.json().catch(() => ({}));
  if (method === 'PUT' && body.action === 'reorder') {
    const orderedIds = Array.isArray(body.ordered_ids) ? body.ordered_ids.map(String) : [];
    if (!orderedIds.length) return json({ error: 'Provide at least one case study to reorder.' }, 400);
    const { rows: currentRows } = await tursoQuery(env, 'SELECT id FROM case_studies WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC');
    const currentIds = currentRows.map(row => String(row.id));
    if (orderedIds.length !== currentIds.length || new Set(orderedIds).size !== currentIds.length || orderedIds.some(id => !currentIds.includes(id))) return json({ error: 'The case study list changed. Refresh the CMS and try reordering again.' }, 409);
    for (let index = 0; index < orderedIds.length; index++) await tursoQuery(env, 'UPDATE case_studies SET sort_order=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND deleted_at IS NULL', [index, orderedIds[index]]);
    const { rows } = await tursoQuery(env, 'SELECT * FROM case_studies WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC');
    return json({ ok: true, projects: rows.map(mapProject) });
  }
  if (method === 'POST') {
    body.title = String(body.title || '').trim() || 'Untitled Case Study';
    body.slug = await uniqueSlug(body.slug || body.title, '', true);
    const content = { sections: [], client: body.client || '', case_meta: { role_label: body.role_label || 'Role', duration_label: body.duration_label || 'Duration', platform_label: body.platform_label || 'Platform', project_type_label: body.project_type_label || 'Project type', platform: body.platform || 'Mobile + Web', project_type: body.project_type || 'End-to-end' } };
    const id = crypto.randomUUID();
    const { rows } = await tursoQuery(env, 'INSERT INTO case_studies (id,title,slug,subtitle,description,role,year,duration,category,status,sort_order,content,cover_image_url,hero_image_url,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *', [id, body.title, body.slug, body.short_description || body.subtitle || '', body.overview || body.description || '', body.role || '', body.year || '', body.duration || '', body.category || '', body.status || 'draft', Number(body.sort_order || 0), JSON.stringify(content), body.cover_image_url || '', body.hero_image_url || '']);
    return json(mapProject(rows[0]), 201);
  }
  if (method === 'PUT') {
    if (!body.id) return json({ error: 'Missing case study id.' }, 400);
    const { rows: found } = await tursoQuery(env, 'SELECT * FROM case_studies WHERE id=$1 LIMIT 1', [body.id]);
    const current = found[0];
    if (!current) return json({ error: 'Case study not found.' }, 404);
    const fields = { title: body.title, slug: body.slug, subtitle: body.short_description ?? body.subtitle, description: body.overview ?? body.description, role: body.role, year: body.year, duration: body.duration, category: body.category, status: body.status, sort_order: body.sort_order === undefined ? undefined : Number(body.sort_order || 0) };
    const updates = []; const values = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      values.push(key === 'slug' ? await uniqueSlug(value, String(body.id), false) : value);
      updates.push(key + '=$' + values.length);
    }
    if (!updates.length) return json(mapProject(current));
    values.push(body.id);
    const { rows } = await tursoQuery(env, 'UPDATE case_studies SET ' + updates.join(',') + ',updated_at=CURRENT_TIMESTAMP WHERE id=$' + values.length + ' RETURNING *', values);
    return json(mapProject(rows[0] || current));
  }
  if (method === 'DELETE') {
    const id = String(body.id || new URL(request.url).searchParams.get('id') || '');
    if (!id) return json({ error: 'Missing case study id.' }, 400);
    const { rows } = await tursoQuery(env, "UPDATE case_studies SET deleted_at=CURRENT_TIMESTAMP,deleted_by=$1,previous_status=status,previous_slug=slug,status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND deleted_at IS NULL RETURNING *", [auth.email || 'admin', id]);
    if (!rows.length) return json({ error: 'Case study not found or already in Trash.' }, 404);
    return json({ ok: true, operation: 'move_to_trash', id, project: rows[0] });
  }
  return json({ error: 'Method not allowed.' }, 405);
}

async function adminCaseStudy(request, env, auth) {
  const url = new URL(request.url);
  const body = ['GET','HEAD'].includes(request.method) ? {} : await request.json().catch(() => ({}));
  const projectId = url.searchParams.get('project_id') || body.project_id || body.id;
  if (!projectId) return json({ error: 'Missing project_id.' }, 400);
  const { rows } = await tursoQuery(env, 'SELECT * FROM case_studies WHERE id=$1 LIMIT 1', [projectId]);
  const project = rows[0];
  if (!project) return json({ error: 'Case study not found.' }, 404);
  const content = object(project.content);
  const sections = normalizeSections(content);
  const response = saved => {
    const nextContent = object(saved.content);
    const nextSections = normalizeSections(nextContent);
    const images = nextSections.flatMap((section, sectionIndex) => section.images.map((image, imageIndex) => ({
      ...image, project_id: saved.id, section_id: section.id, section_title: section.title || '',
      display_order: Number(image.display_order ?? imageIndex), section_index: sectionIndex
    })));
    return { ...saved, cover_image_url: normalizeR2Url(saved.cover_image_url || ''), hero_image_url: normalizeR2Url(saved.hero_image_url || ''), content: { ...nextContent, sections: nextSections }, sections: nextSections, images };
  };
  const save = async incoming => {
    if (!Array.isArray(incoming) || !incoming.length) return json({ error: 'Refusing to save an empty case study. Existing content was preserved.' }, 409);
    const used = new Set();
    const clean = incoming.map((section, index) => {
      const s = object(section);
      let id = String(s.id || s._id || 'section-' + (index + 1));
      if (used.has(id)) id = crypto.randomUUID();
      used.add(id);
      return { ...s, id, _id: id, display_order: index + 1, metadata: object(s.metadata), images: Array.isArray(s.images) ? s.images : [] };
    });
    const nextContent = { ...content, sections: clean };
    if (body.case_meta && typeof body.case_meta === 'object') nextContent.case_meta = { ...object(content.case_meta), ...body.case_meta };
    const result = await tursoQuery(env, 'UPDATE case_studies SET content=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *', [JSON.stringify(nextContent), project.id]);
    return json(response(result.rows[0] || { ...project, content: nextContent }));
  };
  if (request.method === 'GET') return json(response({ ...project, content: { ...content, sections } }));
  if (request.method === 'PUT' && body.replace_all === true) return await save(body.sections);
  if (request.method === 'POST') {
    const next = [...sections, { id: crypto.randomUUID(), type: body.type || body.section_type || 'content', section_type: body.section_type || body.type || 'content', title: body.title || '', subtitle: body.subtitle || body.sub_title || '', body: body.body || body.text || '', text: body.text || body.body || '', metadata: object(body.metadata), images: Array.isArray(body.images) ? body.images : [] }];
    return await save(next);
  }
  if (request.method === 'PUT') {
    if (!body.id) return json({ error: 'Missing section id.' }, 400);
    const index = sections.findIndex(section => String(section.id || section._id) === String(body.id));
    if (index < 0) return json({ error: 'Section not found.' }, 404);
    const next = sections.map((section, i) => i === index ? { ...section, ...body, metadata: body.metadata === undefined ? section.metadata : object(body.metadata) } : section);
    return await save(next);
  }
  if (request.method === 'DELETE') {
    if (!body.id) return json({ error: 'Missing section id.' }, 400);
    const next = sections.filter(section => String(section.id || section._id) !== String(body.id));
    if (next.length === sections.length) return json({ error: 'Section not found.' }, 404);
    if (!next.length) return json({ error: 'A case study must retain at least one section.' }, 409);
    return await save(next);
  }
  return json({ error: 'Method not allowed.' }, 405);
}

async function adminSettings(request, env) {
  await ensureResumeSchema(env);
  if (request.method === 'POST') {
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'No file uploaded.' }, 400);
    const kind = String(form.get('kind') || 'about');
    if (kind === 'resume') {
      if (file.type !== 'application/pdf' && !String(file.name || '').toLowerCase().endsWith('.pdf')) return json({ error: 'Please choose a PDF resume.' }, 415);
      if (file.size > 15 * 1024 * 1024) return json({ error: 'PDF is too large. Maximum size is 15 MB.' }, 413);
      const displayName = String(form.get('display_name') || '').trim().slice(0, 100) || (String(file.name || 'My Resume').toLowerCase().endsWith('.pdf') ? String(file.name || 'My Resume').slice(0, -4) : String(file.name || 'My Resume')).trim() || 'My Resume';
      const safeDisplayName = displayName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 100);
      const key = 'site/resume/' + safeDisplayName + '-' + Date.now() + '-' + crypto.randomUUID().slice(0, 8) + '.pdf';
      const mediaUrl = await uploadR2Object(env, key, await file.arrayBuffer(), 'application/pdf');
      const { rows } = await tursoQuery(env, 'SELECT id,resume_key FROM site_branding LIMIT 1');
      const oldKey = String(rows[0]?.resume_key || '');
      if (rows[0]) await tursoQuery(env, 'UPDATE site_branding SET resume_key=$1,resume_display_name=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$3', [key, displayName, rows[0].id]);
      else await tursoQuery(env, 'INSERT INTO site_branding (id,favicon_key,resume_key,resume_display_name,updated_at) VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP)', ['1','',key,displayName]);
      if (oldKey && !oldKey.startsWith('http')) await deleteR2Object(env, oldKey).catch(() => {});
      return json({ url: mediaUrl, key, saved: true });
    }
    if (!String(file.type || '').startsWith('image/')) return json({ error: 'Please choose an image file.' }, 415);
    if (file.size > 5 * 1024 * 1024) return json({ error: 'Image is too large. Maximum size is 5 MB.' }, 413);
    const safeName = String(file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160);
    const key = (kind === 'favicon' ? 'site/favicon/' : 'site/profile/') + Date.now() + '-' + crypto.randomUUID() + '-' + safeName;
    const mediaUrl = await uploadR2Object(env, key, await file.arrayBuffer(), file.type || 'application/octet-stream');
    if (kind === 'favicon') {
      const { rows } = await tursoQuery(env, 'SELECT id FROM site_branding LIMIT 1');
      if (rows[0]) await tursoQuery(env, 'UPDATE site_branding SET favicon_key=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [key, rows[0].id]);
      else await tursoQuery(env, 'INSERT INTO site_branding (id,favicon_key,updated_at) VALUES ($1,$2,CURRENT_TIMESTAMP)', ['1',key]);
      return json({ ok: true, url: mediaUrl });
    }
    const { rows } = await tursoQuery(env, 'SELECT id FROM portfolio_settings LIMIT 1');
    if (rows[0]) await tursoQuery(env, 'UPDATE portfolio_settings SET about_image_url=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [mediaUrl,rows[0].id]);
    else await tursoQuery(env, 'INSERT INTO portfolio_settings (id,about_image_url) VALUES ($1,$2)', ['1',mediaUrl]);
    return json({ ok: true, url: mediaUrl }, 201);
  }
  if (request.method === 'DELETE') {
    const body = await request.json().catch(() => ({}));
    if (body.kind === 'resume') {
      const { rows } = await tursoQuery(env, 'SELECT id,resume_key FROM site_branding LIMIT 1');
      const oldKey = String(rows[0]?.resume_key || '');
      if (rows[0]) await tursoQuery(env, 'UPDATE site_branding SET resume_key=NULL,resume_display_name=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$1', [rows[0].id]);
      if (oldKey && !oldKey.startsWith('http')) await deleteR2Object(env, oldKey).catch(() => {});
      return json({ ok: true });
    }
    if (body.kind !== 'favicon') return json({ error: 'Unsupported settings delete operation.' }, 400);
    const { rows } = await tursoQuery(env, 'SELECT id FROM site_branding LIMIT 1');
    if (rows[0]) await tursoQuery(env, "UPDATE site_branding SET favicon_key='',updated_at=CURRENT_TIMESTAMP WHERE id=$1", [rows[0].id]);
    return json({ ok: true });
  }
  if (request.method === 'GET') {
    const [{ rows: settingsRows }, { rows: brandingRows }] = await Promise.all([
      tursoQuery(env, 'SELECT * FROM portfolio_settings LIMIT 1'),
      tursoQuery(env, 'SELECT * FROM site_branding LIMIT 1')
    ]);
    const row = settingsRows[0] || {};
    const branding = brandingRows[0] || {};
    const key = String(branding.favicon_key || '');
    return json({
      site_name: row.site_name || '',
      headline: row.intro || '',
      role: row.role || 'UX Designer',
      location: row.location || '',
      email: row.email || '',
      linkedin_url: row.linkedin_url || '',
      profile_image_url: (() => { const imageUrl = String(row.about_image_url || ''); const fallback = 'https://pub-05b8c3177ce444d385936988156c52c2.r2.dev/site/profile/1789656022670-0fbb5a1e-5d51-4d39-a286-0e226949f2ee-Alan.png'; return !imageUrl || imageUrl.toLowerCase().split(/[?#]/)[0].endsWith('.pdf') ? fallback : imageUrl; })(),
      resume_url: branding.resume_key ? (String(branding.resume_key).startsWith('http') ? branding.resume_key : r2PublicUrl(branding.resume_key)) : '',
      resume_key: String(branding.resume_key || ''),
      resume_display_name: branding.resume_display_name || 'My Resume',
      bio: row.about_text || '',
      availability: '',
      favicon_url: key.startsWith('http') ? key : (key.startsWith('site/') ? r2PublicUrl(key) : ''),
      favicon_updated_at: branding.updated_at || ''
    });
  }
  if (request.method !== 'PUT' && request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const values = await request.json().catch(() => ({}));
  const { rows } = await tursoQuery(env, 'SELECT * FROM portfolio_settings LIMIT 1');
  const current = rows[0] || {};
  const data = {
    site_name: String(values.site_name ?? current.site_name ?? ''),
    role: String(values.role ?? current.role ?? 'UX Designer'),
    intro: String(values.headline ?? current.intro ?? ''),
    location: String(values.location ?? current.location ?? ''),
    email: String(values.email ?? current.email ?? ''),
    linkedin_url: String(values.linkedin_url ?? current.linkedin_url ?? ''),
    about_text: String(values.bio ?? current.about_text ?? ''),
    about_image_url: String(values.profile_image_url ?? current.about_image_url ?? '')
  };
  let saved;
  if (current.id) {
    const result = await tursoQuery(env, 'UPDATE portfolio_settings SET site_name=$1,role=$2,intro=$3,location=$4,email=$5,linkedin_url=$6,about_text=$7,about_image_url=$8,updated_at=CURRENT_TIMESTAMP WHERE id=$9 RETURNING *', [data.site_name,data.role,data.intro,data.location,data.email,data.linkedin_url,data.about_text,data.about_image_url,current.id]);
    saved = result.rows[0] || data;
  } else {
    const result = await tursoQuery(env, 'INSERT INTO portfolio_settings (id,site_name,role,intro,location,email,linkedin_url,about_text,about_image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', ['1',data.site_name,data.role,data.intro,data.location,data.email,data.linkedin_url,data.about_text,data.about_image_url]);
    saved = result.rows[0] || data;
  }
  return json({ ok: true, settings: saved });
}

async function adminTrash(request, env, auth) {
  const method = request.method.toUpperCase();
  for (const [name, type] of [['deleted_at','TEXT'],['deleted_by','TEXT'],['previous_status','TEXT'],['previous_slug','TEXT']]) {
    await tursoQuery(env, 'ALTER TABLE case_studies ADD COLUMN ' + name + ' ' + type).catch(error => { if (!/duplicate column|already exists/i.test(error.message || '')) throw error; });
  }
  if (method === 'GET') {
    const { rows } = await tursoQuery(env, 'SELECT * FROM case_studies WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
    return json(rows);
  }
  const body = await request.json().catch(() => ({}));
  const collectKeys = value => {
    const keys = new Set();
    const visit = item => {
      if (typeof item === 'string') { const key = r2KeyFromPublicUrl(item); if (key) keys.add(key); return; }
      if (Array.isArray(item)) return item.forEach(visit);
      if (item && typeof item === 'object') Object.values(item).forEach(visit);
    };
    visit(value); return keys;
  };
  const permanentDelete = async project => {
    const id = String(project.id);
    const keys = collectKeys([project.cover_image_url, project.hero_image_url, project.content]);
    const { rows: otherRows } = await tursoQuery(env, 'SELECT id,content,cover_image_url,hero_image_url FROM case_studies WHERE id<>$1', [id]);
    const referenced = new Set();
    for (const row of otherRows) for (const key of collectKeys([row.cover_image_url,row.hero_image_url,row.content])) referenced.add(key);
    const failures = [];
    for (const key of keys) {
      if (referenced.has(key)) continue;
      try { await deleteR2Object(env, key); } catch (error) { failures.push(key); }
    }
    if (failures.length) return { ok: false, id, error: 'Some exclusively owned media could not be removed. The record remains available for a safe retry.', cleanup_failures: failures.length };
    const { rows: removed } = await tursoQuery(env, 'DELETE FROM case_studies WHERE id=$1 RETURNING id', [id]);
    if (!removed.length) return { ok: false, id, error: 'Database record was not removed.' };
    return { ok: true, id, operation: 'permanent_delete', media_removed: keys.size - [...keys].filter(key => referenced.has(key)).length };
  };
  if (method === 'DELETE' && body.action === 'empty') {
    if (body.confirm !== true) return json({ error: 'Explicit Empty Trash confirmation is required.' }, 400);
    const { rows } = await tursoQuery(env, 'SELECT * FROM case_studies WHERE deleted_at IS NOT NULL ORDER BY deleted_at ASC');
    const results = [];
    for (const project of rows) {
      try { results.push(await permanentDelete(project)); }
      catch (error) { results.push({ ok: false, id: project.id, error: error.message || 'Deletion failed' }); }
    }
    const succeeded = results.filter(item => item.ok);
    const failed = results.filter(item => !item.ok);
    return json({ ok: failed.length === 0, operation: 'empty_trash', requested: rows.length, deleted: succeeded.length, failed: failed.map(item => ({ id: item.id, error: item.error, cleanup_failures: item.cleanup_failures || 0 })), remaining: failed.length }, failed.length ? 207 : 200);
  }
  const id = String(body.id || '');
  if (!id) return json({ error: 'Missing case study id.' }, 400);
  const { rows: found } = await tursoQuery(env, 'SELECT * FROM case_studies WHERE id=$1 LIMIT 1', [id]);
  const project = found[0];
  if (!project) return json({ error: 'Case study not found.' }, 404);
  if (method === 'DELETE') {
    if (body.confirm !== true) return json({ error: 'Explicit permanent-delete confirmation is required.' }, 400);
    if (!project.deleted_at) return json({ error: 'Move the case study to Trash before permanently deleting it.' }, 409);
    const result = await permanentDelete(project);
    return json(result, result.ok ? 200 : 409);
  }
  if (method === 'POST') {
    if (project.deleted_at) return json({ error: 'Case study is already in Trash.' }, 409);
    const { rows } = await tursoQuery(env, "UPDATE case_studies SET deleted_at=CURRENT_TIMESTAMP,deleted_by=$1,previous_status=status,previous_slug=slug,status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND deleted_at IS NULL RETURNING *", [auth.email || 'admin', id]);
    return rows.length ? json({ ok: true, operation: 'move_to_trash', id, project: rows[0] }) : json({ error: 'Case study could not be moved to Trash.' }, 409);
  }
  if (method === 'PUT') {
    if (!project.deleted_at) return json({ error: 'Case study is not in Trash.' }, 409);
    const slug = String(project.previous_slug || project.slug || '');
    const { rows: collisions } = await tursoQuery(env, 'SELECT id FROM case_studies WHERE slug=$1 AND id<>$2 AND deleted_at IS NULL LIMIT 1', [slug,id]);
    if (collisions.length) return json({ error: 'The original slug is now in use. Resolve the conflict before restoring this case study.' }, 409);
    const { rows } = await tursoQuery(env, 'UPDATE case_studies SET slug=$1,status=$2,deleted_at=NULL,deleted_by=NULL,previous_status=NULL,previous_slug=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING *', [slug, project.previous_status || 'draft', id]);
    return json({ ok: true, operation: 'restore', project: rows[0] });
  }
  return json({ error: 'Method not allowed.' }, 405);
}

async function adminMedia(request, env, auth) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  let uploadedFile = null;
  let body = {};
  if (!['GET','HEAD'].includes(method)) {
    const contentType = request.headers.get('content-type') || '';
    if (/^multipart\/form-data\b/i.test(contentType)) {
      const form = await request.formData().catch(() => null);
      uploadedFile = form?.get('file') || null;
      if (form) body = Object.fromEntries([...form.entries()].filter(([key, value]) => key !== 'file' && typeof value === 'string'));
    } else {
      body = await request.json().catch(() => ({}));
    }
  }
  const projectId = url.searchParams.get('project_id') || body.project_id || '';
  if (!projectId) return json({ error: 'Missing project_id.' }, 400);
  const { rows } = await tursoQuery(env, 'SELECT * FROM case_studies WHERE id=$1 LIMIT 1', [projectId]);
  const project = rows[0];
  if (!project) return json({ error: 'Case study not found.' }, 404);
  const content = { ...object(project.content), sections: normalizeSections(project.content) };
  const findImage = id => {
    for (const section of content.sections) {
      const index = section.images.findIndex(image => String(image.id) === String(id));
      if (index >= 0) return { section, index, image: section.images[index] };
    }
    return null;
  };
  const saveContent = async () => {
    const saved = await tursoQuery(env, 'UPDATE case_studies SET content=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *', [JSON.stringify(content), project.id]);
    return saved.rows[0] || { ...project, content };
  };
  if (method === 'GET') {
    if (url.searchParams.has('preview_image_id')) {
      const found = findImage(url.searchParams.get('preview_image_id'));
      if (!found?.image?.image_url) return json({ error: 'Media preview not found.' }, 404);
      return new Response(null, { status: 302, headers: { location: normalizeR2Url(found.image.image_url), 'cache-control': 'private, no-store, max-age=0' } });
    }
    if (url.searchParams.has('preview_fixed')) {
      const target = url.searchParams.get('preview_fixed') === 'cover' ? project.cover_image_url : url.searchParams.get('preview_fixed') === 'hero' ? project.hero_image_url : '';
      if (!target) return json({ error: 'Media preview not found.' }, 404);
      return new Response(null, { status: 302, headers: { location: normalizeR2Url(target), 'cache-control': 'private, no-store, max-age=0' } });
    }
    const images = content.sections.flatMap((section, sectionIndex) => section.images.map((image, index) => ({ ...image, image_url: normalizeR2Url(image.image_url || ''), project_id: project.id, section_id: section.id, section_index: sectionIndex, section_title: section.title || '', display_order: Number(image.display_order ?? index) })));
    return json({ project: { ...project, cover_image_url: normalizeR2Url(project.cover_image_url || ''), hero_image_url: normalizeR2Url(project.hero_image_url || '') }, images, sections: content.sections.map((section, index) => ({ id: section.id, index, title: section.title || '', asset_type: section.asset_type || section.metadata?.asset_type || '', section_type: section.section_type || section.type || 'content', presentation_style: section.presentation_style || section.metadata?.presentation_style || '', display_order: Number(section.display_order || index + 1) })) });
  }
  if (method === 'POST') {
    if (uploadedFile) {
      if (typeof uploadedFile.arrayBuffer !== 'function') return json({ error: 'Choose a file to upload.' }, 400);
      if (uploadedFile.size > 50 * 1024 * 1024) return json({ error: 'File is too large. Maximum upload size is 50 MB.' }, 413);
      const contentType = String(uploadedFile.type || body.content_type || 'application/octet-stream').trim().toLowerCase();
      const supported = new Set(['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','video/mp4','video/webm','video/quicktime']);
      if (!supported.has(contentType)) return json({ error: 'Unsupported media type: ' + contentType }, 415);
      if (body.replace_image_id && !findImage(body.replace_image_id)) return json({ error: 'Media item not found in this case study.' }, 404);
      const safeName = String(uploadedFile.name || body.filename || 'media').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160);
      const key = 'portfolio/' + String(project.slug || project.id) + '/' + Date.now() + '-' + safeName;
      const mediaUrl = await uploadR2Object(env, key, await uploadedFile.arrayBuffer(), contentType);
      const finalizeRequest = new Request(request.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, action: 'finalize_upload', project_id: projectId, url: mediaUrl })
      });
      return await adminMedia(finalizeRequest, env, auth);
    }
    if (body.action === 'prepare_upload') {
      if (!body.filename) return json({ error: 'Choose a file.' }, 400);
      const contentType = String(body.content_type || 'application/octet-stream').toLowerCase();
      const supported = new Set(['image/png','image/jpeg','image/webp','image/gif','image/svg+xml','video/mp4','video/webm','video/quicktime']);
      if (!supported.has(contentType)) return json({ error: 'Unsupported media type.' }, 400);
      if (body.replace_image_id && !findImage(body.replace_image_id)) return json({ error: 'Media item not found in this case study.' }, 404);
      const safeName = String(body.filename).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160);
      const key = 'portfolio/' + String(project.slug || project.id) + '/' + Date.now() + '-' + safeName;
      const signed = await signR2Put(env, key, contentType);
      return json({ signedUrl: signed.url, objectPath: key, publicUrl: r2PublicUrl(key), contentType, projectId, replaceFixed: body.replace_fixed || null, replaceImageId: body.replace_image_id || null });
    }
    if (body.action === 'finalize_upload') {
      const publicPrefix = PUBLIC_R2_BASE + '/';
      if (!String(body.url || '').startsWith(publicPrefix)) return json({ error: 'Invalid R2 media URL.' }, 400);
      const key = r2KeyFromPublicUrl(body.url);
      if (!key) return json({ error: 'Invalid R2 object key.' }, 400);
      await verifyR2Object(env, key);
      if (body.replace_fixed) {
        if (!['cover','hero'].includes(body.replace_fixed)) return json({ error: 'Invalid fixed replacement target.' }, 400);
        const column = body.replace_fixed === 'cover' ? 'cover_image_url' : 'hero_image_url';
        const saved = await tursoQuery(env, 'UPDATE case_studies SET ' + column + '=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *', [body.url, project.id]);
        return json({ kind: body.replace_fixed, url: body.url, project: saved.rows[0] || project });
      }
      if (body.replace_image_id) {
        const found = findImage(body.replace_image_id);
        if (!found) return json({ error: 'Media item not found.' }, 404);
        found.section.images[found.index] = { ...found.image, image_url: body.url };
        await saveContent();
        return json({ kind: 'gallery', url: body.url, image: { ...found.section.images[found.index], id: body.replace_image_id, project_id: project.id, section_id: found.section.id } });
      }
      const assetType = String(body.asset_type || '');
      const allowed = new Set(['project_cover','case_study_hero','project_overview','the_challenge','the_goal','my_role','project_context','research_overview','research_methods','research_findings','key_insights','user_personas','user_needs','problem_statement','ideation','information_architecture','user_flow','wireframing','low_fidelity_prototype','high_fidelity_prototype','heuristic_review','usability_testing','design_decisions','design_iteration','design_refinement','visual_design','design_system','accessibility','responsive_design','final_solution','outcome','learnings','next_steps','sitemap','paper_wireframe','digital_wireframe','design_exploration','desktop_before_heuristic','desktop_after_heuristic','mobile_before_heuristic','mobile_after_heuristic','final_desktop_screens','final_tablet_screens','final_mobile_screens','hifi_desktop_onboarding','hifi_mobile_onboarding','research','storyboard','wireframes_legacy','mobile_final_ui','web_final_ui','cover','hero','chinedu_persona','fatima_persona','low_fi_wireframe','wireframes','marketing_sitemap','marketing_paper_wireframe','marketing_digital_wireframe','marketing_desktop_before','marketing_desktop_after','marketing_mobile_before','marketing_mobile_after','marketing_desktop_final','marketing_tablet_final','marketing_mobile_final','marketing_hifi_desktop','marketing_hifi_mobile']);
      if (!allowed.has(assetType)) return json({ error: 'Invalid asset type.' }, 400);
      if (['cover','project_cover','hero','case_study_hero'].includes(assetType)) {
        const column = ['cover','project_cover'].includes(assetType) ? 'cover_image_url' : 'hero_image_url';
        const saved = await tursoQuery(env, 'UPDATE case_studies SET ' + column + '=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *', [body.url, project.id]);
        return json({ kind: assetType, url: body.url, project: saved.rows[0] || project }, 201);
      }
      const section = body.section_id ? content.sections.find(item => String(item.id) === String(body.section_id)) : content.sections.find(item => String(item.asset_type || item.metadata?.asset_type || '') === assetType);
      if (!section) return json({ error: 'No matching case-study section exists for ' + assetType + '.' }, 400);
      const image = { id: crypto.randomUUID(), image_url: body.url, image_type: assetType, asset_type: assetType, alt_text: String(body.alt_text || ''), caption: String(body.caption || ''), display_order: Math.max(0, Number(body.display_order || section.images.length)), project_id: project.id, section_id: section.id };
      section.images.push(image);
      await saveContent();
      return json({ kind: 'gallery', url: body.url, image }, 201);
    }
    return json({ error: 'Unknown media action.' }, 400);
  }
  if (method === 'PATCH') {
    if (!body.id) return json({ error: 'Missing image id.' }, 400);
    const found = findImage(body.id);
    if (!found) return json({ error: 'Media item not found.' }, 404);
    const image = { ...found.image };
    if (body.alt_text !== undefined) image.alt_text = String(body.alt_text);
    if (body.caption !== undefined) image.caption = String(body.caption);
    if (body.display_order !== undefined) image.display_order = Math.max(0, Number(body.display_order) || 0);
    if (body.section_id) {
      const target = content.sections.find(section => String(section.id) === String(body.section_id));
      if (!target) return json({ error: 'Selected case-study section not found.' }, 400);
      if (target !== found.section) {
        found.section.images.splice(found.index, 1);
        image.section_id = target.id;
        image.display_order = target.images.length;
        target.images.push(image);
      } else found.section.images[found.index] = image;
    } else found.section.images[found.index] = image;
    await saveContent();
    return json({ ...image, id: body.id, project_id: project.id, section_id: image.section_id || found.section.id });
  }
  if (method === 'DELETE') {
    if (body.fixed) {
      if (!['cover','hero'].includes(body.fixed)) return json({ error: 'Invalid fixed image.' }, 400);
      const column = body.fixed === 'cover' ? 'cover_image_url' : 'hero_image_url';
      const saved = await tursoQuery(env, 'UPDATE case_studies SET ' + column + "='',updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *", [project.id]);
      return json({ ok: true, project: saved.rows[0] || project });
    }
    if (!body.id) return json({ error: 'Missing image id.' }, 400);
    const found = findImage(body.id);
    if (!found) return json({ error: 'Media item not found.' }, 404);
    found.section.images.splice(found.index, 1);
    await saveContent();
    // Keep the object in R2 here. Removing it safely requires checking all
    // references across every case study and fixed asset first.
    return json({ ok: true });
  }
  return json({ error: 'Method not allowed.' }, 405);
}

async function adminDuplicateCaseStudy(request, env) {
  const body = await request.json().catch(() => ({}));
  const sourceId = String(body.id || '');
  if (!sourceId) return json({ error: 'Missing case study id.' }, 400);
  const { rows } = await tursoQuery(env, 'SELECT * FROM case_studies WHERE id=$1 LIMIT 1', [sourceId]);
  const source = rows[0];
  if (!source) return json({ error: 'Case study not found.' }, 404);
  const uuid = () => crypto.randomUUID();
  const slugify = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72) || 'case-study';
  const newId = uuid();
  const base = slugify(source.slug || source.title) + '-copy';
  let slug = base;
  for (let index = 2; index < 100; index++) {
    const { rows: existing } = await tursoQuery(env, 'SELECT id FROM case_studies WHERE slug=$1 LIMIT 1', [slug]);
    if (!existing.length) break;
    slug = base.slice(0, 68) + '-' + index;
  }
  const ids = new Map();
  const collect = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach(collect);
    if (typeof value.id === 'string' && value.id) ids.set(value.id, uuid());
    Object.values(value).forEach(collect);
  };
  const rewrite = (value, key = '') => {
    if (Array.isArray(value)) return value.map(item => rewrite(item, key));
    if (!value || typeof value !== 'object') return typeof value === 'string' && (key === 'id' || /_id$/.test(key) || /_ids$/.test(key)) && ids.has(value) ? ids.get(value) : value;
    const out = {};
    for (const [childKey, child] of Object.entries(value)) out[childKey] = rewrite(child, childKey);
    return out;
  };
  const copyMedia = async (value, copiedKeys) => {
    if (Array.isArray(value)) return Promise.all(value.map(item => copyMedia(item, copiedKeys)));
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'string' && /(?:image_url|media_url|video_url|thumbnail_url|cover_image_url|hero_image_url|url)$/i.test(key) && r2KeyFromPublicUrl(child)) {
        const response = await fetch(child);
        if (!response.ok) throw new Error('Could not retrieve a source media asset for duplication.');
        const sourceKey = r2KeyFromPublicUrl(child);
        const ext = sourceKey.includes('.') ? sourceKey.slice(sourceKey.lastIndexOf('.')).replace(/[^.a-zA-Z0-9]/g, '') : '';
        const targetKey = 'case-studies/' + newId + '/media/' + uuid() + ext;
        await uploadR2Object(env, targetKey, await response.arrayBuffer(), response.headers.get('content-type') || 'application/octet-stream');
        copiedKeys.push(targetKey);
        out[key] = r2PublicUrl(targetKey);
      } else out[key] = await copyMedia(child, copiedKeys);
    }
    return out;
  };
  const copiedKeys = [];
  try {
    let content = object(source.content);
    content = rewrite(content);
    content = await copyMedia(content, copiedKeys);
    if (content.preview_token) delete content.preview_token;
    const cover = source.cover_image_url ? (await copyMedia({ cover_image_url: source.cover_image_url }, copiedKeys)).cover_image_url : '';
    const hero = source.hero_image_url ? (await copyMedia({ hero_image_url: source.hero_image_url }, copiedKeys)).hero_image_url : '';
    const { rows: created } = await tursoQuery(env, 'INSERT INTO case_studies (id,title,slug,subtitle,description,role,year,duration,category,status,sort_order,content,cover_image_url,hero_image_url,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *', [
      newId, String(source.title || 'Untitled Case Study') + ' Copy', slug, source.subtitle || '', source.description || '', source.role || '', source.year || '', source.duration || '', source.category || '', 'draft', Number(source.sort_order || 0), JSON.stringify(content), cover, hero
    ]);
    return json({ ...created[0], status: 'draft', editor_url: '/admin/' }, 201);
  } catch (error) {
    for (const key of copiedKeys.reverse()) { try { await deleteR2Object(env, key); } catch {} }
    console.error('Cloudflare duplicate case study failed', error?.message || 'Unknown error');
    return json({ error: 'Unable to duplicate case study. The original remains unchanged.' }, 500);
  }
}

async function adminPreview(request, env) {
  const body = await request.json().catch(() => ({}));
  const id = String(body.project_id || '').trim();
  if (!id) return json({ error: 'Missing project_id.' }, 400);
  const { rows } = await tursoQuery(env, 'SELECT id,slug,content FROM case_studies WHERE id=$1 LIMIT 1', [id]);
  const project = rows[0];
  if (!project) return json({ error: 'Case study not found.' }, 404);
  const content = object(project.content);
  let token = String(content.preview_token || '').trim();
  if (!token) {
    token = crypto.randomUUID() + '-' + crypto.randomUUID();
    await tursoQuery(env, 'UPDATE case_studies SET content=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [JSON.stringify({ ...content, preview_token: token }), id]);
  }
  return json({ preview_url: '/case-study.html?slug=' + encodeURIComponent(project.slug) + '&preview=' + encodeURIComponent(token) });
}

async function adminMediaPreview(request, env) {
  const url = new URL(request.url);
  const projectId = String(url.searchParams.get('project_id') || '');
  const imageId = String(url.searchParams.get('image_id') || '');
  const fixed = String(url.searchParams.get('fixed') || '');
  if (!projectId) return json({ error: 'Missing project_id.' }, 400);
  const { rows } = await tursoQuery(env, 'SELECT * FROM case_studies WHERE id=$1 LIMIT 1', [projectId]);
  const project = rows[0];
  if (!project) return json({ error: 'Case study not found.' }, 404);
  let target = '';
  if (imageId) {
    const sections = normalizeSections(project.content);
    for (const section of sections) {
      const found = section.images.find(image => String(image.id) === imageId);
      if (found) { target = String(found.image_url || ''); break; }
    }
  } else if (fixed === 'cover') target = String(project.cover_image_url || '');
  else if (fixed === 'hero') target = String(project.hero_image_url || '');
  else return json({ error: 'Missing media target.' }, 400);
  if (!target) return json({ error: 'Media preview not found.' }, 404);
  return new Response(null, { status: 302, headers: { location: normalizeR2Url(target), 'cache-control': 'private, no-store, max-age=0' } });
}

async function adminUpload(request, env) {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'No file uploaded.' }, 400);
  if (file.size > 50 * 1024 * 1024) return json({ error: 'File is too large.' }, 413);
  const safeName = String(file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160);
  const key = 'portfolio/misc/' + Date.now() + '-' + crypto.randomUUID() + '-' + safeName;
  const url = await uploadR2Object(env, key, await file.arrayBuffer(), file.type || 'application/octet-stream');
  return json({ url, key, filename: file.name || safeName }, 201);
}

async function resumePdf(request, env) {
  const { rows } = await tursoQuery(env, 'SELECT resume_key,resume_display_name FROM site_branding LIMIT 1');
  const branding = rows[0] || {};
  const key = String(branding.resume_key || '');
  if (!key) return json({ error: 'No resume is currently published.' }, 404);
  const target = key.startsWith('http') ? key : r2PublicUrl(key);
  const source = await fetch(target);
  if (!source.ok) return json({ error: 'The resume PDF could not be retrieved.' }, 502);
  const displayName = String(branding.resume_display_name || 'Alan Odogwuideh Resume').trim() || 'Alan Odogwuideh Resume';
  const asciiName = displayName.replace(/[^a-zA-Z0-9 _.-]/g, '').replace(/\\s+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 100) || 'Alan-Odogwuideh-Resume';
  const headers = new Headers(source.headers);
  headers.set('content-type', 'application/pdf');
  headers.set('content-disposition', 'inline; filename="' + asciiName + '.pdf"; filename*=UTF-8\'\'' + encodeURIComponent(displayName + '.pdf'));
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(source.body, { status: 200, headers });
}

async function favicon(request, env) {
  const { rows } = await tursoQuery(env, 'SELECT favicon_key FROM site_branding LIMIT 1');
  const key = String(rows[0]?.favicon_key || '');
  if (!key || (!key.startsWith('http') && !key.startsWith('site/'))) return Response.redirect(new URL('/favicon.svg', request.url), 302);
  const target = key.startsWith('http') ? key : r2PublicUrl(key);
  return new Response(null, { status: 302, headers: { location: target, 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' } });
}

export async function handleCloudflareApi(request, env) {
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const method = request.method.toUpperCase();

  try {
    if (route === 'portfolio' && method === 'GET') return await portfolio(request, env);
    if (route === 'case-study' && method === 'GET') return await caseStudy(request, env);
    if (route === 'favicon' && method === 'GET') return await favicon(request, env);
    if (route === 'resume-pdf' && method === 'GET') return await resumePdf(request, env);
    if (route === 'about-image' && method === 'GET') {
      const { rows } = await tursoQuery(env, 'SELECT about_image_url FROM portfolio_settings LIMIT 1');
      const savedUrl = String(rows[0]?.about_image_url || '');
      const target = !savedUrl || savedUrl.toLowerCase().split(/[?#]/)[0].endsWith('.pdf') ? 'https://pub-05b8c3177ce444d385936988156c52c2.r2.dev/site/profile/1789656022670-0fbb5a1e-5d51-4d39-a286-0e226949f2ee-Alan.png' : savedUrl;
      return Response.redirect(target, 302);
    }
    if (route === 'admin-config' && method === 'GET') {
      return json({ url: env.SUPABASE_URL || '', publishableKey: env.SUPABASE_PUBLISHABLE_KEY || '' });
    }
    if (route === 'admin-session' && method === 'GET') {
      const auth = await requireSupabaseAdmin(request, env);
      return auth.ok ? json({ ok: true, email: auth.email, id: auth.id }) : json({ error: auth.error }, auth.status);
    }
    if (route === 'admin-logout' && method === 'POST') {
      return json({ ok: true }, 200, { 'set-cookie': 'portfolio_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0' });
    }

    // Every migrated route is handled above. Never forward a CMS request to
    // Hatchable or silently claim success for an endpoint not implemented here.
    const protectedRoutes = new Set([
      'admin-login','admin-case-study','admin-config','admin-duplicate-case-study',
      'admin-media-preview','admin-media','admin-preview','admin-projects',
      'admin-session','admin-settings','admin-trash','admin-upload'
    ]);
    if (protectedRoutes.has(route)) {
      if (route !== 'admin-login') {
        const auth = await requireSupabaseAdmin(request, env);
        if (!auth.ok) return json({ error: auth.error }, auth.status);
        if (route === 'admin-projects') return await adminProjects(request, env, auth);
        if (route === 'admin-case-study') return await adminCaseStudy(request, env, auth);
        if (route === 'admin-settings') return await adminSettings(request, env);
        if (route === 'admin-trash') return await adminTrash(request, env, auth);
        if (route === 'admin-media') return await adminMedia(request, env, auth);
        if (route === 'admin-duplicate-case-study' && method === 'POST') return await adminDuplicateCaseStudy(request, env);
        if (route === 'admin-preview' && method === 'POST') return await adminPreview(request, env);
        if (route === 'admin-media-preview' && method === 'GET') return await adminMediaPreview(request, env);
        if (route === 'admin-upload' && method === 'POST') return await adminUpload(request, env);
      }
      return json({ error: 'This CMS endpoint has not been migrated to Cloudflare yet.' }, 503);
    }
    return json({ error: 'API route not found.' }, 404);
  } catch (error) {
    console.error('Cloudflare route error:', route, error?.message || 'Unknown error');
    return json({ error: 'Portfolio data is temporarily unavailable.' }, 502);
  }
}
