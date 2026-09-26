function normalizePresentationSubsectionsEditor(s){
  s.metadata=s.metadata&&typeof s.metadata==='object'?s.metadata:{};
  const valid=['card1','card2','card3','card4','card5','analytic_card'];
  s.metadata.presentation_subsections=Array.isArray(s.metadata.presentation_subsections)?s.metadata.presentation_subsections:[];
  s.metadata.presentation_subsections=s.metadata.presentation_subsections.map((sub,i)=>({
    id:String(sub?.id||crypto.randomUUID()),
    title:String(sub?.title||''),
    description:String(sub?.description||''),
    image_id:String(sub?.image_id||''),
    presentation_style:valid.includes(String(sub?.presentation_style))?String(sub.presentation_style):'card1',
    display_order:i+1
  }));
  return s.metadata.presentation_subsections;
}
async function persistPresentationStyleMutation(){
  if(!editing.project?.id)return;
  try{await persistEditorMutation()}catch(e){alert(e.message||'Unable to save Presentation Styles change.')}
}
function bindPresentationStyles(card,s){
  const subs=normalizePresentationSubsectionsEditor(s);
  const titleInput=card.querySelector('.sec-title');
  const bodyInput=card.querySelector('.sec-body');
  const titleLabel=titleInput?.closest('label');
  const bodyLabel=bodyInput?.closest('label');
  if(titleLabel&&titleLabel.firstChild)titleLabel.firstChild.textContent='Section Title';
  if(bodyLabel&&bodyLabel.firstChild)bodyLabel.firstChild.textContent='Section Description';
  card.querySelector('.sec-presentation-style')?.closest('label')?.setAttribute('hidden','');
  card.querySelectorAll(':scope > .image-layout-controls, :scope > .section-items').forEach(el=>el.setAttribute('hidden',''));
  let host=card.querySelector('.presentation-styles-editor');
  if(host)host.remove();
  host=document.createElement('div');
  host.className='section-subeditor presentation-styles-editor';
  host.innerHTML='<div class="section-top"><strong>Presentation Styles</strong><span class="muted">Reusable visual subsections</span></div><div class="presentation-subsections"></div><label>Layout<select class="presentation-layout"><option value="grid">Grid</option><option value="list">List</option></select></label><div class="presentation-grid-columns"><label>Columns per row<select class="presentation-grid-columns-select"><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label></div><button type="button" class="secondary add-presentation-subsection">+ Add Subsection</button>';
  const anchor=card.querySelector('.sec-body')?.closest('label');
  card.insertBefore(host,anchor||card.lastElementChild);
  const layout=String(s.metadata.presentation_layout||'grid')==='list'?'list':'grid';
  const columns=[2,3,4].includes(Number(s.metadata.presentation_columns))?Number(s.metadata.presentation_columns):2;
  host.querySelector('.presentation-layout').value=layout;
  host.querySelector('.presentation-grid-columns-select').value=String(columns);
  const columnsWrap=host.querySelector('.presentation-grid-columns');
  columnsWrap.hidden=layout==='list';
  const images=Array.isArray(s.images)?s.images:[];
  const renderSubs=()=>{
    const wrap=host.querySelector('.presentation-subsections');
    wrap.innerHTML=subs.map((sub,i)=>'<div class="presentation-subsection-editor" data-presentation-subsection="'+i+'"><div class="section-top"><strong>Subsection '+(i+1)+'</strong><div class="section-actions"><button type="button" class="secondary move-presentation-subsection" data-presentation-subsection="'+i+'" data-dir="up" '+(i===0?'disabled':'')+'>↑</button><button type="button" class="secondary move-presentation-subsection" data-presentation-subsection="'+i+'" data-dir="down" '+(i===subs.length-1?'disabled':'')+'>↓</button><button type="button" class="danger remove-presentation-subsection" data-presentation-subsection="'+i+'">Remove</button></div></div><label>Subsection Title<input class="presentation-subsection-title" value="'+esc(sub.title)+'" placeholder="Subsection title"></label><label>Subsection Description<textarea class="presentation-subsection-description" placeholder="Subsection description">'+esc(sub.description)+'</textarea></label><label>Image<select class="presentation-subsection-image"><option value="">Select image</option>'+images.map(img=>'<option value="'+esc(img.id)+'" '+(String(img.id)===String(sub.image_id)?'selected':'')+'>'+esc(img.caption||img.alt_text||img.image_type||'Image')+'</option>').join('')+'</select></label><label>Presentation Style<select class="presentation-subsection-style"><option value="card1" '+(sub.presentation_style==='card1'?'selected':'')+'>Card Style 1</option><option value="card2" '+(sub.presentation_style==='card2'?'selected':'')+'>Card Style 2</option><option value="card3" '+(sub.presentation_style==='card3'?'selected':'')+'>Card Style 3</option><option value="card4" '+(sub.presentation_style==='card4'?'selected':'')+'>Card Style 4</option><option value="card5" '+(sub.presentation_style==='card5'?'selected':'')+'>Card Style 5</option><option value="analytic_card" '+(sub.presentation_style==='analytic_card'?'selected':'')+'>Analytic Cards</option></select></label></div>').join('');
    wrap.querySelectorAll('.presentation-subsection-editor').forEach((el,i)=>{
      const sub=subs[i];
      el.querySelector('.presentation-subsection-title').oninput=e=>{sub.title=e.target.value};
      el.querySelector('.presentation-subsection-description').oninput=e=>{sub.description=e.target.value};
      el.querySelector('.presentation-subsection-image').onchange=async e=>{sub.image_id=e.target.value;await persistPresentationStyleMutation()};
      el.querySelector('.presentation-subsection-style').onchange=e=>{sub.presentation_style=e.target.value};
    });
    wrap.querySelectorAll('.remove-presentation-subsection').forEach(btn=>btn.onclick=async()=>{subs.splice(Number(btn.dataset.presentationSubsection),1);subs.forEach((x,i)=>x.display_order=i+1);renderSections();await persistPresentationStyleMutation()});
    wrap.querySelectorAll('.move-presentation-subsection').forEach(btn=>btn.onclick=async()=>{const i=Number(btn.dataset.presentationSubsection),j=btn.dataset.dir==='up'?i-1:i+1;if(j<0||j>=subs.length)return;[subs[i],subs[j]]=[subs[j],subs[i]];subs.forEach((x,k)=>x.display_order=k+1);renderSections();await persistPresentationStyleMutation()});
  };
  renderSubs();
  host.querySelector('.add-presentation-subsection').onclick=async()=>{subs.push({id:crypto.randomUUID(),title:'',description:'',image_id:'',presentation_style:'card1',display_order:subs.length+1});renderSections();await persistPresentationStyleMutation()};
  host.querySelector('.presentation-layout').onchange=e=>{s.metadata.presentation_layout=e.target.value==='list'?'list':'grid';columnsWrap.hidden=s.metadata.presentation_layout==='list'};
  host.querySelector('.presentation-grid-columns-select').onchange=e=>{s.metadata.presentation_columns=[2,3,4].includes(Number(e.target.value))?Number(e.target.value):2};
}