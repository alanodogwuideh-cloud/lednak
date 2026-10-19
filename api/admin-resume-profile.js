import { tursoQuery } from 'lib/turso';
import { requireSupabaseAdmin } from 'lib/admin-auth';

export const access = 'public';
export const methods = ['GET', 'PUT'];

const emptyProfile = () => ({
  contact: { fullName: '', email: '', phone: '', location: '', links: [] },
  summaries: [],
  experience: [],
  projects: [],
  skills: [],
  education: [],
  certifications: [],
});

const text = (value, max = 5000) => String(value ?? '').trim().slice(0, max);
const array = (value, max) => Array.isArray(value) ? value.slice(0, max) : [];
const makeId = value => text(value, 80) || crypto.randomUUID();

function normalizeProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('The profile must be a JSON object.'), { status: 400 });
  }
  const contact = input.contact && typeof input.contact === 'object' ? input.contact : {};
  const profile = {
    contact: {
      fullName: text(contact.fullName, 160),
      email: text(contact.email, 254),
      phone: text(contact.phone, 80),
      location: text(contact.location, 160),
      links: array(contact.links, 20).map(link => ({
        label: text(link?.label, 80),
        url: text(link?.url, 500),
      })),
    },
    summaries: array(input.summaries, 10).map(item => ({
      label: text(item?.label, 120),
      text: text(item?.text, 2500),
    })),
    experience: array(input.experience, 50).map(item => ({
      id: makeId(item?.id),
      company: text(item?.company, 180),
      title: text(item?.title, 180),
      location: text(item?.location, 160),
      startDate: text(item?.startDate, 40),
      endDate: text(item?.endDate, 40),
      current: item?.current === true,
      bullets: array(item?.bullets, 40).map(bullet => ({
        id: makeId(bullet?.id),
        text: text(bullet?.text, 2000),
        tags: array(bullet?.tags, 30).map(tag => text(tag, 80)).filter(Boolean),
      })),
    })),
    projects: array(input.projects, 50).map(item => ({
      id: makeId(item?.id),
      name: text(item?.name, 180),
      url: text(item?.url, 500),
      description: text(item?.description, 2000),
      bullets: array(item?.bullets, 40).map(bullet => ({
        id: makeId(bullet?.id),
        text: text(bullet?.text, 2000),
        tags: array(bullet?.tags, 30).map(tag => text(tag, 80)).filter(Boolean),
      })),
    })),
    skills: array(input.skills, 50).map(item => ({
      category: text(item?.category, 100),
      items: array(item?.items, 100).map(skill => text(skill, 100)).filter(Boolean),
    })),
    education: array(input.education, 30).map(item => ({
      id: makeId(item?.id),
      institution: text(item?.institution, 180),
      degree: text(item?.degree, 180),
      field: text(item?.field, 180),
      startDate: text(item?.startDate, 40),
      endDate: text(item?.endDate, 40),
      notes: text(item?.notes, 1200),
    })),
    certifications: array(input.certifications, 50).map(item => ({
      id: makeId(item?.id),
      name: text(item?.name, 180),
      issuer: text(item?.issuer, 180),
      date: text(item?.date, 80),
    })),
  };
  if (JSON.stringify(profile).length > 250000) {
    throw Object.assign(new Error('The master profile is too large. Please shorten some entries and try again.'), { status: 413 });
  }
  return profile;
}

export default async function (req, res) {
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  try {
    if (req.method === 'GET') {
      const { rows } = await tursoQuery('SELECT profile_json, updated_at FROM master_profile WHERE id=1 LIMIT 1');
      let profile = emptyProfile();
      if (rows[0]?.profile_json) {
        try { profile = normalizeProfile(JSON.parse(rows[0].profile_json)); }
        catch (error) {
          console.error('Resume Studio master profile could not be parsed.');
          return res.status(500).json({ error: 'The saved master profile could not be read safely.' });
        }
      }
      return res.json({ profile, updatedAt: rows[0]?.updated_at || null });
    }

    if (req.method === 'PUT') {
      const profile = normalizeProfile(req.body?.profile);
      const serialized = JSON.stringify(profile);
      await tursoQuery(
        'INSERT INTO master_profile (id, profile_json, created_at, updated_at) VALUES (1, $1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET profile_json=$1, updated_at=CURRENT_TIMESTAMP',
        [serialized]
      );
      const { rows } = await tursoQuery('SELECT updated_at FROM master_profile WHERE id=1 LIMIT 1');
      return res.json({ ok: true, profile, updatedAt: rows[0]?.updated_at || null });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error('Resume Studio master profile operation failed:', String(error?.message || 'Unknown error'));
    return res.status(status).json({ error: status >= 500 ? 'The master profile could not be saved. Your edits are still available in this page; please retry.' : error.message });
  }
}