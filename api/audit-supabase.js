export const access = 'scheduler';

const base = () => String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = () => ({ apikey: key(), Authorization: `Bearer ${key()}` });

async function supa(path, options = {}) {
  const r = await fetch(`${base()}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

async function listObjects(prefix = '', offset = 0) {
  const r = await supa('/storage/v1/object/list/portfolio-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
  });
  if (r.status !== 200 || !Array.isArray(r.data)) throw new Error(`Storage list failed at ${prefix}: ${r.status}`);
  return r.data;
}

async function walk(prefix = '', seen = new Set()) {
  const files = [];
  let offset = 0;
  while (true) {
    const batch = await listObjects(prefix, offset);
    if (!batch.length) break;
    for (const item of batch) {
      const name = String(item?.name || '');
      if (!name) continue;
      const full = prefix ? `${prefix}${name}` : name;
      if (item?.id) {
        files.push({ name: full, id: item.id, metadata: item.metadata || null, created_at: item.created_at || null, updated_at: item.updated_at || null, last_accessed_at: item.last_accessed_at || null });
      } else {
        const dir = full.endsWith('/') ? full : `${full}/`;
        if (!seen.has(dir)) { seen.add(dir); files.push(...await walk(dir, seen)); }
      }
    }
    if (batch.length < 1000) break;
    offset += batch.length;
  }
  return files;
}

export default async function (req, res) {
  try {
    const settings = await supa('/rest/v1/site_settings?select=setting_key,setting_value,updated_at&order=setting_key.asc');
    const sections = await supa('/rest/v1/case_study_sections?select=*&order=project_id.asc,display_order.asc');
    const storage = await walk('');
    const safeSettings = settings.status === 200 ? settings.data : settings.data;
    const referencedUrls = new Set();
    const collect = value => {
      if (value == null) return;
      if (typeof value === 'string') {
        const re = /https?:\/\/[^\\s\"']+\/storage\/v1\/object\/public\/portfolio-images\/[^\\s\"']+/g;
        for (const match of value.matchAll(re)) referencedUrls.add(match[0].replace(/[),.]+$/g, ''));
      } else if (Array.isArray(value)) value.forEach(collect);
      else if (typeof value === 'object') Object.values(value).forEach(collect);
    };
    collect(safeSettings);
    collect(sections.data);
    const caseStudies = await supa('/rest/v1/case_studies?select=id,slug,title,cover_image_url,hero_image_url,content&order=created_at.asc&limit=100');
    collect(caseStudies.data);
    const storageUrl = name => `${base()}/storage/v1/object/public/portfolio-images/${String(name).split('/').map(encodeURIComponent).join('/')}`;
    const referencedFiles = storage.filter(f => referencedUrls.has(storageUrl(f.name)));
    const unreferencedFiles = storage.filter(f => !referencedUrls.has(storageUrl(f.name)));
    const byPrefix = {};
    const byMime = {};
    for (const f of storage) {
      const first = String(f.name).split('/')[0] || '(root)';
      byPrefix[first] = (byPrefix[first] || 0) + 1;
      const mime = String(f.metadata?.mimetype || 'unknown');
      byMime[mime] = (byMime[mime] || 0) + 1;
    }
    const totalBytes = storage.reduce((sum, f) => sum + Number(f.metadata?.size || 0), 0);
    const referencedBytes = referencedFiles.reduce((sum, f) => sum + Number(f.metadata?.size || 0), 0);
    const unreferencedBytes = unreferencedFiles.reduce((sum, f) => sum + Number(f.metadata?.size || 0), 0);
    const duplicateGroups = Object.values(storage.reduce((acc, f) => {
      const etag = String(f.metadata?.eTag || '');
      if (!etag) return acc;
      (acc[etag] ||= []).push(f.name);
      return acc;
    }, {})).filter(group => group.length > 1);
    res.json({
      supabase_url: base(),
      site_settings: { status: settings.status, rows: safeSettings },
      case_study_sections: { status: sections.status, rows: sections.data },
      case_studies: { status: caseStudies.status, count: Array.isArray(caseStudies.data) ? caseStudies.data.length : null },
      storage: {
        bucket: 'portfolio-images',
        file_count: storage.length,
        total_bytes: totalBytes,
        total_mb: Math.round(totalBytes / 1048576 * 100) / 100,
        by_top_level_prefix: byPrefix,
        by_mime_type: byMime,
        referenced_file_count: referencedFiles.length,
        referenced_mb: Math.round(referencedBytes / 1048576 * 100) / 100,
        unreferenced_file_count: unreferencedFiles.length,
        unreferenced_mb: Math.round(unreferencedBytes / 1048576 * 100) / 100,
        duplicate_groups_by_etag: duplicateGroups,
        unreferenced_files: unreferencedFiles.map(f => ({ name: f.name, size: Number(f.metadata?.size || 0), mimetype: f.metadata?.mimetype || null, etag: f.metadata?.eTag || null })),
        files: storage
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}