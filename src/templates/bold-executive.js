export function renderBoldExecutive(data) {
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
    @media print { @page { size: A4; margin: 0.6in; } }
    body { font-family: "Georgia", Times, serif; color: #111111; background: #ffffff; line-height: 1.45; margin: 0; padding: 0; font-size: 13.5px; }
    .wrapper { max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 26px; font-weight: 700; text-transform: uppercase; margin: 0 0 6px 0; color: #000000; letter-spacing: 0.5px; }
    .contact { font-family: -apple-system, sans-serif; font-size: 11.5px; color: #333333; }
    .section-name { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #000000; letter-spacing: 1px; margin: 20px 0 6px 0; text-align: center; }
    .line { border: none; border-top: 2px solid #000000; margin: 0 0 14px 0; }
    .job-block { margin-bottom: 14px; }
    .job-meta { display: flex; justify-content: space-between; font-weight: 700; }
    .job-sub { display: flex; justify-content: space-between; font-style: italic; color: #333333; margin-bottom: 4px; }
    .bullet-list { margin: 0; padding-left: 18px; }
    .bullet-list li { margin-bottom: 4px; text-align: justify; }
  </style>
</head>
<body>
  <div class="wrapper">
    <header class="header">
      <h1>${escapeHtml(personal.name)}</h1>
      <div class="contact">
        ${[personal.location, personal.phone, personal.email].filter(Boolean).join('  &bull;  ')}
        ${personal.links && personal.links.length ? '<br>' + (personal.links || []).join('  &bull;  ') : ''}
      </div>
    </header>
    ${summary ? `<div class="section-name">Summary</div><hr class="line"/><p style="margin:0 0 14px 0; text-align:justify;">\${escapeHtml(summary)}</p>` : ''}
    ${experience.length ? `<div class="section-name">Experience</div><hr class="line"/><div>\${experience.map(job => `<div class="job-block"><div class="job-meta"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="job-sub"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullet-list">\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
    ${education.length ? `<div class="section-name">Education</div><hr class="line"/><div>\${education.map(edu => `<div class="job-block"><div class="job-meta"><span>\${escapeHtml(edu.institution)}</span><span>\${escapeHtml(edu.date_range)}</span></div><div class="job-sub"><span>\${escapeHtml(edu.degree)}</span><span>\${escapeHtml(edu.location)}</span></div></div>`).join('')}</div>` : ''}
    ${skills.length ? `<div class="section-name">Skills</div><hr class="line"/><p style="margin:0;text-align:center;">\${skills.map(s => `<strong>\${escapeHtml(s.category)}:</strong> \${(s.items || []).join(', ')}`).join(' &bull; ')}</p>` : ''}
  </div>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
