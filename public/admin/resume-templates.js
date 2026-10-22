(() => {
 const templates = {
  t1:{name:'New York',className:'rs-template-t1',accent:'#222222',pageSize:'letter',layout:'labels-left'},
  t2:{name:'Paris',className:'rs-template-t2',accent:'#174879',pageSize:'letter',layout:'banner'},
  t3:{name:'Toronto',className:'rs-template-t3',accent:'#A65F64',pageSize:'letter',layout:'editorial'},
  t4:{name:'Chicago',className:'rs-template-t4',accent:'#4F83BD',pageSize:'letter',layout:'banner'},
  t5:{name:'Madrid',className:'rs-template-t5',accent:'#A8445B',pageSize:'letter',layout:'labels-left'},
  t6:{name:'Santiago',className:'rs-template-t6',accent:'#4F83BD',pageSize:'letter',layout:'banner'},
  t7:{name:'Istanbul',className:'rs-template-t7',accent:'#B8A88F',pageSize:'letter',layout:'contact-right'},
  t8:{name:'London',className:'rs-template-t8',accent:'#243B49',pageSize:'a4',layout:'compact'},
  t9:{name:'Karachi',className:'rs-template-t9',accent:'#BD654F',pageSize:'letter',layout:'bookmark'},
  t10:{name:'Mumbai',className:'rs-template-t10',accent:'#8A8A8A',pageSize:'a4',layout:'labels-left'},
  t11:{name:'Delhi',className:'rs-template-t11',accent:'#3676A6',pageSize:'letter',layout:'classic'},
  t12:{name:'San Francisco',className:'rs-template-t12',accent:'#6197B5',pageSize:'letter',layout:'sidebar-left'},
  t13:{name:'Boston',className:'rs-template-t13',accent:'#222222',pageSize:'letter',layout:'sidebar-left'},
  t14:{name:'Seattle',className:'rs-template-t14',accent:'#913C50',pageSize:'letter',layout:'banner'},
  t15:{name:'Amsterdam',className:'rs-template-t15',accent:'#5B9AB5',pageSize:'letter',layout:'sidebar-right'},
  t16:{name:'Singapore',className:'rs-template-t16',accent:'#444444',pageSize:'a4',layout:'columns'},
  t17:{name:'Tokyo',className:'rs-template-t17',accent:'#E37C62',pageSize:'letter',layout:'banner'},
  t18:{name:'Stockholm',className:'rs-template-t18',accent:'#222222',pageSize:'letter',layout:'editorial'},
  t19:{name:'Sydney',className:'rs-template-t19',accent:'#5C514A',pageSize:'letter',layout:'banner'},
  t20:{name:'São Paulo',className:'rs-template-t20',accent:'#8E7AA0',pageSize:'a4',layout:'columns'},
  t21:{name:'Seoul',className:'rs-template-t21',accent:'#555555',pageSize:'a4',layout:'sidebar-left'},
  t22:{name:'Berlin',className:'rs-template-t22',accent:'#111111',pageSize:'a4',layout:'columns'},
  t23:{name:'Zurich',className:'rs-template-t23',accent:'#777777',pageSize:'a4',layout:'sidebar-right'},
  t24:{name:'Vienna',className:'rs-template-t24',accent:'#56799B',pageSize:'letter',layout:'editorial'},
  t25:{name:'Mexico City',className:'rs-template-t25',accent:'#8C77A5',pageSize:'letter',layout:'classic'},
  t26:{name:'Dubai',className:'rs-template-t26',accent:'#343840',pageSize:'letter',layout:'labels-left'},
  t27:{name:'Cape Town',className:'rs-template-t27',accent:'#343840',pageSize:'letter',layout:'sidebar-right'}
 };
 window.ResumeTemplates = Object.freeze({
  all:()=>Object.entries(templates).map(([id,v])=>({id,...v})),
  get:id=>templates[id]||templates.t1,
  className:id=>(templates[id]||templates.t1).className,
  accent:id=>(templates[id]||templates.t1).accent
 });
})();