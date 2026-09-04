import { db, storage } from 'hatchable';

export const access = 'public';
export const methods = ['GET'];

export default async function(req,res){
  try {
    const { rows } = await db.query('SELECT favicon_key, updated_at FROM site_branding ORDER BY updated_at DESC LIMIT 1');
    const key = rows[0]?.favicon_key;
    if(!key) return res.status(404).send('');
    const file = await storage.get(key);
    res.setHeader('Content-Type', file.contentType || 'image/svg+xml');
    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma','no-cache');
    res.setHeader('Expires','0');
    return res.send(file.buffer);
  } catch(e) {
    return res.status(404).send('');
  }
}