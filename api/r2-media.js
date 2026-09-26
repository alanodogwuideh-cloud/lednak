export const access = 'public';
export const methods = ['GET'];

const E = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async value => hex(await crypto.subtle.digest('SHA-256', value));
const hmac = async (key, value) => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), E.encode(value)));

async function signGet(key) {
  const account = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secret = process.env.R2_SECRET_ACCESS_KEY;
  if (!account || !bucket || !accessKey || !secret) throw new Error('R2 media configuration is incomplete.');
  const host = `${account}.r2.cloudflarestorage.com`;
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const path = `/${bucket}/${encodedKey}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const date = amzDate.slice(0, 8);
  const payloadHash = await sha256(E.encode(''));
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `GET\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${date}/auto/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256(E.encode(canonicalRequest))}`;
  let signingKey = await hmac(E.encode(`AWS4${secret}`), date);
  signingKey = await hmac(signingKey, 'auto');
  signingKey = await hmac(signingKey, 's3');
  signingKey = await hmac(signingKey, 'aws4_request');
  const signature = hex(await hmac(signingKey, stringToSign));
  return { url: `https://${host}${path}`, headers: {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }};
}

export default async function (req, res) {
  try {
    const key = String(req.query?.key || '').replace(/^\/+/, '');
    if (!key || key.includes('..') || key.length > 1024) return res.status(400).send('Invalid media key.');
    const signed = await signGet(key);
    const file = await fetch(signed.url, { headers: signed.headers });
    if (!file.ok) return res.status(file.status === 404 ? 404 : 502).send('Media not found.');
    const body = Buffer.from(await file.arrayBuffer());
    res.setHeader('Content-Type', file.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const etag = file.headers.get('etag');
    if (etag) res.setHeader('ETag', etag);
    return res.send(body);
  } catch (error) {
    console.error('r2-media error', error.message);
    return res.status(500).send('Media could not be loaded.');
  }
}