import { tursoQuery } from 'lib/turso';
import { normalizeR2Url } from 'lib/r2';

export const access = 'public';
export const methods = ['GET'];

const esc = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const obj = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const paragraphs = (value) => String(value || '').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean).map(part => '<p>'+esc(part).replace(/\n/g,'<br>')+'</p>').join('');
const shell = "<div class=\"site-shell\"><header class=\"nav\"><a class=\"brand\" href=\"/\">Alan<span>O.</span></a><nav><a href=\"/#work\">Work</a><a href=\"/#skills\">Skills</a><a href=\"/#process\">Process</a><a href=\"/#about\">About</a><a href=\"/#contact\">Contact</a></nav><div class=\"nav-actions\"><button id=\"themeToggle\" class=\"theme-toggle\" aria-label=\"Toggle light and dark mode\"><span class=\"theme-sun-icon\" aria-hidden=\"true\"><svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M12 4V2M12 20V22M6.41421 6.41421L5 5M17.728 17.728L19.1422 19.1422M4 12H2M20 12H22M17.7285 6.41421L19.1427 5M6.4147 17.728L5.00049 19.1422M12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12C17 14.7614 14.7614 17 12 17Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span><span class=\"theme-moon-icon\" aria-hidden=\"true\"><svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M21.0672 11.8568L20.4253 11.469L21.0672 11.8568ZM12.1432 2.93276L11.7553 2.29085V2.29085L12.1432 2.93276ZM21.25 12C21.25 17.1086 17.1086 21.25 12 21.25V22.75C17.9371 22.75 22.75 17.9371 22.75 12H21.25ZM12 21.25C6.89137 21.25 2.75 17.1086 2.75 12H1.25C1.25 17.9371 6.06294 22.75 12 22.75V21.25ZM2.75 12C2.75 6.89137 6.89137 2.75 12 2.75V1.25C6.06294 1.25 1.25 6.06294 1.25 12H2.75ZM15.5 14.25C12.3244 14.25 9.75 11.6756 9.75 8.5H8.25C8.25 12.5041 11.4959 15.75 15.5 15.75V14.25ZM20.4253 11.469C19.4172 13.1373 17.5882 14.25 15.5 14.25V15.75C18.1349 15.75 20.4407 14.3439 21.7092 12.2447L20.4253 11.469ZM9.75 8.5C9.75 6.41182 10.8627 4.5828 12.531 3.57467L11.7553 2.29085C9.65609 3.5593 8.25 5.86509 8.25 8.5H9.75ZM12 2.75C11.9115 2.75 11.8077 2.71008 11.7324 2.63168C11.6686 2.56527 11.6538 2.50244 11.6503 2.47703C11.6461 2.44587 11.6482 2.35557 11.7553 2.29085L12.531 3.57467C13.0342 3.27065 13.196 2.71398 13.1368 2.27627C13.0754 1.82126 12.7166 1.25 12 1.25V2.75ZM21.7092 12.2447C21.6444 12.3518 21.5541 12.3539 21.523 12.3497C21.4976 12.3462 21.4347 12.3314 21.3683 12.2676C21.2899 12.1923 21.25 12.0885 21.25 12H22.75C22.75 11.2834 22.1787 10.9246 21.7237 10.8632C21.286 10.804 20.7293 10.9658 20.4253 11.469L21.7092 12.2447Z\" fill=\"currentColor\"/></svg></span></button><a class=\"linkedin\" href=\"https://www.linkedin.com/in/alanodogwuideh/\" target=\"_blank\" rel=\"noreferrer\">LinkedIn ↗</a><button id=\"menuToggle\" class=\"menu-toggle\" type=\"button\" aria-label=\"Open menu\" aria-expanded=\"false\" aria-controls=\"mobileMenu\">☰</button></div><div id=\"mobileMenu\" class=\"mobile-menu\" aria-hidden=\"true\"><a href=\"/#work\">Work</a><a href=\"/#skills\">Skills</a><a href=\"/#process\">Process</a><a href=\"/#about\">About</a><a href=\"/#contact\">Contact</a><a href=\"https://www.linkedin.com/in/alanodogwuideh/\" target=\"_blank\" rel=\"noreferrer\">LinkedIn ↗</a></div></header><main class=\"case\"><div class=\"case-nav\"><a class=\"back\" href=\"/#work\">← Back to selected work</a></div><div id=\"caseContent\"><!--SSR_CASE_CONTENT--></div></div></main><button id=\"backToTop\" class=\"back-to-top\" type=\"button\" aria-label=\"Back to top\"><span>Back to top</span><span aria-hidden=\"true\">↑</span></button></div><script src=\"/case-study-v169.js?v=525\"></script>";

function renderSection(section) {
  const title = String(section.title || '').trim();
  const subtitle = String(section.subtitle || section.sub_title || '').trim();
  const body = String(section.body || section.text || '').trim();
  const images = Array.isArray(section.images) ? section.images : [];
  const gallery = images.map(image => {
    const url = normalizeR2Url(image.image_url || '');
    if (!url) return '';
    const alt = image.alt_text || image.caption || title || 'Case study image';
    return '<figure class="gallery-item"><img loading="lazy" src="'+esc(url)+'" alt="'+esc(alt)+'">'+(image.caption?'<figcaption>'+esc(image.caption)+'</figcaption>':'')+'</figure>';
  }).join('');
  return '<section class="case-section">'+(title?'<h2>'+esc(title)+'</h2>':'')+(subtitle?'<h3>'+esc(subtitle)+'</h3>':'')+paragraphs(body)+(gallery?'<div class="gallery">'+gallery+'</div>':'')+'</section>';
}

export default async function(req,res) {
  try {
    const slug = String(req.query?.slug || '').trim();
    if (!slug) return res.status(400).send('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Case study not found — Alan Odogwuideh</title></head><body><main><h1>Case study not found</h1></main></body></html>');
    const aliases = { 'outsider-vendor-platform': 'outsider-vendor-app' };
    const { rows } = await tursoQuery('SELECT * FROM case_studies WHERE slug = $1 LIMIT 1', [aliases[slug] || slug]);
    const project = rows?.[0];
    if (!project || project.deleted_at) return res.status(404).send('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Case study not found — Alan Odogwuideh</title></head><body><main><h1>Case study not found</h1></main></body></html>');
    let content = project.content;
    if (typeof content === 'string') { try { content = JSON.parse(content); } catch { content = {}; } }
    content = obj(content);
    const requestedToken = String(req.query?.preview || '').trim();
    const storedToken = String(content.preview_token || '').trim();
    const expiresAt = Date.parse(String(content.preview_token_expires_at || ''));
    const preview = Boolean(requestedToken && storedToken && requestedToken === storedToken && Number.isFinite(expiresAt) && expiresAt > Date.now());
    if (String(project.status || 'draft') !== 'published' && !preview) return res.status(404).send('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Case study not found — Alan Odogwuideh</title></head><body><main><h1>Case study not found</h1></main></body></html>');

    const title = String(project.title || 'Case Study');
    const description = String(project.description || project.subtitle || '').slice(0, 300);
    const hero = normalizeR2Url(project.hero_image_url || project.cover_image_url || '');
    const meta = obj(content.case_meta);
    const sections = Array.isArray(content.sections) ? content.sections : [];
    const caseMeta = '<div class="case-meta"><div><span>'+esc(meta.role_label || 'Role')+'</span><strong>'+esc(project.role || '')+'</strong></div>'+(project.duration?'<div><span>'+esc(meta.duration_label || 'Duration')+'</span><strong>'+esc(project.duration)+'</strong></div>':'')+'<div><span>'+esc(meta.platform_label || 'Platform')+'</span><strong>'+esc(meta.platform || 'Mobile + Web')+'</strong></div><div><span>'+esc(meta.project_type_label || 'Project type')+'</span><strong>'+esc(meta.project_type || 'End-to-end')+'</strong></div></div>';
    const contentHtml = '<header class="case-head"><div class="case-label">'+esc(project.category || '')+(project.year?' · '+esc(project.year):'')+'</div><h1>'+esc(title)+'</h1><div class="sub">'+esc(project.subtitle || description)+'</div>'+caseMeta+'</header>'+(hero?'<img class="case-hero" src="'+esc(hero)+'" alt="'+esc(title)+'" fetchpriority="high">':'')+'<div class="case-content">'+sections.map(renderSection).join('')+'</div>';
    const canonical = 'https://alanodogwuideh.com/case-study?slug='+encodeURIComponent(String(project.slug || slug));
    const head = "<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Case Study — Alan Odogwuideh</title><link id=\"site-favicon\" rel=\"icon\" href=\"/api/favicon?v=initial\" type=\"image/svg+xml\"><script>document.getElementById('site-favicon').href='/api/favicon?v='+Date.now()</script><link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin><link href=\"https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap\" rel=\"stylesheet\"><link rel=\"stylesheet\" href=\"/styles.css?v=433\"><link rel=\"stylesheet\" href=\"/case-study-render.css?v=1\"><script async src=\"https://www.googletagmanager.com/gtag/js?id=G-R1NF246WH6\"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag(\"js\",new Date());gtag(\"config\",\"G-R1NF246WH6\");</script>".replace(/<title>[\s\S]*?<\/title>/i,'<title>'+esc(title)+' - Alan Odogwuideh</title>')
      +'<meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+esc(canonical)+'"><meta property="og:type" content="article"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'">'+(hero?'<meta property="og:image" content="'+esc(hero)+'">':'')+'<meta name="twitter:card" content="summary_large_image">';
    const html = '<!doctype html><html lang="en"><head>'+head+'</head><body>'+shell.replace('<!--SSR_CASE_CONTENT-->',contentHtml)+'</body></html>';
    res.setHeader('Cache-Control', preview ? 'no-store, max-age=0' : 'public, max-age=60, s-maxage=300');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.send(html);
  } catch (error) {
    console.error('case-study SSR error', error?.message || error);
    return res.status(500).send('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Case study unavailable — Alan Odogwuideh</title></head><body><main><h1>Case study unavailable</h1><p>Please try again shortly.</p></main></body></html>');
  }
}