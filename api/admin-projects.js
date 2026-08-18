import { requireSupabaseAdmin } from 'lib/admin-auth';
import { supabaseRequest, storageDeleteByUrl } from 'lib/supabase-admin';
export const access='public';
export const methods=['GET','POST','PUT','DELETE'];

function map(p){return {...p,short_description:p.short_description||'',overview:p.overview||'',status:p.published?'published':'draft',sort_order:Number(p.display_order||0)}}

export default async function(req,res){
  try{
    const a=await requireSupabaseAdmin(req);if(!a.ok)return res.status(a.status).json({error:a.error});
    if(req.method==='GET'){
      const rows=await supabaseRequest('projects?select=*&order=display_order.asc,created_at.asc');
      return res.json((rows||[]).map(map));
    }
    const b=req.body||{};
    if(req.method==='POST'){
      if(!b.title||!b.slug)return res.status(400).json({error:'Title and slug are required.'});
      const rows=await supabaseRequest('projects?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:{title:b.title,slug:b.slug,short_description:b.short_description||'',overview:b.overview||'',role:b.role||'',client:b.client||'',year:b.year||'',duration:b.duration||'',category:b.category||'',cover_image_url:'',hero_image_url:'',featured:false,published:b.status==='published',display_order:Number(b.sort_order)||0}});
      return res.status(201).json(map(rows[0]));
    }
    if(!b.id)return res.status(400).json({error:'Missing case study id.'});
    if(req.method==='PUT'){
      const rows=await supabaseRequest('projects?id=eq.'+encodeURIComponent(b.id)+'&select=*',{method:'PATCH',headers:{Prefer:'return=representation'},body:{...(b.title!==undefined?{title:b.title}:{}),...(b.slug!==undefined?{slug:b.slug}:{}),...(b.short_description!==undefined?{short_description:b.short_description}:{}),...(b.overview!==undefined?{overview:b.overview}:{}),...(b.role!==undefined?{role:b.role}:{}),...(b.client!==undefined?{client:b.client}:{}),...(b.year!==undefined?{year:b.year}:{}),...(b.duration!==undefined?{duration:b.duration}:{}),...(b.category!==undefined?{category:b.category}:{}),...(b.status!==undefined?{published:b.status==='published'}:{}),...(b.sort_order!==undefined?{display_order:Number(b.sort_order)||0}:{}),updated_at:new Date().toISOString()}});
      if(!rows?.[0])return res.status(404).json({error:'Case study not found.'});
      return res.json(map(rows[0]));
    }
    if(req.method==='DELETE'){
      const existing=await supabaseRequest('projects?id=eq.'+encodeURIComponent(b.id)+'&select=id,slug,cover_image_url,hero_image_url');
      if(!existing?.[0])return res.status(404).json({error:'Case study not found.'});
      const media=await supabaseRequest('project_images?project_id=eq.'+encodeURIComponent(b.id)+'&select=image_url');
      // Remove child records first so the foreign-key relationship cannot block deletion.
      await supabaseRequest('project_images?project_id=eq.'+encodeURIComponent(b.id),{method:'DELETE'});
      await supabaseRequest('case_study_sections?project_id=eq.'+encodeURIComponent(b.id),{method:'DELETE'});
      await supabaseRequest('projects?id=eq.'+encodeURIComponent(b.id),{method:'DELETE'});
      await Promise.all([...(media||[]).map(x=>storageDeleteByUrl(x.image_url)),storageDeleteByUrl(existing[0].cover_image_url),storageDeleteByUrl(existing[0].hero_image_url)]);
      return res.json({ok:true});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(e){return res.status(500).json({error:e.message||'Case study operation failed.'});}
}