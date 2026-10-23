export function renderClassicNavy(data) {
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
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1e3a8a; background: #ffffff; line-height: 1.45; margin: 0; padding: 0; font-size: 13px; }
    .resume-container { max-width: 800px; margin: 0 auto; }
    .resume-header { border-left: 4px solid #1e3a8a; padding-left: 16px; margin-bottom: 24px; }
    .resume-header h1 { font-size: 28px; font-weight: 700; color: #1e3a8a; margin: 0 0 4px 0; }
    .contact-row { display: flex; flex-wrap: wrap; gap: 14px; font-size: 11.5px; color: #475569; }
    .section-head { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #1e3a8a; letter-spacing: 0.5px; margin: 20px 0 10px 0; border-bottom: 2px solid #1e3a8a; padding-bottom: 3px; }
    .entry-card { margin-bottom: 14px; }
    .entry-meta { display: flex; justify-content: space-between; font-weight: 700; color: #1e3a8a; }
    .entry-sub { display: flex; justify-content: space-between; color: #475569; font-size: 12px; margin-bottom: 4px; }
    .bullet-list { margin: 0; padding-left: 14px; }
    .bullet-list li { margin-bottom: 4px; color: #1e293b; }
  </style>
</head>
<body>
  <div class="resume-container">
    <header class="resume-header">
      <h1>${escapeHtml(personal.name)}</h1>
      <div class="contact-row">
        ${[personal.location, personal.phone, personal.email].filter(Boolean).map(x => `<span>\${escapeHtml(x)}</span>`).join(' | ')}
      </div>
    </header>
    ${summary ? `<div class="section-head">Summary</div><p style="margin:0 0 14px 0; text-align:justify;">\${escapeHtml(summary)}</p>` : ''}
    ${experience.length ? `<div class="section-head">Experience</div><div>\${experience.map(job => `<div class="entry-card"><div class="entry-meta"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="entry-sub"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullet-list">\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
  </div>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
