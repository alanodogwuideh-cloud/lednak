const API=window.__HATCHABLE__?.api||'/api';
const $=s=>document.querySelector(s);
const esc=s=>String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function renderImages(images=[]){
  if(!images.length)return '';
  return `<div class="gallery">${images.map((x,i)=>`<figure class="gallery-item"><button class="image-trigger" type="button" data-lightbox="${i}" aria-label="Open image larger"><img loading="lazy" src="${esc(x.image_url)}" alt="${esc(x.alt_text||x.caption||'')}"><span class="image-zoom" aria-hidden="true">↗</span></button>${x.caption?`<figcaption>${esc(x.caption)}</figcaption>`:''}</figure>`).join('')}</div>`;
}

function setupLightbox(){
  if(document.querySelector('.lightbox'))return;
  document.body.insertAdjacentHTML('beforeend',`<div class="lightbox" id="imageLightbox" aria-hidden="true"><div class="lightbox-backdrop" data-close-lightbox></div><div class="lightbox-dialog" role="dialog" aria-modal="true" aria-label="Expanded case study image"><button class="lightbox-close" type="button" data-close-lightbox aria-label="Close image">×</button><img id="lightboxImage" alt=""></div></div>`);
  const box=$('#imageLightbox'),img=$('#lightboxImage');
  const close=()=>{box.classList.remove('is-open');box.setAttribute('aria-hidden','true');document.body.classList.remove('lightbox-open');img.src='';};
  document.addEventListener('click',e=>{
    const trigger=e.target.closest('.image-trigger');
    if(trigger){const source=trigger.querySelector('img');if(!source)return;img.src=source.currentSrc||source.src;img.alt=source.alt||'';box.classList.add('is-open');box.setAttribute('aria-hidden','false');document.body.classList.add('lightbox-open');return;}
    if(e.target.closest('[data-close-lightbox]'))close();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&box.classList.contains('is-open'))close();});
}
setupLightbox();

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