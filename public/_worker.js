/**
 * Cloudflare Pages Advanced Mode entrypoint.
 *
 * Hatchable continues to use the existing api/ handlers. Cloudflare Pages uses
 * this worker entrypoint instead, so the two runtimes remain separate.
 *
 * This entrypoint is intentionally conservative until each CMS endpoint has
 * been ported and tested. Public assets continue to be served by Pages Assets.
 */
import { handleCloudflareApi } from './cloudflare/api.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const origin = request.headers.get('Origin') || '';
      const configuredOrigin = String(env.HATCHABLE_ORIGIN || 'https://alan-odogwuideh-ux-5at3.hatchable.site');
      const allowedOrigin = configuredOrigin.endsWith('/') ? configuredOrigin.slice(0, -1) : configuredOrigin;
      const isAllowedPreview = origin === allowedOrigin;
      if (request.method === 'OPTIONS') {
        // Resume Studio has its own explicit multi-origin CORS policy in the API
        // handler. Let it answer preflight instead of rejecting valid production
        // origins here at the generic preview-only gate.
        if (url.pathname.replace(/\/$/, '') === '/api/admin-resume-studio') {
          return await handleCloudflareApi(request, env, ctx);
        }
        if (!isAllowedPreview) return new Response(null, { status: 403 });
        return new Response(null, { status: 204, headers: {
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization,Content-Type',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin'
        }});
      }
      try {
        let response = await handleCloudflareApi(request, env, ctx);
        if (!response) response = json({ error: 'Cloudflare API route is not implemented yet.' }, 503);
        if (isAllowedPreview) {
          const headers = new Headers(response.headers);
          headers.set('Access-Control-Allow-Origin', allowedOrigin);
          headers.set('Access-Control-Allow-Credentials', 'true');
          headers.set('Vary', 'Origin');
          response = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
        }
        return response;
      } catch (error) {
        console.error('Cloudflare API failure', error?.message || 'Unknown error');
        const response = json({ error: 'The service is temporarily unavailable.' }, 500);
        if (!isAllowedPreview) return response;
        const headers = new Headers(response.headers);
        headers.set('Access-Control-Allow-Origin', allowedOrigin);
        headers.set('Access-Control-Allow-Credentials', 'true');
        headers.set('Vary', 'Origin');
        return new Response(response.body, { status: response.status, headers });
      }
    }

    // Cloudflare Pages serves the same static portfolio assets.
    return env.ASSETS.fetch(request);
  }
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}