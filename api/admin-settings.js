import { tursoQuery } from 'lib/turso';
import { r2PublicUrl, r2KeyFromPublicUrl, uploadR2Object, deleteR2Object } from 'lib/r2';
import { requireSupabaseAdmin } from 'lib/admin-auth';

// Owner-only CMS endpoint. Authentication remains on the existing admin session
// while content and media are migrated away from Supabase.
export const access = 'public';
export const methods = ['GET', 'PUT', 'POST', 'DELETE'];

const SETTING_KEYS = ['site_name', 'headline', 'location', 'email', 'linkedin_url', 'profile_image_url', 'bio', 'availability'];
const safeName = n => String(n || 'file').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160);
let brandingSchemaReady;
async function ensureResumeColumn(){if(!brandingSchemaReady)brandingSchemaReady=(async()=>{for(const sql of ['ALTER TABLE site_branding ADD COLUMN resume_key TEXT','ALTER TABLE site_branding ADD COLUMN resume_display_name TEXT']){try{await tursoQuery(sql)}catch(e){if(!/duplicate column|already exists/i.test(e.message||''))throw e}}})();return brandingSchemaReady;}

async function getSettings() {
  const { rows } = await tursoQuery(`SELECT * FROM portfolio_settings LIMIT 1`);
  const { rows: brandingRows } = await tursoQuery(`SELECT * FROM site_branding LIMIT 1`);
  return { settings: rows?.[0] || null, branding: brandingRows?.[0] || null };
}

function settingsObject(data) {
  const row = data?.settings || {};
  const branding = data?.branding || {};
  const faviconKey = String(branding.favicon_key || '');
  const resumeKey = String(branding.resume_key || '');
  const resumeDisplayName = String(branding.resume_display_name || '');
  return {
    site_name: row.site_name || '',
    headline: row.intro || '',
    role: row.role || 'UX Designer',
    location: row.location || '',
    email: row.email || '',
    linkedin_url: row.linkedin_url || '',
    profile_image_url: row.about_image_url || '',
    bio: row.about_text || '',
    availability: '',
    favicon_url: faviconKey.startsWith('http') ? faviconKey : (faviconKey.startsWith('site/') ? r2PublicUrl(faviconKey) : ''),
    favicon_updated_at: branding.updated_at || '',
    resume_url: resumeKey ? (resumeKey.startsWith('http') ? resumeKey : r2PublicUrl(resumeKey)) : '',
    resume_key: resumeKey,
    resume_display_name: resumeDisplayName,
  };
}

async function setSettings(values) {
  const current = await getSettings();
  const row = current.settings;
  const id = row?.id || '1';
  const payload = {
    site_name: String(values.site_name ?? row?.site_name ?? ''),
    role: String(values.role ?? row?.role ?? 'UX Designer'),
    intro: String(values.headline ?? row?.intro ?? ''),
    location: String(values.location ?? row?.location ?? ''),
    email: String(values.email ?? row?.email ?? ''),
    linkedin_url: String(values.linkedin_url ?? row?.linkedin_url ?? ''),
    about_text: String(values.bio ?? row?.about_text ?? ''),
    about_image_url: String(values.profile_image_url ?? row?.about_image_url ?? ''),
  };
  if (row) {
    const { rows } = await tursoQuery(`UPDATE portfolio_settings SET site_name=$1, role=$2, intro=$3, location=$4, email=$5, linkedin_url=$6, about_text=$7, about_image_url=$8, updated_at=NOW() WHERE id=$9 RETURNING *`, [payload.site_name,payload.role,payload.intro,payload.location,payload.email,payload.linkedin_url,payload.about_text,payload.about_image_url,id]);
    return rows?.[0] || payload;
  }
  const { rows } = await tursoQuery(`INSERT INTO portfolio_settings (id,site_name,role,intro,location,email,linkedin_url,about_text,about_image_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [id,payload.site_name,payload.role,payload.intro,payload.location,payload.email,payload.linkedin_url,payload.about_text,payload.about_image_url]);
  return rows?.[0] || payload;
}

async function setFaviconKey(key) {
  const current = await getSettings();
  const row = current.branding;
  const id = row?.id || '1';
  if (row) {
    const { rows } = await tursoQuery(`UPDATE site_branding SET favicon_key=$1, updated_at=NOW() WHERE id=$2 RETURNING *`, [String(key || ''), id]);
    return rows?.[0] || { id, favicon_key: key || '' };
  }
  const { rows } = await tursoQuery(`INSERT INTO site_branding (id,favicon_key) VALUES ($1,$2) RETURNING *`, [id, String(key || '')]);
  return rows?.[0] || { id, favicon_key: key || '' };
}

async function deleteR2Asset(url) {
  const key = r2KeyFromPublicUrl(url);
  if (key) await deleteR2Object(key).catch(() => {});
}

export default async function (req, res) {
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  try {
    if (req.method === 'GET') {
      await ensureResumeColumn();
      const data = await getSettings();
      return res.json(settingsObject(data));
    }

    if (req.method === 'POST') {
      const kind = String(req.body?.kind || 'about');
      const file = req.files?.find(x => x.field === 'file') || req.files?.[0];
      if (kind === 'resume') {
        await ensureResumeColumn();
        if (!file || (file.contentType !== 'application/pdf' && !String(file.filename || '').toLowerCase().endsWith('.pdf'))) return res.status(415).json({ error: 'Please choose a PDF resume.' });
        if (file.buffer.length > 15 * 1024 * 1024) return res.status(413).json({ error: 'PDF is too large. Maximum size is 15 MB.' });
        const current = await getSettings();
        const oldKey = String(current.branding?.resume_key || '');
        const displayName = String(req.body?.display_name || '').trim().slice(0,100) || String(file.filename || 'My Resume').replace(/\.pdf$/i,'').trim() || 'My Resume';
        const key = `site/resume/${safeName(displayName.replace(/\.pdf$/i,''))}-${Date.now()}-${crypto.randomUUID().slice(0,8)}.pdf`;
        await uploadR2Object(key, file.buffer, 'application/pdf');
        const row = current.branding; const rowId = row?.id || '1';
        if (row) await tursoQuery('UPDATE site_branding SET resume_key=$1, resume_display_name=$2, updated_at=NOW() WHERE id=$3', [key,displayName,rowId]);
        else await tursoQuery('INSERT INTO site_branding (id,favicon_key,resume_key,resume_display_name) VALUES ($1,$2,$3,$4)', [rowId,'',key,displayName]);
        if (oldKey && !oldKey.startsWith('http')) await deleteR2Object(oldKey).catch(()=>{});
        return res.json({ url:r2PublicUrl(key), key, saved:true });
      }
      if (!file || !String(file.contentType || '').startsWith('image/')) return res.status(400).json({ error: 'Please choose an image file.' });
      if (file.buffer.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Image is too large. Maximum size is 5 MB.' });

      if (kind === 'favicon') {
        const allowed = new Set(['image/png', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/webp']);
        if (!allowed.has(String(file.contentType))) return res.status(415).json({ error: 'Favicon must be PNG, SVG, ICO, or WebP.' });
        const ext = String(file.filename || '').split('.').pop().replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'svg';
        const key = `site/favicon/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const current = await getSettings();
        const oldKey = String(current.branding?.favicon_key || '');
        await uploadR2Object(key, file.buffer, file.contentType);
        await setFaviconKey(key);
        if (oldKey && !oldKey.startsWith('http')) await deleteR2Object(oldKey).catch(() => {});
        return res.json({ url: r2PublicUrl(key), key, saved: true });
      }

      const current = await getSettings();
      const oldUrl = String(current.settings?.about_image_url || '');
      const key = `site/profile/${Date.now()}-${crypto.randomUUID()}-${safeName(file.filename || 'profile.jpg')}`;
      const url = await uploadR2Object(key, file.buffer, file.contentType || 'image/jpeg');
      await setSettings({ profile_image_url: url });
      // Never delete a resume or unrelated R2 object if legacy data accidentally points the profile field at it.
      if (oldUrl && !/\.pdf(?:$|[?#])/i.test(oldUrl)) await deleteR2Asset(oldUrl);
      return res.json({ url, key, saved: true });
    }

    if (req.method === 'DELETE') {
      if (String(req.body?.kind || '') === 'resume') {
        await ensureResumeColumn();
        const current = await getSettings();
        const oldKey = String(current.branding?.resume_key || '');
        if (current.branding) await tursoQuery('UPDATE site_branding SET resume_key=NULL, resume_display_name=NULL, updated_at=NOW() WHERE id=$1', [current.branding.id || '1']);
        if (oldKey && !oldKey.startsWith('http')) await deleteR2Object(oldKey).catch(()=>{});
        return res.json({ ok:true });
      }
      const current = await getSettings();
      const oldKey = String(current.branding?.favicon_key || '');
      await setFaviconKey('');
      if (oldKey && !oldKey.startsWith('http')) await deleteR2Object(oldKey).catch(() => {});
      return res.json({ ok: true });
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      const current = settingsObject(await getSettings());
      const values = {
        headline: body.headline ?? body.intro ?? current.headline,
        role: body.role ?? current.role ?? 'UX Designer',
        site_name: body.name ?? body.site_name ?? current.site_name,
        location: body.location ?? current.location,
        email: body.email ?? current.email,
        linkedin_url: body.linkedin_url ?? current.linkedin_url,
        profile_image_url: body.profile_image_url ?? current.profile_image_url,
        bio: body.bio ?? body.about_text ?? current.bio,
      };
      if (String(values.profile_image_url).includes('/api/about-image')) values.profile_image_url = current.profile_image_url;
      await setSettings(values);
      return res.json(settingsObject(await getSettings()));
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('admin-settings error', error.message);
    return res.status(500).json({ error: error.message || 'Site content operation failed.' });
  }
}