export function renderBurgundyBlockClassic(data) {
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
    @media print { @page { size: A4; margin: 0.5in; } }
    body { font-family: Georgia, serif; color: #222222; background: #ffffff; line-height: 1.4; margin: 0; padding: 0; font-size: 13.5px; }
    .container { max-width: 800px; margin: 0 auto; }
    .header { border-bottom: 2px solid #800020; padding-bottom: 10px; margin-bottom: 20px; text-align: center; }
    .header h1 { font-size: 26px; color: #800020; font-weight: 400; margin: 0 0 6px 0; text-transform: uppercase; }
    .meta { font-family: -apple-system, sans-serif; font-size: 11.5px; color: #555555; }
    .title { font-size: 13px; font-weight: 700; color: #800020; text-transform: uppercase; letter-spacing: 0.5px; margin: 22px 0 10px 0; border-bottom: 1px solid #d8dadd; padding-bottom: 3px; }
    .card { margin-bottom: 14px; }
    .card-head { display: flex; justify-content: space-between; font-weight: 700; }
    .card-sub { display: flex; justify-content: space-between; font-style: italic; color: #555555; font-size: 12.5px; margin-bottom: 4px; }
    .bullets { margin: 0; padding-left: 18px; }
    .bullets li { margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>${escapeHtml(personal.name)}</h1>
      <div class="meta">
        ${[personal.location, personal.phone, personal.email].filter(Boolean).join('  |  ')}
        ${personal.links && personal.links.length ? '  |  ' + (personal.links || []).join('  |  ') : ''}
      </div>
    </header>
    ${summary ? `<div class="title">Summary</div><p style="margin:0 0 14px 0; text-align:justify;">\${escapeHtml(summary)}</p>` : ''}
    ${experience.length ? `<div class="title">Experience</div><div>\${experience.map(job => `<div class="card"><div class="card-head"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="card-sub"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullets">\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
    ${education.length ? `<div class="title">Education</div><div>\${education.map(edu => `<div class="card"><div class="card-head"><span>\${escapeHtml(edu.institution)}</span><span>\${escapeHtml(edu.date_range)}</span></div><div class="card-sub"><span>\${escapeHtml(edu.degree)}</span><span>\${escapeHtml(edu.location)}</span></div></div>`).join('')}</div>` : ''}
    ${skills.length ? `<div class="title">Skills</div><p style="margin:0;">\${skills.map(s => `<strong>\${escapeHtml(s.category)}:</strong> \${(s.items || []).join(', ')}`).join('<br>')}</p>` : ''}
  </div>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
