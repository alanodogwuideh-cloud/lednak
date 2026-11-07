import { tursoQuery } from 'lib/turso';

export const access = 'public';
export const methods = ['GET'];

const xml = value => String(value || '').replace(/[<>&'"]/g, char => ({
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;',
}[char]));

export default async function (req, res) {
  try {
    const { rows } = await tursoQuery(
      `SELECT slug, updated_at FROM case_studies
       WHERE status = $1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, created_at ASC`,
      ['published'],
    );
    const urls = [
      '<url><loc>https://alanodogwuideh.com/</loc></url>',
      ...(rows || []).filter(row => row.slug).map(row => {
        let lastmod = '';
        if (row.updated_at) {
          const timestamp = Date.parse(row.updated_at);
          if (Number.isFinite(timestamp)) {
            lastmod = `<lastmod>${new Date(timestamp).toISOString()}</lastmod>`;
          }
        }
        return `<url><loc>https://alanodogwuideh.com/case-study?slug=${encodeURIComponent(row.slug)}</loc>${lastmod}</url>`;
      }),
    ];
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    return res.status(200).send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,
    );
  } catch (error) {
    console.error('sitemap error', error.message);
    return res.status(500).send('Sitemap temporarily unavailable');
  }
}