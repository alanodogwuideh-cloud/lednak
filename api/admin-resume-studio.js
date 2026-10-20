/**
 * Hatchable bridge for Resume Studio AI requests.
 * The AI implementation runs in the Cloudflare Pages Worker; forward the
 * authenticated request and response without exposing server credentials.
 */
export const access = 'public';
export const methods = ['POST', 'OPTIONS'];

const CLOUDFLARE_ENDPOINT = 'https://alanodogwuideh.com/api/admin-resume-studio';
const ALLOWED_ORIGINS = new Set([
  'https://alan-odogwuideh-ux-5at3.hatchable.site',
  'https://alanodogwuideh.com',
  'https://www.alanodogwuideh.com'
]);

export default async function handler(request) {
  const origin = request.headers.get('Origin') || '';
  const cors = {};
  if (ALLOWED_ORIGINS.has(origin)) {
    cors['Access-Control-Allow-Origin'] = origin;
    cors['Access-Control-Allow-Credentials'] = 'true';
    cors['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    cors['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    cors['Vary'] = 'Origin';
  }
  if (request.method === 'OPTIONS') {
    if (!ALLOWED_ORIGINS.has(origin)) return new Response('Origin is not allowed.', { status: 403 });
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: cors });
  const authorization = request.headers.get('Authorization');
  if (!authorization) return Response.json({ error: 'Please sign in to the admin panel.' }, { status: 401, headers: cors });
  try {
    const upstream = await fetch(CLOUDFLARE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'Origin': 'https://alan-odogwuideh-ux-5at3.hatchable.site'
      },
      body: await request.text()
    });
    const headers = new Headers(cors);
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json; charset=utf-8');
    headers.set('Cache-Control', 'no-store');
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers });
  } catch {
    return Response.json({ error: 'Resume Studio AI service could not be reached. Please retry.' }, { status: 502, headers: cors });
  }
}