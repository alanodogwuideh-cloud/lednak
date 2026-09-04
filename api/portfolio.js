import { supabaseAdmin } from 'lib/supabase-admin';

export const access = 'public';
export const methods = ['GET'];

export default async function (req, res) {
  try {
    const [settingsRows, projects] = await Promise.all([
      supabaseAdmin('site_settings?select=setting_key,setting_value,updated_at&order=setting_key.asc'),
      supabaseAdmin('projects?select=id,title,slug,short_description,overview,role,client,year,duration,category,cover_image_url,hero_image_url,featured,published,display_order&published=eq.true&order=display_order.asc,created_at.asc'),
    ]);

    const values = {};
    for (const row of settingsRows || []) values[row.setting_key] = row.setting_value || '';
    const faviconRow = (settingsRows || []).find(row => row.setting_key === 'favicon_url');

    return res.json({
      settings: {
        site_name: values.site_name || 'Alan Odogwuideh',
        role: values.role || 'UX Designer',
        intro: values.headline || '',
        about_text: values.bio || '',
        location: values.location || 'Abuja, Nigeria',
        linkedin_url: values.linkedin_url || '',
        email: values.email || '',
        about_image_url: values.profile_image_url || '',
        favicon_url: values.favicon_url || '',
        favicon_updated_at: faviconRow?.updated_at || '',
      },
      projects: (projects || []).map(p => ({
        ...p,
        short_description: p.short_description || p.overview || '',
        status: p.published ? 'published' : 'draft',
        sort_order: Number(p.display_order || 0),
      })),
    });
  } catch (error) {
    console.error('portfolio error', error.message);
    return res.status(502).json({ error: 'Portfolio data is temporarily unavailable.' });
  }
}