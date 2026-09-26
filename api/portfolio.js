import { tursoQuery } from 'lib/turso';

export const access = 'public';
export const methods = ['GET'];

export default async function (req, res) {
  try {
    const [settingsResult, projectResult] = await Promise.all([
      tursoQuery('SELECT site_name,role,intro,about_text,location,linkedin_url,email,about_image_url FROM portfolio_settings LIMIT 1'),
      tursoQuery(`SELECT id,title,slug,subtitle,description,role,year,duration,category,cover_image_url,hero_image_url,status,sort_order,updated_at FROM case_studies WHERE status = ? ORDER BY sort_order ASC, created_at ASC`, ['published']),
    ]);
    const projects = projectResult?.rows || [];
    const settings = settingsResult?.rows?.[0] || {};

    const faviconResult = await tursoQuery('SELECT favicon_key,updated_at FROM site_branding LIMIT 1');
    const branding = faviconResult?.rows?.[0] || {};
    const faviconKey = branding.favicon_key || '';

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
        favicon_url: faviconKey ? '/api/favicon' : '',
        favicon_updated_at: branding.updated_at || '',
      },
      projects: (projects || []).map(p => ({
        ...p,
        short_description: p.short_description || p.overview || '',
        status: p.status || 'draft',
        sort_order: Number(p.sort_order || 0),
      })),
    });
  } catch (error) {
    console.error('portfolio error', error.message);
    return res.status(502).json({ error: 'Portfolio data is temporarily unavailable.' });
  }
}