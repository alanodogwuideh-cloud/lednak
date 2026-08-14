import { supabase } from '../lib/supabase.js';

export const access = 'public';
export const methods = ['GET'];

export default async function(req,res){
  const slug=req.query?.slug || req.params?.slug;
  if(!slug)return res.status(400).json({error:'Missing slug'});

  try {
    const studies = await supabase(`case_studies?select=*&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`);
    const study = studies[0];
    if(!study)return res.status(404).json({error:'Case study not found'});

    res.json({
      id: study.id,
      slug: study.slug,
      title: study.title,
      subtitle: study.subtitle || '',
      description: study.description || study.subtitle || '',
      category: study.category || 'UX / Product Design',
      year: study.year || '',
      role: study.role || 'UX Designer',
      duration: study.duration || '',
      cover_image_url: study.cover_image_url || '',
      hero_image_url: study.hero_image_url || '',
      content: study.content || { sections: [] },
    });
  } catch (error) {
    console.error('case study error', error.message);
    res.status(502).json({ error: 'Case study data is temporarily unavailable.' });
  }
}