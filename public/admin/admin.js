const API=window.__HATCHABLE__?.api||'/api';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let projects=[];
let mediaState={project:null,images:[],sections:[]};

async function api(path,opts={}){
  const isForm=opts.body instanceof FormData;
  const headers=isForm?{...(opts.headers||{})}:{'Content-Type':'application/json',...(opts.headers||{})};
  const r=await fetch(API+path,{...opts,headers});
  let d={};try{d=await r.json()}catch{}
  if(!r.ok){
    if(r.status===401){
      const login=d.login_url||'https://hatchable.com/console/login';
      window.location.href=login;
      throw Error('Redirecting to Hatchable sign-in…');
    }
    if(r.status===403)throw Error('Your Hatchable account does not have admin access to this portfolio.');
    throw Error(d.error||'Request failed');
  }
  return d;
}

function render(){
  const el=$('#projectList');
  if(!projects.length){el.innerHTML='<div class="panel">No case studies yet. Create your first one.</div>';return}
  el.innerHTML=projects.map(p=>`<div class="project-row"><img class="thumb" src="${esc(p.cover_image_url||'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%2290%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%23e7e8e3%22/%3E%3C/svg%3E')}" alt=""><div><h3>${esc(p.title)}</h3><p>${esc(p.category)} · ${esc(p.year)} · ${esc(p.status)}</p></div><div><span class="order">#${esc(p.sort_order)}</span> <button class="edit" data-id="${esc(p.id)}">Edit</button> <button class="secondary manage-media" data-id="${esc(p.id)}">Media</button></div></div>`).join('');
  document.querySelectorAll('.edit').forEach(b=>b.onclick=()=>openEditor(projects.find(p=>p.id===b.dataset.id)));
  document.querySelectorAll('.manage-media').forEach(b=>b.onclick=()=>openMediaForProject(b.dataset.id));
}

function openMediaForProject(id){
  const tab=document.querySelector('.tab[data-tab="media"]');
  tab?.click();
  const select=$('#mediaProject');
  if(select){select.value=id; loadMedia();}
}

function setForm(p={}){
  const f=$('#projectForm');
  Object.keys(p).forEach(k=>{const el=f.elements[k];if(el)el.value=k==='sections'?JSON.stringify(p.content?.sections||[],null,2):p[k]??''});
  if(!p.id){f.elements.status.value='draft';f.elements.sort_order.value=projects.length}
  $('#editorTitle').textContent=p.id?'Edit case study':'New case study';
}
function openEditor(p){setForm(p||{});$('#editor').showModal();$('#deleteProject').style.display=p?.id?'inline-block':'none'}

$('#newProject').onclick=()=>openEditor();
$('#closeEditor').onclick=()=>$('#editor').close();

document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
  const tab=t.dataset.tab;
  $('#projectsTab').hidden=tab!=='projects';
  $('#mediaTab').hidden=tab!=='media';
  $('#aboutTab').hidden=tab!=='about';
  $('#pageTitle').textContent=tab==='media'?'Media':tab==='about'?'About & site':'Case studies';
  $('#newProject').hidden=tab!=='projects';
  if(tab==='about')loadSettings();
  if(tab==='media'){populateMediaProjects();loadMedia();}
});

$('#projectForm').onsubmit=async e=>{
  e.preventDefault();
  const f=new FormData(e.target);let sections=[];
  try{sections=JSON.parse(f.get('sections')||'[]')}catch{$('#projectMsg').textContent='Sections JSON is invalid.';return}
  const b=Object.fromEntries(f.entries());b.sort_order=Number(b.sort_order||0);b.content={sections};
  try{await api('/admin-projects',{method:b.id?'PUT':'POST',body:JSON.stringify(b)});$('#projectMsg').textContent='Saved.';$('#editor').close();await loadProjects();populateMediaProjects()}catch(err){$('#projectMsg').textContent=err.message}
};

$('#deleteProject').onclick=async()=>{const id=$('#projectForm').elements.id.value;if(!id||!confirm('Delete this case study?'))return;try{await api('/admin-projects',{method:'DELETE',body:JSON.stringify({id})});$('#editor').close();await loadProjects();populateMediaProjects()}catch(e){alert(e.message)}};

async function loadProjects(){
  try{projects=await api('/admin-projects');render();populateMediaProjects()}
  catch(e){$('#projectList').innerHTML='<div class="panel">Admin access is required to manage content.</div>'}
}

function populateMediaProjects(){
  const select=$('#mediaProject');if(!select)return;
  const current=select.value;
  if(!projects.length){
    select.innerHTML='<option value="">No case studies available</option>';
    select.disabled=true;
    if($('#mediaProjectMsg'))$('#mediaProjectMsg').textContent='No case studies were returned. Click Case studies → Refresh or reload the admin page.';
    return;
  }
  select.disabled=false;
  select.innerHTML='<option value="">Select a case study…</option>'+projects.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('');
  if(current&&projects.some(p=>p.id===current))select.value=current;
  if($('#mediaProjectMsg'))$('#mediaProjectMsg').textContent=`${projects.length} case stud${projects.length===1?'y':'ies'} available`;
  if(select.value)loadMedia();
}

async function loadMedia(){
  const id=$('#mediaProject')?.value;
  if(!id){$('#mediaList').textContent='Choose a case study above.';return}
  try{
    mediaState=await api('/admin-media?project_id='+encodeURIComponent(id));
    renderMedia();
  }catch(e){$('#mediaList').innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}

function typeLabel(type){
  const map={cover:'Project cover',hero:'Case-study hero',research:'Research',chinedu_persona:'Chinedu persona',fatima_persona:'Fatima persona',storyboard:'Storyboard',wireframes:'Wireframes',usability_testing:'Usability testing',mobile_final_ui:'Mobile final UI',web_final_ui:'Web final UI'};
  return map[type]||type;
}

function renderMedia(){
  const p=mediaState.project;
  $('#mediaListTitle').textContent=p?`${p.title} media`: 'Attached media';
  const fixed=[];
  if(p?.cover_image_url)fixed.push({fixed:'cover',url:p.cover_image_url,label:'Project cover'});
  if(p?.hero_image_url)fixed.push({fixed:'hero',url:p.hero_image_url,label:'Case-study hero'});
  const gallery=mediaState.images||[];
  if(!fixed.length&&!gallery.length){$('#mediaList').innerHTML='<div class="empty">No media attached yet. Upload the first image above.</div>';return}
  $('#mediaList').innerHTML=[...fixed.map(x=>`<div class="media-card"><img src="${esc(x.url)}" alt=""><div class="media-info"><strong>${esc(x.label)}</strong><span>Managed on the case study</span><div class="media-actions"><button class="danger remove-fixed" data-fixed="${esc(x.fixed)}">Remove</button></div></div></div>`),...gallery.map((x,i)=>`<div class="media-card"><img src="${esc(x.image_url)}" alt="${esc(x.alt_text||'')}"><div class="media-info"><strong>${esc(typeLabel(x.image_type))}</strong><span>${esc(x.caption||x.alt_text||'No caption')}</span><div class="media-actions"><button class="secondary move-media" data-id="${esc(x.id)}" data-order="${Number(x.display_order||0)-1}">↑</button><button class="secondary move-media" data-id="${esc(x.id)}" data-order="${Number(x.display_order||0)+1}">↓</button><button class="danger remove-media" data-id="${esc(x.id)}">Remove</button></div></div></div>`)].join('');
  document.querySelectorAll('.remove-media').forEach(b=>b.onclick=()=>removeMedia(b.dataset.id));
  document.querySelectorAll('.remove-fixed').forEach(b=>b.onclick=()=>removeFixed(b.dataset.fixed));
  document.querySelectorAll('.move-media').forEach(b=>b.onclick=()=>moveMedia(b.dataset.id,b.dataset.order));
}

async function removeFixed(kind){
  if(!confirm('Remove this image from the case study?'))return;
  try{await api('/admin-media',{method:'DELETE',body:JSON.stringify({fixed:kind,project_id:mediaState.project?.id})});await loadProjects();await loadMedia()}catch(e){alert(e.message)}
}

async function removeMedia(id){
  if(!confirm('Remove this image from the case study?'))return;
  try{await api('/admin-media',{method:'DELETE',body:JSON.stringify({id})});await loadMedia()}catch(e){alert(e.message)}
}
async function moveMedia(id,order){
  try{await api('/admin-media',{method:'PATCH',body:JSON.stringify({id,display_order:Math.max(0,Number(order)||0)})});await loadMedia()}catch(e){alert(e.message)}
}

$('#mediaProject').onchange=loadMedia;
$('#refreshMedia').onclick=loadMedia;
$('#mediaForm').onsubmit=async e=>{
  e.preventDefault();
  const file=$('#mediaFile').files[0];
  if(!file){$('#mediaMsg').textContent='Choose an image first.';return}
  const fd=new FormData(e.target);
  $('#mediaMsg').textContent='Uploading…';
  try{
    const d=await api('/admin-media',{method:'POST',body:fd});
    $('#mediaMsg').textContent='Uploaded and attached.';
    e.target.reset();
    $('#mediaType').value='research';
    await loadProjects();
    $('#mediaProject').value=d.image?.project_id||d.project?.id||mediaState.project?.id||$('#mediaProject').value;
    await loadMedia();
  }catch(err){$('#mediaMsg').textContent=err.message}
};

async function loadSettings(){try{const s=await api('/admin-settings');const f=$('#settingsForm');Object.keys(s||{}).forEach(k=>{if(f.elements[k])f.elements[k].value=s[k]??''})}catch(e){$('#settingsMsg').textContent=e.message}}
$('#settingsForm').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target).entries());try{await api('/admin-settings',{method:'PUT',body:JSON.stringify(b)});$('#settingsMsg').textContent='Saved.'}catch(err){$('#settingsMsg').textContent=err.message}};

loadProjects();