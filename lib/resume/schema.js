const text=(v,max=500)=>String(v??'').trim().slice(0,max);
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const arr=v=>Array.isArray(v)?v:[];
export function normalizeResumeExtras(value={}) {
 const x=obj(value), contact=obj(x.contact), settings=obj(x.settings);
 return {
  ...x,
  contact:{...contact,headline:text(contact.headline,180)},
  languages:arr(x.languages).slice(0,30).map(v=>({name:text(v?.name,100),proficiency:text(v?.proficiency,60)})),
  references:arr(x.references).slice(0,30).map(v=>({name:text(v?.name,160),title:text(v?.title,160),company:text(v?.company,160),email:text(v?.email,254),phone:text(v?.phone,80)})),
  accent:/^#[0-9a-fA-F]{6}$/.test(x.accent||'')?x.accent:'#23395B',
  pageSize:['letter','a4'].includes(x.pageSize)?x.pageSize:'letter',
  settings:{...settings}
 };
}
export function validateResume(value={}) {
 const normalized=normalizeResumeExtras(value);
 if(JSON.stringify(normalized).length>250000) throw new Error('Resume content is too large.');
 return normalized;
}