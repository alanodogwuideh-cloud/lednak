import { tursoQuery } from 'lib/turso';
import { r2PublicUrl } from 'lib/r2';

export const access = 'public';
export const methods = ['GET'];

export default async function (req, res) {
  try {
    const { rows } = await tursoQuery(`SELECT favicon_key FROM site_branding LIMIT 1`);
    const key = String(rows?.[0]?.favicon_key || '');
    if (!key || (!key.startsWith('http') && !key.startsWith('site/'))) return res.redirect('/favicon.svg');
    const url = key.startsWith('http') ? key : r2PublicUrl(key);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return res.redirect(url);
  } catch (error) {
    console.error('favicon error', error.message);
    return res.redirect('/favicon.svg');
  }
}