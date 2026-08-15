import { supabase } from '../lib/supabase.js';
import { db, storage } from 'hatchable';

export const access = 'public';
export const methods = ['GET'];

export default async function(req,res){
  try {
    const [aboutRows, projects, branding] = await Promise.all([
      supabase('about?select=*&limit=1'),
      supabase('projects?select=id,title,slug,short_description,overview,role,client,year,duration,category,cover_image_url,hero_image_url,featured,published,display_order&published=eq.true&order=display_order.asc,created_at.asc'),
      db.query('SELECT favicon_key, updated_at FROM site_branding ORDER BY updated_at DESC LIMIT 1'),
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
      favicon_url: branding.rows[0]?.favicon_key ? '/api/favicon' : '',
      favicon_updated_at: branding.rows[0]?.updated_at || '',
    } : { favicon_url: branding.rows[0]?.favicon_key ? '/api/favicon' : '' };

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