export function renderBlushBlocks(data) {
  const personal = data.personal_info || {};
  const summary = data.summary || "";
  const experience = data.work_experience || [];
  const education = data.education || [];
  const skills = data.skills || [];
  const certificates = data.certificates || [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    @media print { @page { size: A4; margin: 0in; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: -apple-system, sans-serif; color: #2d2325; background: #ffffff; line-height: 1.4; margin: 0; padding: 0; font-size: 13px; }
    .header-banner { background: #fdf5f6; border-bottom: 1px solid #f3e1e4; padding: 32px 40px; text-align: center; }
    .header-banner h1 { font-size: 26px; color: #4a3538; font-weight: 700; margin: 0 0 8px 0; letter-spacing: -0.5px; }
    .contact-flex { display: flex; justify-content: center; flex-wrap: wrap; gap: 16px; font-size: 11.5px; color: #705c5e; }
    .main-body { max-width: 800px; margin: 0 auto; padding: 24px 40px; box-sizing: border-box; }
    .section-title { display: inline-block; background: #9c6c70; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; margin: 18px 0 12px 0; border-radius: 4px; }
    .entry-row { margin-bottom: 14px; }
    .entry-head { display: flex; justify-content: space-between; font-weight: 700; font-size: 13.5px; color: #4a3538; }
    .entry-sub { display: flex; justify-content: space-between; font-style: italic; color: #705c5e; margin-bottom: 4px; }
    .bullet-list { margin: 0; padding-left: 16px; }
    .bullet-list li { margin-bottom: 4px; color: #3d2d30; }
    .skill-pill { display: inline-block; background: #fdf5f6; border: 1px solid #f3e1e4; color: #705c5e; padding: 3px 8px; border-radius: 12px; margin: 0 4px 6px 0; font-size: 12px; }
  </style>
</head>
<body>
  <header class="header-banner">
    <h1>${escapeHtml(personal.name)}</h1>
    <div class="contact-flex">
      ${[personal.location, personal.phone, personal.email].filter(Boolean).map(x => `<span>\${escapeHtml(x)}</span>`).join(' &bull; ')}
      ${(personal.links || []).map(l => `<span>\${escapeHtml(l)}</span>`).join(' &bull; ')}
    </div>
  </header>
  <main class="main-body">
    ${summary ? `<div class="section-title">Overview</div><p style="margin:0 0 14px 0; text-align:justify;">\${escapeHtml(summary)}</p>` : ''}
    ${experience.length ? `<div class="section-title">Experience</div><div>\${experience.map(job => `<div class="entry-row"><div class="entry-head"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="entry-sub"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullet-list">\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
    ${education.length ? `<div class="section-title">Education</div><div>\${education.map(edu => `<div class="entry-row"><div class="entry-head"><span>\${escapeHtml(edu.institution)}</span><span>\${escapeHtml(edu.date_range)}</span></div><div class="entry-sub"><span>\${escapeHtml(edu.degree)}</span><span>\${escapeHtml(edu.location)}</span></div></div>`).join('')}</div>` : ''}
    ${skills.length ? `<div class="section-title">Skills</div><div>\${skills.flatMap(s => s.items || []).map(item => `<span class="skill-pill">\${escapeHtml(item)}</span>`).join('')}</div>` : ''}
  </main>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
