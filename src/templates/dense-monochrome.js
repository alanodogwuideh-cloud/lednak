export function renderDenseMonochrome(data) {
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
    body { font-family: Arial, sans-serif; color: #000000; background: #ffffff; line-height: 1.25; margin: 0; padding: 0; font-size: 11px; }
    .resume-container { max-width: 800px; margin: 0 auto; }
    .resume-header { text-align: center; margin-bottom: 10px; }
    .resume-header h1 { font-size: 20px; font-weight: 700; margin: 0 0 2px 0; text-transform: uppercase; }
    .contact-line { font-size: 10.5px; color: #222222; }
    .section-title { font-size: 10.5px; font-weight: 700; text-transform: uppercase; border-bottom: 1.5px solid #000000; margin: 10px 0 4px 0; padding-bottom: 1px; }
    .entry-meta { display: flex; justify-content: space-between; font-weight: 700; }
    .entry-sub { display: flex; justify-content: space-between; color: #333333; margin-bottom: 2px; }
    .bullet-list { margin: 0; padding-left: 12px; }
    .bullet-list li { margin-bottom: 1px; color: #000000; }
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
    ${summary ? `<div class="section-title">Summary</div><p style="margin:0 0 6px 0; text-align:justify;">\${escapeHtml(summary)}</p>` : ''}
    ${experience.length ? `<div class="section-title">Experience</div><div>\${experience.map(job => `<div style="margin-bottom:4px;"><div class="entry-meta"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="entry-sub"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullet-list">\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
  </div>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
