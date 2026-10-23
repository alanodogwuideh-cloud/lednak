export function renderCharcoalClassic(data) {
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
    body { font-family: "Georgia", Times, serif; color: #2d2d2d; background: #ffffff; line-height: 1.4; margin: 0; padding: 0; font-size: 13.5px; }
    .resume-container { max-width: 800px; margin: 0 auto; box-sizing: border-box; }
    .resume-header { border-bottom: 2px solid #2d2d2d; padding-bottom: 12px; margin-bottom: 20px; text-align: center; }
    .resume-header h1 { font-size: 28px; font-weight: 400; color: #2d2d2d; margin: 0 0 6px 0; letter-spacing: 0.5px; text-transform: uppercase; }
    .contact-line { font-size: 12px; color: #555555; font-family: -apple-system, sans-serif; }
    .section-title { font-size: 13px; font-weight: 700; color: #2d2d2d; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 10px 0; padding-bottom: 4px; border-bottom: 1px solid #d8dadd; }
    .entry-block { margin-bottom: 14px; }
    .entry-header { display: flex; justify-content: space-between; font-weight: 700; font-size: 14px; }
    .entry-subheader { display: flex; justify-content: space-between; font-style: italic; color: #555555; margin-bottom: 4px; }
    .bullet-list { margin: 0; padding-left: 18px; }
    .bullet-list li { margin-bottom: 4px; color: #2d2d2d; }
    .skills-text { line-height: 1.5; }
  </style>
</head>
<body>
  <div class="resume-container">
    <header class="resume-header">
      <h1>${escapeHtml(personal.name)}</h1>
      <div class="contact-line">
        ${[personal.location, personal.phone, personal.email].filter(Boolean).join('  |  ')}
      </div>
    </header>
    ${summary ? `<div class="section-title">Summary</div><p style="margin:0 0 14px 0; text-align:justify;">\${escapeHtml(summary)}</p>` : ''}
    ${experience.length ? `<div class="section-title">Experience</div><div>\${experience.map(job => `<div class="entry-block"><div class="entry-header"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="entry-subheader"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullet-list">\ factory\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
    ${education.length ? `<div class="section-title">Education</div><div>\${education.map(edu => `<div class="entry-block"><div class="entry-header"><span>\${escapeHtml(edu.institution)}</span><span>\${escapeHtml(edu.date_range)}</span></div><div class="entry-subheader"><span>\${escapeHtml(edu.degree)}</span><span>\${escapeHtml(edu.location)}</span></div></div>`).join('')}</div>` : ''}
    ${skills.length ? `<div class="section-title">Skills</div><div class="skills-text">\${skills.map(s => `<strong>\${escapeHtml(s.category || 'Skills')}:</strong> \${escapeHtml((s.items || []).join(', '))}`).join('<br>')}</div>` : ''}
  </div>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
