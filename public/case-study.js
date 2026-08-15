const API=window.__HATCHABLE__?.api||'/api';
const $=s=>document.querySelector(s);
const esc=s=>String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function isVideo(url=''){return /\.(mp4|webm|mov)(\?|#|$)/i.test(url)}
function renderImages(images=[]){
  if(!images.length)return '';
  const fullWidth=images.some(x=>/lowfi\s*wireframe.*offline\s*order\s*flow|offline\s*order\s*flow.*lowfi\s*wireframe/i.test(String(x.caption||'')));
  return `<div class="gallery${fullWidth?' gallery-full-width':''}">${images.map((x,i)=>{const video=isVideo(x.image_url);return `<figure class="gallery-item"><button class="image-trigger" type="button" data-lightbox="${i}" data-media-url="${esc(x.image_url)}" data-media-kind="${video?'video':'image'}" aria-label="Open ${video?'video':'image'} larger">${video?`<video loading="lazy" muted playsinline loop autoplay src="${esc(x.image_url)}"></video>`:`<img loading="lazy" src="${esc(x.image_url)}" alt="${esc(x.alt_text||x.caption||'')}">`}<span class="image-zoom" aria-hidden="true">↗</span></button>${x.caption?`<figcaption>${esc(x.caption)}</figcaption>`:''}</figure>`}).join('')}</div>`;
}

function setupLightbox(){
  if(document.querySelector('.lightbox'))return;
  document.body.insertAdjacentHTML('beforeend',`<div class="lightbox" id="imageLightbox" aria-hidden="true"><div class="lightbox-backdrop" data-close-lightbox></div><div class="lightbox-dialog" role="dialog" aria-modal="true" aria-label="Expanded case study media"><button class="lightbox-close" type="button" data-close-lightbox aria-label="Close media">×</button><div id="lightboxMedia"></div></div></div>`);
  const box=$('#imageLightbox'),media=$('#lightboxMedia');
  const close=()=>{box.classList.remove('is-open');box.setAttribute('aria-hidden','true');document.body.classList.remove('lightbox-open');media.innerHTML='';};
  document.addEventListener('click',e=>{
    const trigger=e.target.closest('.image-trigger');
    if(trigger){const url=trigger.dataset.mediaUrl,kind=trigger.dataset.mediaKind;if(!url)return;media.innerHTML=kind==='video'?`<video controls autoplay playsinline src="${esc(url)}"></video>`:`<img src="${esc(url)}" alt="${esc(trigger.querySelector('img')?.alt||'')}">`;box.classList.add('is-open');box.setAttribute('aria-hidden','false');document.body.classList.add('lightbox-open');return;}
    if(e.target.closest('[data-close-lightbox]'))close();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&box.classList.contains('is-open'))close();});
}
setupLightbox();

function block(b){
  if(!b)return '';
  const title=b.title?`<h2>${esc(b.title)}</h2>`:'';
  const body=b.body?`<p>${esc(b.body)}</p>`:'';
  const images=Array.isArray(b.images)?b.images:[];
  const isDesign=/design\s*exploration/i.test(String(b.title||''));
  const types=[...new Set(images.map(x=>x.image_type).filter(Boolean))];
  let media='';
  if(isDesign && types.includes('wireframes')){
    const papers=images.filter(x=>x.image_type==='wireframes' && !/lowfi\s*wireframe.*offline\s*order\s*flow|offline\s*order\s*flow.*lowfi\s*wireframe/i.test(String(x.caption||'')));
    const lowfi=images.filter(x=>x.image_type==='wireframes' && /lowfi\s*wireframe.*offline\s*order\s*flow|offline\s*order\s*flow.*lowfi\s*wireframe/i.test(String(x.caption||'')));
    const other=images.filter(x=>x.image_type!=='wireframes');
    media=`${papers.length?`<div class="media-group paper-wireframe-media"><h3>Paper Wireframe Explorations</h3>${renderImages(papers)}</div>`:''}${lowfi.length?`<div class="media-group lowfi-flow-media"><h3>Low-Fi Wireframe: Offline Order Flow</h3><p class="media-note">A detailed end-to-end flow for offline ordering across the web and mobile experiences.</p>${renderImages(lowfi)}</div>`:''}${other.length?`<div class="media-group">${renderImages(other)}</div>`:''}`;
  }else if(types.includes('storyboard')&&types.includes('wireframes')){
    const story=images.filter(x=>x.image_type==='storyboard');
    const wires=images.filter(x=>x.image_type==='wireframes');
    const other=images.filter(x=>!['storyboard','wireframes'].includes(x.image_type));
    media=`<div class="media-group"><h3>Storyboarding</h3>${renderImages(story)}</div><div class="media-group design-exploration-media"><h3>Design Exploration</h3>${renderImages(wires)}</div>${other.length?`<div class="media-group">${renderImages(other)}</div>`:''}`;
  }else media=renderImages(images);
  return `<section class="case-section${isDesign?' case-section-design':''}">${title}${body}${media}</section>`;
}

async function init(){
  const slug=new URLSearchParams(location.search).get('slug');
  try{
    if(!slug)throw Error('Missing slug');
    const r=await fetch(API+'/case-study?slug='+encodeURIComponent(slug));
    const p=await r.json();
    if(!r.ok)throw Error(p.error||'Case study unavailable');
    document.title=p.title+' — Alan Odogwuideh';
    fetch(API+'/portfolio').then(r=>r.json()).then(d=>{if(d.settings?.favicon_url){const icon=document.querySelector('#site-favicon');if(icon)icon.href=d.settings.favicon_url+'?v='+encodeURIComponent(d.settings.favicon_updated_at||Date.now());}}).catch(()=>{});
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
      ${p.hero_image_url?(isVideo(p.hero_image_url)?`<video class="case-hero" src="${esc(p.hero_image_url)}" autoplay muted loop playsinline controls></video>`:`<img class="case-hero" src="${esc(p.hero_image_url)}" alt="${esc(p.title)}">`):''}
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