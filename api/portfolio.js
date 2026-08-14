import { supabase } from '../lib/supabase.js';

export const access = 'public';
export const methods = ['GET'];

export default async function(req,res){
  try {
    const [aboutRows, projects] = await Promise.all([
      supabase('about?select=*&limit=1'),
      supabase('projects?select=id,title,slug,short_description,overview,role,client,year,duration,category,cover_image_url,hero_image_url,featured,published,display_order&published=eq.true&order=display_order.asc,created_at.asc'),
    ]);

    const a = aboutRows[0] || null;
    const settings = a ? {
      site_name: a.name || 'Alan Odogwuideh',
      role: 'UX Designer',
      intro: a.headline || '',
      about_text: a.bio || '',
      location: a.location || 'Abuja, Nigeria',
      linkedin_url: a.linkedin_url || '',
      email: a.email || '',
      about_image_url: a.profile_image_url || '',
    } : null;

    res.json({
      settings,
      projects: projects.map(p => ({
        ...p,
        short_description: p.short_description || p.overview || '',
        status: p.published ? 'published' : 'draft',
      })),
    });
  } catch (error) {
    console.error('portfolio error', error.message);
    res.status(502).json({ error: 'Portfolio data is temporarily unavailable.' });
  }
}