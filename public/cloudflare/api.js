/**
 * Cloudflare-only API implementation.
 *
 * Keep this file independent from Hatchable's api/ and lib/ runtime. All
 * credentials are supplied through Cloudflare Pages environment variables.
 */
import { signR2Put, signR2Get, verifyR2Object, uploadR2Object, deleteR2Object, r2KeyFromPublicUrl } from './r2.js';

const PUBLIC_R2_BASE = 'https://pub-05b8c3177ce444d385936988156c52c2.r2.dev';

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
});
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const skillItems = value => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map(item => String(item ?? '').trim().slice(0,100)).filter(Boolean).slice(0,100);
const parseStoredJson = (value, fallback = {}) => { if (value == null || value === '') return fallback; if (typeof value === 'object') return value; try { return JSON.parse(String(value)); } catch { return fallback; } };
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

async function ensureResumeStudioSchema(env) {
  const columns = [
    ['master_resume_text','TEXT'],
    ['master_resume_source_key','TEXT'],
    ['resume_studio_usage_date','TEXT'],
    ['resume_studio_requests','INTEGER DEFAULT 0']
  ];
  for (const [name, type] of columns) {
    await tursoQuery(env, 'ALTER TABLE site_branding ADD COLUMN ' + name + ' ' + type).catch(error => {
      if (!/duplicate column|already exists/i.test(error.message || '')) throw error;
    });
  }
}
async function ensureSavedDocumentsSchema(env) {
  await tursoQuery(env, `CREATE TABLE IF NOT EXISTS resume_studio_documents (
    id TEXT PRIMARY KEY,
    document_type TEXT NOT NULL,
    title TEXT NOT NULL,
    job_title TEXT NOT NULL DEFAULT '',
    company_name TEXT NOT NULL DEFAULT '',
    object_key TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}
async function listSavedDocuments(env) {
  await ensureSavedDocumentsSchema(env);
  const { rows } = await tursoQuery(env, 'SELECT id,document_type,title,job_title,company_name,created_at,updated_at FROM resume_studio_documents ORDER BY created_at DESC');
  return rows;
}
async function readSavedDocument(env, id) {
  await ensureSavedDocumentsSchema(env);
  const { rows } = await tursoQuery(env, 'SELECT * FROM resume_studio_documents WHERE id=$1 LIMIT 1', [id]);
  const row = rows[0];
  if (!row) return null;
  const privateUrl = await signR2Get(env, row.object_key, 60);
  const response = await fetch(privateUrl);
  if (!response.ok) throw new Error('Saved document content could not be retrieved from private R2 storage.');
  const payload = await response.json();
  return { ...row, content: String(payload.content || ''), template: String(payload.template || 'new-york'), analysis: object(payload.analysis) };
}
async function saveDocument(env, input) {
  await ensureSavedDocumentsSchema(env);
  const type = input.document_type === 'cover' ? 'cover' : 'resume';
  const content = String(input.content || '');
  if (!content.trim() || content.length > 50000) throw new Error('Document content is empty or exceeds 50,000 characters.');
  const id = String(input.id || crypto.randomUUID()).slice(0,80);
  const title = String(input.title || (type === 'cover' ? 'Cover letter' : 'Tailored resume')).slice(0,240);
  const jobTitle = String(input.job_title || '').slice(0,160);
  const company = String(input.company_name || '').slice(0,160);
  const { rows } = await tursoQuery(env, 'SELECT id,object_key FROM resume_studio_documents WHERE id=$1 LIMIT 1', [id]);
  const old = rows[0];
  const key = old?.object_key || ('site/resume-studio/' + id + '.json');
  const payload = JSON.stringify({ content, template: String(input.template || 'new-york'), analysis: object(input.analysis) });
  await uploadR2Object(env, key, new TextEncoder().encode(payload), 'application/json; charset=utf-8');
  if (old) {
    await tursoQuery(env, 'UPDATE resume_studio_documents SET document_type=$1,title=$2,job_title=$3,company_name=$4,object_key=$5,updated_at=CURRENT_TIMESTAMP WHERE id=$6', [type,title,jobTitle,company,key,id]);
  } else {
    await tursoQuery(env, 'INSERT INTO resume_studio_documents (id,document_type,title,job_title,company_name,object_key) VALUES ($1,$2,$3,$4,$5,$6)', [id,type,title,jobTitle,company,key]);
  }
  return { id, document_type:type, title, job_title:jobTitle, company_name:company, object_key:key };
}
async function deleteSavedDocuments(env, ids) {
  await ensureSavedDocumentsSchema(env);
  const clean = [...new Set((Array.isArray(ids) ? ids : [ids]).map(v => String(v || '').trim()).filter(v => /^[a-zA-Z0-9-]{8,80}$/.test(v)))].slice(0,200);
  if (!clean.length) throw new Error('Select at least one saved document.');
  let deleted = 0;
  for (const id of clean) {
    const { rows } = await tursoQuery(env, 'SELECT object_key FROM resume_studio_documents WHERE id=$1 LIMIT 1', [id]);
    const row = rows[0];
    if (!row) continue;
    await deleteR2Object(env, row.object_key);
    await tursoQuery(env, 'DELETE FROM resume_studio_documents WHERE id=$1', [id]);
    deleted++;
  }
  return deleted;
}

async function getResumeStudioRecord(env) {
  await ensureResumeStudioSchema(env);
  const { rows } = await tursoQuery(env, 'SELECT id,master_resume_text,master_resume_source_key,resume_studio_usage_date,resume_studio_requests,resume_key,resume_display_name FROM site_branding LIMIT 1');
  if (rows[0]) return rows[0];
  await tursoQuery(env, "INSERT INTO site_branding (id,favicon_key,updated_at) VALUES ($1,$2,CURRENT_TIMESTAMP)", ['1','']);
  const created = await tursoQuery(env, 'SELECT id,master_resume_text,master_resume_source_key,resume_studio_usage_date,resume_studio_requests,resume_key,resume_display_name FROM site_branding LIMIT 1');
  return created.rows[0] || {};
}
async function resumeStudioUsage(env, record) {
  const today = new Date().toISOString().slice(0, 10);
  const requests = String(record.resume_studio_usage_date || '') === today ? Number(record.resume_studio_requests || 0) : 0;
  return { date: today, requests, request_limit: 40, remaining_requests: Math.max(0, 40 - requests), reset_at: today + 'T00:00:00Z' };
}
async function recordResumeStudioRequest(env, record, usage) {
  const next = Number(usage.requests || 0) + 1;
  await tursoQuery(env, 'UPDATE site_branding SET resume_studio_usage_date=$1,resume_studio_requests=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$3', [usage.date,next,record.id]);
  return { ...usage, requests: next, remaining_requests: Math.max(0, usage.request_limit - next) };
}
function resumeStudioJson(text) {
  const clean = String(text || '').trim().replace(/^\u0060\u0060\u0060(?:json)?\s*/i, '').replace(/\s*\u0060\u0060\u0060$/,'');
  const start = clean.indexOf('{'), end = clean.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The AI returned an incomplete response. Please try again.');
  return JSON.parse(clean.slice(start, end + 1));
}
function resumeStudioFastProfile(text) {
  const source = String(text || '').replace(/\r/g, '');
  const lines = source.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const joined = lines.join('\n');
  const email = (joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [''])[0];
  const phone = (joined.match(/(?:\+?\d[\d\s().-]{7,}\d)/) || [''])[0].trim();
  const urls = [...new Set(joined.match(/https?:\/\/[^\s)>,]+/gi) || [])].slice(0, 12);
  const name = lines.find(line => line.length < 70 && !/@|https?:\/\/|\d{3,}/.test(line) && !/resume|curriculum vitae|professional profile/i.test(line)) || '';
  const headings = {
    summary: /^(professional summary|summary|profile|career objective|objective|about me)$/i,
    experience: /^(work experience|professional experience|employment history|experience|career history)$/i,
    projects: /^(projects|selected projects|key projects|portfolio projects)$/i,
    skills: /^(skills|core skills|technical skills|competencies|areas of expertise|tools)$/i,
    education: /^(education|academic background|qualifications|education and training)$/i,
    certifications: /^(certifications|certificates|licenses|professional certifications)$/i
  };
  const sections = { summary: [], experience: [], projects: [], skills: [], education: [], certifications: [] };
  let current = '';
  for (const line of lines) {
    let found = '';
    for (const [key, regex] of Object.entries(headings)) if (regex.test(line.replace(/:$/, ''))) { found = key; break; }
    if (found) { current = found; continue; }
    if (current && !/^(page\s+\d+|references available on request)$/i.test(line)) sections[current].push(line);
  }
  const bullets = arr => arr.filter(line => line.length > 2).map(line => ({ text: line.replace(/^[-•*▪◦]\s*/, '').trim() })).filter(x => x.text);
  const dateLine = /(?:19|20)\d{2}|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}/i;
  const expLines = sections.experience;
  const experience = [];
  for (const line of expLines) {
    if (dateLine.test(line) && (experience.length === 0 || line.length < 180)) {
      experience.push({ company: '', title: line, location: '', startDate: '', endDate: '', current: /present|current/i.test(line), bullets: [] });
    } else if (!experience.length) {
      experience.push({ company: '', title: '', location: '', startDate: '', endDate: '', current: false, bullets: [] });
      experience[0].bullets.push({ text: line.replace(/^[-•*▪◦]\s*/, '') });
    } else experience[experience.length - 1].bullets.push({ text: line.replace(/^[-•*▪◦]\s*/, '') });
  }
  const skills = sections.skills.length ? [{ category: 'Skills', items: sections.skills.join(', ').split(/[,;|•]/).map(x => x.trim()).filter(Boolean).slice(0, 100) }] : [];
  const education = sections.education.length ? [{ institution: '', degree: sections.education[0] || '', field: '', startDate: '', endDate: '', notes: sections.education.slice(1).join('\n') }] : [];
  const certifications = sections.certifications.map(line => ({ name: line, issuer: '', date: '' }));
  const projects = sections.projects.map(line => ({ name: line.replace(/^[-•*▪◦]\s*/, ''), url: urls.find(url => line.includes(url)) || '', description: '', bullets: [] }));
  return {
    profile: {
      contact: { fullName: name, email, phone, location: '', links: urls.map(url => ({ label: /linkedin/i.test(url) ? 'LinkedIn' : /github/i.test(url) ? 'GitHub' : 'Portfolio', url })) },
      summaries: sections.summary.length ? [{ label: 'Professional summary', text: sections.summary.join(' ') }] : [],
      experience, projects, skills, education, certifications
    },
    warnings: ['Fast text extraction was used because AI did not finish within 7 seconds. Review all fields carefully; complex role and date formatting may need manual correction.']
  };
}
async function adminResumeStudio(request, env) {
  const record = await getResumeStudioRecord(env);
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  if (method === 'GET') {
    if (url.searchParams.get('view') === 'ai-check') {
      if (!env.AI || typeof env.AI.run !== 'function') return json({ ok: false, stage: 'binding', error: 'The AI binding named AI is not available in this deployed Cloudflare runtime.' }, 503);
      try {
        const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages: [{ role: 'user', content: 'Reply with exactly: Resume Studio AI connection successful.' }], max_tokens: 40 });
        const output = typeof result === 'string' ? result : String(result?.response || result?.output_text || result?.result?.response || '');
        if (!output.trim()) return json({ ok: false, stage: 'model-response', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', error: 'The AI binding ran but returned an empty response.' }, 502);
        return json({ ok: true, model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', message: output.trim().slice(0, 160) });
      } catch (error) {
        console.error('Resume Studio AI connection check failed:', error?.message || 'unknown', error?.stack || '');
        return json({ ok: false, stage: 'model-invocation', error: String(error?.message || 'Workers AI invocation failed.').slice(0, 300) }, 502);
      }
    }
    const usage = await resumeStudioUsage(env, record);
    if (url.searchParams.get('view') === 'usage') return json(usage);
    if (url.searchParams.get('view') === 'documents') return json({ documents: await listSavedDocuments(env) });
    if (url.searchParams.get('view') === 'document') {
      const id = String(url.searchParams.get('id') || '').slice(0,80);
      if (!id) return json({ error: 'A saved document ID is required.' }, 400);
      const document = await readSavedDocument(env, id);
      return document ? json({ document }) : json({ error: 'Saved document not found.' }, 404);
    }
    return json({
      master_resume_text: String(record.master_resume_text || ''),
      master_resume_source_key: String(record.master_resume_source_key || ''),
      resume_key: String(record.resume_key || ''),
      resume_display_name: String(record.resume_display_name || ''),
      usage
    });
  }
  if (method === 'PUT') {
    const body = await request.json().catch(() => ({}));
    if (body.action === 'publish-master') {
      const key = String(record.master_resume_source_key || '');
      if (!key) return json({ error: 'Upload the master resume PDF first.' }, 400);
      const source = await fetch(r2PublicUrl(key));
      if (!source.ok) return json({ error: 'The master resume PDF could not be retrieved from R2.' }, 502);
      const publishedKey = 'site/resume/Alan-Odogwuideh-Master-' + Date.now() + '-' + crypto.randomUUID().slice(0,8) + '.pdf';
      await uploadR2Object(env, publishedKey, await source.arrayBuffer(), 'application/pdf');
      const displayName = 'Alan Odogwuideh — Master Resume';
      const oldPublicKey = String(record.resume_key || '');
      await tursoQuery(env, 'UPDATE site_branding SET resume_key=$1,resume_display_name=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$3', [publishedKey,displayName,record.id]);
      if (oldPublicKey && !oldPublicKey.startsWith('http') && oldPublicKey !== key) await deleteR2Object(env, oldPublicKey).catch(() => {});
      return json({ ok: true, message: 'A separate copy of the master PDF is now the resume shown on your public portfolio.' });
    }
    const text = String(body.master_resume_text || '').trim();
    if (!text || text.length > 40000) return json({ error: 'Master resume text is required (maximum 40,000 characters).' }, 400);
    await tursoQuery(env, 'UPDATE site_branding SET master_resume_text=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [text,record.id]);
    return json({ ok: true, saved: true });
  }
  if (method === 'POST') {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'Choose a PDF file.' }, 400);
      if (file.size > 15 * 1024 * 1024 || !(String(file.name || '').toLowerCase().endsWith('.pdf') || file.type === 'application/pdf')) return json({ error: 'Upload a PDF under 15 MB.' }, 400);
      const safeName = String(file.name || 'master-resume.pdf').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0,100);
      const key = 'site/resume-master/' + Date.now() + '-' + crypto.randomUUID().slice(0,8) + '-' + safeName;
      await uploadR2Object(env, key, await file.arrayBuffer(), 'application/pdf');
      const oldSourceKey = String(record.master_resume_source_key || '');
      await tursoQuery(env, 'UPDATE site_branding SET master_resume_source_key=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2', [key,record.id]);
      if (oldSourceKey && !oldSourceKey.startsWith('http') && oldSourceKey !== key) await deleteR2Object(env, oldSourceKey).catch(() => {});
      return json({ ok: true, master_resume_source_key: key, resume_key: String(record.resume_key || '') }, 201);
    }
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'generate');
    if (action === 'save-documents') {
      if (!Array.isArray(body.documents) || !body.documents.length || body.documents.length > 2) return json({ error: 'Provide a tailored resume and/or cover letter to save.' }, 400);
      try {
        const saved = [];
        for (const document of body.documents) saved.push(await saveDocument(env, { ...object(document), job_title: body.job_title, company_name: body.company_name, analysis: body.analysis }));
        return json({ ok: true, saved, documents: await listSavedDocuments(env) });
      } catch (error) { return json({ error: String(error?.message || 'Could not save your documents.').slice(0,300) }, 500); }
    }
    const usage = await resumeStudioUsage(env, record);
    if (usage.requests >= usage.request_limit) return json({ error: 'You have reached the Resume Studio daily request safety limit. It resets at midnight UTC. Check Cloudflare AI analytics for your actual Neurons usage.' }, 429);
    if (!env.AI || typeof env.AI.run !== 'function') return json({ error: 'Cloudflare Workers AI is not bound to this Pages project yet. Add the AI binding named AI in Cloudflare Pages Settings → Functions → Workers AI.' }, 503);
    const master = String(body.master_resume_text || record.master_resume_text || '').trim();
    const job = String(body.job_description || '').trim();
    const isAnalysis = action === 'analyze-resume';
    const isProfileImport = action === 'import-profile';
    if (!master) return json({ error: isProfileImport ? 'Extracted resume text is required.' : 'Add resume content before running an analysis.' }, 400);
    if (master.length > 40000) return json({ error: 'Resume content is too long (maximum 40,000 characters).' }, 400);
    if (!isAnalysis && !isProfileImport && (!job || job.length > 20000)) return json({ error: 'A job description is required (maximum 20,000 characters).' }, 400);
    const jobTitle = String(body.job_title || '').slice(0,160);
    const company = String(body.company_name || '').slice(0,160);
    const companyDetails = String(body.company_details || '').slice(0,5000);
    const tone = ['professional','enthusiastic','confident'].includes(body.cover_tone) ? body.cover_tone : 'professional';
    const length = ['concise','standard','detailed'].includes(body.cover_length) ? body.cover_length : 'standard';
    const system = 'You are a meticulous career-document editor. Use only facts explicitly supported by the master resume. Never invent employers, dates, qualifications, metrics, tools, certifications, responsibilities, or outcomes. You may improve clarity, reorder relevant evidence, and identify gaps without claiming the candidate has them. Return valid JSON only, no markdown fences.';
    let prompt;
    if (isProfileImport) {
      prompt = 'Convert the resume into the exact JSON schema below. Do not explain your work or repeat the source text outside the fields. Completeness is more important than brevity: preserve every distinct employment role, project, achievement bullet, skill, skill category, education item, certification, date, contact detail and link from the source. Keep roles in source order. Do not merge separate bullets, summarize multiple achievements into one, discard older roles, or reduce a skill list to a generic label. Transfer every substantive source bullet as its own concise factual bullet, retaining all supported numbers and named tools. Before returning JSON, internally compare each source section against the output and ensure no entries or bullets were dropped. Remove only exact duplicates. Never infer missing facts. Use empty arrays for genuinely absent sections and empty strings for unknown values. No IDs or tags. Add warnings only for genuinely ambiguous or unreadable details. Schema: {"profile":{"contact":{"fullName":"","email":"","phone":"","location":"","links":[{"label":"","url":""}]},"summaries":[{"label":"Professional summary","text":""}],"experience":[{"company":"","title":"","location":"","startDate":"","endDate":"","current":false,"bullets":[{"text":""}]}],"projects":[{"name":"","url":"","description":"","bullets":[{"text":""}]}],"skills":[{"category":"","items":[]}],"education":[{"institution":"","degree":"","field":"","startDate":"","endDate":"","notes":""}],"certifications":[{"name":"","issuer":"","date":""}]},"warnings":[]}. Return valid JSON only. RESUME TEXT:\\n' + master;
    } else if (isAnalysis) {
      prompt = 'Review the supplied resume as a career-document quality auditor. Return JSON only with fields: overall_assessment (string), strengths (array of strings), issues (array of strings), missing_information (array of strings), structure_recommendations (array of strings), evidence_warnings (array of strings), next_steps (array of strings). Identify formatting/content risks and unsupported or unclear claims. Do not rewrite the resume, invent facts, or assume missing details. Keep recommendations specific and actionable. RESUME CONTENT:\\n' + master;
    } else if (action === 'cover-only') {
      const tailored = String(body.tailored_resume || '').trim();
      if (!tailored || tailored.length > 40000) return json({ error: 'A tailored resume is required to regenerate the cover letter.' }, 400);
      prompt = 'Return JSON with one string field "cover_letter". Write a ' + length + ' cover letter in a ' + tone + ' tone for ' + (jobTitle || 'the advertised role') + ' at ' + (company || 'the company') + '. Use only the candidate evidence in the supplied resume. Do not fabricate details. Company context: ' + companyDetails + '\nJOB DESCRIPTION:\n' + job + '\nTAILORED RESUME:\n' + tailored;
    } else {
      prompt = 'Return one JSON object with fields: analysis (object with role_summary string, matched_requirements array of strings, gaps_or_unproven array of strings, tailoring_strategy string), tailored_resume (string), cover_letter (string). Tailor the resume to ' + (jobTitle || 'the role in the job description') + ' at ' + (company || 'the company') + '. Company context: ' + companyDetails + '. The resume should be ATS-readable, use clear headings and evidence-backed bullets, prioritize relevant verified experience, and preserve factual dates/credentials. Do not add unsupported metrics or keywords as claimed skills. Cover-letter tone: ' + tone + '; length: ' + length + '. JOB DESCRIPTION:\n' + job + '\nMASTER RESUME:\n' + master;
    }
    let modelResult;
    const model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    const requestedTokens = isProfileImport ? 1500 : (action === 'cover-only' || isAnalysis) ? 2200 : 6500;
    try {
      // Keep imports responsive: after 7 seconds, return a deterministic text-based
      // profile rather than leaving the admin waiting indefinitely. The AI promise
      // may finish later, but it is not used after the fallback has been selected.
      if (isProfileImport) {
        let timeoutId;
        const timeout = new Promise(resolve => {
          timeoutId = setTimeout(() => resolve({ __resumeStudioFastFallback: true }), 7000);
        });
        try {
          modelResult = await Promise.race([
            env.AI.run(model, { messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], max_tokens: requestedTokens }),
            timeout
          ]);
        } finally { clearTimeout(timeoutId); }
        if (modelResult?.__resumeStudioFastFallback) {
          const fallback = resumeStudioFastProfile(master);
          const nextUsage = await recordResumeStudioRequest(env, record, usage);
          return json({ ...fallback, usage: nextUsage, import_mode: 'fast-fallback' });
        }
      } else {
        modelResult = await env.AI.run(model, { messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], max_tokens: requestedTokens });
      }
    } catch (firstError) {
      try {
        modelResult = await env.AI.run(model, { messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], max_tokens: requestedTokens });
      } catch (retryError) {
        const detail = String(retryError?.message || firstError?.message || 'Unknown Workers AI invocation error').slice(0, 400);
        console.error('Resume Studio model invocation failed:', detail, retryError?.name || firstError?.name || 'Error');
        return json({ error: 'Resume Studio could not complete the AI request.', diagnostic: detail, error_name: String(retryError?.name || firstError?.name || 'Error').slice(0, 80), model, max_tokens: requestedTokens, action }, 502);
      }
    }
    const extractModelOutput = result => { const value = typeof result === 'string' ? result : (result?.response ?? result?.output_text ?? result?.result?.response ?? result?.choices?.[0]?.message?.content ?? result?.result?.choices?.[0]?.message?.content ?? ''); return typeof value === 'string' ? value : JSON.stringify(value); };
    let output = extractModelOutput(modelResult);
    let parsed;
    try {
      parsed = resumeStudioJson(output);
    } catch (firstParseError) {
      if (isProfileImport) {
        const detail = String(firstParseError?.message || 'The model returned invalid JSON.').slice(0, 240);
        console.error('Resume Studio import JSON response failed validation:', detail);
        return json({ error: 'Resume Studio received an incomplete or invalid profile response. Please retry the import.', diagnostic: detail, model, max_tokens: requestedTokens, action }, 502);
      } else {
        // Other Resume Studio tasks retain the full-budget JSON repair retry.
        try {
          const repairPrompt = prompt + '\\n\\nIMPORTANT: Your previous response was not parseable JSON. Return the complete requested JSON object only. Do not use markdown fences, commentary, or omit any requested fields.';
          const repairResult = await env.AI.run(model, { messages: [{ role: 'system', content: system }, { role: 'user', content: repairPrompt }], max_tokens: requestedTokens });
          output = extractModelOutput(repairResult);
          parsed = resumeStudioJson(output);
        } catch (repairError) {
          const detail = String(repairError?.message || firstParseError?.message || 'The model returned invalid JSON.').slice(0, 300);
          console.error('Resume Studio JSON response failed validation:', detail);
          return json({ error: 'Resume Studio received an incomplete or invalid JSON response after one repair attempt.', diagnostic: detail, model, max_tokens: requestedTokens, action }, 502);
        }
      }
    }
    const nextUsage = await recordResumeStudioRequest(env, record, usage);
    if (isProfileImport) {
      const imported = object(parsed.profile);
      if (!imported.contact || !Array.isArray(imported.experience) || !Array.isArray(imported.skills) || !Array.isArray(imported.education)) return json({ error: 'The extracted profile did not match the expected structure. Please try again with a clearer PDF or DOCX.' }, 502);
      return json({ profile: imported, warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(x => String(x).slice(0,300)).slice(0,30) : [], usage: nextUsage });
    }
    if (isAnalysis) return json({ analysis: object(parsed), usage: nextUsage });
    if (action === 'cover-only') return json({ cover_letter: String(parsed.cover_letter || ''), usage: nextUsage });
    return json({
      analysis: object(parsed.analysis),
      tailored_resume: String(parsed.tailored_resume || ''),
      cover_letter: String(parsed.cover_letter || ''),
      usage: nextUsage
    });
  }
  if (method === 'DELETE') {
    const body = await request.json().catch(() => ({}));
    try {
      const deleted = await deleteSavedDocuments(env, body.ids || body.id);
      return json({ ok: true, deleted, documents: await listSavedDocuments(env) });
    } catch (error) { return json({ error: String(error?.message || 'Could not delete saved documents.').slice(0,300) }, 400); }
  }
  return json({ error: 'Method not allowed.' }, 405);
}

const emptyMasterProfile = () => ({
  contact: { fullName: '', email: '', phone: '', location: '', links: [] },
  summaries: [], experience: [], projects: [], skills: [], education: [], certifications: []
});
const profileText = (value, max = 5000) => String(value ?? '').trim().slice(0, max);
const profileArray = (value, max) => Array.isArray(value) ? value.slice(0, max) : [];
const profileSkillArray = (value, max = 100) => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map(skill => profileText(skill, 100)).filter(Boolean).slice(0, max);
const profileId = value => profileText(value, 80) || crypto.randomUUID();
function normalizeMasterProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('The profile must be a JSON object.'), { status: 400 });
  const contact = object(input.contact);
  const profile = {
    contact: {
      fullName: profileText(contact.fullName, 160), email: profileText(contact.email, 254),
      phone: profileText(contact.phone, 80), location: profileText(contact.location, 160),
      links: profileArray(contact.links, 20).map(link => ({ label: profileText(link?.label, 80), url: profileText(link?.url, 500) }))
    },
    summaries: profileArray(input.summaries, 10).map(item => ({ label: profileText(item?.label, 120), text: profileText(item?.text, 2500) })),
    experience: profileArray(input.experience, 50).map(item => ({
      id: profileId(item?.id), company: profileText(item?.company, 180), title: profileText(item?.title, 180),
      location: profileText(item?.location, 160), startDate: profileText(item?.startDate, 40),
      endDate: profileText(item?.endDate, 40), current: item?.current === true,
      bullets: profileArray(item?.bullets, 40).map(bullet => ({
        id: profileId(bullet?.id), text: profileText(bullet?.text, 2000),
        tags: profileArray(bullet?.tags, 30).map(tag => profileText(tag, 80)).filter(Boolean)
      }))
    })),
    projects: profileArray(input.projects, 50).map(item => ({
      id: profileId(item?.id), name: profileText(item?.name, 180), url: profileText(item?.url, 500),
      description: profileText(item?.description, 2000),
      bullets: profileArray(item?.bullets, 40).map(bullet => ({
        id: profileId(bullet?.id), text: profileText(bullet?.text, 2000),
        tags: profileArray(bullet?.tags, 30).map(tag => profileText(tag, 80)).filter(Boolean)
      }))
    })),
    skills: profileArray(input.skills, 50).map(item => ({
      category: profileText(item?.category, 100),
      items: profileSkillArray(item?.items, 100)
    })),
    education: profileArray(input.education, 30).map(item => ({
      id: profileId(item?.id), institution: profileText(item?.institution, 180),
      degree: profileText(item?.degree, 180), field: profileText(item?.field, 180),
      startDate: profileText(item?.startDate, 40), endDate: profileText(item?.endDate, 40),
      notes: profileText(item?.notes, 1200)
    })),
    certifications: profileArray(input.certifications, 50).map(item => ({
      id: profileId(item?.id), name: profileText(item?.name, 180),
      issuer: profileText(item?.issuer, 180), date: profileText(item?.date, 80)
    }))
  };
  if (JSON.stringify(profile).length > 250000) throw Object.assign(new Error('The master profile is too large. Please shorten some entries and try again.'), { status: 413 });
  return profile;
}
async function adminResumeProfile(request, env) {
  const method = request.method.toUpperCase();
  if (method === 'GET') {
    const { rows } = await tursoQuery(env, 'SELECT profile_json, updated_at FROM master_profile WHERE id=1 LIMIT 1');
    let profile = emptyMasterProfile();
    if (rows[0]?.profile_json) {
      try { profile = normalizeMasterProfile(parseStoredJson(rows[0].profile_json,{})); }
      catch { return json({ error: 'The saved master profile could not be read safely.' }, 500); }
    }
    return json({ profile, updatedAt: rows[0]?.updated_at || null });
  }
  if (method === 'PUT') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'Please send a valid JSON profile.' }, 400); }
    let profile;
    try { profile = normalizeMasterProfile(body?.profile); }
    catch (error) { return json({ error: error.message || 'The profile is invalid.' }, Number(error.status) || 400); }
    await tursoQuery(env, 'INSERT INTO master_profile (id, profile_json, created_at, updated_at) VALUES (1, $1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET profile_json=excluded.profile_json, updated_at=CURRENT_TIMESTAMP', [JSON.stringify(profile)]);
    const { rows } = await tursoQuery(env, 'SELECT updated_at FROM master_profile WHERE id=1 LIMIT 1');
    return json({ ok: true, profile, updatedAt: rows[0]?.updated_at || null });
  }
  return json({ error: 'Method not allowed.' }, 405);
}

function resumeSnapshotFromMaster(profile) {
  const contact=object(profile.contact), sections=['summary','experience','projects','skills','education','certifications'];
  const summary=(Array.isArray(profile.summaries)?profile.summaries:[]).find(x=>String(x?.text||'').trim());
  const links=(Array.isArray(contact.links)?contact.links:[]).map(x=>({label:String(x?.label||''),url:String(x?.url||''),hidden:false}));
  if(!links.length) links.push({label:'Portfolio',url:'',hidden:false});
  return {
    contact:{fullName:String(contact.fullName||''),email:String(contact.email||''),phone:String(contact.phone||''),location:String(contact.location||''),links},
    summary:String(summary?.text||''),summaryLabel:String(summary?.label||''),sectionOrder:sections,
    sectionTitles:{summary:'Professional Summary',experience:'Experience',projects:'Projects',skills:'Skills',education:'Education',certifications:'Certifications'},hiddenSections:[],
    experience:(Array.isArray(profile.experience)?profile.experience:[]).map(x=>({...object(x),id:x.id||crypto.randomUUID(),hidden:false,endDate:x.current?'Present':String(x.endDate||''),bullets:(Array.isArray(x.bullets)?x.bullets:[]).map(b=>({id:b.id||crypto.randomUUID(),text:String(b.text||''),hidden:false}))})),
    projects:(Array.isArray(profile.projects)?profile.projects:[]).map(x=>({...object(x),id:x.id||crypto.randomUUID(),hidden:false,bullets:(Array.isArray(x.bullets)?x.bullets:[]).map(b=>({id:b.id||crypto.randomUUID(),text:String(b.text||''),hidden:false}))})),
    skills:(Array.isArray(profile.skills)?profile.skills:[]).map(x=>({...object(x),id:crypto.randomUUID(),hidden:false,items:skillItems(x.items)})),
    education:(Array.isArray(profile.education)?profile.education:[]).map(x=>({...object(x),id:x.id||crypto.randomUUID(),hidden:false})),
    certifications:(Array.isArray(profile.certifications)?profile.certifications:[]).map(x=>({...object(x),id:x.id||crypto.randomUUID(),hidden:false}))
  };
}
function normalizeResumeContent(value) {
  const c=object(value), sections=['summary','experience','projects','skills','education','certifications'];
  const titles=object(c.sectionTitles);
  const out={...c,contact:object(c.contact),summary:String(c.summary||'').slice(0,2500),
    sectionOrder:(Array.isArray(c.sectionOrder)?c.sectionOrder:sections).filter(x=>sections.includes(x)),
    sectionTitles:Object.fromEntries(sections.map(k=>[k,String(titles[k]||({summary:'Professional Summary',experience:'Experience',projects:'Projects',skills:'Skills',education:'Education',certifications:'Certifications'}[k])).slice(0,100)])),
    hiddenSections:(Array.isArray(c.hiddenSections)?c.hiddenSections:[]).filter(x=>sections.includes(x)),
    experience:(Array.isArray(c.experience)?c.experience:[]).slice(0,50).map(x=>({...object(x),id:String(x.id||crypto.randomUUID()),hidden:x.hidden===true,bullets:(Array.isArray(x.bullets)?x.bullets:[]).slice(0,40).map(b=>({...object(b),id:String(b.id||crypto.randomUUID()),text:String(b.text||'').slice(0,2000),hidden:b.hidden===true}))})),
    projects:(Array.isArray(c.projects)?c.projects:[]).slice(0,50).map(x=>({...object(x),id:String(x.id||crypto.randomUUID()),hidden:x.hidden===true,bullets:(Array.isArray(x.bullets)?x.bullets:[]).slice(0,40).map(b=>({...object(b),id:String(b.id||crypto.randomUUID()),text:String(b.text||'').slice(0,2000),hidden:b.hidden===true}))})),
    skills:(Array.isArray(c.skills)?c.skills:[]).slice(0,50).map(x=>({...object(x),id:String(x.id||crypto.randomUUID()),hidden:x.hidden===true,category:String(x.category||'').slice(0,100),items:skillItems(x.items)})),
    education:(Array.isArray(c.education)?c.education:[]).slice(0,30).map(x=>({...object(x),id:String(x.id||crypto.randomUUID()),hidden:x.hidden===true})),
    certifications:(Array.isArray(c.certifications)?c.certifications:[]).slice(0,50).map(x=>({...object(x),id:String(x.id||crypto.randomUUID()),hidden:x.hidden===true}))};
  for(const s of sections) if(!out.sectionOrder.includes(s)) out.sectionOrder.push(s);
  out.contact={fullName:String(out.contact.fullName||'').slice(0,160),email:String(out.contact.email||'').slice(0,254),phone:String(out.contact.phone||'').slice(0,80),location:String(out.contact.location||'').slice(0,160),links:(Array.isArray(out.contact.links)?out.contact.links:[]).slice(0,20).map(x=>({label:String(x.label||'').slice(0,80),url:String(x.url||'').slice(0,500),hidden:x.hidden===true}))};
  if(JSON.stringify(out).length>250000) throw Object.assign(new Error('This resume is too large to save.'),{status:413});
  return out;
}
async function adminResumes(request,env) {
  const method=request.method.toUpperCase(), url=new URL(request.url), id=String(url.searchParams.get('id')||'').trim();
  let body={}; if(['POST','PUT','DELETE'].includes(method)){try{body=await request.json()}catch{return json({error:'Please send valid JSON.'},400)}}
  const resumeId=id||String(body.id||'').trim();
  if(method==='GET'){
    if(resumeId){const {rows}=await tursoQuery(env,'SELECT id,title,template,content,created_at,updated_at FROM resumes WHERE id=$1 LIMIT 1',[resumeId]);if(!rows[0])return json({error:'Resume not found.'},404);return json({...rows[0],content:normalizeResumeContent(parseStoredJson(rows[0].content,{}))});}
    const {rows}=await tursoQuery(env,'SELECT id,title,template,created_at,updated_at,job_id FROM resumes ORDER BY updated_at DESC,id DESC');return json(rows);
  }
  if(method==='POST'){
    let title=String(body.title||'Untitled Resume').trim().slice(0,160)||'Untitled Resume',template='us',content;
    if(body.action==='duplicate'){const {rows}=await tursoQuery(env,'SELECT title,template,content FROM resumes WHERE id=$1 LIMIT 1',[String(body.id||'')]);if(!rows[0])return json({error:'Resume not found.'},404);title=String(body.title||('Copy of '+rows[0].title)).slice(0,160);template=rows[0].template||'us';content=normalizeResumeContent(parseStoredJson(rows[0].content,{}));}
    else {const {rows}=await tursoQuery(env,'SELECT profile_json FROM master_profile WHERE id=1 LIMIT 1');let profile={};try{profile=JSON.parse(rows[0]?.profile_json||'{}')}catch{}content=normalizeResumeContent(resumeSnapshotFromMaster(profile));}
    const created=await tursoQuery(env,'INSERT INTO resumes (title,template,content,created_at,updated_at) VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id',[title,template,JSON.stringify(content)]);const newId=created.rows[0]?.id;if(!newId)throw new Error('The resume could not be created.');
    await tursoQuery(env,'INSERT INTO resume_versions (resume_id,content,created_at) VALUES ($1,$2,CURRENT_TIMESTAMP)',[newId,JSON.stringify(content)]);
    const {rows}=await tursoQuery(env,'SELECT id,title,template,content,created_at,updated_at FROM resumes WHERE id=$1 LIMIT 1',[newId]);return json({...rows[0],content:normalizeResumeContent(parseStoredJson(rows[0].content,{}))},201);
  }
  if(method==='PUT'){
    if(!resumeId)return json({error:'Resume ID is required.'},400);const {rows:existing}=await tursoQuery(env,'SELECT id FROM resumes WHERE id=$1 LIMIT 1',[resumeId]);if(!existing[0])return json({error:'Resume not found.'},404);
    const content=normalizeResumeContent(body.content);const title=String(body.title||'Untitled Resume').trim().slice(0,160)||'Untitled Resume';
    await tursoQuery(env,'INSERT INTO resume_versions (resume_id,content,created_at) SELECT id,content,CURRENT_TIMESTAMP FROM resumes WHERE id=$1',[resumeId]);
    await tursoQuery(env,'DELETE FROM resume_versions WHERE resume_id=$1 AND id NOT IN (SELECT id FROM resume_versions WHERE resume_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20)',[resumeId,resumeId]);
    await tursoQuery(env,'UPDATE resumes SET title=$1,template=$2,content=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$4',[title,'us',JSON.stringify(content),resumeId]);
    const {rows}=await tursoQuery(env,'SELECT id,title,template,content,created_at,updated_at FROM resumes WHERE id=$1 LIMIT 1',[resumeId]);return json({...rows[0],content:normalizeResumeContent(parseStoredJson(rows[0].content,{}))});
  }
  if(method==='DELETE'){if(!resumeId)return json({error:'Resume ID is required.'},400);await tursoQuery(env,'DELETE FROM cover_letters WHERE resume_id=$1',[resumeId]);await tursoQuery(env,'DELETE FROM resume_versions WHERE resume_id=$1',[resumeId]);const {rows}=await tursoQuery(env,'DELETE FROM resumes WHERE id=$1 RETURNING id',[resumeId]);if(!rows.length)return json({error:'Resume not found.'},404);return json({ok:true,id:resumeId});}
  return json({error:'Method not allowed.'},405);
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
  const disposition = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline';
  headers.set('content-disposition', disposition + '; filename="' + asciiName + '.pdf"; filename*=UTF-8\'\'' + encodeURIComponent(displayName + '.pdf'));
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

const RESUME_STUDIO_ALLOWED_ORIGINS = new Set([
  'https://alan-odogwuideh-ux-5at3.hatchable.site',
  'https://alanodogwuideh.com',
  'https://www.alanodogwuideh.com',
  'https://0e09631b.alanodogwuideh.pages.dev'
]);
function resumeStudioCors(response, request) {
  const origin = request.headers.get('Origin') || '';
  if (!RESUME_STUDIO_ALLOWED_ORIGINS.has(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  headers.append('Vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function handleCloudflareApi(request, env) {
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const method = request.method.toUpperCase();

  if (route === 'admin-resume-studio' && method === 'OPTIONS') {
    const origin = request.headers.get('Origin') || '';
    if (!RESUME_STUDIO_ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origin is not allowed.' }, 403);
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin'
    }});
  }

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
      'admin-session','admin-settings','admin-resume-profile','admin-resumes','admin-resume-studio','admin-trash','admin-upload'
    ]);
    if (protectedRoutes.has(route)) {
      if (route !== 'admin-login') {
        const auth = await requireSupabaseAdmin(request, env);
        if (!auth.ok) return route === 'admin-resume-studio' ? resumeStudioCors(json({ error: auth.error }, auth.status), request) : json({ error: auth.error }, auth.status);
        if (route === 'admin-projects') return await adminProjects(request, env, auth);
        if (route === 'admin-case-study') return await adminCaseStudy(request, env, auth);
        if (route === 'admin-settings') return await adminSettings(request, env);
        if (route === 'admin-resume-profile') return await adminResumeProfile(request, env);
        if (route === 'admin-resumes') return await adminResumes(request, env);
        if (route === 'admin-resume-studio') return resumeStudioCors(await adminResumeStudio(request, env), request);
        // Other Resume Studio routes will be added in their approved phases.
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
    const message = String(error?.message || 'Unknown error');
    console.error('Cloudflare route error:', route, message, error?.stack || '');
    // Resume Studio runs authenticated and has no user-supplied secrets in its
    // errors; return a bounded diagnostic so failures can be fixed instead of
    // masking every database, binding, or storage issue as the same 502.
    if (route === 'admin-resume-studio') {
      return resumeStudioCors(json({ error: 'Resume Studio request failed before it could complete.', diagnostic: message.slice(0, 300), route, method }, 502), request);
    }
    return json({ error: 'Portfolio data is temporarily unavailable.' }, 502);
  }
}
