import { tursoQuery, ensureTrashSchema } from 'lib/turso';
import { r2PublicUrl, normalizeR2Url } from 'lib/r2';

export const access = 'public';
export const methods = ['GET'];

export default async function (req, res) {
  try {
    await ensureTrashSchema();
    try { await tursoQuery('ALTER TABLE site_branding ADD COLUMN resume_key TEXT'); } catch (e) { if (!/duplicate column|already exists/i.test(e.message || '')) throw e; }
    const [{ rows: settingsRows }, { rows: projectRows }, { rows: brandingRows }] = await Promise.all([
      tursoQuery(`SELECT * FROM portfolio_settings LIMIT 1`),
      tursoQuery(`SELECT id,title,slug,subtitle,description,role,year,duration,category,content,cover_image_url,hero_image_url,status,sort_order,updated_at FROM case_studies WHERE status = $1 AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC`, ['published']),
      tursoQuery(`SELECT * FROM site_branding LIMIT 1`),
    ]);
    const settings = settingsRows?.[0] || {};
    const branding = brandingRows?.[0] || {};
    const faviconKey = String(branding.favicon_key || '');

    return res.json({
      settings: {
        site_name: settings.site_name || 'Alan Odogwuideh',
        role: settings.role || 'UX Designer',
        intro: settings.intro || '',
        about_text: settings.about_text || '',
        location: settings.location || 'Abuja, Nigeria',
        linkedin_url: settings.linkedin_url || '',
        email: settings.email || '',
        about_image_url: (() => { const imageUrl = String(settings.about_image_url || 'https://pub-05b8c3177ce444d385936988156c52c2.r2.dev/site/profile/1789656022670-0fbb5a1e-5d51-4d39-a286-0e226949f2ee-Alan.png'); return /\.pdf(?:$|[?#])/i.test(imageUrl) ? '' : imageUrl; })(),
        favicon_url: faviconKey ? (faviconKey.startsWith('http') ? faviconKey : (faviconKey.startsWith('site/') ? r2PublicUrl(faviconKey) : '')) : '',
        favicon_updated_at: branding.updated_at || '',
        resume_url: branding.resume_key ? (String(branding.resume_key).startsWith('http') ? branding.resume_key : r2PublicUrl(branding.resume_key)) : '',
        resume_display_name: branding.resume_display_name || 'My Resume',
      },
      projects: (projectRows || []).map(p => ({
        ...p,
        display_category: (() => { let c=p?.content; if(typeof c==='string'){try{c=JSON.parse(c)}catch{c={}}} const v=String(c?.case_meta?.display_category||'').toLowerCase(); return ['mobile','web','both'].includes(v)?v:'all' })(),
        cover_image_url: normalizeR2Url(p.cover_image_url || ''),
        hero_image_url: normalizeR2Url(p.hero_image_url || ''),
        short_description: p.short_description || p.description || '',
        status: p.status || 'draft',
        sort_order: Number(p.sort_order || 0),
      })),
    });
  } catch (error) {
    console.error('portfolio error', error.message);
    return res.status(502).json({ error: 'Portfolio data is temporarily unavailable.' });
  }
}