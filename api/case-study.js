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

    const designSection = sections.find(section => /design\s*exploration/i.test(section.title || ''));
    const grouped = sections.map(section => {
      const sectionImages = images.filter(img => img.section_id === section.id);
      // Wireframes belong to the Design Exploration narrative, even if older
      // CMS records still have them attached to the process/storyboard section.
      const wireframes = designSection && designSection.id === section.id
        ? images.filter(img => img.image_type === 'wireframes')
        : [];
      const filtered = sectionImages.filter(img => img.image_type !== 'wireframes');
      return {
        ...section,
        images: [...filtered, ...wireframes].sort((a,b) => (Number(a.display_order)||0) - (Number(b.display_order)||0)),
      };
    });

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