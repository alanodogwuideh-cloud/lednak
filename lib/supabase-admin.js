const base = () => String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

function authHeaders(extra = {}) {
  const serviceKey = key();
  if (!serviceKey) throw new Error('Supabase service role key is missing.');
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

export async function supabaseAdmin(path, options = {}) {
  const response = await fetch(`${base()}/rest/v1/${path}`, {
    ...options,
    headers: authHeaders({
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    }),
  });
  const text = await response.text().catch(() => '');
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = typeof data === 'string' ? data : (data?.message || data?.hint || data?.details || `Supabase request failed: ${response.status}`);
    throw new Error(message);
  }
  return data;
}

export function publicStorageUrl(bucket, path) {
  return `${base()}/storage/v1/object/public/${encodeURIComponent(bucket)}/${String(path).split('/').map(encodeURIComponent).join('/')}`;
}

export async function uploadStorageObject(bucket, path, buffer, contentType) {
  const response = await fetch(`${base()}/storage/v1/object/${bucket}/${String(path).split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': contentType || 'application/octet-stream',
      'x-upsert': 'true',
      'cache-control': '3600',
    }),
    body: buffer,
  });
  const text = await response.text().catch(() => '');
  if (!response.ok) {
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    throw new Error(typeof data === 'string' ? data : (data?.message || 'Supabase Storage upload failed.'));
  }
  return publicStorageUrl(bucket, path);
}

export async function deleteStorageObject(bucket, path) {
  if (!path) return;
  const response = await fetch(`${base()}/storage/v1/object/${bucket}/${String(path).split('/').map(encodeURIComponent).join('/')}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Supabase Storage delete failed: ${response.status}`);
  }
}

export function storagePathFromPublicUrl(url, bucket = 'portfolio-images') {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const value = String(url || '');
  const index = value.indexOf(marker);
  if (index < 0) return '';
  return decodeURIComponent(value.slice(index + marker.length));
}