export function renderCorporateLedger(data) {
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
    body { font-family: "Helvetica Neue", Arial, sans-serif; color: #2d3748; background: #ffffff; line-height: 1.45; margin: 0; padding: 0; font-size: 13px; }
    .resume-container { max-width: 800px; margin: 0 auto; }
    .resume-header { padding-bottom: 16px; margin-bottom: 24px; border-bottom: 3px solid #2d3748; }
    .resume-header h1 { font-size: 32px; font-weight: 800; text-transform: uppercase; color: #1a202c; margin: 0 0 8px 0; }
    .contact-grid { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; font-weight: 500; color: #4a5568; text-transform: uppercase; letter-spacing: 0.5px; }
    .ledger-row { display: grid; grid-template-columns: 160px 1fr; column-gap: 32px; margin-bottom: 24px; align-items: start; }
    .ledger-title { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #2d3748; letter-spacing: 1px; border-top: 2px solid #2d3748; padding-top: 6px; }
    .ledger-content { border-top: 1px solid #e2e8f0; padding-top: 6px; }
    .ledger-row:first-of-type .ledger-title, .ledger-row:first-of-type .ledger-content { border-top: none; padding-top: 0; }
    .entry-block { margin-bottom: 18px; }
    .entry-meta { display: flex; justify-content: space-between; font-weight: 700; font-size: 13.5px; }
    .entry-sub { display: flex; justify-content: space-between; color: #4a5568; font-size: 12.5px; margin-bottom: 6px; }
    .bullet-list { margin: 0; padding-left: 14px; }
    .bullet-list li { margin-bottom: 4px; color: #2d3748; }
  </style>
</head>
<body>
  <div class="resume-container">
    <header class="resume-header">
      <h1>${escapeHtml(personal.name)}</h1>
      <div class="contact-grid">
        ${[personal.location, personal.phone, personal.email].filter(Boolean).map(x => `<span>\${escapeHtml(x)}</span>`).join(' &bull; ')}
      </div>
    </header>
    ${summary ? `<div class="ledger-row"><div class="ledger-title">Profile</div><div class="ledger-content" style="text-align:justify;">\${escapeHtml(summary)}</div></div>` : ''}
    ${experience.length ? `<div class="ledger-row"><div class="ledger-title">Experience</div><div class="ledger-content">\${experience.map(job => `<div class="entry-block"><div class="entry-meta"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="entry-sub"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullet-list">\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div></div>` : ''}
    ${education.length ? `<div class="ledger-row"><div class="ledger-title">Education</div><div class="ledger-content">\${education.map(edu => `<div class="entry-block"><div class="entry-meta"><span>\${escapeHtml(edu.institution)}</span><span>\${escapeHtml(edu.date_range)}</span></div><div class="entry-sub"><span>\${escapeHtml(edu.degree)}</span><span>\${escapeHtml(edu.location)}</span></div></div>`).join('')}</div></div>` : ''}
  </div>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
