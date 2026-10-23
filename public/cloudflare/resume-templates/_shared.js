/**
 * Resume Studio – shared helpers for the core templates.
 *
 * WHY THIS FILE EXISTS (root-cause of the "padding / font" problems):
 *  1. Fonts   – the old templates used `-apple-system, "Segoe UI", Roboto, Helvetica`.
 *               On a Linux/Chromium PDF renderer none of those exist, so the browser fell
 *               back to DejaVu Sans (much wider than Arial) and every line wrapped differently.
 *               The reference designs are Arial-metric (rendered as Arimo/Liberation Sans),
 *               so every template now uses FONT_STACK below.
 *  2. Padding – the old templates combined `@page { margin: 0.5in }` + `max-width: 800px`
 *               + `body { padding: 0 }`. Page margin and container width fought each other
 *               and full-bleed headers/sidebars could never touch the page edge.
 *               Now: `@page { margin: 0 }`, one fixed 794px A4 `.sheet`, and ALL spacing is
 *               padding that lives inside the template (so banners/sidebars go edge-to-edge).
 *  3. Pages   – `box-decoration-break: clone` repeats the sheet padding / sidebar colour on
 *               page 2+, and entries use `break-inside: avoid` so a job never splits badly.
 */
export const FONT_STACK = 'Arial, "Liberation Sans", Arimo, Helvetica, sans-serif';
export function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function linkLabel(url) {
  const u = String(url || '');
  if (/linkedin\./i.test(u)) return 'LinkedIn';
  if (/github\./i.test(u)) return 'GitHub';
  if (/(twitter|x)\.com/i.test(u)) return 'X';
  if (/behance\./i.test(u)) return 'Behance';
  if (/dribbble\./i.test(u)) return 'Dribbble';
  return u;
}
export function normalize(data = {}) {
  const p = data.personal_info || {};
  const links = (p.links || []).map((l) => (typeof l === 'string' ? { url: l, label: linkLabel(l) } : { url: l.url || l.href || '', label: l.label || linkLabel(l.url || l.href) })).filter((l) => l.url);
  const bullets = (b) => (b || []).map((x) => (typeof x === 'string' ? x : x?.text || '')).filter(Boolean);
  return {
    p: { name: p.name || '', location: p.location || '', phone: p.phone || '', email: p.email || '', links },
    summary: data.summary || '',
    jobs: (data.work_experience || []).map((j) => ({ role: j.role || '', company: j.company || '', location: j.location || '', date: j.date_range || j.date || '', bullets: bullets(j.bullets) })),
    edu: (data.education || []).map((e) => ({ institution: e.institution || '', degree: e.degree || '', location: e.location || '', date: e.date_range || e.date || '' })),
    skills: (data.skills || []).map((s) => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean),
    certs: (data.certificates || []).map((c) => ({ title: c.title || c.name || '', issuer: c.issuer || '', date: c.date || '' })),
  };
}
const ICON_PATHS = {
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
};
export function icon(kind, { size = 14, color = 'currentColor', knock = '#fff' } = {}) {
  const k = kind === 'link' ? 'globe' : kind;
  if (k === 'linkedin') return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="flex:none;display:inline-block;vertical-align:middle"><rect x="2" y="2" width="20" height="20" rx="4" fill="${color}"/><rect x="6" y="10" width="2.6" height="8" fill="${knock}"/><circle cx="7.3" cy="7.3" r="1.5" fill="${knock}"/><path d="M11 10h2.5v1.2c.5-.9 1.4-1.4 2.6-1.4 2.1 0 2.9 1.3 2.9 3.4V18h-2.6v-4.2c0-1-.3-1.7-1.3-1.7s-1.5.8-1.5 1.8V18H11z" fill="${knock}"/></svg>`;
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:inline-block;vertical-align:middle">${ICON_PATHS[k] || ICON_PATHS.globe}</svg>`;
}
export function contactItems(p, order = ['location', 'phone', 'email', 'links']) {
  const out = [];
  for (const key of order) {
    if (key === 'location' && p.location) out.push({ kind: 'pin', text: p.location, underline: false });
    if (key === 'phone' && p.phone) out.push({ kind: 'phone', text: p.phone, href: `tel:${p.phone}`, underline: true });
    if (key === 'email' && p.email) out.push({ kind: 'mail', text: p.email, href: `mailto:${p.email}`, underline: true });
    if (key === 'links') p.links.forEach((l) => out.push({ kind: /linkedin/i.test(l.url) ? 'linkedin' : 'globe', text: l.label, href: l.url, underline: true }));
  }
  return out;
}
export function contactHtml(item, { icons = false, iconSize = 14, iconColor = 'currentColor', knock = '#fff', gap = 6 } = {}) {
  const text = item.underline ? `<a href="${esc(item.href)}" style="color:inherit;text-decoration:underline">${esc(item.text)}</a>` : `<span>${esc(item.text)}</span>`;
  if (!icons) return text;
  return `<span class="ci" style="display:inline-flex;align-items:center;gap:${gap}px">${icon(item.kind, { size: iconSize, color: iconColor, knock })}${text}</span>`;
}
export function page({ title = 'Resume', css = '', body = '' }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>
@page { size: A4; margin: 0; }
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: ${FONT_STACK}; font-size: 14px; line-height: 1.25; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1, h2, h3, p, ul, li { margin: 0; padding: 0; } ul { list-style: none; } a { color: inherit; }
.sheet { position: relative; width: 794px; min-height: 1122px; margin: 0 auto; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.avoid { break-inside: avoid; page-break-inside: avoid; } .bullets { list-style: disc outside; } .bullets li { padding-left: 0; } .bullets li::marker { font-size: 0.9em; }
${css}
</style></head><body><div class="sheet">${body}</div></body></html>`;
}
export const joinText = (items, sep) => items.filter(Boolean).join(sep);
export const bulletList = (arr, cls = 'bullets') => arr && arr.length ? `<ul class="${cls}">${arr.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '';