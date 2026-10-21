import { tursoQuery } from 'lib/turso';
import { requireSupabaseAdmin } from 'lib/admin-auth';

export const access = 'public';
export const methods = ['GET','POST','PUT','DELETE'];

const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const arr = value => Array.isArray(value) ? value : [];
const skillItems = value => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map(item => text(item,100)).filter(Boolean).slice(0,100);
const parseStoredJson = (value, fallback = {}) => { if (value == null || value === '') return fallback; if (typeof value === 'object') return value; try { return JSON.parse(String(value)); } catch { return fallback; } };

function snapshotFromProfile(profile) {
  const contact = obj(profile.contact);
  const summary = arr(profile.summaries).find(x => text(x?.text, 2500));
  return {
    contact: {
      fullName: text(contact.fullName,160), email: text(contact.email,254),
      phone: text(contact.phone,80), location: text(contact.location,160),
      links: arr(contact.links).map(x => ({ label:text(x?.label,80), url:text(x?.url,500), hidden:false }))
    },
    summary: summary ? text(summary.text,2500) : '',
    summaryLabel: summary ? text(summary.label,120) : '',
    sectionOrder: ['summary','experience','projects','skills','education','certifications'],
    sectionTitles: { summary:'Professional Summary', experience:'Experience', projects:'Projects', skills:'Skills', education:'Education', certifications:'Certifications' },
    hiddenSections: [],
    experience: arr(profile.experience).map(x => ({
      id:text(x?.id,80) || crypto.randomUUID(), company:text(x?.company,180), title:text(x?.title,180),
      location:text(x?.location,160), startDate:text(x?.startDate,40), endDate:text(x?.current ? 'Present' : x?.endDate,40),
      current:x?.current===true, hidden:false,
      bullets:arr(x?.bullets).map(b=>({id:text(b?.id,80)||crypto.randomUUID(),text:text(b?.text,2000),hidden:false}))
    })),
    projects: arr(profile.projects).map(x => ({
      id:text(x?.id,80)||crypto.randomUUID(), name:text(x?.name,180), url:text(x?.url,500),
      description:text(x?.description,2000), hidden:false,
      bullets:arr(x?.bullets).map(b=>({id:text(b?.id,80)||crypto.randomUUID(),text:text(b?.text,2000),hidden:false}))
    })),
    skills: arr(profile.skills).map(x=>({id:crypto.randomUUID(),category:text(x?.category,100),items:skillItems(x?.items),hidden:false})),
    education: arr(profile.education).map(x=>({
      id:text(x?.id,80)||crypto.randomUUID(), institution:text(x?.institution,180), degree:text(x?.degree,180),
      field:text(x?.field,180), startDate:text(x?.startDate,40), endDate:text(x?.endDate,40), notes:text(x?.notes,1200), hidden:false
    })),
    certifications: arr(profile.certifications).map(x=>({id:text(x?.id,80)||crypto.randomUUID(),name:text(x?.name,180),issuer:text(x?.issuer,180),date:text(x?.date,80),hidden:false}))
  };
}
function normalizeContent(value) {
  const content = obj(value);
  const sections = ['summary','experience','projects','skills','education','certifications'];
  const out = {
    contact: {...obj(content.contact),headline:text(obj(content.contact).headline,180)},
    languages: arr(content.languages).slice(0,30).map(x=>({name:text(x?.name,100),proficiency:text(x?.proficiency,60)})),
    references: arr(content.references).slice(0,30).map(x=>({name:text(x?.name,160),title:text(x?.title,160),company:text(x?.company,160),email:text(x?.email,254),phone:text(x?.phone,80)})),
    accent: /^#[0-9a-fA-F]{6}$/.test(content.accent||'')?content.accent:'#23395B',
    pageSize: ['letter','a4'].includes(content.pageSize)?content.pageSize:'letter',
    summary: text(content.summary,2500),
    summaryLabel: text(content.summaryLabel,120),
    sectionOrder: arr(content.sectionOrder).filter(x=>sections.includes(x)).slice(0,sections.length),
    sectionTitles: Object.fromEntries(sections.map(k=>[k,text(obj(content.sectionTitles)[k],100)||({summary:'Professional Summary',experience:'Experience',projects:'Projects',skills:'Skills',education:'Education',certifications:'Certifications'}[k])])),
    hiddenSections: arr(content.hiddenSections).filter(x=>sections.includes(x)),
    experience: arr(content.experience).slice(0,50).map(x=>({...obj(x),id:text(x?.id,80)||crypto.randomUUID(),company:text(x?.company,180),title:text(x?.title,180),location:text(x?.location,160),startDate:text(x?.startDate,40),endDate:text(x?.endDate,40),current:x?.current===true,hidden:x?.hidden===true,bullets:arr(x?.bullets).slice(0,40).map(b=>({...obj(b),id:text(b?.id,80)||crypto.randomUUID(),text:text(b?.text,2000),hidden:b?.hidden===true}))})),
    projects: arr(content.projects).slice(0,50).map(x=>({...obj(x),id:text(x?.id,80)||crypto.randomUUID(),name:text(x?.name,180),url:text(x?.url,500),description:text(x?.description,2000),hidden:x?.hidden===true,bullets:arr(x?.bullets).slice(0,40).map(b=>({...obj(b),id:text(b?.id,80)||crypto.randomUUID(),text:text(b?.text,2000),hidden:b?.hidden===true}))})),
    skills: arr(content.skills).slice(0,50).map(x=>({...obj(x),id:text(x?.id,80)||crypto.randomUUID(),category:text(x?.category,100),items:skillItems(x?.items),hidden:x?.hidden===true})),
    education: arr(content.education).slice(0,30).map(x=>({...obj(x),id:text(x?.id,80)||crypto.randomUUID(),institution:text(x?.institution,180),degree:text(x?.degree,180),field:text(x?.field,180),startDate:text(x?.startDate,40),endDate:text(x?.endDate,40),notes:text(x?.notes,1200),hidden:x?.hidden===true})),
    certifications: arr(content.certifications).slice(0,50).map(x=>({...obj(x),id:text(x?.id,80)||crypto.randomUUID(),name:text(x?.name,180),issuer:text(x?.issuer,180),date:text(x?.date,80),hidden:x?.hidden===true}))
  };
  for (const section of sections) if (!out.sectionOrder.includes(section)) out.sectionOrder.push(section);
  out.contact = {
    fullName:text(out.contact.fullName,160),email:text(out.contact.email,254),phone:text(out.contact.phone,80),location:text(out.contact.location,160),
    headline:text(out.contact.headline,180),
    links:arr(out.contact.links).slice(0,20).map(x=>({label:text(x?.label,80),url:text(x?.url,500),hidden:x?.hidden===true}))
  };
  if (JSON.stringify(out).length > 250000) throw Object.assign(new Error('This resume is too large to save.'),{status:413});
  return out;
}
export default async function(req,res) {
  const auth = await requireSupabaseAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({error:auth.error});
  try {
    const id = text(req.query?.id || req.body?.id,80);
    if (req.method === 'GET') {
      if (id) {
        const {rows}=await tursoQuery('SELECT id,title,template,content,created_at,updated_at FROM resumes WHERE id=$1 LIMIT 1',[id]);
        if (!rows[0]) return res.status(404).json({error:'Resume not found.'});
        return res.json({...rows[0],content:normalizeContent(parseStoredJson(rows[0].content,{}))});
      }
      const {rows}=await tursoQuery('SELECT id,title,template,created_at,updated_at,job_id FROM resumes ORDER BY updated_at DESC,id DESC');
      return res.json(rows);
    }
    if (req.method === 'POST') {
      const body=obj(req.body);
      if (body.action==='duplicate') {
        const sourceId=text(body.id,80);
        const {rows}=await tursoQuery('SELECT title,template,content FROM resumes WHERE id=$1 LIMIT 1',[sourceId]);
        if (!rows[0]) return res.status(404).json({error:'Resume not found.'});
        const title=text(body.title,160)||('Copy of '+rows[0].title).slice(0,160);
        const content=normalizeContent(parseStoredJson(rows[0].content,{}));
        const created=await tursoQuery('INSERT INTO resumes (title,template,content,created_at,updated_at) VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id',[title,rows[0].template||'us',JSON.stringify(content)]);
        const newId=created.rows[0]?.id;
        if (!newId) throw new Error('The duplicate resume could not be created.');
        await tursoQuery('INSERT INTO resume_versions (resume_id,content,created_at) VALUES ($1,$2,CURRENT_TIMESTAMP)',[newId,JSON.stringify(content)]);
        const {rows:result}=await tursoQuery('SELECT id,title,template,content,created_at,updated_at FROM resumes WHERE id=$1 LIMIT 1',[newId]);
        return res.status(201).json({...result[0],content:normalizeContent(parseStoredJson(result[0].content,{}))});
      }
      // New resumes start completely blank; the Master Profile and existing resumes remain untouched.
      const content=normalizeContent({
        contact:{fullName:'',email:'',phone:'',location:'',links:[]},
        summary:'',summaryLabel:'',
        sectionOrder:['summary','experience','projects','skills','education','certifications'],
        sectionTitles:{summary:'Professional Summary',experience:'Experience',projects:'Projects',skills:'Skills',education:'Education',certifications:'Certifications'},
        hiddenSections:[],experience:[],projects:[],skills:[],education:[],certifications:[]
      });
      const title=text(body.title,160)||'Untitled Resume';
      const template='us';
      const created=await tursoQuery('INSERT INTO resumes (title,template,content,created_at,updated_at) VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id',[title,template,JSON.stringify(content)]);
      const newId=created.rows[0]?.id;
      if (!newId) throw new Error('The resume could not be created.');
      await tursoQuery('INSERT INTO resume_versions (resume_id,content,created_at) VALUES ($1,$2,CURRENT_TIMESTAMP)',[newId,JSON.stringify(content)]);
      const {rows}=await tursoQuery('SELECT id,title,template,content,created_at,updated_at FROM resumes WHERE id=$1 LIMIT 1',[newId]);
      return res.status(201).json({...rows[0],content:normalizeContent(parseStoredJson(rows[0].content,{}))});
    }
    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({error:'Resume ID is required.'});
      const {rows:existing}=await tursoQuery('SELECT id FROM resumes WHERE id=$1 LIMIT 1',[id]);
      if (!existing[0]) return res.status(404).json({error:'Resume not found.'});
      const body=obj(req.body), content=normalizeContent(body.content), title=text(body.title,160)||'Untitled Resume';
      await tursoQuery('INSERT INTO resume_versions (resume_id,content,created_at) SELECT id,content,CURRENT_TIMESTAMP FROM resumes WHERE id=$1',[id]);
      await tursoQuery('DELETE FROM resume_versions WHERE resume_id=$1 AND id NOT IN (SELECT id FROM resume_versions WHERE resume_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20)',[id,id]);
      await tursoQuery('UPDATE resumes SET title=$1,template=$2,content=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$4',[title,'us',JSON.stringify(content),id]);
      const {rows}=await tursoQuery('SELECT id,title,template,content,created_at,updated_at FROM resumes WHERE id=$1 LIMIT 1',[id]);
      return res.json({...rows[0],content:normalizeContent(parseStoredJson(rows[0].content,{}))});
    }
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({error:'Resume ID is required.'});
      await tursoQuery('DELETE FROM cover_letters WHERE resume_id=$1',[id]);
      await tursoQuery('DELETE FROM resume_versions WHERE resume_id=$1',[id]);
      const {rows}=await tursoQuery('DELETE FROM resumes WHERE id=$1 RETURNING id',[id]);
      if (!rows.length) return res.status(404).json({error:'Resume not found.'});
      return res.json({ok:true,id});
    }
    return res.status(405).json({error:'Method not allowed.'});
  } catch(error) {
    const status=Number(error?.status)||500;
    if(status>=500) console.error('Resume Studio resume operation failed:',String(error?.message||'Unknown error'));
    return res.status(status).json({error:status>=500?'The resume operation failed. Your current edits have not been confirmed saved.':error.message});
  }
}