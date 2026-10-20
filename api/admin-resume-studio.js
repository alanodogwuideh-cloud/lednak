/**
 * Hatchable bridge for Resume Studio AI requests.
 * Cloudflare Pages Worker owns the AI implementation; this endpoint keeps the
 * browser request same-origin and forwards the authenticated payload.
 */
import { requireSupabaseAdmin } from 'lib/admin-auth';

export const access = 'public';
export const methods = ['POST'];

const CLOUDFLARE_ENDPOINT = 'https://alanodogwuideh.com/api/admin-resume-studio';

export default async function (req, res) {
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const upstream = await fetch(CLOUDFLARE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers?.authorization || ''
      },
      body: JSON.stringify(req.body || {})
    });
    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { error: 'The Resume Studio service returned an invalid response.' }; }
    return res.status(upstream.status).json(data);
  } catch (error) {
    console.error('Resume Studio Cloudflare bridge failed:', String(error?.message || 'Unknown error'));
    return res.status(502).json({ error: 'Resume Studio AI service could not be reached. Please retry.' });
  }
}