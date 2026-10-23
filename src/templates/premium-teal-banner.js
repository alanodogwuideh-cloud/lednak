export function renderPremiumTealBanner(data) {
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
    body { font-family: -apple-system, sans-serif; color: #23395b; background: #ffffff; line-height: 1.45; margin: 0; padding: 0; font-size: 13px; }
    .banner { background: #005a5b; color: #ffffff; padding: 36px 40px; text-align: center; }
    .banner h1 { font-size: 28px; font-weight: 700; color: #ffffff; margin: 0 0 8px 0; }
    .banner-meta { font-size: 12px; color: #e2f1f1; display: flex; justify-content: center; flex-wrap: wrap; gap: 16px; }
    .content-box { max-width: 800px; margin: 0 auto; padding: 24px 40px; box-sizing: border-box; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #005a5b; letter-spacing: 0.5px; border-bottom: 2px solid #005a5b; padding-bottom: 2px; margin: 20px 0 10px 0; }
    .job-card { margin-bottom: 14px; }
    .job-head { display: flex; justify-content: space-between; font-weight: 700; font-size: 13.5px; color: #005a5b; }
    .job-sub { display: flex; justify-content: space-between; color: #546e7a; font-size: 12.5px; margin-bottom: 4px; }
    .bullets { margin: 0; padding-left: 14px; }
    .bullets li { margin-bottom: 4px; }
  </style>
</head>
<body>
  <header class="banner">
    <h1>${escapeHtml(personal.name)}</h1>
    <div class="banner-meta">
      ${[personal.location, personal.phone, personal.email].filter(Boolean).map(x => `<span>\${escapeHtml(x)}</span>`).join(' | ')}
    </div>
  </header>
  <main class="content-box">
    ${summary ? `<div class="section-title">Profile</div><p style="margin:0 0 14px 0; text-align:justify;">\${escapeHtml(summary)}</p>` : ''}
    ${experience.length ? `<div class="section-title">Experience</div><div>\${experience.map(job => `<div class="job-card"><div class="job-head"><span>\${escapeHtml(job.role)}</span><span>\${escapeHtml(job.date_range)}</span></div><div class="job-sub"><span>\${escapeHtml(job.company)}</span><span>\${escapeHtml(job.location)}</span></div><ul class="bullets">\${(job.bullets || []).map(b => `<li>\${escapeHtml(b.text || b)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
  </main>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
