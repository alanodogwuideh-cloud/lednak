export const access = 'admin';
export const methods = ['GET','POST','PATCH','DELETE'];

const base=()=>process.env.SUPABASE_URL;
const key=()=>process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers=()=>({apikey:key(),Authorization:'Bearer '+key(),'Content-Type':'application/json'});

async function sb(path,opts={}){
  const r=await fetch(base()+'/rest/v1/'+path,{...opts,headers:{...headers(),...(opts.headers||{})}});
  const text=await r.text();
  let data=null; try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok) throw new Error(typeof data==='string'?data:(data?.message||data?.hint||'Supabase request failed'));
  return data;
}

const TYPES={
  research:'Research',
  chinedu_persona:'Chinedu persona',
  fatima_persona:'Fatima persona',
  storyboard:'Storyboard',
  wireframes:'Wireframes',
  usability_testing:'Usability testing',
  mobile_final_ui:'Mobile final UI',
  web_final_ui:'Web final UI'
};

const SECTION_TYPES={
  research:'research',
  chinedu_persona:'personas',
  fatima_persona:'personas',
  storyboard:'process',
  wireframes:'usability',
  usability_testing:'final',
  mobile_final_ui:'outcome',
  web_final_ui:'outcome'
};

function safeName(name){return String(name||'image').replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,160);}

async function getProject(id){
  const rows=await sb('projects?select=id,title,slug,cover_image_url,hero_image_url&id=eq.'+encodeURIComponent(id)+'&limit=1');
  return rows?.[0]||null;
}

async function getSection(projectId,imageType){
  const sectionType=SECTION_TYPES[imageType];
  if(!sectionType)return null;
  const rows=await sb('case_study_sections?select=id,title,section_type,display_order&project_id=eq.'+encodeURIComponent(projectId)+'&section_type=eq.'+encodeURIComponent(sectionType)+'&order=display_order.asc&limit=1');
  return rows?.[0]||null;
}

export default async function(req,res){
  try{
    if(req.method==='GET'){
      const projectId=req.query?.project_id;
      if(!projectId)return res.status(400).json({error:'Missing project_id'});
      const [project,images,sections]=await Promise.all([
        getProject(projectId),
        sb('project_images?select=*&project_id=eq.'+encodeURIComponent(projectId)+'&order=display_order.asc,created_at.asc'),
        sb('case_study_sections?select=id,title,section_type,display_order&project_id=eq.'+encodeURIComponent(projectId)+'&order=display_order.asc')
      ]);
      if(!project)return res.status(404).json({error:'Project not found'});
      return res.json({project,images,sections,types:TYPES});
    }

    if(req.method==='POST'){
      const file=req.files?.[0];
      const type=req.body?.asset_type;
      const projectId=req.body?.project_id;
      const altText=req.body?.alt_text||'';
      const caption=req.body?.caption||'';
      const order=Number(req.body?.display_order||0);
      if(!file)return res.status(400).json({error:'Please choose an image file.'});
      if(!projectId)return res.status(400).json({error:'Please choose a case study.'});
      if(!['cover','hero',...Object.keys(TYPES)].includes(type))return res.status(400).json({error:'Invalid asset type.'});
      if(!String(file.contentType||'').startsWith('image/'))return res.status(400).json({error:'Only image files are supported.'});

      const project=await getProject(projectId);
      if(!project)return res.status(404).json({error:'Project not found'});
      const safe=safeName(file.filename);
      const keyPath=`portfolio/${project.slug}/${Date.now()}-${safe}`;
      const contentType=file.contentType||'image/jpeg';
      const upload=await fetch(base()+'/storage/v1/object/portfolio-images/'+keyPath,{method:'POST',headers:{apikey:key(),Authorization:'Bearer '+key(),'Content-Type':contentType,'x-upsert':'true'},body:file.buffer});
      const uploadText=await upload.text();
      if(!upload.ok)throw new Error('Supabase Storage upload failed: '+uploadText);
      const url=base()+'/storage/v1/object/public/portfolio-images/'+keyPath;

      if(type==='cover' || type==='hero'){
        const field=type==='cover'?'cover_image_url':'hero_image_url';
        const updated=await sb('projects?id=eq.'+encodeURIComponent(projectId),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({[field]:url,updated_at:new Date().toISOString()})});
        return res.status(201).json({kind:type,url,key:keyPath,project:updated?.[0]||null});
      }

      const section=await getSection(projectId,type);
      if(!section)return res.status(400).json({error:'No matching case-study section exists for this asset type yet.'});
      const row={project_id:projectId,section_id:section.id,image_url:url,image_type:type,alt_text:altText,caption,display_order:order};
      const created=await sb('project_images',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});
      return res.status(201).json({kind:'gallery',url,key:keyPath,image:created?.[0]||null});
    }

    const b=req.body||{};
    if(req.method==='PATCH'){
      if(!b.id)return res.status(400).json({error:'Missing image id'});
      const row={};
      if(b.display_order!==undefined)row.display_order=Number(b.display_order)||0;
      if(b.alt_text!==undefined)row.alt_text=String(b.alt_text);
      if(b.caption!==undefined)row.caption=String(b.caption);
      const updated=await sb('project_images?id=eq.'+encodeURIComponent(b.id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});
      return res.json(updated?.[0]||updated);
    }

    if(req.method==='DELETE'){
      if(b.fixed && b.project_id && (b.fixed==='cover'||b.fixed==='hero')){
        const field=b.fixed==='cover'?'cover_image_url':'hero_image_url';
        await sb('projects?id=eq.'+encodeURIComponent(b.project_id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({[field]:'',updated_at:new Date().toISOString()})});
        return res.json({ok:true});
      }
      if(!b.id)return res.status(400).json({error:'Missing image id'});
      await sb('project_images?id=eq.'+encodeURIComponent(b.id),{method:'DELETE'});
      return res.json({ok:true});
    }

    return res.status(405).json({error:'Method not allowed'});
  }catch(e){
    console.error('admin-media error',e.message);
    return res.status(500).json({error:e.message||'Media operation failed'});
  }
}