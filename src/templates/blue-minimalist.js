export function renderBlueMinimalist(data) {
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
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1e293b; background: #ffffff; line-height: 1.5; margin: 0; padding: 0; font-size: 13px; }
    .container { max-width: 750px; margin: 0 auto; }
    .header { margin-bottom: 24px; }
    .header h1 { font-size: 24px; font-weight: 600; margin: 0 0 6px 0; color: #1d4ed8; letter-spacing: -0.5px; }
    .meta-line { font-size: 12px; color: #475569; display: flex; flex-wrap: wrap; gap: 12px; }
    .section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #1d4ed8; letter-spacing: 1px; margin: 24px 0 8px 0; }
    .line { border: none; border-top: 1px solid #d9f2ff; margin: 0 0 12px 0; }
    .item { margin-bottom: 16px; }
    .item-row { display: flex; justify-content: space-between; font-weight: 600; font-size: 13.5px; color: #1e293b; }
    .item-sub { display: flex; justify-content: space-between; color: #475569; font-size: 12px; margin-bottom: 4px; }
    .bullets { margin: 0; padding-left: 16px; }
    .bullets li { margin-bottom: 4px; color: #334155; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>${escapeHtml(personal.name)}</h1>
      <div class="meta-line">
        ${[personal.location, personal.phone, personal.email].filter(Boolean).map(x => `<span>\${escapeHtml(x)}</span>`).join(' &middot; ')}
      </div>
    </header>
    ${summary ? `<div class="section-title">Profile</div><hr class="line"/><p style="margin:0 0 16px 0; text-align:justify;">\${escapeHtml(summary)}</p>` : ''}
    ${experience.length ? `<div class="section-title">Experience</div><hr class="line"/><div>\${experience.map(job => `<div class="item"><div class="item-row"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="item-sub"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullets">\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
  </div>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
