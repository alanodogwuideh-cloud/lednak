const API=window.__HATCHABLE__?.api||'/api';
const $=s=>document.querySelector(s);
const esc=s=>String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function renderImages(images=[]){
  if(!images.length)return '';
  return `<div class="gallery">${images.map(x=>`<figure><img loading="lazy" src="${esc(x.image_url)}" alt="${esc(x.alt_text||x.caption||'')}">${x.caption?`<figcaption>${esc(x.caption)}</figcaption>`:''}</figure>`).join('')}</div>`;
}

function block(b){
  if(!b)return '';
  const title=b.title?`<h2>${esc(b.title)}</h2>`:'';
  const body=b.body?`<p>${esc(b.body)}</p>`:'';
  return `<section class="case-section">${title}${body}${renderImages(b.images)}</section>`;
}

async function init(){
  const slug=new URLSearchParams(location.search).get('slug');
  try{
    if(!slug)throw Error('Missing slug');
    const r=await fetch(API+'/case-study?slug='+encodeURIComponent(slug));
    const p=await r.json();
    if(!r.ok)throw Error(p.error||'Case study unavailable');
    document.title=p.title+' — Alan Odogwuideh';
    const c=p.content||{};
    const blocks=Array.isArray(c.sections)?c.sections:[];
    $('#caseContent').innerHTML=`
      <header class="case-head">
        <div class="case-label">${esc(p.category)}${p.year?' · '+esc(p.year):''}</div>
        <h1>${esc(p.title)}</h1>
        <div class="sub">${esc(p.subtitle||p.description)}</div>
        <div class="case-meta">
          <div><span>Role</span><strong>${esc(p.role)}</strong></div>
          <div><span>Duration</span><strong>${esc(p.duration||'—')}</strong></div>
          <div><span>Platform</span><strong>Mobile + Web</strong></div>
          <div><span>Project type</span><strong>End-to-end</strong></div>
        </div>
      </header>
      ${p.hero_image_url?`<img class="case-hero" src="${esc(p.hero_image_url)}" alt="${esc(p.title)}">`:''}
      <div class="case-content">${blocks.map(block).join('')}</div>
      <a class="next-case" href="/#work"><span>MORE PROJECTS</span><h3>Explore the rest of my work ↗</h3></a>`;
  }catch(e){
    console.error(e);
    $('#caseContent').innerHTML='<div class="loading">This case study could not be loaded right now.</div>';
  }
}

const saved=localStorage.getItem('theme');
if(saved==='dark')document.body.classList.add('dark');
$('#themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('dark');
  localStorage.setItem('theme',document.body.classList.contains('dark')?'dark':'light');
  $('#themeToggle').textContent=document.body.classList.contains('dark')?'☀':'☾';
});
$('#themeToggle').textContent=document.body.classList.contains('dark')?'☀':'☾';
init();