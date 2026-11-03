import english from './english.json' with {type:'json'};
import zhCN from './locales/zh-CN.json' with {type:'json'};
import zhTW from './locales/zh-TW.json' with {type:'json'};
import es from './locales/es.json' with {type:'json'};
import pt from './locales/pt-BR.json' with {type:'json'};
import fr from './locales/fr.json' with {type:'json'};
import de from './locales/de.json' with {type:'json'};
import ja from './locales/ja.json' with {type:'json'};
import ko from './locales/ko.json' with {type:'json'};
import ar from './locales/ar.json' with {type:'json'};
import hi from './locales/hi.json' with {type:'json'};
import type {Locale} from '../locale-copy.ts';

export const messageSource:Record<string,string>=english;
export const messageCatalogs:Record<Locale,Record<string,string>>={'en':english,'zh-CN':zhCN,'zh-TW':zhTW,es,'pt-BR':pt,fr,de,ja,ko,ar,hi};
const normalize=(value:string)=>value.replace(/\s+/g,' ').trim();
const entries=Object.entries(messageSource),exact=new Map(entries.map(([id,text])=>[normalize(text),id])),folded=new Map(entries.map(([id,text])=>[normalize(text).toLowerCase(),id]));
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns=entries.filter(([,text])=>/\{\d+\}/.test(text)).map(([id,text])=>{
  const slots=[...text.matchAll(/\{(\d+)\}/g)].map(match=>Number(match[1]));
  const expression=text.split(/\{\d+\}/).map(escape).join('(.{1,240}?)');
  return {id,slots,expression:new RegExp(`^${expression}$`,'i'),weight:text.replace(/\{\d+\}/g,'').length};
}).sort((a,b)=>b.weight-a.weight);
const basisPoints:Record<Locale,string>={en:'bp','zh-CN':'基点','zh-TW':'基點',es:'pb','pt-BR':'pb',fr:'pb',de:'Bp.',ja:'ベーシスポイント',ko:'bp',ar:'نقطة أساس',hi:'आधार अंक'};
const proper=/^(?:https?:\/\/|\d{4}-\d{2}-\d{2}T)|^(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|[A-Z][A-Z0-9]{1,19}(?:[\/-][A-Z0-9]{2,20})?|[a-f0-9-]{24,})$/;
function translateNormalized(locale:Locale,text:string,split=true):string {
  const id=exact.get(text)??folded.get(text.toLowerCase());
  if(id)return messageCatalogs[locale][id]??text;
  if(proper.test(text))return text;
  for(const pattern of patterns){const match=pattern.expression.exec(text);if(match){const values=new Map(pattern.slots.map((slot,index)=>[slot,match[index+1]]));return (messageCatalogs[locale][pattern.id]??messageSource[pattern.id]).replace(/\{(\d+)\}/g,(_,slot)=>translateNormalized(locale,values.get(Number(slot))??'',true));}}
  if(['ms','s','m','h'].includes(text)){try{return new Intl.NumberFormat(locale,{style:'unit',unit:({ms:'millisecond',s:'second',m:'minute',h:'hour'} as Record<string,string>)[text],unitDisplay:'short'}).formatToParts(1).filter(part=>part.type==='unit').map(part=>part.value).join('');}catch{return text;}}
  if(text==='bp'||text==='bps')return basisPoints[locale];
  const unit=/^([-+]?\d+(?:\.\d+)?)\s*(ms|s|m|h|bp|bps|H)$/.exec(text);
  if(unit){const value=Number(unit[1]);if(unit[2]==='bp'||unit[2]==='bps')return `${unit[1]} ${basisPoints[locale]}`;
    try{return new Intl.NumberFormat(locale,{style:'unit',unit:({ms:'millisecond',s:'second',m:'minute',h:'hour'} as Record<string,string>)[unit[2].toLowerCase()],unitDisplay:'short',maximumFractionDigits:2}).format(value);}catch{return text;}}
  if(split&&/[·•]| \/ /.test(text))return text.split(/(\s*[·•]\s*| \/ )/).map(part=>/^[\s·•/]+$/.test(part)?part:translateNormalized(locale,part.trim(),false)).join('');
  const labelled=/^([A-Za-z][A-Za-z /&-]*?):?\s+([-+]?\d.*)$/.exec(text);if(labelled){const labelId=exact.get(labelled[1])??folded.get(labelled[1].toLowerCase());if(labelId)return `${messageCatalogs[locale][labelId]} ${translateNormalized(locale,labelled[2],false)}`;}
  if(split&&text.includes(': ')){const index=text.indexOf(': ');const labelId=exact.get(text.slice(0,index))??folded.get(text.slice(0,index).toLowerCase());if(labelId)return `${messageCatalogs[locale][labelId]}: ${text.slice(index+2)}`;}
  return text;
}
/** Translate authored display text only. Never apply this function to protocol values or stored data. */
export function localizeText(locale:Locale,text:string):string {
  if(locale==='en'||!text||!/[A-Za-z]/.test(text))return text;
  const normalized=normalize(text),translated=translateNormalized(locale,normalized);
  if(translated===normalized)return text;
  return `${text.match(/^\s*/)?.[0]??''}${translated}${text.match(/\s*$/)?.[0]??''}`;
}
