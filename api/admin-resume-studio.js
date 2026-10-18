import { requireSupabaseAdmin } from 'lib/admin-auth';

export const access = 'public';
export const methods = ['GET', 'POST', 'PUT', 'DELETE'];

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
      const upstreamMessage = payload?.error || payload?.message || payload?.detail || payload?.title;
      const safeShape = payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 12) : [];
      console.error('Resume Studio upstream error', upstream.status, upstreamMessage || 'No error field in upstream JSON', 'keys:', safeShape.join(','));
      const cloudflareDetail = [payload?.detail, payload?.title, payload?.cloudflare_error].filter(Boolean).map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' | ').slice(0, 600);
      const diagnostic = payload?.diagnostic || cloudflareDetail || payload?.error_name || payload?.error_category || '';
      return res.status(upstream.status).json({
        error: upstreamMessage || `The production Cloudflare API returned HTTP ${upstream.status} without an error message. Its deployed response needs inspection.`,
        ...(diagnostic ? { diagnostic: String(diagnostic).slice(0, 600) } : {}),
        ...(payload?.stage ? { stage: String(payload.stage).slice(0, 80) } : {}),
        ...(payload?.error_code ? { error_code: String(payload.error_code).slice(0, 80) } : {}),
        ...(payload?.error_name ? { error_name: String(payload.error_name).slice(0, 120) } : {}),
        ...(payload?.error_category ? { error_category: String(payload.error_category).slice(0, 120) } : {}),
        ...(payload?.ray_id ? { ray_id: String(payload.ray_id).slice(0, 100) } : {}),
        ...(payload?.ok === false ? { ok: false } : {}),
        upstream_status: upstream.status,
        upstream_fields: safeShape
      });
    }
    return res.status(upstream.status).json(payload);
  } catch (error) {
    console.error('Resume Studio proxy failure', error?.message || 'Unknown network error');
    return res.status(502).json({ error: 'Could not reach the Cloudflare Resume Studio API. Verify the production Worker deployment and route.' });
  }
}