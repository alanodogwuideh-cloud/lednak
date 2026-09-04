import { uploadStorageObject } from 'lib/supabase-admin';
import crypto from 'node:crypto';

// Owner-only legacy upload endpoint.
export const access = 'admin';
export const methods = ['POST'];

export default async function (req, res) {
  const file = req.files?.[0];
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const safe = String(file.filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `portfolio/misc/${Date.now()}-${crypto.randomUUID()}-${safe}`;
  const url = await uploadStorageObject('portfolio-images', key, file.buffer, file.contentType || 'application/octet-stream');
  return res.status(201).json({ url, key, filename: file.filename });
}