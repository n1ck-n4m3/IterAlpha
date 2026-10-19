import type { Candle } from '../training/types.ts';

export const marketAssets = ['BTC','ETH','SOL','XRP'] as const;
export type MarketAsset = typeof marketAssets[number];
export interface MarketQuote { asset: MarketAsset; price: number; bid: number; ask: number; volume24h: number; time: string }
const quoteCache = new Map<MarketAsset,{until:number;value:MarketQuote|null}>();
const candleCache = new Map<MarketAsset,{until:number;value:Candle[]}>();

async function coinbase(path:string):Promise<unknown> {
  const response=await fetch(`https://api.exchange.coinbase.com${path}`,{headers:{Accept:'application/json','User-Agent':'IterAlpha-MVP/0.3'},signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw new Error('Coinbase market data is unavailable.');
  return response.json();
}
function finitePositive(value:unknown):number|null { const result=Number(value);return Number.isFinite(result)&&result>0?result:null; }
export async function quote(asset:MarketAsset):Promise<MarketQuote|null> {
  const cached=quoteCache.get(asset);if(cached&&cached.until>Date.now())return cached.value;
  try {
    const raw=await coinbase(`/products/${asset}-USD/ticker`) as Record<string,unknown>;
    const price=finitePositive(raw.price),bid=finitePositive(raw.bid),ask=finitePositive(raw.ask),volume24h=finitePositive(raw.volume);
    const time=typeof raw.time==='string'?raw.time:'';
    if(price===null||bid===null||ask===null||volume24h===null||!Number.isFinite(Date.parse(time)))throw new Error('Invalid market quote.');
    const value={asset,price,bid,ask,volume24h,time};quoteCache.set(asset,{until:Date.now()+15_000,value});return value;
  } catch {quoteCache.set(asset,{until:Date.now()+5_000,value:null});return null;}
}
export function parseCoinbaseCandles(raw:unknown):Candle[] {
  if(!Array.isArray(raw))return [];
  const candles:Candle[]=[];
  for(const row of raw){if(!Array.isArray(row)||row.length<6)continue;const [time,low,high,open,close,volume]=row.map(Number);if(![time,low,high,open,close,volume].every(Number.isFinite)||time<=0||low<=0||high<low||open<low||open>high||close<low||close>high||volume<0)continue;candles.push({time,low,high,open,close,volume});}
  return candles.sort((a,b)=>a.time-b.time).filter((c,i,a)=>i===0||c.time!==a[i-1].time);
}
export async function candles(asset:MarketAsset):Promise<Candle[]> {
  const cached=candleCache.get(asset);if(cached&&cached.until>Date.now())return cached.value;
  try {const value=parseCoinbaseCandles(await coinbase(`/products/${asset}-USD/candles?granularity=900`)).slice(-192);if(value.length<2)throw new Error('Candle history is unavailable.');candleCache.set(asset,{until:Date.now()+300_000,value});return value;}
  catch {return cached?.value??[];}
}
export async function marketSnapshot(selected:MarketAsset) {
  const [quotes,chart]=await Promise.all([Promise.all(marketAssets.map(quote)),candles(selected)]);
  return {source:'Coinbase Exchange',selected,quotes,chart,intervalSeconds:900,refreshedAt:new Date().toISOString()};
}
