# Resume Studio Core Templates (T1–T27)

This folder contains the 27 HTML-document renderers, the shared escaping/layout helpers, a template registry, and sample data.

- `index.js` exports `TEMPLATES` and `renderResume(idOrSlug, resumeJson)`.
- Every renderer returns a complete HTML document and uses a fixed 794px A4 sheet, zero @page margins, and the Arial-metric font stack specified by the source brief.
- Use the same returned HTML for preview and PDF; do not add CSS, margins, padding, or wrappers around the template document.
- PDF generation requires Cloudflare Browser Rendering to be configured as the `BROWSER` binding and the `@cloudflare/puppeteer` package to be available to the Cloudflare Pages Worker.
- The provided sample data is in `sample.json`.