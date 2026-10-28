'use client';
import {useEffect, useRef, useState} from 'react';
import type {IChartApi, ISeriesApi, Time, SeriesType, SeriesMarker} from 'lightweight-charts';
import type {Candle} from '../lib/training/types';
import type {Snapshot, Trade} from '../lib/spider/types';
import {ema, macd, rsi, sma} from '../lib/training/indicators';
import {SPIDER_CHART as C} from '../lib/spider/chart-copy';
import {heikinAshi, chartStyles, type ChartStyle} from './market-chart';

type Indicators = {ma: boolean; ema: boolean; bands: boolean; volume: boolean; macd: boolean; rsi: boolean};
const INITIAL: Indicators = {ma: true, ema: false, bands: false, volume: true, macd: true, rsi: false};
type Bundle = {chart: IChartApi; price: ISeriesApi<SeriesType>; lines: Record<string, ISeriesApi<'Line'>>; volume?: ISeriesApi<'Histogram'>; histogram?: ISeriesApi<'Histogram'>; markers: {setMarkers: (m: SeriesMarker<Time>[]) => void}};
export default function SpiderChart({snapshot, trades, stop}: {snapshot: Snapshot; trades: Trade[]; stop: number | null}) {
  const lastBar = useRef<Candle | null>(null);
  const container = useRef<HTMLDivElement>(null), bundle = useRef<Bundle | null>(null);
  const [style, setStyle] = useState<ChartStyle>('candles'), [indicators, setIndicators] = useState(INITIAL), [ready, setReady] = useState(0), [failed, setFailed] = useState(false);
  const identity = `${snapshot.market.id}:${snapshot.interval}`;
  useEffect(() => {
    let disposed = false;
    void import('lightweight-charts').then(L => {
      if (disposed || !container.current) return;
      const chart = L.createChart(container.current, {autoSize: true, height: 520,
        layout: {background: {type: L.ColorType.Solid, color: '#100b1a'}, textColor: '#af9fc2', fontFamily: 'Inter, sans-serif', attributionLogo: true},
        grid: {vertLines: {color: '#a48bb610'}, horzLines: {color: '#a48bb619'}}, crosshair: {mode: L.CrosshairMode.Normal},
        rightPriceScale: {borderColor: '#b99bd22a'}, timeScale: {borderColor: '#b99bd22a', timeVisible: true, secondsVisible: false},
      });
      const colors = {upColor: '#6aebc0', downColor: '#fa8ba4', wickUpColor: '#6aebc0', wickDownColor: '#fa8ba4', borderVisible: false};
      const precision = snapshot.price >= 100 ? 2 : snapshot.price >= 1 ? 4 : Math.min(10, Math.max(6, Math.ceil(-Math.log10(snapshot.price)) + 4));
      const common = {priceFormat: {type: 'price' as const, precision, minMove: 10 ** -precision}};
      let price: ISeriesApi<SeriesType>;
      if (style === 'candles' || style === 'hollow' || style === 'heikin') price = chart.addSeries(L.CandlestickSeries, {...colors, ...common, ...(style === 'hollow' ? {upColor: '#100b1a', borderVisible: true, borderUpColor: '#6aebc0', borderDownColor: '#fa8ba4'} : {})});
      else if (style === 'bars' || style === 'highlow') price = chart.addSeries(L.BarSeries, {...common, upColor: colors.upColor, downColor: colors.downColor, openVisible: style === 'bars'});
      else if (style === 'area') price = chart.addSeries(L.AreaSeries, {...common, lineColor: '#c298fa', topColor: '#ad65ed66', bottomColor: '#ad65ed00'});
      else if (style === 'baseline') price = chart.addSeries(L.BaselineSeries, {...common, baseValue: {type: 'price', price: snapshot.candles[0].close}});
      else price = chart.addSeries(L.LineSeries, {...common, color: '#c7a0ff', lineWidth: 2, pointMarkersVisible: style === 'markers', lineType: style === 'step' ? L.LineType.WithSteps : L.LineType.Simple});
      const lines: Record<string, ISeriesApi<'Line'>> = {};
      const add = (key: string, color: string, pane = 0) => {lines[key] = chart.addSeries(L.LineSeries, {color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false}, pane);};
      if (indicators.ma) {add('fast', '#ffcf75'); add('slow', '#74b8ff');}
      if (indicators.ema) add('ema', '#df9bfa');
      if (indicators.bands) {add('upper', '#8478c5'); add('lower', '#8478c5');}
      let pane = 1;
      const volume = indicators.volume ? chart.addSeries(L.HistogramSeries, {priceFormat: {type: 'volume'}, priceLineVisible: false, lastValueVisible: false}, pane++) : undefined;
      let histogram: ISeriesApi<'Histogram'> | undefined;
      if (indicators.macd) {histogram = chart.addSeries(L.HistogramSeries, {priceLineVisible: false, lastValueVisible: false}, pane); add('macd', '#cba5ff', pane); add('signal', '#ffce78', pane++);}
      if (indicators.rsi) {add('rsi', '#b98bfa', pane); lines.rsi.createPriceLine({price: 30, color: '#aaa0c055', lineWidth: 1, lineStyle: L.LineStyle.Dashed, axisLabelVisible: false}); lines.rsi.createPriceLine({price: 70, color: '#aaa0c055', lineWidth: 1, lineStyle: L.LineStyle.Dashed, axisLabelVisible: false});}
      chart.panes().forEach((p, i) => p.setHeight(i === 0 ? 340 : 90));
      bundle.current = {chart, price, lines, volume, histogram, markers: L.createSeriesMarkers(price)}; setReady(value => value + 1);
    }).catch(() => {if (!disposed) setFailed(true);});
    return () => {disposed = true; bundle.current?.chart.remove(); bundle.current = null; lastBar.current = null;};
    // Chart configuration is rebuilt only when the market, style, or indicators change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, style, indicators]);
  useEffect(() => {
    const b = bundle.current; if (!b) return;
    const candles = snapshot.candles, displayed = style === 'heikin' ? heikinAshi(candles) : candles;
    const ohlc = ['candles', 'hollow', 'heikin', 'bars', 'highlow'].includes(style);
    b.price.setData(displayed.map(c => ohlc ? {...c, time: c.time as Time} : {time: c.time as Time, value: c.close}));
    const values = candles.map(c => c.close), fast = sma(values, 7), slow = sma(values, 25), middle = sma(values, 20), exp = ema(values, 9), momentum = macd(values), strength = rsi(values);
    const sigma = values.map((_, i) => i < 19 ? null : Math.sqrt(values.slice(i - 19, i + 1).reduce((sum, value) => sum + (value - middle[i]!) ** 2, 0) / 20));
    const series: Record<string, (number | null)[]> = {fast, slow, ema: exp, upper: middle.map((m, i) => m === null ? null : m + 2 * sigma[i]!), lower: middle.map((m, i) => m === null ? null : m - 2 * sigma[i]!), macd: momentum.line, signal: momentum.signal, rsi: strength};
    for (const [key, line] of Object.entries(b.lines)) line.setData(series[key].flatMap((value, i) => value === null ? [] : [{time: candles[i].time as Time, value}]));
    b.volume?.setData(candles.map(c => ({time: c.time as Time, value: c.volume ?? 0, color: c.close >= c.open ? '#6aebc070' : '#fa8ba470'})));
    b.histogram?.setData(momentum.histogram.flatMap((value, i) => value === null ? [] : [{time: candles[i].time as Time, value, color: value >= 0 ? '#6aebc090' : '#fa8ba490'}]));
    b.markers.setMarkers(trades.filter(t => t.time / 1000 >= candles[0].time).map(t => ({time: (Math.floor(t.time / 1000 / snapshot.interval) * snapshot.interval) as Time, position: t.side === 'buy' ? 'belowBar' : 'aboveBar', color: t.side === 'buy' ? '#6aebc0' : '#fa8ba4', shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown', text: t.side === 'buy' ? 'BUY' : 'SELL'})));
    const target = displayed.at(-1)!;
    const prior = lastBar.current; lastBar.current = target;
    let animation = 0;
    if (prior && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const from = prior.time === target.time ? prior : {...target, open: target.open, close: target.open, high: target.open, low: target.open};
      const began = performance.now();
      const animate = (now: number) => {
        if (bundle.current !== b) return;
        const fraction = Math.min(1, (now - began) / 650), eased = 1 - (1 - fraction) ** 3;
        const lerp = (a: number, z: number) => a + (z - a) * eased;
        b.price.update(ohlc ? {time: target.time as Time, open: lerp(from.open, target.open), high: lerp(from.high, target.high), low: lerp(from.low, target.low), close: lerp(from.close, target.close)} : {time: target.time as Time, value: lerp(from.close, target.close)});
        if (fraction < 1) animation = requestAnimationFrame(animate);
      };
      animation = requestAnimationFrame(animate);
    }
    const stopLine = stop && style !== 'heikin' ? b.price.createPriceLine({price: stop, color: '#ffaf7e', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'STOP'}) : null;
    return () => {cancelAnimationFrame(animation); if (stopLine && bundle.current === b) b.price.removePriceLine(stopLine);};
  }, [snapshot, trades, stop, ready, style]);
  useEffect(() => {bundle.current?.chart.timeScale().fitContent();}, [ready]);
  return <><div className="sp-chart-controls"><select aria-label="Chart style" value={style} onChange={e => setStyle(e.target.value as ChartStyle)}>{chartStyles.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><div>{(Object.keys(indicators) as (keyof Indicators)[]).map(key => <button type="button" aria-pressed={indicators[key]} className={indicators[key] ? 'active' : ''} key={key} onClick={() => setIndicators({...indicators, [key]: !indicators[key]})}>{C[key]}</button>)}</div><button type="button" onClick={() => bundle.current?.chart.timeScale().fitContent()}>{C.reset}</button></div><div ref={container} className="sp-interactive-chart" role="region" aria-label={C.aria}/>{failed && <p role="alert">{C.failed}</p>}<p className="sp-chart-hint">{C.hint}</p></>;
}
