(() => {
  const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let nodes=[],selected=null,undo=[];
  const workspace=()=>document.getElementById('cvTemplateWorkspace');
  const paper=()=>workspace()?.querySelector('.cvte-paper');
  const id=()=> 'el-'+Math.random().toString(36).slice(2,10);
  const defaults=type=>({id:id(),type,text:type==='line'?'':type==='shape'?'':type==='bullets'?'First bullet\nSecond bullet':type==='container'?'Layout block':'Custom text',x:5,y:5,w:type==='shape'?24:45,h:type==='line'?1:12,color:'#F8831D',weight:2,layout:'vertical',gap:8,fontSize:11,bullet:'disc'});
  function getLayout(){return nodes.map(n=>({...n}))}
  function setLayout(v){nodes=Array.isArray(v)?v.map(n=>({...n})):[];selected=nodes[0]?.id||null;render()}
  function remember(){undo.push(getLayout());if(undo.length>30)undo.shift()}
  function add(type){remember();const n=defaults(type);n.x=Math.min(70,5+nodes.length*2);n.y=Math.min(75,5+nodes.length*3);nodes.push(n);selected=n.id;render()}
  function render(){
    const w=workspace();if(!w)return;
    let panel=w.querySelector('#cvteAdvancedPanel');
    if(!panel){
      const target=w.querySelector('.cvte-grid .cvte-panel:last-child');if(!target)return;
      panel=document.createElement('div');panel.id='cvteAdvancedPanel';panel.className='cvte-advanced';
      panel.innerHTML='<div class="cvte-adv-head"><div><div class="eyebrow">VISUAL BUILDER</div><h3>Layout elements</h3></div><div class="cvte-adv-tools"><button type="button" data-add="shape">+ Shape</button><button type="button" data-add="line">+ Line</button><button type="button" data-add="text">+ Text</button><button type="button" data-add="bullets">+ Bullets</button><button type="button" data-add="container">+ Auto layout</button></div></div><div class="cvte-adv-body"><div class="cvte-adv-list" id="cvteAdvList"></div><div class="cvte-adv-props" id="cvteAdvProps">Select an element to edit its properties.</div></div><p class="muted">Elements are stored with this template. Drag an element on the preview to reposition it. Text-driven blocks grow with their content.</p>';
      target.appendChild(panel);
      panel.addEventListener('click',e=>{const addBtn=e.target.closest('[data-add]');if(addBtn){add(addBtn.dataset.add);return}const pick=e.target.closest('[data-pick]');if(pick){selected=pick.dataset.pick;render();return}if(e.target.closest('[data-delete]')){remember();nodes=nodes.filter(n=>n.id!==selected);selected=nodes[0]?.id||null;render();return}if(e.target.closest('[data-front]')){remember();const i=nodes.findIndex(n=>n.id===selected);if(i>=0){const [n]=nodes.splice(i,1);nodes.push(n)}render();return}if(e.target.closest('[data-back]')){remember();const i=nodes.findIndex(n=>n.id===selected);if(i>=0){const [n]=nodes.splice(i,1);nodes.unshift(n)}render();return}if(e.target.closest('[data-undo]')){nodes=undo.pop()||nodes;selected=nodes[0]?.id||null;render()}});
      panel.addEventListener('input',e=>{const key=e.target.dataset.prop;if(!key)return;const n=nodes.find(n=>n.id===selected);if(!n)return;const val=e.target.type==='number'?Number(e.target.value):e.target.value;n[key]=val;renderPreview();const active=panel.querySelector('[data-prop="'+key+'"]');if(active){active.focus();if(active.setSelectionRange&&e.target.selectionStart!=null)active.setSelectionRange(e.target.selectionStart,e.target.selectionEnd)}});
    }
    const list=panel.querySelector('#cvteAdvList'),props=panel.querySelector('#cvteAdvProps');
    list.innerHTML=nodes.length?nodes.map(n=>'<button type="button" class="cvte-adv-item '+(n.id===selected?'active':'')+'" data-pick="'+esc(n.id)+'"><span class="cvte-dot" style="background:'+esc(n.color)+'"></span><span>'+esc(n.type)+' · '+esc((n.text||'').slice(0,24)||'Decoration')+'</span></button>').join(''):'<p class="muted">Add a shape, line, text block, bullet list or auto-layout block.</p>';
    const n=nodes.find(n=>n.id===selected);
    props.innerHTML=n?'<div class="cvte-adv-propgrid"><label>Content / bullets<textarea data-prop="text" rows="3">'+esc(n.text)+'</textarea></label><label>Color<input data-prop="color" type="color" value="'+esc(n.color)+'"></label><label>HEX color<input data-prop="color" type="text" value="'+esc(n.color)+'" pattern="#[0-9a-fA-F]{6}" maxlength="7"></label><label>Font size<input data-prop="fontSize" type="number" min="7" max="32" value="'+n.fontSize+'"></label><label>Line weight<input data-prop="weight" type="number" min="1" max="12" value="'+n.weight+'"></label><label>Width (%)<input data-prop="w" type="number" min="5" max="100" value="'+n.w+'"></label><label>Height (%)<input data-prop="h" type="number" min="2" max="100" value="'+n.h+'"></label><label>Layout<select data-prop="layout"><option value="vertical" '+(n.layout==='vertical'?'selected':'')+'>Vertical auto layout</option><option value="row" '+(n.layout==='row'?'selected':'')+'>Horizontal row</option><option value="grid" '+(n.layout==='grid'?'selected':'')+'>Grid</option></select></label><label>Gap (px)<input data-prop="gap" type="number" min="0" max="40" value="'+n.gap+'"></label><label>Bullet style<select data-prop="bullet"><option value="disc" '+(n.bullet==='disc'?'selected':'')+'>Disc</option><option value="circle" '+(n.bullet==='circle'?'selected':'')+'>Circle</option><option value="square" '+(n.bullet==='square'?'selected':'')+'>Square</option><option value="number" '+(n.bullet==='number'?'selected':'')+'>Numbered</option></select></label><div class="cvte-adv-tools"><button type="button" data-back>Send backward</button><button type="button" data-front>Bring forward</button><button type="button" data-undo>Undo</button><button type="button" data-delete>Delete element</button></div></div>':'Select an element to edit its properties.';
    renderPreview();
  }
  function renderPreview(){
    const p=paper();if(!p)return;
    let layer=p.querySelector('.cvte-advanced-layer');if(!layer){layer=document.createElement('div');layer.className='cvte-advanced-layer';p.appendChild(layer)}
    layer.innerHTML=nodes.map(n=>{
      const style='left:'+n.x+'%;top:'+n.y+'%;width:'+n.w+'%;min-height:'+n.h+'%;color:'+n.color+';font-size:'+n.fontSize+'px;--shape-color:'+n.color+';--line-weight:'+n.weight+'px';
      let body='';
      if(n.type==='shape')body='<div class="cvte-shape" style="background:'+esc(n.color)+'"></div>';
      else if(n.type==='line')body='<div class="cvte-line" style="background:'+esc(n.color)+';height:'+n.weight+'px"></div>';
      else if(n.type==='bullets')body='<ul style="list-style-type:'+({disc:'disc',circle:'circle',square:'square',number:'decimal'}[n.bullet]||'disc')+'">'+String(n.text||'').split('\n').map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>';
      else if(n.type==='container')body='<div class="cvte-auto-content" style="display:flex;flex-direction:'+(n.layout==='row'?'row':n.layout==='grid'?'row':'column')+';gap:'+n.gap+'px"><span>'+esc(n.text||'Layout block')+'</span><span>Content expands automatically</span></div>';
      else body='<div class="cvte-custom-text">'+esc(n.text)+'</div>';
      return '<div class="cvte-adv-node '+(n.id===selected?'selected':'')+' '+(n.type==='shape'?'is-shape':'')+'" data-node="'+esc(n.id)+'" style="'+style+'">'+body+(n.type==='shape'?'':'<span class="cvte-node-handle" aria-hidden="true">↕</span>')+'</div>';
    }).join('');
    layer.querySelectorAll('[data-node]').forEach(el=>{
      el.onpointerdown=e=>{if(e.target.closest('input,textarea,button'))return;const n=nodes.find(x=>x.id===el.dataset.node);if(!n)return;selected=n.id;const rect=p.getBoundingClientRect(),startX=e.clientX,startY=e.clientY,ox=n.x,oy=n.y;el.setPointerCapture?.(e.pointerId);const move=ev=>{n.x=Math.max(0,Math.min(95,ox+(ev.clientX-startX)/rect.width*100));n.y=Math.max(0,Math.min(98,oy+(ev.clientY-startY)/rect.height*100));el.style.left=n.x+'%';el.style.top=n.y+'%'};const up=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);render()};el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);};
      el.ondblclick=()=>{selected=el.dataset.node;render()};
    });
  }
  const obs=new MutationObserver(()=>{if(workspace()&&!workspace().hidden&&!workspace().querySelector('#cvteAdvancedPanel'))render()});
  obs.observe(document.documentElement,{childList:true,subtree:true});
  window.CVTEAdvanced={getLayout,setLayout};
  document.addEventListener('input',e=>{if(e.target.closest('#cvteForm'))renderPreview()});
})();