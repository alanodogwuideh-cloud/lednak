export function renderBlueEditorial(data) {
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
    @media print { @page { size: A4; margin: 0.5in; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: "Times New Roman", Times, serif; color: #222222; background: #ffffff; line-height: 1.4; margin: 0; padding: 0; font-size: 13.5px; }
    .resume-container { max-width: 800px; margin: 0 auto; }
    .resume-header { text-align: left; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #2c3e50; padding-bottom: 8px; }
    .resume-header h1 { font-size: 28px; font-weight: 400; color: #2c3e50; margin: 0; font-family: Georgia, serif; }
    .contact-block { font-family: -apple-system, sans-serif; font-size: 11px; color: #555555; text-align: right; line-height: 1.5; }
    .section-title { font-family: Georgia, serif; font-size: 14px; font-weight: 700; color: #2c3e50; text-transform: uppercase; margin: 22px 0 10px 0; letter-spacing: 0.5px; }
    .divider { border: none; border-top: 1px solid #bccedc; margin: 4px 0 12px 0; }
    .entry-block { margin-bottom: 14px; }
    .entry-head { display: flex; justify-content: space-between; font-weight: 700; font-size: 14px; }
    .entry-sub { display: flex; justify-content: space-between; font-style: italic; color: #444444; margin-bottom: 3px; }
    .bullet-list { margin: 0; padding-left: 18px; }
    .bullet-list li { margin-bottom: 3px; }
  </style>
</head>
<body>
  <div class="resume-container">
    <header class="resume-header">
      <h1>${escapeHtml(personal.name)}</h1>
      <div class="contact-block">
        <div>${escapeHtml(personal.location)} &bull; ${escapeHtml(personal.phone)}</div>
        <div>${escapeHtml(personal.email)}</div>
        <div>${(personal.links || []).join(' | ')}</div>
      </div>
    </header>
    ${summary ? `<div class="section-title">Overview</div><hr class="divider"/><p style="margin:0 0 14px 0; text-align:justify;">\${escapeHtml(summary)}</p>` : ''}
    ${experience.length ? `<div class="section-title">Experience</div><hr class="divider"/><div>\${experience.map(job => `<div class="entry-block"><div class="entry-head"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="entry-sub"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullet-list">\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
    ${education.length ? `<div class="section-title">Education</div><hr class="divider"/><div>\${education.map(edu => `<div class="entry-block"><div class="entry-head"><span>\${escapeHtml(edu.institution)}</span><span>\${escapeHtml(edu.date_range)}</span></div><div class="entry-sub"><span>\${escapeHtml(edu.degree)}</span><span>\${escapeHtml(edu.location)}</span></div></div>`).join('')}</div>` : ''}
    ${skills.length ? `<div class="section-title">Expertise</div><hr class="divider"/><p style="margin:0;">\${skills.map(s => `<strong>\${escapeHtml(s.category)}:</strong> \${(s.items || []).join(', ')}`).join('<br>')}</p>` : ''}
  </div>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
