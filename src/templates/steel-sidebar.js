export function renderSteelSidebar(data) {
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
    body { font-family: -apple-system, sans-serif; color: #334155; background: #ffffff; line-height: 1.45; margin: 0; padding: 0; font-size: 12.5px; }
    .wrapper { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
    .sidebar { background: #475569; color: #ffffff; padding: 40px 24px; box-sizing: border-box; }
    .sidebar h1 { font-size: 22px; font-weight: 700; margin: 0 0 16px 0; color: #ffffff; line-height: 1.2; }
    .sidebar-section { margin-bottom: 24px; }
    .sidebar-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #cbd5e1; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #64748b; padding-bottom: 4px; }
    .sidebar-item { font-size: 11.5px; color: #f1f5f9; margin-bottom: 6px; }
    .main-pane { padding: 40px; box-sizing: border-box; }
    .pane-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #1e293b; letter-spacing: 0.8px; margin: 0 0 12px 0; padding-bottom: 4px; border-bottom: 2px solid #475569; }
    .timeline-block { margin-bottom: 16px; }
    .block-head { display: flex; justify-content: space-between; font-weight: 700; font-size: 13.5px; color: #1e293b; }
    .block-sub { display: flex; justify-content: space-between; color: #64748b; font-size: 12px; margin-bottom: 4px; }
    .bullet-list { margin: 0; padding-left: 14px; }
    .bullet-list li { margin-bottom: 4px; color: #334155; }
  </style>
</head>
<body>
  <div class="wrapper">
    <aside class="sidebar">
      <h1>${escapeHtml(personal.name)}</h1>
      <div class="sidebar-section">
        <div class="sidebar-title">Contact</div>
        <div class="sidebar-item">${escapeHtml(personal.location)}</div>
        <div class="sidebar-item">${escapeHtml(personal.email)}</div>
      </div>
    </aside>
    <main class="main-pane">
      ${summary ? `<h2 class="pane-title">Profile</h2><p style="margin:0 0 20px 0; text-align:justify;">\${escapeHtml(summary)}</p>` : ''}
      ${experience.length ? `<h2 class="pane-title">Experience</h2><div>\${experience.map(job => `<div class="timeline-block"><div class="block-head"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="block-sub"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullet-list">\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
    </main>
  </div>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
