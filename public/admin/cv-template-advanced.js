(() => {
  const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const safeColor=v=>/^#[0-9a-fA-F]{6}$/.test(v||'')?v:'#F8831D';
  const colorOrTransparent=v=>v==='transparent'?'transparent':safeColor(v);
  const allowedSections=['summary','experience','education','skills','projects','certifications','languages','references'];
  let nodes=[],selected=null,history=[],future=[],drag=null,documentLayout=allowedSections.slice();
  const workspace=()=>document.getElementById('cvTemplateWorkspace');
  const paper=()=>workspace()?.querySelector('.cvte-paper');
  const makeId=()=> 'el-'+Math.random().toString(36).slice(2,10);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const defaults=type=>({id:makeId(),type:type==='field'?'text':type,parentId:null,positionMode:type==='shape'||type==='line'?'absolute':'auto',shapeKind:type==='shape'?'rounded':'rect',text:type==='shape'||type==='line'||type==='container'||type==='field'?'':type==='bullets'?'First bullet\nSecond bullet':'Custom text',binding:type==='field'?'contact.fullName':'',repeatBinding:'',x:5,y:5,w:type==='shape'?24:45,h:type==='line'?1:12,color:type==='shape'||type==='line'?'#F8831D':'#24272c',background:'transparent',opacity:100,borderColor:'#F8831D',borderWeight:0,radius:type==='shape'?8:0,weight:2,fontSize:11,fontWeight:400,lineHeight:1.35,letterSpacing:0,textAlign:'left',textTransform:'none',layout:'vertical',columns:2,gap:8,rowGap:8,padding:8,paddingX:8,paddingY:8,align:'stretch',justify:'start',wrap:true,heightMode:type==='shape'||type==='line'?'fixed':'auto',locked:false,visible:true,bullet:'disc',layer:0});
  const getLayout=()=>clone(nodes);
  const getDocumentLayout=()=>documentLayout.slice();
  function setDocumentLayout(v){documentLayout=Array.isArray(v)?v.filter((x,i,a)=>allowedSections.includes(x)&&a.indexOf(x)===i):allowedSections.slice();allowedSections.forEach(x=>{if(!documentLayout.includes(x))documentLayout.push(x)});render()}
  function setLayout(v){
    const raw=Array.isArray(v)?v.slice(0,160):[];
    nodes=raw.map((n,i)=>({...defaults(n?.type||'text'),...n,id:String(n?.id||('el-'+i)),parentId:n?.parentId?String(n.parentId):null,color:/^#[0-9a-fA-F]{6}$/.test(n?.color||'')?n.color:(n?.type==='container'?'#24272c':'#F8831D'),background:colorOrTransparent(n?.background||'transparent')}));
    const ids=new Set(nodes.map(n=>n.id));
    nodes.forEach(n=>{if(!ids.has(n.parentId)||n.parentId===n.id||nodes.find(p=>p.id===n.parentId)?.type!=='container')n.parentId=null;if(!Number.isFinite(+n.layer))n.layer=0});
    nodes.forEach(n=>{let p=n.parentId,seen=new Set([n.id]);while(p){if(seen.has(p)){n.parentId=null;break}seen.add(p);p=nodes.find(x=>x.id===p)?.parentId||null}});
    selected=nodes[0]?.id||null;history=[];future=[];render();
  }
  function remember(){history.push(getLayout());if(history.length>60)history.shift();future=[]}
  function restore(v){nodes=clone(v||[]);selected=nodes.find(n=>n.id===selected)?.id||nodes[0]?.id||null;render()}
  const nodeById=id=>nodes.find(n=>n.id===id);
  const childrenOf=id=>nodes.filter(n=>(n.parentId||null)===(id||null)).sort((a,b)=>(Number(a.layer)||0)-(Number(b.layer)||0));
  function descendants(id){const out=[];const walk=pid=>childrenOf(pid).forEach(n=>{out.push(n.id);if(n.type==='container')walk(n.id)});walk(id);return out}
  function add(type){
    remember();const current=nodeById(selected);let parentId=null;
    if(current?.type==='container')parentId=current.id;
    else if(current?.parentId&&nodeById(current.parentId)?.type==='container')parentId=current.parentId;
    const n=defaults(type);n.parentId=parentId;n.layer=childrenOf(parentId).length*10;
    if(parentId){n.x=0;n.y=0;n.w=100;n.heightMode='auto'}else{n.x=Math.min(70,5+nodes.filter(x=>!x.parentId).length*2);n.y=Math.min(75,5+nodes.filter(x=>!x.parentId).length*3)}
    if(type==='container'){n.layout='vertical';n.w=parentId?100:55;n.h=25;n.heightMode='auto'}
    if(type==='field'){n.binding='contact.fullName';n.text=''}
    nodes.push(n);selected=n.id;render();
  }
  function update(key,value){
    const n=nodeById(selected);if(!n)return;
    if(['x','y','w','h','fontSize','fontWeight','lineHeight','letterSpacing','weight','opacity','borderWeight','radius','gap','rowGap','padding','paddingX','paddingY','columns','layer'].includes(key)){value=Number(value);if(!Number.isFinite(value))return}
    if(key==='color'||key==='borderColor')value=safeColor(value);
    if(key==='background')value=colorOrTransparent(value);
    if(key==='parentId'){const target=value?nodeById(value):null;if(target&&(target.type!=='container'||target.id===n.id||descendants(n.id).includes(target.id)))return;n.parentId=target?.id||null;n.x=0;n.y=0;n.layer=childrenOf(n.parentId).length*10;render();return}
    if(key==='type'&&value==='container'&&n.type!=='container'){n.type='container';n.layout='vertical';n.text=''}
    else n[key]=value;
    renderPreview();
  }
  function removeNode(id){const remove=new Set([id,...descendants(id)]);nodes=nodes.filter(n=>!remove.has(n.id));if(remove.has(selected))selected=nodes[0]?.id||null}
  function moveLayer(dir){
    const n=nodeById(selected);if(!n)return;remember();const siblings=childrenOf(n.parentId),i=siblings.findIndex(x=>x.id===selected);
    if(dir==='back'&&i>0)[siblings[i-1],siblings[i]]=[siblings[i],siblings[i-1]];
    else if(dir==='front'&&i>=0&&i<siblings.length-1)[siblings[i+1],siblings[i]]=[siblings[i],siblings[i+1]];
    else if(dir==='backmost'&&i>=0)siblings.unshift(siblings.splice(i,1)[0]);
    else if(dir==='frontmost'&&i>=0)siblings.push(siblings.splice(i,1)[0]);
    siblings.forEach((x,index)=>x.layer=index*10);render();
  }
  function render(){
    const w=workspace();if(!w)return;
    let panel=w.querySelector('#cvteAdvancedPanel');
    if(!panel){const target=w.querySelector('.cvte-grid .cvte-panel:last-child');if(!target)return;
      panel=document.createElement('div');panel.id='cvteAdvancedPanel';panel.className='cvte-advanced';
      panel.innerHTML='<div class="cvte-adv-head"><div><div class="eyebrow">DOCUMENT BUILDER</div><h3>Template components</h3><p class="muted">Select a container before adding components to place them inside it.</p></div></div><div class="cvte-doc-layout"><div class="cvte-doc-layout-head"><strong>Resume content order</strong><span>Reorder standard resume sections</span></div><div id="cvteDocBlocks"></div></div><div class="cvte-adv-body"><div class="cvte-adv-list" id="cvteAdvList" aria-label="Document layers"></div><div class="cvte-adv-props" id="cvteAdvProps">Select an element to edit its properties.</div></div><p class="muted">The component tree, Auto Layout settings and resume bindings are saved with the template.</p>';
      target.appendChild(panel);
      const previewWrap=w.querySelector('.cvte-preview-wrap');
      if(previewWrap&&!previewWrap.querySelector('.cvte-component-toolbar')){const bar=document.createElement('div');bar.className='cvte-component-toolbar';bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Template components');bar.innerHTML='<button type="button" data-add="container">+ Auto layout</button><button type="button" data-add="text">+ Text</button><button type="button" data-add="field">+ Resume field</button><button type="button" data-add="bullets">+ List</button><button type="button" data-add="shape">+ Shape</button><button type="button" data-add="line">+ Divider</button>';previewWrap.prepend(bar);bar.addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(b)add(b.dataset.add)})}
      panel.addEventListener('click',e=>{
        const a=e.target.closest('[data-add]');if(a){add(a.dataset.add);return}
        const sb=e.target.closest('[data-section-move]');if(sb){const key=sb.dataset.sectionMove,idx=documentLayout.indexOf(key),next=idx+Number(sb.dataset.dir||0);if(idx>=0&&next>=0&&next<documentLayout.length){remember();[documentLayout[idx],documentLayout[next]]=[documentLayout[next],documentLayout[idx]];render()}return}
        const p=e.target.closest('[data-pick]');if(p){selected=p.dataset.pick;render();return}
        const act=e.target.closest('[data-action]')?.dataset.action;if(!act)return;
        if(act==='delete'&&selected){remember();removeNode(selected);render()}
        if(act==='duplicate'){const n=nodeById(selected);if(n){remember();const c=clone(n);const oldId=c.id;c.id=makeId();c.layer=childrenOf(c.parentId).length*10;if(!c.parentId){c.x=Math.min(95,n.x+3);c.y=Math.min(98,n.y+3)}nodes.push(c);if(n.type==='container'){const map=new Map([[oldId,c.id]]);descendants(oldId).forEach(id=>map.set(id,makeId()));const copies=descendants(oldId).map(id=>{const child=clone(nodeById(id));child.id=map.get(id);child.parentId=map.get(child.parentId)||c.id;return child});nodes.push(...copies)}selected=c.id;render()}}
        if(act==='lock'){const n=nodeById(selected);if(n){remember();n.locked=!n.locked;render()}}
        if(act==='visibility'){const n=nodeById(selected);if(n){remember();n.visible=!n.visible;render()}}
        if(['back','front','backmost','frontmost'].includes(act))moveLayer(act);
        if(act==='undo'&&history.length){future.push(getLayout());restore(history.pop())}
        if(act==='redo'&&future.length){history.push(getLayout());restore(future.pop())}
        if(['left','center','right'].includes(act)){const n=nodeById(selected);if(n&&!n.parentId){remember();n.x=act==='left'?5:act==='center'?(100-n.w)/2:95-n.w;render()}}
        if(act==='move-into'){const target=nodeById(selected),source=nodeById(e.target.closest('[data-source]')?.dataset.source);if(target?.type==='container'&&source&&source.id!==target.id&&!descendants(source.id).includes(target.id)){remember();source.parentId=target.id;source.x=0;source.y=0;render()}}
      });
      panel.addEventListener('focusin',e=>{if(e.target.dataset.prop)remember()});
      panel.addEventListener('input',e=>{const key=e.target.dataset.prop;if(!key)return;let value=e.target.type==='checkbox'?e.target.checked:e.target.value;if(e.target.type==='number')value=Number(value);update(key,value);const status=panel.querySelector('#cvteAdvStatus');if(status)status.textContent='Unsaved layout changes.'});
      panel.addEventListener('change',e=>{const key=e.target.dataset.prop;if(!key)return;let value=e.target.type==='checkbox'?e.target.checked:e.target.value;if(e.target.type==='number')value=Number(value);update(key,value)});
    }
    const list=panel.querySelector('#cvteAdvList'),props=panel.querySelector('#cvteAdvProps'),docBlocks=panel.querySelector('#cvteDocBlocks');
    if(docBlocks){const labels={summary:'Professional summary',experience:'Experience',education:'Education',skills:'Skills',projects:'Projects',certifications:'Certifications',languages:'Languages',references:'References'};docBlocks.innerHTML=documentLayout.map((key,i)=>'<div class="cvte-doc-block"><span class="cvte-doc-grip" aria-hidden="true">⠿</span><span class="cvte-doc-block-label">'+labels[key]+'</span><button type="button" data-section-move="'+key+'" data-dir="-1" aria-label="Move '+labels[key]+' up" '+(i===0?'disabled':'')+'>↑</button><button type="button" data-section-move="'+key+'" data-dir="1" aria-label="Move '+labels[key]+' down" '+(i===documentLayout.length-1?'disabled':'')+'>↓</button></div>').join('')}
    function layerButtons(parentId,depth){return childrenOf(parentId).slice().reverse().map(n=>'<div class="cvte-layer-row" data-layer-row="'+esc(n.id)+'" data-parent="'+esc(parentId||'')+'" draggable="true" style="--depth:'+depth+'"><button type="button" class="cvte-adv-item '+(n.id===selected?'active':'')+'" data-pick="'+esc(n.id)+'" style="padding-left:'+(8+depth*14)+'px"><span class="cvte-layer-grip" aria-hidden="true">⠿</span><span class="cvte-layer-icon">'+(n.type==='container'?'▦':n.type==='shape'?'◩':n.type==='line'?'━':n.binding?'↗':'T')+'</span><span>'+esc(n.name||((n.type==='container'?'Auto layout':n.type==='shape'?'Shape':n.type==='line'?'Divider':n.type==='bullets'?'List':'Text')+' · '+(n.text||n.binding||n.id).slice(0,18)))+'</span></button>'+(n.type==='container'?layerButtons(n.id,depth+1):'')+'</div>').join('')}
    list.innerHTML=nodes.length?layerButtons(null,0):'<p class="muted">Add a container, then select it and add text, fields, shapes or lists inside it.</p>';
    if(!list.dataset.dragBound){list.dataset.dragBound='1';let dragged=null;list.addEventListener('dragstart',e=>{const row=e.target.closest('[data-layer-row]');if(!row)return;dragged=row.dataset.layerRow;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragged);row.classList.add('is-dragging')});list.addEventListener('dragend',e=>{e.target.closest('[data-layer-row]')?.classList.remove('is-dragging');list.querySelectorAll('.drop-before,.drop-after').forEach(x=>x.classList.remove('drop-before','drop-after'));dragged=null});list.addEventListener('dragover',e=>{const row=e.target.closest('[data-layer-row]');if(!row||!dragged||row.dataset.layerRow===dragged||nodeById(row.dataset.layerRow)?.parentId!==nodeById(dragged)?.parentId)return;e.preventDefault();list.querySelectorAll('.drop-before,.drop-after').forEach(x=>x.classList.remove('drop-before','drop-after'));row.classList.add(e.clientY<row.getBoundingClientRect().top+row.getBoundingClientRect().height/2?'drop-before':'drop-after')});list.addEventListener('drop',e=>{const row=e.target.closest('[data-layer-row]');if(!row||!dragged)return;e.preventDefault();const source=nodeById(dragged),target=nodeById(row.dataset.layerRow);if(!source||!target||source.parentId!==target.parentId)return;remember();const siblings=childrenOf(source.parentId),from=siblings.findIndex(x=>x.id===source.id),to=siblings.findIndex(x=>x.id===target.id);if(from<0||to<0)return;siblings.splice(from,1);const after=e.clientY>=row.getBoundingClientRect().top+row.getBoundingClientRect().height/2;let at=siblings.findIndex(x=>x.id===target.id)+(after?0:1);siblings.splice(Math.max(0,at),0,source);siblings.forEach((x,i)=>x.layer=i*10);selected=source.id;render()})}
    const n=nodeById(selected);
    const field=(label,key,value,type='text',attrs='')=>'<label>'+label+'<input type="'+type+'" data-prop="'+key+'" value="'+esc(value??'')+'" '+attrs+'></label>';
    const select=(label,key,value,options)=>'<label>'+label+'<select data-prop="'+key+'">'+options.map(o=>'<option value="'+esc(o[0])+'" '+(String(value??'')===String(o[0])?'selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select></label>';
    const bindOptions=[['','No binding'],['contact.fullName','Full name'],['contact.headline','Professional title'],['contact.email','Email'],['contact.phone','Phone'],['contact.location','Location'],['summary','Professional summary'],['experience','Repeat: experience'],['projects','Repeat: projects'],['skills','Repeat: skills'],['education','Repeat: education'],['certifications','Repeat: certifications'],['languages','Repeat: languages'],['references','Repeat: references'],['title','Current item: title / name'],['company','Current item: company'],['institution','Current item: institution'],['degree','Current item: degree'],['startDate','Current item: start date'],['endDate','Current item: end date'],['description','Current item: description'],['url','Current item: URL'],['category','Current item: category'],['items','Current item: skill items'],['name','Current item: name'],['issuer','Current item: issuer'],['date','Current item: date'],['proficiency','Current item: proficiency'],['email','Current item: email'],['phone','Current item: phone'],['location','Current item: location'],['bullets','Current item: bullet list']];
    if(n){
      const parents=[['','Document root'],...nodes.filter(x=>x.type==='container'&&x.id!==n.id&&!descendants(n.id).includes(x.id)).map(x=>[x.id,'Container · '+(x.name||x.text||x.id)])];
      props.innerHTML='<div class="cvte-adv-propgrid"><label class="cvte-adv-wide">Layer name<input data-prop="name" value="'+esc(n.name||'')+'" placeholder="Give this layer a name"></label><label class="cvte-adv-wide">Content / one item per line<textarea data-prop="text" rows="3">'+esc(n.text)+'</textarea></label>'+select('Parent container','parentId',n.parentId||'',parents)+select('Positioning','positionMode',n.positionMode||'auto',[['auto','Follow Auto Layout'],['absolute','Free position / overlay'],['document','Document flow root']])+select('Resume data binding','binding',n.binding||'',bindOptions)+(n.type==='shape'?select('Shape','shapeKind',n.shapeKind,[['rect','Rectangle'],['rounded','Rounded rectangle'],['ellipse','Circle / ellipse']]):'')+field('Text / fill color','color',safeColor(n.color),'color')+field('Background','background',n.background||'transparent','text','placeholder="#ffffff or transparent"')+field('Opacity (%)','opacity',n.opacity,'number','min="0" max="100"')+field('Border color','borderColor',safeColor(n.borderColor||n.color),'color')+field('Border weight (px)','borderWeight',n.borderWeight,'number','min="0" max="12"')+(n.type==='shape'?field('Corner radius (px)','radius',n.radius,'number','min="0" max="80"'):'')+(n.type==='line'?field('Line thickness (px)','weight',n.weight,'number','min="1" max="12"'):'')+field('X position (%)','x',n.x,'number','min="0" max="100"')+field('Y position (%)','y',n.y,'number','min="0" max="100"')+field('Width (%)','w',n.w,'number','min="2" max="100"')+field('Height (%)','h',n.h,'number','min="0.5" max="100"')+field('Font size (px)','fontSize',n.fontSize,'number','min="7" max="48"')+field('Font weight','fontWeight',n.fontWeight,'number','min="100" max="900" step="100"')+field('Line height','lineHeight',n.lineHeight,'number','min="0.8" max="3" step="0.05"')+field('Letter spacing (px)','letterSpacing',n.letterSpacing,'number','min="-2" max="10" step="0.1"')+select('Text alignment','textAlign',n.textAlign,[['left','Left'],['center','Center'],['right','Right']])+select('Text transform','textTransform',n.textTransform,[['none','None'],['uppercase','Uppercase'],['capitalize','Capitalize']])+select('Height behavior','heightMode',n.heightMode,[['auto','Content-driven'],['min','Minimum height'],['fixed','Fixed']])+select('Auto layout direction','layout',n.layout,[['vertical','Vertical list'],['row','Horizontal row'],['grid','Grid'],['columns2','Two columns'],['columns3','Three columns'],['free','Free positioning']])+field('Grid columns','columns',n.columns,'number','min="1" max="6"')+field('Column gap (px)','gap',n.gap,'number','min="0" max="60"')+field('Row gap (px)','rowGap',n.rowGap,'number','min="0" max="60"')+field('Padding (px)','padding',n.padding,'number','min="0" max="60"')+select('Alignment','align',n.align,[['stretch','Stretch'],['start','Start'],['center','Center'],['end','End']])+select('Distribution','justify',n.justify,[['start','Start'],['center','Center'],['end','End'],['between','Space between']])+select('List marker','bullet',n.bullet,[['disc','Bullet'],['circle','Circle'],['square','Square'],['number','Numbered']])+'<div class="cvte-adv-tools cvte-adv-wide"><button type="button" data-action="left">Align left</button><button type="button" data-action="center">Center</button><button type="button" data-action="right">Align right</button><button type="button" data-action="back">Send backward</button><button type="button" data-action="backmost">Send to back</button><button type="button" data-action="front">Bring forward</button><button type="button" data-action="frontmost">Bring to front</button><button type="button" data-action="duplicate">Duplicate</button><button type="button" data-action="lock">'+(n.locked?'Unlock':'Lock')+'</button><button type="button" data-action="visibility">'+(n.visible?'Hide':'Show')+'</button><button type="button" data-action="undo">Undo</button><button type="button" data-action="redo">Redo</button><button type="button" data-action="delete">Delete</button></div><p id="cvteAdvStatus" class="cvte-adv-wide muted" role="status">Save the template to keep these changes.</p></div>';
    }else props.innerHTML='Select an element to edit its properties.';
    renderPreview();
  }
  const sampleData={contact:{fullName:'Alex Morgan',headline:'Product Designer',email:'alex@example.com',phone:'+234 800 000 0000',location:'Abuja, Nigeria'},summary:'Product designer who turns complex workflows into clear, accessible digital products.',experience:[{title:'Senior Product Designer',company:'Example Company',startDate:'2023',endDate:'Present',bullets:[{text:'Led product design from discovery through delivery.'}]}],projects:[{name:'Portfolio project',description:'A selected project.'}],skills:[{category:'Design',items:['Product design','Research','Prototyping']}],education:[{degree:'BSc',institution:'Example University'}],certifications:[],languages:[],references:[]};
  function resolveBinding(binding,data,ctx){if(!binding)return '';if(ctx&&Object.prototype.hasOwnProperty.call(ctx,binding))return ctx[binding];let v=data;for(const part of String(binding).split('.'))v=v?.[part];return v??''}
  function textFor(n,data,ctx){const v=resolveBinding(n.binding,data,ctx);if(Array.isArray(v))return v.map(x=>typeof x==='string'?x:(x.text||x.name||x.title||'')).filter(Boolean).join(' · ');if(v&&typeof v==='object')return v.text||v.name||v.title||'';return v!==''&&v!=null?String(v):String(n.text||'')}
  function emptyNode(n,data,ctx){
    if(!n||n.visible===false)return true;
    if(n.type==='shape'||n.type==='line')return false;
    if(n.binding||n.repeatBinding){
      const v=resolveBinding(n.binding||n.repeatBinding,data,ctx);
      if(Array.isArray(v))return v.length===0;
      if(v&&typeof v==='object')return Object.values(v).every(x=>!String(x??'').trim());
      if(v!==''&&v!=null)return false;
      if(String(n.text||'').trim())return false;
      return true;
    }
    const kids=childrenOf(n.id);
    return kids.length?kids.every(ch=>emptyNode(ch,data,ctx)):!String(n.text||'').trim();
  }
  function shouldHideSection(n,data,ctx){
    if(n.type!=='container'||!/ section$/i.test(n.name||''))return false;
    const content=childrenOf(n.id).filter(ch=>!String(ch.name||'').toLowerCase().endsWith('heading'));
    return content.length>0&&content.every(ch=>emptyNode(ch,data,ctx));
  }
  function childStyle(n,isRoot,parent){
    const flow=!!parent&&parent.type==='container'&&parent.layout!=='free'&&n.positionMode!=='absolute';
    const documentRoot=!parent&&n.positionMode==='document';
    const position=documentRoot||flow?'position:relative;left:auto;top:auto;':'position:absolute;left:'+Math.max(0,Math.min(100,Number(n.x)||0))+'%;top:'+Math.max(0,Math.min(100,Number(n.y)||0))+'%;';
    const width=documentRoot?'width:100%;min-width:0;':flow?(parent.layout==='grid'?'min-width:0;width:100%;':parent.layout==='row'?'min-width:0;flex:1 1 0;width:auto;':'min-width:0;'+(Number(n.w)<100?'width:'+Math.max(1,Number(n.w)||100)+'%;':'width:100%;')):'width:'+Math.max(2,Math.min(100,Number(n.w)||30))+'%;';
    const height=flow||documentRoot?'auto':n.heightMode==='fixed'?Math.max(.5,Number(n.h)||10)+'%':'auto';
    const minHeight=n.heightMode==='min'?Math.max(.5,Number(n.h)||10)+'%':'0';
    const opacity=Math.max(0,Math.min(100,Number(n.opacity??100)))/100;
    const border=Number(n.borderWeight)>0?'border:'+Math.min(12,Number(n.borderWeight))+'px solid '+safeColor(n.borderColor||n.color)+';':'';
    return position+width+'height:'+height+';min-height:'+minHeight+';z-index:'+Math.max(-100,Math.min(100,Number(n.layer)||0))+';color:'+safeColor(n.color)+';background:'+colorOrTransparent(n.background||'transparent')+';font-size:'+Math.max(7,Math.min(48,Number(n.fontSize)||11))+'px;font-weight:'+Math.max(100,Math.min(900,Number(n.fontWeight)||400))+';line-height:'+Math.max(.8,Math.min(3,Number(n.lineHeight)||1.35))+';letter-spacing:'+Number(n.letterSpacing||0)+'px;text-align:'+(['left','center','right'].includes(n.textAlign)?n.textAlign:'left')+';text-transform:'+(['uppercase','capitalize'].includes(n.textTransform)?n.textTransform:'none')+';opacity:'+opacity+';padding:'+Math.max(0,Number(n.padding)||0)+'px;box-sizing:border-box;overflow-wrap:anywhere;'+border;
  }
  function renderNode(n,parent,data,ctx,forExport=false){
    if(n.visible===false||shouldHideSection(n,data,ctx))return '';
    const isRoot=!parent,style=childStyle(n,isRoot,parent),shape=n.type==='shape',line=n.type==='line',container=n.type==='container';
    const cls='cvte-adv-node '+(n.id===selected?'selected ':'')+(shape?'is-shape ':'')+(n.locked?'is-locked':'');
    const resolved=textFor(n,data,ctx);
    let body='';
    if(shape){const br=n.shapeKind==='ellipse'?'50%':n.shapeKind==='rounded'?Math.max(0,Number(n.radius)||8)+'px':'0';body='<div style="width:100%;height:100%;min-height:24px;background:'+safeColor(n.color)+';border-radius:'+br+';border:'+Math.max(0,Number(n.borderWeight)||0)+'px solid '+safeColor(n.borderColor||n.color)+';box-sizing:border-box"></div>'}
    else if(line)body='<div style="width:100%;height:'+Math.max(1,Math.min(12,Number(n.weight)||1))+'px;background:'+safeColor(n.color)+'"></div>';
    else if(n.type==='bullets'){let vals=resolveBinding(n.binding,data,ctx);if(!Array.isArray(vals))vals=String(resolved||'').split(/\n/).filter(Boolean);body='<ul style="margin:0;padding-left:20px;list-style-type:'+({disc:'disc',circle:'circle',square:'square',number:'decimal'}[n.bullet]||'disc')+'">'+vals.map(t=>'<li>'+esc(typeof t==='string'?t:(t.text||t.name||''))+'</li>').join('')+'</ul>'}
    else if(container){
      const repeat=resolveBinding(n.binding||n.repeatBinding,data,ctx),items=Array.isArray(repeat)?repeat:null;
      const display=n.layout==='grid'||n.layout==='columns2'||n.layout==='columns3'?'grid':n.layout==='free'?'block':'flex';
      const cols=n.layout==='columns3'?3:n.layout==='columns2'?2:Math.max(1,Math.min(6,Number(n.columns)||2));
      const innerStyle='display:'+display+';position:'+(n.layout==='free'?'relative':'relative')+';flex-direction:'+(n.layout==='row'?'row':'column')+';grid-template-columns:repeat('+cols+',minmax(0,1fr));gap:'+Math.max(0,Number(n.rowGap)||0)+'px '+Math.max(0,Number(n.gap)||0)+'px;padding:'+Math.max(0,Number(n.padding)||0)+'px;align-items:'+({stretch:'stretch',start:'flex-start',center:'center',end:'flex-end'}[n.align]||'stretch')+';justify-content:'+({start:'flex-start',center:'center',end:'flex-end',between:'space-between'}[n.justify]||'flex-start')+';min-width:0;box-sizing:border-box;overflow-wrap:anywhere;';
      if(items){body='<div class="cvte-auto-content" style="'+innerStyle+'">'+items.map((item,i)=>'<div class="cvte-repeat-item" style="min-width:0;position:relative">'+childrenOf(n.id).map(ch=>renderNode(ch,n,data,item,forExport)).join('')+'</div>').join('')+'</div>'}
      else {const kids=childrenOf(n.id);body='<div class="cvte-auto-content" style="'+innerStyle+(forExport?'':'border:1px dashed #c9ced6;border-radius:4px;')+'">'+(kids.length?kids.map(ch=>renderNode(ch,n,data,ctx,forExport)).join(''):String(n.text||'').split(/\n/).filter(Boolean).map(t=>'<div>'+esc(t)+'</div>').join('')||(!forExport?'<div class="cvte-container-empty">Select this container and add components</div>':''))+'</div>'}
    }else{
      let content=resolved;
      if(Array.isArray(resolveBinding(n.binding,data,ctx))&&n.type!=='bullets')content=resolved;
      body='<div class="cvte-custom-text" style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(content)+'</div>';
    }
    const resize=!forExport&&!n.locked&&isRoot?'<button class="cvte-node-resize" type="button" data-resize="'+esc(n.id)+'" aria-label="Resize element">↘</button>':'';
    return '<div class="'+cls+'" data-node="'+esc(n.id)+'" style="'+style+(container?'overflow:visible;':'')+(n.locked?'cursor:not-allowed;':'')+'">'+body+resize+'</div>';
  }
  function renderPreview(){
    const p=paper();if(!p)return;
    let layer=p.querySelector('.cvte-advanced-layer');if(!layer){layer=document.createElement('div');layer.className='cvte-advanced-layer';p.prepend(layer)}
    const children=Array.from(p.children).filter(el=>el!==layer),firstSection=children.findIndex(el=>el.tagName==='H3');
    if(firstSection>=0){const header=children.slice(0,firstSection),groups=[];let group=null;children.slice(firstSection).forEach(el=>{if(el.tagName==='H3'){group={key:({'Professional Summary':'summary','Experience':'experience','Skills':'skills','Education':'education'}[el.textContent.trim()]||el.textContent.trim().toLowerCase()),els:[]};groups.push(group)}if(group)group.els.push(el)});const rank=key=>{const i=documentLayout.indexOf(key);return i<0?999:i};groups.sort((a,b)=>rank(a.key)-rank(b.key));const frag=document.createDocumentFragment();header.concat(...groups.map(g=>g.els)).forEach(el=>frag.appendChild(el));p.appendChild(frag)}
    layer.innerHTML=childrenOf(null).map(n=>renderNode(n,null,sampleData,null,false)).join('');
    layer.querySelectorAll('[data-node]').forEach(el=>{
      el.addEventListener('pointerdown',e=>{
        if(e.target.closest('[data-node]')!==el)return;
        const n=nodeById(el.dataset.node);if(!n)return;selected=n.id;
        const parent=nodeById(n.parentId),isFlowChild=parent?.type==='container'&&parent.layout!=='free'&&n.positionMode!=='absolute';
        if((e.target.closest('button')&&!e.target.closest('[data-resize]'))||n.locked||isFlowChild)return;
        remember();const rect=parent&&n.positionMode==='absolute'?el.parentElement.getBoundingClientRect():p.getBoundingClientRect();drag={id:n.id,startX:e.clientX,startY:e.clientY,x:n.x,y:n.y,w:n.w,h:n.h,resize:!!e.target.closest('[data-resize]'),rect};e.preventDefault();
      });
      el.addEventListener('pointermove',e=>{if(!drag||drag.id!==el.dataset.node)return;const dx=(e.clientX-drag.startX)/drag.rect.width*100,dy=(e.clientY-drag.startY)/drag.rect.height*100,n=nodeById(drag.id);if(!n)return;if(drag.resize){n.heightMode='fixed';n.w=Math.max(2,Math.min(100-drag.x,drag.w+dx));n.h=Math.max(.5,Math.min(100-drag.y,drag.h+dy));el.style.width=n.w+'%';el.style.height=n.h+'%'}else{n.x=Math.max(0,Math.min(100-n.w,drag.x+dx));n.y=Math.max(0,Math.min(100-n.h,drag.y+dy));el.style.left=n.x+'%';el.style.top=n.y+'%'}});
      const end=()=>{if(drag&&drag.id===el.dataset.node){drag=null;render()}};
      el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
      el.addEventListener('click',e=>{if(e.target.closest('[data-node]')!==el)return;selected=el.dataset.node;render()});
    });
  }
  const observer=new MutationObserver(()=>{if(workspace()&&!workspace().hidden&&!workspace().querySelector('#cvteAdvancedPanel'))render()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  function exportNode(n,parent,data,ctx){
    if(n.visible===false||shouldHideSection(n,data,ctx))return '';
    const style=childStyle(n,!parent,parent),shape=n.type==='shape',line=n.type==='line',container=n.type==='container';
    let body='',value=resolveBinding(n.binding,data,ctx);
    if(shape){const br=n.shapeKind==='ellipse'?'50%':n.shapeKind==='rounded'?Math.max(0,Number(n.radius)||8)+'px':'0';body='<div style="width:100%;height:100%;min-height:24px;background:'+safeColor(n.color)+';border-radius:'+br+';border:'+Math.max(0,Number(n.borderWeight)||0)+'px solid '+safeColor(n.borderColor||n.color)+';box-sizing:border-box"></div>'}
    else if(line)body='<div style="width:100%;height:'+Math.max(1,Math.min(12,Number(n.weight)||1))+'px;background:'+safeColor(n.color)+'"></div>';
    else if(container){const repeat=resolveBinding(n.binding||n.repeatBinding,data,ctx),items=Array.isArray(repeat)?repeat:null,display=n.layout==='grid'||n.layout==='columns2'||n.layout==='columns3'?'grid':n.layout==='free'?'block':'flex',cols=n.layout==='columns3'?3:n.layout==='columns2'?2:Math.max(1,Math.min(6,Number(n.columns)||2)),inner='display:'+display+';position:relative;flex-direction:'+(n.layout==='row'?'row':'column')+';grid-template-columns:repeat('+cols+',minmax(0,1fr));gap:'+Math.max(0,Number(n.rowGap)||0)+'px '+Math.max(0,Number(n.gap)||0)+'px;padding:'+Math.max(0,Number(n.padding)||0)+'px;align-items:'+({stretch:'stretch',start:'flex-start',center:'center',end:'flex-end'}[n.align]||'stretch')+';justify-content:'+({start:'flex-start',center:'center',end:'flex-end',between:'space-between'}[n.justify]||'flex-start')+';min-width:0;box-sizing:border-box;overflow-wrap:anywhere;';if(items)body='<div style="'+inner+'">'+items.map(item=>'<div style="min-width:0;position:relative">'+childrenOf(n.id).map(ch=>exportNode(ch,n,data,item)).join('')+'</div>').join('')+'</div>';else {const kids=childrenOf(n.id);body='<div style="'+inner+'">'+(kids.length?kids.map(ch=>exportNode(ch,n,data,ctx)).join(''):String(n.text||'').split(/\n/).filter(Boolean).map(t=>'<div>'+esc(t)+'</div>').join(''))+'</div>'}}
    else if(n.type==='bullets'){let vals=Array.isArray(value)?value:String(n.text||'').split(/\n/).filter(Boolean);body='<ul style="margin:0;padding-left:18px;list-style-type:'+({disc:'disc',circle:'circle',square:'square',number:'decimal'}[n.bullet]||'disc')+'">'+vals.map(t=>'<li>'+esc(typeof t==='string'?t:(t.text||t.name||''))+'</li>').join('')+'</ul>'}
    else {if(Array.isArray(value))value=value.map(x=>typeof x==='string'?x:(x.text||x.name||x.title||'')).join(' · ');if(value&&typeof value==='object')value=value.text||value.name||value.title||'';body='<div style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(value!==''&&value!=null?value:n.text||'')+'</div>'}
    return '<div style="'+style+'box-sizing:border-box;'+(container?'overflow:visible;':'')+'">'+body+'</div>';
  }
  function createStarterLayout(){
    const out=[];
    const make=(type,parentId,props={})=>{const n={...defaults(type),id:makeId(),parentId:parentId||null,layer:out.filter(x=>(x.parentId||null)===(parentId||null)).length*10,...props};out.push(n);return n.id};
    const page=make('container',null,{name:'Page content',positionMode:'document',x:0,y:0,w:100,h:100,layout:'vertical',gap:12,rowGap:12,padding:34,background:'transparent',heightMode:'auto'});
    const header=make('container',page,{name:'Header',w:100,layout:'vertical',gap:4,padding:0,align:'center',justify:'start',heightMode:'auto'});
    make('text',header,{name:'Full name',binding:'contact.fullName',text:'',w:100,fontSize:25,fontWeight:700,color:'#24272c',textAlign:'center',heightMode:'auto'});
    make('text',header,{name:'Professional title',binding:'contact.headline',text:'',w:100,fontSize:12,color:'#F8831D',textAlign:'center',heightMode:'auto'});
    const contact=make('container',header,{name:'Contact details',w:100,layout:'row',gap:8,rowGap:4,padding:0,align:'center',justify:'center',heightMode:'auto'});
    ['email','phone','location'].forEach(k=>make('text',contact,{name:k[0].toUpperCase()+k.slice(1),binding:'contact.'+k,text:'',w:100,fontSize:9,color:'#505866',textAlign:'center',heightMode:'auto'}));
    const section=(name,binding,fields)=>{
      const sec=make('container',page,{name:name+' section',w:100,layout:'vertical',gap:5,rowGap:5,padding:0,align:'stretch',heightMode:'auto'});
      make('text',sec,{name:name+' heading',text:name.toUpperCase(),w:100,fontSize:11,fontWeight:700,color:'#F8831D',textTransform:'uppercase',borderWeight:0,heightMode:'auto'});
      if(binding==='summary')make('text',sec,{name:'Professional summary',binding:'summary',text:'',w:100,fontSize:10,color:'#24272c',heightMode:'auto'});
      else {
        const repeat=make('container',sec,{name:'Repeat '+name.toLowerCase(),binding,w:100,layout:'vertical',gap:5,rowGap:5,padding:0,align:'stretch',heightMode:'auto'});
        fields.forEach(f=>make(f.type||'text',repeat,{name:f.name,binding:f.binding,text:f.text||'',w:100,fontSize:f.fontSize||10,fontWeight:f.fontWeight||400,color:'#24272c',heightMode:'auto',...(f.extra||{})}));
      }
    };
    section('Professional Summary','summary',[]);
    section('Experience','experience',[{name:'Role / title',binding:'title',fontWeight:700},{name:'Company',binding:'company',fontWeight:600},{name:'Dates',binding:'startDate',extra:{text:'',fontSize:9,color:'#606773'}},{name:'Achievements',binding:'bullets',type:'bullets',extra:{bullet:'disc',fontSize:9}}]);
    section('Projects','projects',[{name:'Project name',binding:'name',fontWeight:700},{name:'Project description',binding:'description'},{name:'Project achievements',binding:'bullets',type:'bullets'}]);
    section('Skills','skills',[{name:'Skill category',binding:'category',fontWeight:700},{name:'Skill items',binding:'items'}]);
    section('Education','education',[{name:'Degree',binding:'degree',fontWeight:700},{name:'Institution',binding:'institution'},{name:'Dates',binding:'startDate',fontSize:9},{name:'Notes',binding:'notes',fontSize:9}]);
    section('Certifications','certifications',[{name:'Certification',binding:'name',fontWeight:700},{name:'Issuer',binding:'issuer'},{name:'Date',binding:'date',fontSize:9}]);
    section('Languages','languages',[{name:'Language',binding:'name',fontWeight:700},{name:'Proficiency',binding:'proficiency'}]);
    section('References','references',[{name:'Reference name',binding:'name',fontWeight:700},{name:'Title',binding:'title'},{name:'Company',binding:'company'},{name:'Email',binding:'email'},{name:'Phone',binding:'phone'}]);
    return out;
  }
  document.addEventListener('keydown',e=>{const w=workspace();if(!w||w.hidden||!w.querySelector('#cvteAdvancedPanel'))return;const t=e.target,tag=(t?.tagName||'').toLowerCase();if(t?.isContentEditable||['input','textarea','select'].includes(tag))return;const mod=e.metaKey||e.ctrlKey;const act=name=>{const b=w.querySelector('#cvteAdvancedPanel [data-action="'+name+'"]');if(b)b.click()};if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();act(e.shiftKey?'redo':'undo')}else if(e.ctrlKey&&e.key.toLowerCase()==='y'){e.preventDefault();act('redo')}else if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();act('duplicate')}else if(mod&&e.key.toLowerCase()==='c'&&selected){copiedNode=clone(nodeById(selected));e.preventDefault()}else if(mod&&e.key==='['){e.preventDefault();act('backmost')}else if(mod&&e.key===']'){e.preventDefault();act('frontmost')}else if(!mod&&['Delete','Backspace'].includes(e.key)&&selected){e.preventDefault();act('delete')}});
  let copiedNode=null;
  window.CVTEAdvanced={getLayout,setLayout,getDocumentLayout,setDocumentLayout,createStarterLayout,exportHtml(layout,data){const original=nodes;nodes=Array.isArray(layout)?layout:[];const rootData=data||{};const result=childrenOf(null).filter(n=>n.visible!==false).map(n=>exportNode(n,null,rootData,null)).join('');nodes=original;return result}};
  document.addEventListener('input',e=>{if(e.target.closest('#cvteForm'))renderPreview()});
})();