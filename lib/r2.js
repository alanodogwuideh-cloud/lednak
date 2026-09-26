const E = new TextEncoder();
const PUBLIC_BASE = 'https://pub-05b8c3177ce444d385936988156c52c2.r2.dev';

const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async value => hex(await crypto.subtle.digest('SHA-256', value));
const hmac = async (key, value) => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), E.encode(value)));
const awsEncode = value => encodeURIComponent(String(value)).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const config = () => {
  const account = String(process.env.R2_ACCOUNT_ID || '');
  const bucket = String(process.env.R2_BUCKET_NAME || '');
  const accessKey = String(process.env.R2_ACCESS_KEY_ID || '');
  const secret = String(process.env.R2_SECRET_ACCESS_KEY || '');
  if (!account || !bucket || !accessKey || !secret) throw new Error('R2 configuration is incomplete.');
  return { account, bucket, accessKey, secret };
};

function objectPath(key) {
  const value = String(key || '').replace(/^\/+/, '');
  if (!value || value.includes('..') || value.length > 1024) throw new Error('Invalid R2 object key.');
  return value;
}

export function r2PublicUrl(key) {
  return `${PUBLIC_BASE}/${objectPath(key).split('/').map(encodeURIComponent).join('/')}`;
}

async function signQuery(method, key, expires = 3600, contentType = '') {
  const { account, bucket, accessKey, secret } = config();
  const cleanKey = objectPath(key);
  const host = `${account}.r2.cloudflarestorage.com`;
  const path = `/${bucket}/${cleanKey.split('/').map(encodeURIComponent).join('/')}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const date = amzDate.slice(0, 8);
  const scope = `${date}/auto/s3/aws4_request`;
  const credential = `${accessKey}/${scope}`;
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': contentType ? 'content-type;host' : 'host',
  };
  const canonicalQuery = Object.keys(params).sort().map(k => `${awsEncode(k)}=${awsEncode(params[k])}`).join('&');
  const canonicalHeaders = contentType ? `content-type:${contentType}\nhost:${host}\n` : `host:${host}\n`;
  const signedHeaders = contentType ? 'content-type;host' : 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalRequest = `${method}\n${path}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256(E.encode(canonicalRequest))}`;
  let signingKey = await hmac(E.encode(`AWS4${secret}`), date);
  signingKey = await hmac(signingKey, 'auto');
  signingKey = await hmac(signingKey, 's3');
  signingKey = await hmac(signingKey, 'aws4_request');
  const signature = hex(await hmac(signingKey, stringToSign));
  return {
    url: `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    contentType,
  };
}

export async function signR2Put(key, contentType) {
  return signQuery('PUT', key, 3600, String(contentType || 'application/octet-stream'));
}

export async function verifyR2Object(key) {
  const signed = await signQuery('HEAD', key);
  const response = await fetch(signed.url, { method: 'HEAD' });
  if (!response.ok) throw new Error('R2 object verification failed: ' + response.status);
  return true;
}

export async function uploadR2Object(key, buffer, contentType) {
  const signed = await signR2Put(key, contentType);
  const response = await fetch(signed.url, {
    method: 'PUT',
    headers: { 'Content-Type': signed.contentType },
    body: buffer,
  });
  if (!response.ok) throw new Error(`R2 upload failed: ${response.status}`);
  return r2PublicUrl(key);
}

export async function deleteR2Object(key) {
  if (!key) return;
  const signed = await signQuery('DELETE', key);
  const response = await fetch(signed.url, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) throw new Error(`R2 delete failed: ${response.status}`);
}

export function r2KeyFromPublicUrl(url) {
  const value = String(url || '');
  const prefix = `${PUBLIC_BASE}/`;
  if (!value.startsWith(prefix)) return '';
  return decodeURIComponent(value.slice(prefix.length));
}

export function normalizeR2Url(url) {
  const value = String(url || '');
  if (value.startsWith(`${PUBLIC_BASE}/`)) return value;
  const marker = '/api/r2-media?key=';
  const index = value.indexOf(marker);
  if (index < 0) return value;
  try { return r2PublicUrl(decodeURIComponent(value.slice(index + marker.length).split('&')[0])); } catch { return value; }
}