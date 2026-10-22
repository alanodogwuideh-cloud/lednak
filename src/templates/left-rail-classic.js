/**
 * Template #1: Executive Left-Rail Classic
 * Decoupled data injection architecture.
 */
export function renderLeftRailClassic(data) {
  // Gracefully fallback on missing structural nodes to prevent template rendering crashes
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
  <title>${escapeHtml(personal.name)} - Resume</title>
  <style>
    /* Print media page optimization boundaries */
    @media print {
      @page {
        size: A4;
        margin: 0.5in;
      }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111111;
      background: #ffffff;
      line-height: 1.45;
      margin: 0;
      padding: 0;
      font-size: 13px;
    }

    .resume-container {
      max-width: 800px;
      margin: 0 auto;
      box-sizing: border-box;
    }

    /* Top Centered Profile Contact Header */
    .resume-header {
      text-align: center;
      margin-bottom: 8px;
    }

    .resume-header h1 {
      font-size: 26px;
      font-weight: 500;
      letter-spacing: -0.5px;
      margin: 0 0 6px 0;
    }

    .contact-bar, .links-bar {
      font-size: 11px;
      color: #444444;
      margin-bottom: 4px;
    }

    .section-divider {
      border: none;
      border-top: 1.2px solid #111111;
      margin: 14px 0;
    }

    /* Rigid Master Two-Column Grid Framework */
    .resume-grid {
      display: grid;
      grid-template-columns: 140px 1fr;
      row-gap: 16px;
      column-gap: 24px;
      align-items: start;
    }

    .left-rail-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #333333;
      letter-spacing: 0.8px;
      padding-top: 2px;
    }

    .grid-span-all {
      grid-column: span 2;
    }

    /* Content and Timeline Blocks Inner Layouts */
    .timeline-item {
      display: grid;
      grid-template-columns: 100px 1fr;
      column-gap: 12px;
      margin-bottom: 16px;
    }
    
    .timeline-item:last-child {
      margin-bottom: 0;
    }

    .item-date {
      font-size: 12px;
      font-weight: 500;
      color: #444444;
      padding-top: 1px;
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      font-size: 13.5px;
      margin-bottom: 2px;
    }

    .role-title {
      font-weight: 700;
    }

    .location-text {
      color: #555555;
      font-size: 12.5px;
    }

    .sub-institution {
      font-size: 12.5px;
      font-weight: 500;
      color: #222222;
      margin: 0 0 6px 0;
    }

    .bullet-list {
      margin: 0;
      padding-left: 14px;
    }

    .bullet-list li {
      margin-bottom: 4px;
      color: #222222;
      font-size: 13px;
    }
    
    .bullet-list li:last-child {
      margin-bottom: 0;
    }

    /* Asymmetrical Multi-Column Subgrid Skills Framework */
    .skills-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      row-gap: 6px;
      column-gap: 16px;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="resume-container">
    
    <header class="resume-header">
      <h1>${escapeHtml(personal.name)}</h1>
      <div class="contact-bar">
        ${[personal.location, personal.phone, personal.email].filter(Boolean).join('  &bull;  ')}
      </div>
      <div class="links-bar">
        ${(personal.links || []).map(link => `<span style="text-decoration: underline;">\${escapeHtml(link)}</span>`).join('  |  ')}
      </div>
    </header>

    <hr class="section-divider" />

    <main class="resume-grid">
      
      <!-- Summary Node Row -->
      ${summary ? `
        <div class="left-rail-title">Summary</div>
        <div style="font-size: 13px; text-align: justify;">\${escapeHtml(summary)}</div>
        <div class="grid-span-all"><hr class="section-divider" /></div>
      ` : ''}

      <!-- Work Experience Array Loop Node Row -->
      ${experience.length ? `
        <div class="left-rail-title">Work Experience</div>
        <div>
          \${experience.map(job => `
            <div class="timeline-item">
              <div class="item-date">${escapeHtml(job.date_range)}</div>
              <div>
                <div class="item-header">
                  <span class="role-title">${escapeHtml(job.role)}</span>
                  <span class="location-text">${escapeHtml(job.location)}</span>
                </div>
                <div class="sub-institution">${escapeHtml(job.company}</div>
                <ul class="bullet-list">
                  ${(job.bullets || []).map(bullet => `<li>\${escapeHtml(bullet)}</li>`).join('')}
                </ul>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="grid-span-all"><hr class="section-divider" /></div>
      ` : ''}

      <!-- Education Array Loop Node Row -->
      ${education.length ? `
        <div class="left-rail-title">Education</div>
        <div>
          \${education.map(edu => `
            <div class="timeline-item">
              <div class="item-date">${escapeHtml(edu.date_range)}</div>
              <div>
                <div class="item-header">
                  <span class="role-title">${escapeHtml(edu.institution)}</span>
                  <span class="location-text">${escapeHtml(edu.location)}</span>
                </div>
                <div class="sub-institution" style="font-weight: 400;">${escapeHtml(edu.degree)}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="grid-span-all"><hr class="section-divider" /></div>
      ` : ''}

      <!-- Skills Split Array Node Row -->
      ${skills.length ? `
        <div class="left-rail-title">Skills</div>
        <div class="skills-container">
          \${skills.map(skill => `<div>&bull; ${escapeHtml(skill)}</div>`).join('')}
        </div>
        \${certificates.length ? '<div class="grid-span-all"><hr class="section-divider" /></div>' : ''}
      ` : ''}

      <!-- Certifications Node Row -->
      ${certificates.length ? `
        <div class="left-rail-title">Certifications</div>
        <div>
          \${certificates.map(cert => `
            <div class="timeline-item">
              <div class="item-date">${escapeHtml(cert.date)}</div>
              <div>
                <div class="item-header">
                  <span class="role-title">${escapeHtml(cert.title)}</span>
                </div>
                <div class="sub-institution" style="font-weight: 400; color: #555555;">${escapeHtml(cert.issuer)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

    </main>
  </div>
</body>
</html>`;
}

/**
 * XSS injection defense escape string processing utility helper function
 */
function escapeHtml(string) {
  return String(string ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
