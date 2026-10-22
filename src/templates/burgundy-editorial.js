export function renderBurgundyEditorial(data) {
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
    .resume-header { text-align: left; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #800020; padding-bottom: 8px; }
    .resume-header h1 { font-size: 28px; font-weight: 400; color: #800020; margin: 0; font-family: Georgia, serif; }
    .contact-block { font-family: -apple-system, sans-serif; font-size: 11px; color: #800020; text-align: right; line-height: 1.5; }
    .section-title { font-family: Georgia, serif; font-size: 14px; font-weight: 700; color: #800020; text-transform: uppercase; margin: 22px 0 10px 0; letter-spacing: 0.5px; }
    .divider { border: none; border-top: 1px solid #f3e1e4; margin: 4px 0 12px 0; }
    .entry-block { margin-bottom: 14px; }
    .entry-head { display: flex; justify-content: space-between; font-weight: 700; font-size: 14px; }
    .entry-sub { display: flex; justify-content: space-between; font-style: italic; color: #555555; margin-bottom: 3px; }
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
      </div>
    </header>
    ${summary ? `<div class="section-title">Overview</div><hr class="divider"/><p style="margin:0 0 14px 0; text-align:justify;">\${escapeHtml(summary)}</p>` : ''}
    ${experience.length ? `<div class="section-title">Experience</div><hr class="divider"/><div>\${experience.map(job => `<div class="entry-block"><div class="entry-head"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="entry-sub"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullet-list">\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
  </div>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
