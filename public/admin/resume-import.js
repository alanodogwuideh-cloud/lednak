(() => {
'use strict';
const BULLET = /^[\s]*(?:[•●▪◦‣⁃∙*–—-]|\d+[.)])\s+/;
const HEADINGS = [
['summaries',/^(?:professional\s+)?(?:summary|profile|about me|career objective|objective|personal statement)$/i],
['experience',/^(?:(?:professional|work|employment|career)\s+)?(?:experience|history|work history|employment history)$/i],
['projects',/^(?:selected\s+)?(?:key\s+)?projects(?: and portfolio)?$/i],
['education',/^(?:education|academic background|qualifications|education and training)$/i],
['skills',/^(?:(?:technical|core|key|relevant)\s+)?skills|competencies|areas of expertise|tools(?: and technologies)?$/i],
['certifications',/^(?:certifications|certificates|licenses|professional certifications)$/i],
['awards',/^(?:awards|honors|honours|achievements)$/i],['languages',/^(?:languages|language proficiency)$/i],
['interests',/^(?:interests|hobbies|activities)$/i],['references',/^references|referees$/i]
];
const cleanHead = s => String(s||'').replace(/^[\s#|•*-]+|[\s:|•*-]+$/g,'').replace(/\s+/g,' ').trim();
const isHeading = s => HEADINGS.some(([,r])=>r.test(cleanHead(s)));
function normalize(source){
 const raw=String(source||'').replace(/\u0000/g,'').replace(/\r\n?/g,'\n').replace(/[‐‑‒–—]/g,'-').replace(/[●▪◦‣⁃∙]/g,'•').replace(/\u00a0/g,' ').split('\n').map(s=>s.replace(/[ \t]+/g,' ').trim()).filter(Boolean);
 const out=[];
 for(const line of raw){const prev=out[out.length-1]||'';const join=prev&&!isHeading(prev)&&!isHeading(line)&&!BULLET.test(prev)&&!BULLET.test(line)&&!/[.!?;:]$/.test(prev)&&prev.length<115&&/^[a-z(]/.test(line)&&!/@|https?:\/\/|www\.|^\+?\d[\d ().-]{7,}\d/.test(line);if(join)out[out.length-1]=prev+' '+line;else out.push(line);}
 return out.map((text,i)=>({n:i+1,text}));
}
function domainLabel(value){try{const u=new URL(/^https?:\/\//i.test(value)?value:'https://'+value);const h=u.hostname.toLowerCase().replace(/^www\./,'');if(h==='linkedin.com'||h.endsWith('.linkedin.com'))return'LinkedIn';if(h==='github.com'||h.endsWith('.github.com'))return'GitHub';if(['x.com','twitter.com'].some(d=>h===d||h.endsWith('.'+d)))return'X';if(h==='instagram.com'||h.endsWith('.instagram.com'))return'Instagram';if(['youtube.com','youtu.be'].some(d=>h===d||h.endsWith('.'+d)))return'YouTube';return'Website or Portfolio';}catch(_){return'Website or Portfolio';}}
function extractUrls(text){const withoutEmails=String(text||'').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'');const matches=withoutEmails.match(/(?:https?:\/\/|www\.)[^\s<>{}\[\]"']+|(?:linkedin\.com\/in\/|github\.com\/|instagram\.com\/|x\.com\/|twitter\.com\/)[^\s<>{}\[\]"']+|(?:[a-z0-9-]+\.)+(?:com|org|net|io|dev|co|me|ai|app|uk|ng|edu|gov)(?:\/[^\s<>{}\[\]"']*)?/gi)||[];const seen=new Set();return matches.map(s=>s.replace(/[),.;!?]+$/g,'')).map(raw=>({raw,url:/^https?:\/\//i.test(raw)?raw:'https://'+raw})).filter(x=>{try{const u=new URL(x.url).href;if(seen.has(u))return false;seen.add(u);return true;}catch(_){return false;}}).map(x=>({label:domainLabel(x.url),url:x.url}));}
function parseDateRange(s){const atom='(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\.?\\s+\\d{4}|\\d{1,2}\\/\\d{4}|(?:19|20)\\d{2})';const m=new RegExp('('+atom+')\\s*(?:-|to)\\s*('+atom+'|present|current|now)','i').exec(String(s||''));if(m)return{startDate:m[1],endDate:m[2],current:/present|current|now/i.test(m[2])};const one=String(s||'').match(/\b(?:19|20)\d{2}\b/);return{startDate:one?one[0]:'',endDate:'',current:false};}
function splitSkills(lines){return lines.map(line=>{const ix=line.text.indexOf(':');const category=ix>0&&ix<55?line.text.slice(0,ix).trim():'';const body=category?line.text.slice(ix+1):line.text;const items=body.split(/[,;|•]/).map(x=>x.trim()).filter(Boolean);return items.length?{category:category||'Skills',items,_confidence:category?'high':'medium',_lines:[line.n]}:null;}).filter(Boolean);}
function extract(source){
 const lines=normalize(source),joined=lines.map(x=>x.text).join('\n');
 const email=(joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[''])[0];
 const phoneCandidates=joined.match(/(?:\+\s?\d{1,3}[\s().-]?)?(?:\(?\d{2,5}\)?[\s().-]?)?(?:\d[\s().-]?){7,14}\d/g)||[];
 const phone=phoneCandidates.map(s=>s.trim()).find(s=>{const n=s.replace(/\D/g,'');return n.length>=9&&n.length<=15;})||'';
 const links=extractUrls(joined),top=lines.slice(0,12);
 const name=top.find(x=>x.text.length>=2&&x.text.length<=80&&!isHeading(x.text)&&!/@|https?:\/\/|www\./i.test(x.text)&&!/^\+?[\d\s()./-]{8,}$/.test(x.text)&&!/\b(?:resume|curriculum vitae|portfolio|linkedin|github|phone|email|address)\b/i.test(x.text)&&!/\d{4}/.test(x.text)&&!/^[\W\d_]+$/.test(x.text));
 const locationLine=top.find(x=>x!==name&&(/(?:abuja|lagos|nigeria|united states|united kingdom|canada|australia|remote|hybrid|based in|london|new york|toronto|sydney|dublin|berlin|paris|dubai|india|ghana|kenya)\b/i.test(x.text)||(/,/.test(x.text)&&x.text.length<90&&!/\d{4}|@|https?:\/\/|www\./i.test(x.text))));
 const profile={contact:{fullName:name?name.text:'',email,phone,location:locationLine?locationLine.text.replace(/[|•]\s*(?:https?:\/\/)?\S+.*$/,'').trim():'',links},summaries:[],experience:[],projects:[],skills:[],education:[],certifications:[]};
 const sections={summaries:[],experience:[],projects:[],skills:[],education:[],certifications:[],awards:[],languages:[],interests:[],references:[]};const unplaced=[];let current='';
 for(const line of lines){const heading=HEADINGS.find(([,r])=>r.test(cleanHead(line.text)));if(heading){current=heading[0];continue;}if(current&&sections[current])sections[current].push(line);else if(line.n>12&&!/@|https?:\/\/|www\./i.test(line.text)&&!/^\+?[\d\s()./-]{8,}$/.test(line.text))unplaced.push({line:line.n,text:line.text,section:'',reason:'Could not confidently place this line'});}
 if(sections.summaries.length)profile.summaries=[{label:'Professional summary',text:sections.summaries.map(x=>x.text.replace(BULLET,'')).join(' ')}];
 const makeEntries=(items,kind)=>{const entries=[];let e=null;const flush=()=>{if(e)entries.push(e);e=null;};for(const l of items){const raw=l.text,b=BULLET.test(raw),date=parseDateRange(raw),hasDate=!!date.startDate;const newHead=!b&&e&&((kind==='experience'&&hasDate&&(!!e.startDate||e.bullets.length>0))||(kind==='projects'&&(e.bullets.length>0||!!e.description)&&raw.length<120));if(!e||newHead){flush();e=kind==='experience'?{company:'',title:'',location:'',startDate:'',endDate:'',current:false,bullets:[],_confidence:'low',_lines:[]}:{name:'',url:'',description:'',bullets:[],_confidence:'low',_lines:[]};}
 e._lines.push(l.n);if(b){e.bullets.push({text:raw.replace(BULLET,'').trim(),_line:l.n});continue;}
 if(kind==='experience'){if(hasDate){const stripped=raw.replace(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|(?:19|20)\d{2}|present|current|now/ig,'').replace(/[-,]+$/g,'').trim();const parts=stripped.split(/\s+\|\s+|\s+at\s+|\s+@\s+/i).map(s=>s.trim().replace(/[-,]+$/g,'').trim()).filter(Boolean);if(parts.length>1){e.title=parts[0];e.company=parts.slice(1).join(' ');}else if(stripped&&!e.title)e.title=stripped;else if(stripped&&!e.company)e.company=stripped;e.startDate=date.startDate;e.endDate=date.endDate;e.current=date.current;e._confidence=(e.title&&e.company)?'high':'medium';continue;}else if(!e.title)e.title=raw;else if(!e.company)e.company=raw;else e.bullets.push({text:raw,_line:l.n});}
 else {if(!e.name){e.name=raw;e._confidence='medium';}else if(!e.description){e.description=raw;e._confidence='medium';}else e.bullets.push({text:raw,_line:l.n});}}
 flush();return entries;};
 profile.experience=makeEntries(sections.experience,'experience');
 profile.projects=makeEntries(sections.projects,'projects');
 profile.projects.forEach(e=>{const link=links.find(x=>e.name.includes(x.url)||e.description.includes(x.url));if(link)e.url=link.url;});
 profile.skills=splitSkills(sections.skills);
 profile.education=sections.education.map(l=>{
  const raw=l.text.replace(BULLET,'').trim(),d=parseDateRange(raw);
  const clean=raw.replace(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|(?:19|20)\d{2}|present|current|now/ig,'').replace(/[|,–—-]+/g,' ').replace(/\s+/g,' ').trim();
  const parts=raw.split(/\s+\|\s+|,\s*/).map(x=>x.trim()).filter(Boolean);
  const degreePattern=/\b(?:BSc|BA|B\.?S\.?c?\.?|BEng|MSc|MA|MBA|PhD|Bachelor|Master|Doctor|HND|OND|ND|Diploma|Associate|Certificate|Higher National|National Diploma)\b/i;
  let degree='',institution=clean||raw,field='';
  if(parts.length>1){const di=parts.findIndex(x=>degreePattern.test(x));if(di>=0){degree=parts[di];institution=parts.filter((x,i)=>i!==di&&!/\b(?:19|20)\d{2}\b/.test(x)).join(', ')||institution;field=degree.replace(/\b(?:BSc|BA|BEng|MSc|MA|MBA|PhD|HND|OND|ND|Bachelor(?:'s)?|Master(?:'s)?|Doctor(?:ate)?|Diploma|Associate|Certificate)\b\.?/ig,'').trim();}else institution=parts.filter(x=>!/\b(?:19|20)\d{2}\b/.test(x)).join(', ')||institution;}
  else {const m=clean.match(/^(.+?)\s+(?:at|from|[-|])\s+(.+)$/i);if(m&&degreePattern.test(m[1])){degree=m[1].trim();institution=m[2].trim();field=degree.replace(degreePattern,'').trim();}else if(degreePattern.test(clean)){degree=clean;field=clean.replace(degreePattern,'').trim();}}
  return{institution,degree,field,startDate:d.startDate,endDate:d.endDate,notes:'',_confidence:(degree&&institution)?'high':'medium',_lines:[l.n]};
});
 profile.certifications=sections.certifications.map(l=>({name:l.text.replace(BULLET,''),issuer:'',date:parseDateRange(l.text).startDate,_confidence:'medium',_lines:[l.n]}));
 const bulletLines=lines.filter(x=>BULLET.test(x.text)).length, extractedBullets=[...profile.experience,...profile.projects].reduce((n,e)=>n+e.bullets.length,0);
 const warnings=[];if(!email)warnings.push('Email was not detected. Verify the contact details.');if(!phone)warnings.push('Phone number needs review. Check for a local or international format.');if(!profile.contact.location)warnings.push('Location needs review.');if(bulletLines!==extractedBullets)warnings.push('Some bullet lines are not assigned to work or project entries. Check Unplaced lines.');
 const lowConfidence=[];for(const group of ['experience','projects','skills','education','certifications'])profile[group].forEach((e,index)=>{if(e._confidence==='low')lowConfidence.push({group,index,message:'Needs review'});});
 const sourceNumbers=[...new Set(joined.match(/\b\d+(?:[.,]\d+)?%?\b/g)||[])];const missingNumbers=sourceNumbers.filter(n=>!JSON.stringify(profile).includes(n));if(missingNumbers.length)warnings.push('Some numbers, years or amounts may need review.');
 const contactConfidence={fullName:name?'medium':'low',email:email?'high':'low',phone:phone?'medium':'low',location:locationLine?'medium':'low',links:links.length?'high':'low'};
 return{profile,lines,unplaced,warnings,lowConfidence,contactConfidence,stats:{lineCount:lines.length,entriesByCode:profile.experience.length+profile.projects.length+profile.education.length+profile.certifications.length+profile.skills.length,aiEntries:0,bulletLines,extractedBullets,missingNumbers}};
}
window.ResumeImport={normalize,extract,domainLabel,splitSkills,parseDateRange};
})();