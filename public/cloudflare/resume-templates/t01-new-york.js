import { esc, normalize, contactItems, contactHtml, page, bulletList } from './_shared.js';
export function renderNewYork(data) {
 const d=normalize(data), ink='#000', mute='#484745', rule='#393e46';
 const contact=contactItems(d.p,['location','phone','email','links']).map(i=>contactHtml(i)).join(', ');
 const css=`
 .sheet { padding:60px 64px 56px;color:${ink};line-height:17.5px; }
 .head { text-align:center;padding-bottom:14px;border-bottom:2px solid ${rule}; }
 .head h1 { font-size:20px;font-weight:400;line-height:25px;margin-bottom:7px; }
 .head .contact { line-height:18.7px;color:${mute}; }
 .row { display:grid;grid-template-columns:25% 75%;padding:14px 0 16px; }
 .row.ruled { border-bottom:2px solid ${rule}; }
 .label { text-transform:uppercase;color:${mute}; }
 .label.wide { padding:17px 0 0; }
 .txt { color:${mute}; }
 .entry { display:grid;grid-template-columns:25% 75%;margin-top:16px;break-inside:avoid; }
 .entry + .entry { margin-top:17px; }
 .date { color:${mute}; }
 .line { display:flex;justify-content:space-between;align-items:baseline;font-weight:700;margin-bottom:4px; }
 .line .where { font-weight:400;color:${mute}; }
 .sub { font-weight:700;margin-bottom:8px; }
 .sub.plain { font-weight:400;color:${mute};margin-bottom:0; }
 .bullets { margin-left:16px;color:${mute}; }
 .skills { display:grid;grid-template-columns:1fr 1fr;column-gap:24px;row-gap:2px;color:#000;font-weight:700; }`;
 const body=`<header class="head"><h1>${esc(d.p.name)}</h1><div class="contact">${contact}</div></header>
 ${d.summary?`<section class="row ruled"><div class="label">Summary</div><div class="txt">${esc(d.summary)}</div></section>`:''}
 ${d.jobs.length?`<section><div class="label wide">Work Experience</div>${d.jobs.map(j=>`<div class="entry"><div class="date">${esc(j.date)}</div><div><div class="line"><span>${esc(j.role)}</span><span class="where">${esc(j.location)}</span></div><div class="sub">${esc(j.company)}</div>${bulletList(j.bullets)}</div></div>`).join('')}</section>`:''}
 ${d.edu.length?`<section><div class="label wide" style="padding-top:22px">Education</div>${d.edu.map(e=>`<div class="entry"><div class="date">${esc(e.date)}</div><div><div class="line"><span>${esc(e.institution)}</span><span class="where">${esc(e.location)}</span></div><div class="sub plain" style="font-weight:700;color:#000">${esc(e.degree)}</div></div></div>`).join('')}</section>`:''}
 ${d.skills.length?`<section class="row ruled" style="margin-top:14px;border-top:2px solid ${rule}"><div class="label">Skills</div><div class="skills">${d.skills.map(s=>`<div>${esc(s)}</div>`).join('')}</div></section>`:''}
 ${d.certs.length?`<section class="row"><div class="label">Certificates</div><div>${d.certs.map(c=>`<div class="avoid"><div class="line" style="margin-bottom:0"><span>${esc(c.title)}</span><span class="where">${esc(c.date)}</span></div><div class="sub plain" style="font-weight:700;color:#000">${esc(c.issuer)}</div></div>`).join('')}</div></section>`:''}`;
 return page({title:`${d.p.name} – Resume`,css,body});
}