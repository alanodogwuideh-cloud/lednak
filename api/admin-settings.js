import { supabaseAdmin, uploadStorageObject, deleteStorageObject, storagePathFromPublicUrl } from 'lib/supabase-admin';
import crypto from 'node:crypto';

// Owner-only CMS endpoint. Edge auth avoids the Supabase Auth server dependency.
export const access = 'admin';
export const methods = ['GET', 'PUT', 'POST', 'DELETE'];

const BUCKET = 'portfolio-images';
const safeName = n => String(n || 'file').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160);

const SETTING_KEYS = ['site_name', 'headline', 'location', 'email', 'linkedin_url', 'profile_image_url', 'bio', 'availability', 'favicon_url'];

async function getSettings() {
  const rows = await supabaseAdmin('site_settings?select=setting_key,setting_value,updated_at&order=setting_key.asc');
  return rows || [];
}

function settingsObject(rows) {
  const out = {};
  for (const row of rows || []) out[row.setting_key] = row.setting_value || '';
  return out;
}

async function setSetting(settingKey, value) {
  const existing = await supabaseAdmin(`site_settings?setting_key=eq.${encodeURIComponent(settingKey)}&select=id&limit=1`);
  const payload = { setting_value: String(value ?? ''), updated_at: new Date().toISOString() };
  if (existing?.[0]) {
    const rows = await supabaseAdmin(`site_settings?setting_key=eq.${encodeURIComponent(settingKey)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload),
    });
    return rows?.[0] || null;
  }
  const rows = await supabaseAdmin('site_settings', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ setting_key: settingKey, ...payload }),
  });
  return rows?.[0] || null;
}

async function deleteOldPublicAsset(url) {
  const path = storagePathFromPublicUrl(url, BUCKET);
  if (path) await deleteStorageObject(BUCKET, path).catch(() => {});
}

export default async function (req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await getSettings();
      const values = settingsObject(rows);
      const faviconRow = rows.find(x => x.setting_key === 'favicon_url');
      const latest = rows.reduce((a, b) => String(a?.updated_at || '') > String(b?.updated_at || '') ? a : b, null);
      return res.json({
        ...values,
        name: values.site_name || '',
        headline: values.headline || '',
        profile_image_url: values.profile_image_url || '',
        favicon_url: values.favicon_url || '',
        favicon_updated_at: faviconRow?.updated_at || latest?.updated_at || '',
      });
    }

    if (req.method === 'POST') {
      const kind = String(req.body?.kind || 'about');
      const file = req.files?.find(x => x.field === 'file') || req.files?.[0];
      if (!file || !String(file.contentType || '').startsWith('image/')) return res.status(400).json({ error: 'Please choose an image file.' });
      if (file.buffer.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Image is too large. Maximum size is 5 MB.' });

      if (kind === 'favicon') {
        const allowed = new Set(['image/png', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/webp']);
        if (!allowed.has(String(file.contentType))) return res.status(415).json({ error: 'Favicon must be PNG, SVG, ICO, or WebP.' });
        const uploadedBuffer = Buffer.from(file.buffer);
        const base64 = uploadedBuffer.toString('base64');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><clipPath id="circle"><circle cx="32" cy="32" r="32"/></clipPath></defs><image href="data:${String(file.contentType)};base64,${base64}" x="0" y="0" width="64" height="64" preserveAspectRatio="xMidYMid slice" clip-path="url(#circle)"/></svg>`;
        const path = `site/favicon/${Date.now()}-${crypto.randomUUID()}.svg`;
        const rows = await getSettings();
        const oldUrl = rows.find(x => x.setting_key === 'favicon_url')?.setting_value || '';
        const url = await uploadStorageObject(BUCKET, path, Buffer.from(svg, 'utf8'), 'image/svg+xml');
        await setSetting('favicon_url', url);
        await deleteOldPublicAsset(oldUrl);
        return res.json({ url: '/api/favicon?v=' + Date.now(), storage_url: url, saved: true });
      }

      const rows = await getSettings();
      const oldUrl = rows.find(x => x.setting_key === 'profile_image_url')?.setting_value || '';
      const path = `site/profile/${Date.now()}-${crypto.randomUUID()}-${safeName(file.filename || 'profile.jpg')}`;
      const url = await uploadStorageObject(BUCKET, path, file.buffer, file.contentType || 'image/jpeg');
      await setSetting('profile_image_url', url);
      await deleteOldPublicAsset(oldUrl);
      return res.json({ url, key: path, saved: true });
    }

    if (req.method === 'DELETE') {
      const rows = await getSettings();
      const oldUrl = rows.find(x => x.setting_key === 'favicon_url')?.setting_value || '';
      await setSetting('favicon_url', '');
      await deleteOldPublicAsset(oldUrl);
      return res.json({ ok: true });
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      const values = {
        site_name: body.name ?? body.site_name ?? '',
        headline: body.headline ?? body.intro ?? '',
        location: body.location ?? '',
        email: body.email ?? '',
        linkedin_url: body.linkedin_url ?? '',
        profile_image_url: body.profile_image_url ?? '',
        bio: body.bio ?? body.about_text ?? '',
        availability: body.availability ?? '',
      };
      const rows = await getSettings();
      const existingProfileUrl = rows.find(x => x.setting_key === 'profile_image_url')?.setting_value || '';
      if (String(values.profile_image_url).includes('/api/about-image')) values.profile_image_url = existingProfileUrl;
      for (const key of Object.keys(values)) await setSetting(key, values[key]);
      const fresh = settingsObject(await getSettings());
      return res.json({ ...fresh, name: fresh.site_name || '', headline: fresh.headline || '', profile_image_url: fresh.profile_image_url || '' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('admin-settings error', error.message);
    return res.status(500).json({ error: error.message || 'Site content operation failed.' });
  }
}