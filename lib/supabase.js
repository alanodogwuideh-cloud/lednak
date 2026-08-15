const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) throw new Error('Supabase configuration is missing.');

export async function supabase(path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('Supabase request failed', { status: response.status, path, body: body.slice(0, 300) });
    throw new Error(`Supabase request failed: ${response.status}`);
  }

  return response.json();
}