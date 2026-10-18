import { requireSupabaseAdmin } from 'lib/admin-auth';

export const access = 'public';
export const methods = ['GET', 'POST', 'PUT'];

const UPSTREAM = 'https://alanodogwuideh.com/api/admin-resume-studio';

export default async function(req, res) {
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const incoming = new URL(req.url, 'https://hatchable.local');
  const target = UPSTREAM + incoming.search;
  const headers = new Headers();
  const authorization = req.headers?.authorization || req.headers?.Authorization;
  if (authorization) headers.set('Authorization', authorization);
  const contentType = req.headers?.['content-type'] || req.headers?.['Content-Type'];
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('Accept', 'application/json');

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (contentType && contentType.includes('multipart/form-data')) {
      body = req;
    } else if (typeof req.body === 'string') {
      body = req.body;
    } else if (req.body !== undefined && req.body !== null) {
      body = JSON.stringify(req.body);
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    }
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: 'manual'
    });
    const text = await upstream.text();
    let payload;
    try { payload = JSON.parse(text); }
    catch {
      console.error('Resume Studio upstream returned non-JSON', upstream.status, text.slice(0, 240));
      return res.status(502).json({ error: 'Resume Studio API returned an unexpected response. Check that the Cloudflare Worker deployment includes the admin-resume-studio route.' });
    }
    if (!upstream.ok) {
      console.error('Resume Studio upstream error', upstream.status, payload?.error || 'Unknown upstream error');
      return res.status(upstream.status).json({
        error: payload?.error || `Resume Studio API request failed (HTTP ${upstream.status}).`
      });
    }
    return res.status(upstream.status).json(payload);
  } catch (error) {
    console.error('Resume Studio proxy failure', error?.message || 'Unknown network error');
    return res.status(502).json({ error: 'Could not reach the Cloudflare Resume Studio API. Verify the production Worker deployment and route.' });
  }
}