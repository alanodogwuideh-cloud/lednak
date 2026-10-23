export function renderMonochromeCompact(data) {
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
    @media print { @page { size: A4; margin: 0.4in; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: Arial, sans-serif; color: #111111; background: #ffffff; line-height: 1.3; margin: 0; padding: 0; font-size: 11.5px; }
    .resume-container { max-width: 800px; margin: 0 auto; }
    .resume-header { text-align: center; margin-bottom: 12px; }
    .resume-header h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px 0; text-transform: uppercase; }
    .contact-line { font-size: 11px; color: #333333; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 1.5px solid #111111; margin: 12px 0 6px 0; padding-bottom: 1px; letter-spacing: 0.5px; }
    .entry-meta { display: flex; justify-content: space-between; font-weight: 700; }
    .entry-sub { display: flex; justify-content: space-between; color: #444444; margin-bottom: 2px; }
    .bullet-list { margin: 0; padding-left: 14px; }
    .bullet-list li { margin-bottom: 2px; color: #111111; }
  </style>
</head>
<body>
  <div class="resume-container">
    <header class="resume-header">
      <h1>${escapeHtml(personal.name)}</h1>
      <div class="contact-line">
        ${[personal.location, personal.phone, personal.email].filter(Boolean).join('  |  ')}
        ${personal.links && personal.links.length ? '  |  ' + (personal.links || []).join('  |  ') : ''}
      </div>
    </header>
    ${summary ? `<div class="section-title">Summary</div><p style="margin:0 0 8px 0; text-align:justify;">\${escapeHtml(summary)}</p>` : ''}
    ${experience.length ? `<div class="section-title">Experience</div><div>\${experience.map(job => `<div style="margin-bottom:6px;"><div class="entry-meta"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="entry-sub"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullet-list">\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
    ${education.length ? `<div class="section-title">Education</div><div>\${education.map(edu => `<div style="margin-bottom:4px;"><div class="entry-meta"><span>\${escapeHtml(edu.institution)}</span><span>\${escapeHtml(edu.date_range)}</span></div><div class="entry-sub"><span>\${escapeHtml(edu.degree)}</span><span>\${escapeHtml(edu.location)}</span></div></div>`).join('')}</div>` : ''}
    ${skills.length ? `<div class="section-title">Skills</div><p style="margin:0;">\${skills.map(s => `<strong>\${escapeHtml(s.category)}:</strong> \${(s.items || []).join(', ')}`).join(' &bull; ')}</p>` : ''}
  </div>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
