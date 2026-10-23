import { renderNewYork } from './t01-new-york.js';
import { renderParis } from './t02-paris.js';
import { renderToronto } from './t03-toronto.js';
import { renderChicago } from './t04-chicago.js';
import { renderMadrid } from './t05-madrid.js';
import { renderSantiago } from './t06-santiago.js';
import { renderIstanbul } from './t07-istanbul.js';
import { renderLondon } from './t08-london.js';
import { renderKarachi } from './t09-karachi.js';
import { renderMumbai } from './t10-mumbai.js';
import { renderDelhi } from './t11-delhi.js';
import { renderSanFrancisco } from './t12-san-francisco.js';
import { renderBoston } from './t13-boston.js';
import { renderSeattle } from './t14-seattle.js';
import { renderAmsterdam } from './t15-amsterdam.js';
import { renderSingapore } from './t16-singapore.js';
import { renderTokyo } from './t17-tokyo.js';
import { renderStockholm } from './t18-stockholm.js';
import { renderSydney } from './t19-sydney.js';
import { renderSaoPaulo } from './t20-sao-paulo.js';
import { renderSeoul } from './t21-seoul.js';
import { renderBerlin } from './t22-berlin.js';
import { renderZurich } from './t23-zurich.js';
import { renderVienna } from './t24-vienna.js';
import { renderMexicoCity } from './t25-mexico-city.js';
import { renderDubai } from './t26-dubai.js';
import { renderCapeTown } from './t27-cape-town.js';
export const TEMPLATES = [
{ id:'T1',slug:'new-york',name:'New York',render:renderNewYork },
{ id:'T2',slug:'paris',name:'Paris',render:renderParis },
{ id:'T3',slug:'toronto',name:'Toronto',render:renderToronto },
{ id:'T4',slug:'chicago',name:'Chicago',render:renderChicago },
{ id:'T5',slug:'madrid',name:'Madrid',render:renderMadrid },
{ id:'T6',slug:'santiago',name:'Santiago',render:renderSantiago },
{ id:'T7',slug:'istanbul',name:'Istanbul',render:renderIstanbul },
{ id:'T8',slug:'london',name:'London',render:renderLondon },
{ id:'T9',slug:'karachi',name:'Karachi',render:renderKarachi },
{ id:'T10',slug:'mumbai',name:'Mumbai',render:renderMumbai },
{ id:'T11',slug:'delhi',name:'Delhi',render:renderDelhi },
{ id:'T12',slug:'san-francisco',name:'San Francisco',render:renderSanFrancisco },
{ id:'T13',slug:'boston',name:'Boston',render:renderBoston },
{ id:'T14',slug:'seattle',name:'Seattle',render:renderSeattle },
{ id:'T15',slug:'amsterdam',name:'Amsterdam',render:renderAmsterdam },
{ id:'T16',slug:'singapore',name:'Singapore',render:renderSingapore },
{ id:'T17',slug:'tokyo',name:'Tokyo',render:renderTokyo },
{ id:'T18',slug:'stockholm',name:'Stockholm',render:renderStockholm },
{ id:'T19',slug:'sydney',name:'Sydney',render:renderSydney },
{ id:'T20',slug:'sao-paulo',name:'São Paulo',render:renderSaoPaulo },
{ id:'T21',slug:'seoul',name:'Seoul',render:renderSeoul },
{ id:'T22',slug:'berlin',name:'Berlin',render:renderBerlin },
{ id:'T23',slug:'zurich',name:'Zurich',render:renderZurich },
{ id:'T24',slug:'vienna',name:'Vienna',render:renderVienna },
{ id:'T25',slug:'mexico-city',name:'Mexico City',render:renderMexicoCity },
{ id:'T26',slug:'dubai',name:'Dubai',render:renderDubai },
{ id:'T27',slug:'cape-town',name:'Cape Town',render:renderCapeTown },
];
export function renderResume(idOrSlug, data) {
  const k=String(idOrSlug ?? '').toLowerCase();
  const t=TEMPLATES.find(x=>x.id.toLowerCase()===k||x.slug===k||x.name.toLowerCase()===k);
  if(!t) throw new Error(`Unknown resume template: ${idOrSlug}`);
  return t.render(data);
}