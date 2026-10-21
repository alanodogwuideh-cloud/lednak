(() => {
 const templates = {
  t1:{name:'Navy Banner',className:'rs-template-t1',accent:'#23395B',pageSize:'letter',layout:'banner'},
  t2:{name:'Burgundy Classic',className:'rs-template-t2',accent:'#7A263A',pageSize:'letter',layout:'classic'},
  t3:{name:'Ledger',className:'rs-template-t3',accent:'#315B4C',pageSize:'a4',layout:'ledger'},
  t4:{name:'Blush Blocks',className:'rs-template-t4',accent:'#B65F68',pageSize:'a4',layout:'blocks'},
  classic:{name:'Classic',className:'rs-template-classic',accent:'#23395B',pageSize:'letter',layout:'classic'},
  modern:{name:'Modern',className:'rs-template-modern',accent:'#F8831D',pageSize:'letter',layout:'modern'},
  minimal:{name:'Minimal',className:'rs-template-minimal',accent:'#333333',pageSize:'a4',layout:'minimal'},
  executive:{name:'Executive',className:'rs-template-executive',accent:'#30332E',pageSize:'letter',layout:'executive'}
 };
 window.ResumeTemplates = Object.freeze({
  all:()=>Object.entries(templates).map(([id,v])=>({id,...v})),
  get:id=>templates[id]||templates.classic,
  className:id=>(templates[id]||templates.classic).className,
  accent:id=>(templates[id]||templates.classic).accent
 });
})();