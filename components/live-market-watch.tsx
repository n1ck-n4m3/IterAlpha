'use client';
import {useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,Radio,RefreshCw,ShieldCheck} from 'lucide-react';
import type {Candle} from '../lib/training/types';
import {aggregateCandles} from '../lib/training/engine';
import MarketChart, {chartStyles,type ChartStyle} from './market-chart';

type Asset='BTC'|'ETH'|'SOL'|'XRP';
type Quote={asset:Asset;price:number;bid:number;ask:number;volume24h:number;time:string};
type Snapshot={quotes:(Quote|null)[];chart:Candle[];selected:Asset;refreshedAt:string};
const assets:Asset[]=['BTC','ETH','SOL','XRP'];
const money=(number:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(number);
function mergeQuotes(previous:Record<Asset,Quote|null>, incoming:(Quote|null)[]) {const next={...previous};for(const item of incoming)if(item&&(!next[item.asset]||Date.parse(item.time)>=Date.parse(next[item.asset]!.time)))next[item.asset]=item;return next;}

export default function LiveMarketWatch() {
  const [selected,setSelected]=useState<Asset>('BTC');
  const [quotes,setQuotes]=useState<Record<Asset,Quote|null>>({BTC:null,ETH:null,SOL:null,XRP:null});
  const [candles,setCandles]=useState<Candle[]>([]);
  const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [streaming,setStreaming]=useState(false);
  const [period,setPeriod]=useState<900|3600|14400>(900);const [style,setStyle]=useState<ChartStyle>('candles');
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{
      try {const response=await fetch(`/api/market?symbol=${selected}`,{cache:'no-store'});if(!response.ok)throw new Error('Market data could not be loaded.');const data=await response.json() as Snapshot;if(!active)return;
        setQuotes(previous=>mergeQuotes(previous,data.quotes));setCandles(data.chart);setError(data.chart.length?'':'Chart data is temporarily unavailable. Quotes may still update.');
      }catch{if(active)setError('The quote feed is temporarily unavailable. Try refresh shortly.');}finally{if(active)setLoading(false);}
    };
    void refresh();const timer=setInterval(()=>void refresh(),30_000);
    return()=>{active=false;clearInterval(timer);};
  },[selected]);
  useEffect(()=>{
    let socket:WebSocket;
    try {socket=new WebSocket('wss://ws-feed.exchange.coinbase.com');}catch{return;}
    socket.onopen=()=>{setStreaming(true);socket.send(JSON.stringify({type:'subscribe',product_ids:assets.map(asset=>`${asset}-USD`),channels:['ticker']}));};
    socket.onmessage=event=>{try {const message=JSON.parse(event.data) as Record<string,unknown>;if(message.type!=='ticker'||typeof message.product_id!=='string'||typeof message.price!=='string'||typeof message.time!=='string')return;const asset=message.product_id.replace('-USD','') as Asset;if(!assets.includes(asset))return;const price=Number(message.price);if(!Number.isFinite(price)||price<=0)return;setQuotes(previous=>({...previous,[asset]:{asset,price,bid:previous[asset]?.bid??price,ask:previous[asset]?.ask??price,volume24h:previous[asset]?.volume24h??0,time:message.time as string}}));}catch{}};
    socket.onerror=()=>setStreaming(false);socket.onclose=()=>setStreaming(false);
    return()=>{socket.close();setStreaming(false);};
  },[]);
  const visible=useMemo(()=>{if(period===900)return candles;const cutoff=(candles.at(-1)?.time??0)+900;return aggregateCandles(candles,period,cutoff);},[candles,period]);
  const quote=quotes[selected];
  return <div className="live-watch"><div className="page-heading"><div><div className="eyebrow"><Radio size={13}/>MARKET WATCH</div><h1>Crypto, as it moves.</h1><p>Current Coinbase Exchange quotes and a chart shown immediately. Practice rounds use separate simulated data.</p></div></div>
    <div className="live-symbols">{assets.map(asset=><button key={asset} className={selected===asset?'active':''} onClick={()=>{setSelected(asset);setLoading(true);}}><strong>{asset}<span> / USD</span></strong><b>{quotes[asset]?money(quotes[asset]!.price):'—'}</b><small>{quotes[asset]?new Date(quotes[asset]!.time).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'Waiting for quote'}</small></button>)}</div>
    <section className="live-widget-panel market-direct"><div className="section-heading"><h2>{selected} / USD</h2><span><span className="status-dot"/>{streaming?'Streaming quotes':'Refreshing quotes every 30 sec'}</span></div><div className="live-price-row"><div><strong>{quote?money(quote.price):loading?'Loading quote…':'Quote unavailable'}</strong><span>{quote?`Last trade ${new Date(quote.time).toLocaleString('en-US')}`:'Coinbase Exchange'}</span></div><button className="quiet-button" onClick={()=>{setLoading(true);void fetch(`/api/market?symbol=${selected}`,{cache:'no-store'}).then(r=>r.json() as Promise<Snapshot>).then(data=>{setCandles(data.chart);setQuotes(previous=>mergeQuotes(previous,data.quotes));setError('');}).catch(()=>setError('Market refresh failed.')).finally(()=>setLoading(false));}}><RefreshCw size={14}/>Refresh</button></div><div className="chart-toolbar"><div className="period-control" aria-label="Chart interval"><button className={period===900?'active':''} onClick={()=>setPeriod(900)}>15m</button><button className={period===3600?'active':''} onClick={()=>setPeriod(3600)}>1h</button><button className={period===14400?'active':''} onClick={()=>setPeriod(14400)}>4h</button></div><label className="chart-style-picker"><span className="sr-only">Chart style</span><select aria-label="Chart style" value={style} onChange={event=>setStyle(event.target.value as ChartStyle)}>{chartStyles.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><span className="market-timestamp">{quote?`Quote time ${new Date(quote.time).toLocaleTimeString('en-US')}`:'No timestamp'}</span></div><div className="live-chart-direct">{visible.length?<MarketChart candles={visible} fills={[]} stop={null} style={style} training={false} referencePrice={quote?.price} revision={`${selected}-${period}`}/>:<div className="live-chart-empty">{loading?'Loading chart…':'Chart data is unavailable right now.'}</div>}</div><p className="live-chart-note">15-minute candle history refreshes periodically; the dotted line marks the latest streamed trade. Heikin Ashi displays smoothed prices.</p>{error&&<p className="live-error" role="status">{error}</p>}</section>
    <div className="live-notice"><ShieldCheck size={18}/><p>Prices are from the Coinbase Exchange last-trade feed. Chart history may be delayed or temporarily unavailable. Quotes are never used to fill training orders. The simulator uses its own labeled synthetic price path.</p></div><p className="live-attribution">Source: <a href="https://exchange.coinbase.com/" target="_blank" rel="noreferrer">Coinbase Exchange<ArrowUpRight size={12}/></a>. No brokerage account is connected.</p>
  </div>;
}
