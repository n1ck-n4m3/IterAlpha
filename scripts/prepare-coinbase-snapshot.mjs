import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';

const [sceneId,startInput,outputInput]=process.argv.slice(2);
const asset=sceneId?.startsWith('btc-')?'BTC':sceneId?.startsWith('eth-')?'ETH':null;
if(!asset||!startInput||!outputInput)throw new Error('Usage: node scripts/prepare-coinbase-snapshot.mjs <btc-or-eth-scene-id> <UTC-start> <output-json-path>');
const output=resolve(outputInput);
const project=resolve('.');
if(output===project||output.startsWith(project+sep))throw new Error('Save research drafts outside the repository.');
const start=Date.parse(startInput)/1000;
if(!Number.isInteger(start)||start<=0||start%900!==0)throw new Error('The UTC start must align with a 15-minute candle.');
const end=start+88*900;
const url=new URL(`https://api.exchange.coinbase.com/products/${asset}-USD/candles`);
url.searchParams.set('granularity','900');
url.searchParams.set('start',new Date(start*1000).toISOString());
url.searchParams.set('end',new Date(end*1000).toISOString());
const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'IterAlpha-research/0.1'}});
if(!response.ok)throw new Error(`Coinbase returned HTTP ${response.status}.`);
const body=await response.json();
if(!Array.isArray(body))throw new Error('The provider returned an unexpected response.');
const candles=body.filter(row=>Array.isArray(row)&&row.length>=6&&Number.isInteger(row[0])&&row[0]>=start&&row[0]<end)
  .map(row=>({time:row[0],low:row[1],high:row[2],open:row[3],close:row[4],volume:row[5]}))
  .sort((a,b)=>a.time-b.time);
if(candles.length!==88||candles.some((c,i)=>c.time!==start+i*900||![c.low,c.high,c.open,c.close,c.volume].every(Number.isFinite)||c.low<=0||c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close)))throw new Error('The provider window is incomplete or invalid. No draft was written.');
const hash=createHash('sha256').update(JSON.stringify(candles)).digest('hex');
const snapshot={sceneId,editorReviewed:false,displayRightsConfirmed:false,source:{mode:'historical',provider:'Coinbase Exchange',venue:'Coinbase Exchange',symbol:`${asset}-USD`,intervalSeconds:900,retrievedAt:new Date().toISOString(),version:`research-${start}-${hash.slice(0,12)}`,license:'Research-only draft. Public display and storage rights have not been confirmed.',sourceUrl:url.toString(),hash},candles,evidence:[]};
await writeFile(output,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});
console.log(`Research draft saved outside the repository: ${output}. It cannot be imported until source, facts, and display rights are reviewed.`);
