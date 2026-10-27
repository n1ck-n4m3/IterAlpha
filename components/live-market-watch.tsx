'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Radio, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import type { Candle } from '../lib/training/types';
import { aggregateCandles } from '../lib/training/engine';
import { COPY } from '../lib/ui-copy';
import MarketChart, { chartStyles, type ChartStyle } from './market-chart';
import IndicatorControls,{useChartIndicators} from './indicator-controls';
import {useLocale} from './locale-provider';

type Asset = 'BTC' | 'ETH' | 'SOL' | 'XRP';
type Quote = { asset: Asset; price: number; bid: number; ask: number; volume24h: number; time: string };
type Snapshot = { mode: 'synthetic'; quotes: Quote[]; chart: Candle[]; selected: Asset; refreshedAt: string };
const assets: Asset[] = ['BTC', 'ETH', 'SOL', 'XRP'];
const money = (number: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: number < 1 ? 4 : 2 }).format(number);

export default function MarketLab() {
  const {locale,t}=useLocale();
  const [selected, setSelected] = useState<Asset>('BTC');
  const [quotes, setQuotes] = useState<Partial<Record<Asset, Quote>>>({});
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [period, setPeriod] = useState<900 | 3600 | 14400>(900);
  const [style, setStyle] = useState<ChartStyle>('candles');
  const [indicators,setIndicators]=useChartIndicators();

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/market?symbol=${selected}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Synthetic sample request failed.');
        const data = await response.json() as Snapshot;
        if (data.mode !== 'synthetic' || !active) return;
        setQuotes(Object.fromEntries(data.quotes.map(quote => [quote.asset, quote])));
        setCandles(data.chart);
        setError(data.chart.length ? '' : COPY.market.chartUnavailable);
      } catch {
        if (active) setError(COPY.market.feedError);
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    return () => { active = false; clearInterval(timer); };
  }, [selected, refreshKey]);

  const visible = useMemo(() => {
    if (period === 900) return candles;
    const cutoff = (candles.at(-1)?.time ?? 0) + 900;
    return aggregateCandles(candles, period, cutoff);
  }, [candles, period]);
  const quote = quotes[selected];
  const lastCandle = quote ? new Date(quote.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '';

  return <div className="live-watch">
    <div className="page-heading"><div><div className="eyebrow"><Radio size={13}/>{COPY.market.eyebrow}</div><h1>{t('marketLab')}</h1><p>{COPY.market.description}</p></div></div>
    <div className="live-symbols">{assets.map(asset => <button key={asset} className={selected === asset ? 'active' : ''} onClick={() => { setSelected(asset); setLoading(true); }}><strong>{asset}<span> / USD</span></strong><b>{quotes[asset] ? money(quotes[asset]!.price) : '—'}</b><small>{quotes[asset] ? COPY.market.sample : COPY.market.waiting}</small></button>)}</div>
    <section className="live-widget-panel market-direct">
      <div className="section-heading"><h2>{selected} / USD</h2><span><span className="status-dot"/>{COPY.market.sample}</span></div>
      <div className="live-price-row"><div><strong>{quote ? money(quote.price) : loading ? COPY.market.loading : COPY.market.unavailable}</strong><span>{lastCandle ? `${COPY.market.lastCandle} · ${lastCandle} UTC` : COPY.market.sample}</span></div><button className="quiet-button" onClick={() => { setLoading(true); setRefreshKey(key => key + 1); }}><RefreshCw size={14}/>{COPY.market.refresh}</button></div>
      <div className="chart-toolbar"><div className="period-control" aria-label="Chart interval"><button className={period === 900 ? 'active' : ''} onClick={() => setPeriod(900)}>15m</button><button className={period === 3600 ? 'active' : ''} onClick={() => setPeriod(3600)}>1h</button><button className={period === 14400 ? 'active' : ''} onClick={() => setPeriod(14400)}>4h</button></div><label className="chart-style-picker"><span className="sr-only">{t('chartStyle')}</span><select aria-label={t('chartStyle')} value={style} onChange={event => setStyle(event.target.value as ChartStyle)}>{chartStyles.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><span className="market-timestamp">{COPY.market.sample}</span></div>
      <IndicatorControls value={indicators} onChange={setIndicators} availableBars={visible.length} hasVolume={visible.some(c=>c.volume!==undefined)} educational/>
      <div className="live-chart-direct">{visible.length ? <MarketChart candles={visible} fills={[]} stop={null} style={style} training={false} referencePrice={quote?.price} indicators={indicators} locale={locale} revision={`${selected}-${period}`} /> : <div className="live-chart-empty">{loading ? COPY.market.loading : COPY.market.chartUnavailable}</div>}</div>
      <p className="live-chart-note">{COPY.market.chartNote}</p>{error && <p className="live-error" role="status">{error}</p>}
    </section>
    <div className="live-notice"><ShieldCheck size={18}/><p>{COPY.market.notice}</p></div>
    <section className="paper-preview"><div><span className="eyebrow"><Sparkles size={14}/>{COPY.market.paperPreview.eyebrow}</span><h2>{COPY.market.paperPreview.title}</h2><p>{COPY.market.paperPreview.description}</p><div className="paper-preview-steps">{COPY.market.paperPreview.steps.map((step,index)=><span key={step}><b>0{index+1}</b>{step}</span>)}</div><a href="/app?track=foundations">{COPY.market.paperPreview.action}<ArrowRight size={15}/></a></div><span className="paper-preview-status">{COPY.market.paperPreview.status}</span></section>
  </div>;
}
