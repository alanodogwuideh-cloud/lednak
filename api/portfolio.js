import { tursoQuery } from 'lib/turso';
import { r2PublicUrl, normalizeR2Url } from 'lib/r2';

export const access = 'public';
export const methods = ['GET'];

export default async function (req, res) {
  try {
    const [{ rows: settingsRows }, { rows: projectRows }, { rows: brandingRows }] = await Promise.all([
      tursoQuery(`SELECT * FROM portfolio_settings LIMIT 1`),
      tursoQuery(`SELECT id,title,slug,subtitle,description,role,year,duration,category,cover_image_url,hero_image_url,status,sort_order,updated_at FROM case_studies WHERE status = $1 ORDER BY sort_order ASC, created_at ASC`, ['published']),
      tursoQuery(`SELECT favicon_key,updated_at FROM site_branding LIMIT 1`),
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
        about_image_url: settings.about_image_url || '',
        favicon_url: faviconKey ? (faviconKey.startsWith('http') ? faviconKey : (faviconKey.startsWith('site/') ? r2PublicUrl(faviconKey) : '')) : '',
        favicon_updated_at: branding.updated_at || '',
      },
      projects: (projectRows || []).map(p => ({
        ...p,
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