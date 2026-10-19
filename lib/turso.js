const rawUrl = () => String(process.env.TURSO_DATABASE_URL || '').replace(/\/$/, '');
const token = () => process.env.TURSO_AUTH_TOKEN || '';

function baseUrl() {
  const raw = rawUrl();
  if (!raw) throw new Error('Turso database URL is not configured.');
  return raw.replace(/^libsql:/i, 'https:');
}

function cellValue(cell) {
  if (cell == null) return null;
  if (typeof cell !== 'object' || !('type' in cell)) return cell;
  if (cell.type === 'null') return null;
  if (cell.type === 'integer') return Number(cell.value);
  if (cell.type === 'float') return Number(cell.value);
  if (cell.type === 'blob') return cell.value;
  return cell.value ?? null;
}

function rowsFromResult(result) {
  const cols = result?.response?.result?.cols || [];
  const rows = result?.response?.result?.rows || [];
  return rows.map(row => {
    const out = {};
    cols.forEach((col, i) => { out[col.name] = cellValue(row[i]); });
    if (typeof out.content === 'string') {
      try { out.content = JSON.parse(out.content); } catch {}
    }
    return out;
  });
}

let resumeStudioSchemaPromise;
export async function ensureResumeStudioSchema() {
  if (!resumeStudioSchemaPromise) resumeStudioSchemaPromise = (async () => {
    const statements = [
      `CREATE TABLE IF NOT EXISTS master_profile (id INTEGER PRIMARY KEY CHECK (id = 1), profile_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, company TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'saved', analysis_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS resumes (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL, title TEXT NOT NULL, template TEXT NOT NULL DEFAULT 'us', content TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS resume_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, resume_id INTEGER NOT NULL REFERENCES resumes(id) ON DELETE CASCADE, content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS cover_letters (id INTEGER PRIMARY KEY AUTOINCREMENT, resume_id INTEGER NOT NULL UNIQUE REFERENCES resumes(id) ON DELETE CASCADE, content TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE INDEX IF NOT EXISTS idx_resumes_job_id ON resumes(job_id)`,
      `CREATE INDEX IF NOT EXISTS idx_resume_versions_resume_id ON resume_versions(resume_id)`,
      `CREATE INDEX IF NOT EXISTS idx_cover_letters_resume_id ON cover_letters(resume_id)`
    ];
    for (const sql of statements) await tursoQuery(sql);
  })();
  return resumeStudioSchemaPromise;
}

let trashSchemaPromise;
export async function ensureTrashSchema() {
  if (!trashSchemaPromise) trashSchemaPromise = (async () => {
    for (const [name, type] of [['deleted_at','TEXT'],['deleted_by','TEXT'],['previous_status','TEXT'],['previous_slug','TEXT']]) {
      try { await tursoQuery('ALTER TABLE case_studies ADD COLUMN ' + name + ' ' + type); }
      catch (error) { if (!/duplicate column|already exists/i.test(error.message || '')) throw error; }
    }
  })();
  return trashSchemaPromise;
}

export async function tursoQuery(sql, params = []) {
  // Keep the existing API SQL readable during the cutover while translating
  // the small PostgreSQL syntax subset used by this portfolio to SQLite.
  const normalizedSql = String(sql)
    .replace(/::jsonb\b/gi, '')
    .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\$(\d+)/g, '?');
  const positional = Array.isArray(params) ? params.map(value => {
    if (value === undefined || value === null) return { type: 'null' };
    if (typeof value === 'boolean') return { type: 'integer', value: value ? '1' : '0' };
    if (typeof value === 'number') return Number.isInteger(value) ? { type: 'integer', value: String(value) } : { type: 'float', value: String(value) };
    return { type: 'text', value: String(value) };
  }) : [];
  const args = positional.length ? positional : undefined;
  const stmt = args ? { sql: normalizedSql, args } : { sql: normalizedSql };
  const response = await fetch(baseUrl() + '/v2/pipeline', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt }, { type: 'close' }] }),
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`Turso returned invalid JSON (${response.status}).`); }
  if (!response.ok) throw new Error(payload?.error || `Turso request failed (${response.status}).`);
  const first = payload?.results?.[0];
  if (first?.type === 'error') throw new Error(first.error?.message || 'Turso query failed.');
  const result = first?.response?.result;
  if (!result) throw new Error('Turso returned no query result.');
  return {
    rows: rowsFromResult(first),
    rowCount: Number(result.affected_row_count || 0),
    changes: Number(result.affected_row_count || 0),
  };
}