import { uploadR2Object } from 'lib/r2';
import { requireSupabaseAdmin } from 'lib/admin-auth';
import crypto from 'node:crypto';

// Legacy compatibility upload endpoint. Storage is now Cloudflare R2.
export const access = 'public';
export const methods = ['POST'];

const safe = n => String(n || 'file').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 160);

export default async function (req, res) {
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  try {
    const file = req.files?.find(x => x.field === 'file') || req.files?.[0];
    if (!file) return res.status(400).json({ error: 'No file uploaded.' });
    if (file.buffer.length > 50 * 1024 * 1024) return res.status(413).json({ error: 'File is too large.' });
    const key = `portfolio/misc/${Date.now()}-${crypto.randomUUID()}-${safe(file.filename)}`;
    const url = await uploadR2Object(key, file.buffer, file.contentType || 'application/octet-stream');
    return res.status(201).json({ url, key, filename: file.filename });
  } catch (error) {
    console.error('admin-upload error', error.message);
    return res.status(500).json({ error: error.message || 'Upload failed.' });
  }
}