const BASE=()=>String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const publicUrl=(slug,file)=>`${BASE()}/storage/v1/object/public/portfolio-images/portfolio/${slug}/${encodeURIComponent(file)}`;

const vendorAssets={
  research:{file:'1786812129658-Research.png',type:'research',alt:'User research findings matrix',caption:'User research findings matrix'},
  chinedu_persona:{file:'1786734312567-Chinedu-Okonkwo-User-Persona.png',type:'chinedu_persona',alt:'Chinedu Okonkwo user persona',caption:'Chinedu Okonkwo user persona'},
  fatima_persona:{file:'1786734610981-Fatima-Usman-User-Personas.png',type:'fatima_persona',alt:'Fatima Usman user persona',caption:'Fatima Usman user persona'},
  storyboard_close:{file:'1786745102333-Outsiders---Close-up.jpg',type:'storyboard',alt:'Outsider storyboard close-up',caption:'Storyboard exploration'},
  storyboard_big:{file:'1786745461756-Outsiders---Big_Picture.jpg',type:'storyboard',alt:'Outsider storyboard big picture',caption:'Storyboard exploration'},
  wireframes_mobile:{file:'1786735848671-Paper-Wireframes.png',type:'wireframes',alt:'Mobile paper wireframes',caption:'Paper wireframe exploration'},
  wireframes_web:{file:'1786744651542-Paper-Wireframes---Web-App.jpg',type:'wireframes',alt:'Web app paper wireframes',caption:'Web app paper wireframe exploration'},
  wireframes_lowfi:{file:'1786753119391-LowFi-Wireframe-Offline-Order-Flow.jpg',type:'wireframes',alt:'Low fidelity offline order flow',caption:'Low-Fi Wireframe: Offline Order Flow'},
  mobile_onboarding:{file:'1786756962641-Onboarding.gif',type:'mobile_final_ui',alt:'Outsider mobile onboarding flow',caption:'Mobile final UI: Onboarding'},
  mobile_home:{file:'1786757161942-Home-Screen.gif',type:'mobile_final_ui',alt:'Outsider mobile home screen flow',caption:'Mobile final UI: Home Screen'},
  mobile_online:{file:'1786767811394-Processing-Online-Order.gif',type:'mobile_final_ui',alt:'Outsider mobile online order processing',caption:'Mobile final UI: Processing Online Order'},
  mobile_offline:{file:'1786768521610-Processing-Offline-Order.gif',type:'mobile_final_ui',alt:'Outsider mobile offline order processing',caption:'Mobile final UI: Processing Offline Order'},
  web_ordering:{file:'1786798641115-Ordering-Process.gif',type:'web_final_ui',alt:'Outsider web ordering process',caption:'Web final UI: Online + Offline Ordering'}
};

function sectionsOf(project){return Array.isArray(project?.content?.sections)?project.content.sections:[];}
function cloneSections(project){return sectionsOf(project).map(s=>({...s,images:Array.isArray(s.images)?[...s.images]:[]}));}
function addImage(section,key,slug,order){const a=vendorAssets[key];if(!a)return;section.images.push({image_url:publicUrl(slug,a.file),image_type:a.type,alt_text:a.alt,caption:a.caption,display_order:order});}

export function repairVendorMedia(project){
  if(!project||project.slug!=='outsider-vendor-app')return {project,changed:false};
  const content=project.content&&typeof project.content==='object'?project.content:{};
  if(content.media_repaired_at)return {project,changed:false};
  const sections=cloneSections(project);
  const hasAny=sections.some(s=>s.images.length>0);
  if(hasAny)return {project,changed:false};
  const byTitle=title=>sections.findIndex(s=>String(s.title||'').trim().toLowerCase()===title.toLowerCase());
  const research=byTitle('Research');
  const people=byTitle('Who I Designed For');
  const context=byTitle('From Context to Concept');
  const exploration=byTitle('Design Exploration');
  const final=byTitle('Final Experience & Accessibility');
  if(research>=0)addImage(sections[research],'research',project.slug,1);
  if(people>=0){addImage(sections[people],'chinedu_persona',project.slug,1);addImage(sections[people],'fatima_persona',project.slug,2);}
  if(context>=0){addImage(sections[context],'storyboard_close',project.slug,1);addImage(sections[context],'storyboard_big',project.slug,2);}
  if(exploration>=0){addImage(sections[exploration],'wireframes_mobile',project.slug,1);addImage(sections[exploration],'wireframes_web',project.slug,2);addImage(sections[exploration],'wireframes_lowfi',project.slug,3);}
  if(final>=0){addImage(sections[final],'mobile_onboarding',project.slug,1);addImage(sections[final],'mobile_home',project.slug,2);addImage(sections[final],'mobile_online',project.slug,3);addImage(sections[final],'mobile_offline',project.slug,4);addImage(sections[final],'web_ordering',project.slug,5);}
  const nextContent={...content,sections,media_repaired_at:new Date().toISOString()};
  return {project:{...project,content:nextContent},changed:true};
}