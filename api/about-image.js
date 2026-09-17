import { tursoQuery } from 'lib/turso';

export const access = 'public';
export const methods = ['GET'];

export default async function (req, res) {
  try {
    const { rows } = await tursoQuery(`SELECT about_image_url FROM portfolio_settings LIMIT 1`);
    const url = String(rows?.[0]?.about_image_url || '');
    if (!url) return res.status(404).send('');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return res.redirect(url);
  } catch (error) {
    console.error('about-image error', error.message);
    return res.status(404).send('');
  }
}