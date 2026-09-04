import { requireSupabaseAdmin } from 'lib/admin-auth';
import { supabaseRequest } from 'lib/supabase-admin';
export const access='public';
export const methods=['GET','POST','PUT','DELETE'];

function normalizeMetadata(value){return value&&typeof value==='object'&&!Array.isArray(value)?{...value}:{}}
function fromRow(row){
  const metadata=normalizeMetadata(row.metadata);
  return {...row,metadata,items:Array.isArray(metadata.items)?metadata.items:[],item_display:metadata.item_display||'',quote_text:metadata.quote_text||'',quote_author:metadata.quote_author||'',text:row.body||'',type:row.section_type||'content'};
}
async function getProject(id){const rows=await supabaseRequest('projects?id=eq.'+encodeURIComponent(id)+'&select=*');return rows?.[0]||null}
async function getSections(id){const rows=await supabaseRequest('case_study_sections?project_id=eq.'+encodeURIComponent(id)+'&select=*&order=display_order.asc,created_at.asc');return (rows||[]).map(fromRow)}
async function getImages(id){return await supabaseRequest('project_images?project_id=eq.'+encodeURIComponent(id)+'&select=*&order=display_order.asc,created_at.asc')||[]}
function payloadForSection(s,index){
  const metadata=normalizeMetadata(s.metadata);
  if(Array.isArray(s.items))metadata.items=s.items; else delete metadata.items;
  if(s.item_display!==undefined)metadata.item_display=s.item_display; else delete metadata.item_display;
  if(s.quote_text!==undefined)metadata.quote_text=s.quote_text; else if(s.section_type!=='quote'&&s.type!=='quote')delete metadata.quote_text;
  if(s.quote_author!==undefined)metadata.quote_author=s.quote_author; else if(s.section_type!=='quote'&&s.type!=='quote')delete metadata.quote_author;
  if(s.metadata?.quote_font_size!==undefined)metadata.quote_font_size=s.metadata.quote_font_size;
  if(s.metadata?.metric_font_size!==undefined)metadata.metric_font_size=s.metadata.metric_font_size;
  return {section_type:s.section_type||s.type||'content',title:s.title??'',body:s.body??s.text??'',metadata,display_order:index+1,updated_at:new Date().toISOString()};
}

export default async function(req,res){
  try{
    const a=await requireSupabaseAdmin(req);if(!a.ok)return res.status(a.status).json({error:a.error});
    const q=req.query||{},b=req.body||{},projectId=q.project_id||b.project_id;
    if(!projectId)return res.status(400).json({error:'Missing project_id.'});
    const project=await getProject(projectId);if(!project)return res.status(404).json({error:'Case study not found.'});
    if(req.method==='GET')return res.json({project,sections:await getSections(projectId),images:await getImages(projectId)});

    if(req.method==='POST'){
      const rows=await supabaseRequest('case_study_sections?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:payloadForSection(b,Number(b.display_order||0))});
      return res.status(201).json(fromRow(rows[0]));
    }

    if(req.method==='PUT'){
      if(b.replace_all===true&&Array.isArray(b.sections)){
        const existing=await getSections(projectId);
        const incomingIds=new Set(b.sections.map(s=>String(s.id||s._id||'')).filter(Boolean));
        for(const old of existing){if(!incomingIds.has(String(old.id))){await supabaseRequest('project_images?section_id=eq.'+encodeURIComponent(old.id),{method:'DELETE'});await supabaseRequest('case_study_sections?id=eq.'+encodeURIComponent(old.id),{method:'DELETE'});}}
        for(let i=0;i<b.sections.length;i++){
          const s=b.sections[i],id=s.id||s._id;
          const payload=payloadForSection(s,i);
          if(id&&existing.some(x=>String(x.id)===String(id))){await supabaseRequest('case_study_sections?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:payload});}
          else {await supabaseRequest('case_study_sections?select=id',{method:'POST',headers:{Prefer:'return=minimal'},body:{...payload,project_id:projectId}});}
        }
        return res.json({project,sections:await getSections(projectId),images:await getImages(projectId)});
      }
      if(!b.id)return res.status(400).json({error:'Missing section id.'});
      const rows=await supabaseRequest('case_study_sections?id=eq.'+encodeURIComponent(b.id)+'&project_id=eq.'+encodeURIComponent(projectId)+'&select=*',{method:'PATCH',headers:{Prefer:'return=representation'},body:payloadForSection(b,Math.max(0,Number(b.display_order||1)-1))});
      if(!rows?.[0])return res.status(404).json({error:'Section not found.'});
      return res.json(fromRow(rows[0]));
    }

    if(req.method==='DELETE'){
      if(!b.id)return res.status(400).json({error:'Missing section id.'});
      await supabaseRequest('project_images?section_id=eq.'+encodeURIComponent(b.id),{method:'DELETE'});
      await supabaseRequest('case_study_sections?id=eq.'+encodeURIComponent(b.id)+'&project_id=eq.'+encodeURIComponent(projectId),{method:'DELETE'});
      return res.json({ok:true});
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(e){return res.status(500).json({error:e.message||'Case study section operation failed.'});}
}