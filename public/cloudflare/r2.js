const encoder = new TextEncoder();
const PUBLIC_BASE = 'https://pub-05b8c3177ce444d385936988156c52c2.r2.dev';
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async value => hex(await crypto.subtle.digest('SHA-256', value));
const hmac = async (key, value) => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(value)));
const awsEncode = value => encodeURIComponent(String(value)).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function config(env) {
  const account = String(env.R2_ACCOUNT_ID || '');
  const bucket = String(env.R2_BUCKET_NAME || '');
  const accessKey = String(env.R2_ACCESS_KEY_ID || '');
  const secret = String(env.R2_SECRET_ACCESS_KEY || '');
  if (!account || !bucket || !accessKey || !secret) throw new Error('Cloudflare R2 environment variables are not configured.');
  return { account, bucket, accessKey, secret };
}
function objectPath(key) {
  const value = String(key || '').replace(/^\/+/, '');
  const segments = value.split('/');
  if (!value || value.length > 1024 || segments.some(part => !part || part === '.' || part === '..')) throw new Error('Invalid R2 object key.');
  return value;
}
export const r2PublicUrl = key => PUBLIC_BASE + '/' + objectPath(key).split('/').map(encodeURIComponent).join('/');
export function r2KeyFromPublicUrl(url) {
  const value = String(url || '');
  const prefix = PUBLIC_BASE + '/';
  if (!value.startsWith(prefix)) return '';
  try { return decodeURIComponent(value.slice(prefix.length)); } catch { return ''; }
}
export const normalizeR2Url = value => {
  const raw = String(value || '');
  if (!raw) return '';
  if (raw.startsWith(PUBLIC_BASE + '/')) return raw;
  if (raw.startsWith('portfolio/')) return r2PublicUrl(raw);
  return raw;
};
async function signQuery(env, method, key, expires = 3600, contentType = '') {
  const { account, bucket, accessKey, secret } = config(env);
  const cleanKey = objectPath(key);
  const host = account + '.r2.cloudflarestorage.com';
  const path = '/' + bucket + '/' + cleanKey.split('/').map(awsEncode).join('/');
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const date = amzDate.slice(0, 8);
  const scope = date + '/auto/s3/aws4_request';
  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': accessKey + '/' + scope,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': contentType ? 'content-type;host' : 'host'
  };
  const canonicalQuery = Object.keys(params).sort().map(keyName => awsEncode(keyName) + '=' + awsEncode(params[keyName])).join('&');
  const canonicalHeaders = contentType ? 'content-type:' + contentType + '\nhost:' + host + '\n' : 'host:' + host + '\n';
  const signedHeaders = contentType ? 'content-type;host' : 'host';
  const canonicalRequest = method + '\n' + path + '\n' + canonicalQuery + '\n' + canonicalHeaders + '\n' + signedHeaders + '\nUNSIGNED-PAYLOAD';
  const stringToSign = 'AWS4-HMAC-SHA256\n' + amzDate + '\n' + scope + '\n' + await sha256(encoder.encode(canonicalRequest));
  let signingKey = await hmac(encoder.encode('AWS4' + secret), date);
  signingKey = await hmac(signingKey, 'auto');
  signingKey = await hmac(signingKey, 's3');
  signingKey = await hmac(signingKey, 'aws4_request');
  const signature = hex(await hmac(signingKey, stringToSign));
  return { url: 'https://' + host + path + '?' + canonicalQuery + '&X-Amz-Signature=' + signature, contentType };
}
export async function signR2Put(env, key, contentType) {
  const type = String(contentType || 'application/octet-stream').trim().toLowerCase();
  // Do not include Content-Type in the signature. Browsers and proxies can normalize
  // this header differently; signing only host avoids false SignatureDoesNotMatch errors.
  const signed = await signQuery(env, 'PUT', key, 3600, '');
  return { ...signed, contentType: type };
}
export async function uploadR2Object(env, key, bytes, contentType) {
  const signed = await signR2Put(env, key, contentType);
  const response = await fetch(signed.url, { method: 'PUT', headers: { 'content-type': signed.contentType }, body: bytes });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    // R2 returns structured XML error codes (for example SignatureDoesNotMatch).
    // Preserve a short sanitized excerpt in server logs to diagnose rejected uploads.
    const safeDetails = String(details || '').replace(/(AWSAccessKeyId|Credential|Signature|X-Amz-[A-Za-z-]+)=?[^<&\s]*/gi, '$1=[redacted]').slice(0, 500);
    throw new Error('R2 upload failed: ' + response.status + (safeDetails ? ' ' + safeDetails : ''));
  }
  return r2PublicUrl(key);
}
export async function deleteR2Object(env, key) {
  if (!key) return;
  const signed = await signQuery(env, 'DELETE', key);
  const response = await fetch(signed.url, { method: 'DELETE' });
  if (!response.ok && response.status !== 404) throw new Error('R2 delete failed: ' + response.status);
}
export async function verifyR2Object(env, key) {
  const signed = await signQuery(env, 'HEAD', key);
  const response = await fetch(signed.url, { method: 'HEAD' });
  if (!response.ok) throw new Error('R2 object verification failed: ' + response.status);
  return true;
}