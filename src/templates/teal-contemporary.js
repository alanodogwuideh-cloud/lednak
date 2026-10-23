export function renderTealContemporary(data) {
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
    body { font-family: -apple-system, sans-serif; color: #2c3e50; background: #ffffff; line-height: 1.45; margin: 0; padding: 0; font-size: 13px; }
    .resume-container { max-width: 800px; margin: 0 auto; }
    .resume-header { border-left: 4px solid #008080; padding-left: 16px; margin-bottom: 24px; }
    .resume-header h1 { font-size: 28px; font-weight: 700; color: #004d40; margin: 0 0 4px 0; }
    .contact-row { display: flex; flex-wrap: wrap; gap: 14px; font-size: 11.5px; color: #546e7a; }
    .section-head { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #008080; letter-spacing: 0.5px; margin: 20px 0 10px 0; border-bottom: 2px solid #008080; padding-bottom: 3px; }
    .entry-card { margin-bottom: 14px; }
    .entry-meta { display: flex; justify-content: space-between; font-weight: 700; font-size: 13.5px; color: #004d40; }
    .entry-sub { display: flex; justify-content: space-between; font-weight: 500; color: #546e7a; font-size: 12px; margin-bottom: 4px; }
    .bullet-list { margin: 0; padding-left: 14px; }
    .bullet-list li { margin-bottom: 4px; color: #2c3e50; }
    .skills-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .skill-item { background: #f0f7f7; padding: 6px; border-radius: 4px; border-left: 2px solid #008080; }
  </style>
</head>
<body>
  <div class="resume-container">
    <header class="resume-header">
      <h1>${escapeHtml(personal.name)}</h1>
      <div class="contact-row">
        ${[personal.location, personal.phone, personal.email].filter(Boolean).map(x => `<span>\${escapeHtml(x)}</span>`).join(' | ')}
        ${(personal.links || []).map(l => `<span>\${escapeHtml(l)}</span>`).join(' | ')}
      </div>
    </header>
    ${summary ? `<div class="section-head">Executive Summary</div><p style="margin:0 0 14px 0; text-align:justify;">\${escapeHtml(summary)}</p>` : ''}
    ${experience.length ? `<div class="section-head">Professional Background</div><div>\${experience.map(job => `<div class="entry-card"><div class="entry-meta"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="entry-sub"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullet-list">\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
    ${education.length ? `<div class="section-head">Academic History</div><div>\${education.map(edu => `<div class="entry-card"><div class="entry-meta"><span>\${escapeHtml(edu.institution)}</span><span>\${escapeHtml(edu.date_range)}</span></div><div class="entry-sub"><span>\${escapeHtml(edu.degree)}</span><span>\${escapeHtml(edu.location)}</span></div></div>`).join('')}</div>` : ''}
    ${skills.length ? `<div class="section-head">Core Competencies</div><div class="skills-grid">\${skills.flatMap(s => s.items || []).map(item => `<div class="skill-item">\${escapeHtml(item)}</div>`).join('')}</div>` : ''}
  </div>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
