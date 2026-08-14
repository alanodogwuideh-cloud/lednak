import { supabase } from '../lib/supabase.js';

export const access = 'public';
export const methods = ['GET'];

export default async function(req,res){
  const slug=req.query?.slug || req.params?.slug;
  if(!slug)return res.status(400).json({error:'Missing slug'});

  try {
    const projects = await supabase(`projects?select=*&slug=eq.${encodeURIComponent(slug)}&published=eq.true&limit=1`);
    const study = projects[0];
    if(!study)return res.status(404).json({error:'Case study not found'});

    const [sections, images] = await Promise.all([
      supabase(`case_study_sections?select=*&project_id=eq.${study.id}&order=display_order.asc`),
      supabase(`project_images?select=*&project_id=eq.${study.id}&order=display_order.asc`),
    ]);

    const grouped = sections.map(section => ({
      ...section,
      images: images.filter(img => img.section_id === section.id),
    }));

    res.json({
      id: study.id,
      slug: study.slug,
      title: study.title,
      subtitle: study.short_description || '',
      description: study.overview || study.short_description || '',
      category: study.category || 'UX / Product Design',
      year: study.year || '',
      role: study.role || 'UX Designer',
      duration: study.duration || '',
      cover_image_url: study.cover_image_url || '',
      hero_image_url: study.hero_image_url || '',
      content: { sections: grouped },
    });
  } catch (error) {
    console.error('case study error', error.message);
    res.status(502).json({ error: 'Case study data is temporarily unavailable.' });
  }
}