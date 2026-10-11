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
      try {
        const response = await handleCloudflareApi(request, env, ctx);
        if (response) return response;
        return json({ error: 'Cloudflare API route is not implemented yet.' }, 503);
      } catch (error) {
        console.error('Cloudflare API failure', error?.message || 'Unknown error');
        return json({ error: 'The service is temporarily unavailable.' }, 500);
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