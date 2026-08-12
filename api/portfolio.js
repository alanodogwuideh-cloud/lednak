import { supabase } from '../lib/supabase.js';

export const access = 'public';
export const methods = ['GET'];

export default async function(req,res){
  try {
    const [settingsRows, projects] = await Promise.all([
      supabase('about?select=*&limit=1'),
      supabase('projects?select=id,slug,title,short_description,role,year,duration,category,cover_image_url,hero_image_url,featured,published,display_order&published=eq.true&order=display_order.asc'),
    ]);

    const about = settingsRows[0] || null;
    const settings = about ? {
      site_name: about.name || 'Alan Odogwuideh',
      role: 'UX Designer',
      intro: about.headline || '',
      about_text: about.bio || '',
      location: about.location || 'Abuja, Nigeria',
      linkedin_url: about.linkedin_url || '',
      email: about.email || '',
      about_image_url: about.profile_image_url || '',
    } : null;

    const normalizedProjects = projects.map(p => ({
      ...p,
      subtitle: p.short_description || '',
      description: p.short_description || '',
      status: p.published ? 'published' : 'draft',
      sort_order: p.display_order,
    }));

    res.json({ settings, projects: normalizedProjects });
  } catch (error) {
    console.error('portfolio error', error.message);
    res.status(502).json({ error: 'Portfolio data is temporarily unavailable.' });
  }
}