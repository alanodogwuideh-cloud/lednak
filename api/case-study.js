import { supabase } from '../lib/supabase.js';

export const access = 'public';
export const methods = ['GET'];

export default async function(req,res){
  const slug=req.query?.slug || req.params?.slug;
  if(!slug)return res.status(400).json({error:'Missing slug'});

  try {
    const projects = await supabase(`projects?select=*&slug=eq.${encodeURIComponent(slug)}&published=eq.true&limit=1`);
    const project = projects[0];
    if(!project)return res.status(404).json({error:'Case study not found'});

    const [sections, images] = await Promise.all([
      supabase(`case_study_sections?select=*&project_id=eq.${project.id}&order=display_order.asc`),
      supabase(`project_images?select=*&project_id=eq.${project.id}&order=display_order.asc`),
    ]);

    const sectionBlocks = sections.map(section => {
      const sectionImages = images.filter(image => image.section_id === section.id);
      const metadata = section.metadata || {};
      const type = section.section_type || 'content';

      if(type === 'gallery' || sectionImages.length) {
        return {
          type: 'gallery',
          title: section.title || '',
          images: sectionImages.map(image => ({ url: image.image_url, caption: image.caption || '', alt: image.alt_text || '' })),
        };
      }

      if(type === 'list') {
        return { type: 'list', title: section.title || '', items: Array.isArray(metadata.items) ? metadata.items : [] };
      }

      return { type: 'text', title: section.title || '', text: section.body || '' };
    });

    res.json({
      id: project.id,
      slug: project.slug,
      title: project.title,
      subtitle: project.short_description || '',
      description: project.overview || project.short_description || '',
      category: project.category || 'UX / Product Design',
      year: project.year || '',
      role: project.role || 'UX Designer',
      duration: project.duration || '',
      cover_image_url: project.cover_image_url || '',
      hero_image_url: project.hero_image_url || '',
      content: { sections: sectionBlocks },
      images,
    });
  } catch (error) {
    console.error('case study error', error.message);
    res.status(502).json({ error: 'Case study data is temporarily unavailable.' });
  }
}