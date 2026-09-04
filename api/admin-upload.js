import { uploadStorageObject } from 'lib/supabase-admin';
import { requireSupabaseAdmin } from 'lib/admin-auth';
import crypto from 'node:crypto';

// Owner-only legacy upload endpoint authenticated by the portfolio's Supabase admin account.
export const access = 'public';
export const methods = ['POST'];

export default async function (req, res) {
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const file = req.files?.[0];
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const safe = String(file.filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `portfolio/misc/${Date.now()}-${crypto.randomUUID()}-${safe}`;
  const url = await uploadStorageObject('portfolio-images', key, file.buffer, file.contentType || 'application/octet-stream');
  return res.status(201).json({ url, key, filename: file.filename });
}