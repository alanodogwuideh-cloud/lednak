import { supabase } from '../lib/supabase.js';

export const access = 'public';
export const methods = ['GET'];

export default async function(req,res){
  try {
    const [settingsRows, studies] = await Promise.all([
      supabase('portfolio_settings?select=*&limit=1'),
      supabase('case_studies?select=id,slug,title,subtitle,description,role,year,duration,category,cover_image_url,hero_image_url,status,sort_order&status=eq.published&order=sort_order.asc,created_at.asc'),
    ]);

    const s = settingsRows[0] || null;
    const settings = s ? {
      site_name: s.site_name || 'Alan Odogwuideh',
      role: s.role || 'UX Designer',
      intro: s.intro || '',
      about_text: s.about_text || '',
      location: s.location || 'Abuja, Nigeria',
      linkedin_url: s.linkedin_url || '',
      email: s.email || '',
      about_image_url: s.about_image_url || '',
    } : null;

    const projects = studies.map(p => ({
      ...p,
      short_description: p.subtitle || p.description || '',
      featured: true,
      published: p.status === 'published',
      display_order: p.sort_order,
      status: p.status,
    }));

    res.json({ settings, projects });
  } catch (error) {
    console.error('portfolio error', error.message);
    res.status(502).json({ error: 'Portfolio data is temporarily unavailable.' });
  }
}