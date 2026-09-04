import { supabaseAdmin } from 'lib/supabase-admin';

export const access = 'public';
export const methods = ['GET'];

export default async function (req, res) {
  try {
    const rows = await supabaseAdmin('site_settings?setting_key=eq.favicon_url&select=setting_value&limit=1');
    const url = rows?.[0]?.setting_value;
    if (!url) return res.status(404).send('');
    const file = await fetch(url);
    if (!file.ok) return res.status(404).send('');
    res.setHeader('Content-Type', file.headers.get('content-type') || 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.send(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    console.error('favicon error', error.message);
    return res.status(404).send('');
  }
}