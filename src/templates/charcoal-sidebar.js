export function renderCharcoalSidebar(data) {
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
    @media print { @page { size: A4; margin: 0in; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { font-family: -apple-system, sans-serif; color: #333333; background: #ffffff; line-height: 1.45; margin: 0; padding: 0; font-size: 12.5px; }
    .wrapper { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
    .sidebar { background: #24292e; color: #ffffff; padding: 40px 24px; box-sizing: border-box; }
    .sidebar h1 { font-size: 22px; font-weight: 700; margin: 0 0 16px 0; color: #ffffff; line-height: 1.2; }
    .sidebar-section { margin-bottom: 24px; }
    .sidebar-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #8a9299; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #3f4448; padding-bottom: 4px; }
    .sidebar-item { font-size: 11.5px; color: #e1e4e8; margin-bottom: 6px; word-break: break-all; }
    .main-pane { padding: 40px; box-sizing: border-box; }
    .pane-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #24292e; letter-spacing: 0.8px; margin: 0 0 12px 0; padding-bottom: 4px; border-bottom: 2px solid #24292e; }
    .timeline-block { margin-bottom: 16px; }
    .block-head { display: flex; justify-content: space-between; font-weight: 700; font-size: 13.5px; }
    .block-sub { display: flex; justify-content: space-between; color: #666666; font-size: 12px; margin-bottom: 4px; }
    .bullet-list { margin: 0; padding-left: 14px; }
    .bullet-list li { margin-bottom: 4px; color: #333333; }
  </style>
</head>
<body>
  <div class="wrapper">
    <aside class="sidebar">
      <h1>${escapeHtml(personal.name)}</h1>
      <div class="sidebar-section">
        <div class="sidebar-title">Contact</div>
        <div class="sidebar-item">${escapeHtml(personal.location)}</div>
        <div class="sidebar-item">${escapeHtml(personal.phone)}</div>
        <div class="sidebar-item">${escapeHtml(personal.email)}</div>
      </div>
      ${skills.length ? `<div class="sidebar-section"><div class="sidebar-title">Expertise</div>\${skills.map(s => `<div class="sidebar-item" style="font-weight:600;margin-top:6px;">\${escapeHtml(s.category)}</div><div class="sidebar-item" style="color:#b1b8be;font-size:11px;">\${(s.items || []).join(', ')}</div>`).join('')}</div>` : ''}
    </aside>
    <main class="main-pane">
      ${summary ? `<h2 class="pane-title">Profile</h2><p style="margin:0 0 20px 0; text-align:justify;">\${escapeHtml(summary)}</p>` : ''}
      ${experience.length ? `<h2 class="pane-title">Experience</h2><div style="margin-bottom:20px;">\${experience.map(job => `<div class="timeline-block"><div class="block-head"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="block-sub"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullet-list">\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
      ${education.length ? `<h2 class="pane-title">Education</h2><div>\${education.map(edu => `<div class="timeline-block"><div class="block-head"><span>\${escapeHtml(edu.institution)}</span><span>\${escapeHtml(edu.date_range)}</span></div><div class="block-sub"><span>\${escapeHtml(edu.degree)}</span><span>\${escapeHtml(edu.location)}</span></div></div>`).join('')}</div>` : ''}
    </main>
  </div>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
