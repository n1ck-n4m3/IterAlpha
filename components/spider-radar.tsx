'use client';
import {useEffect, useId, useRef, useState} from 'react';
import {Activity, ArrowDownRight, ArrowUpRight, Check, Download, Radar} from 'lucide-react';
import type {BotView, Cycle, EvaluationSeconds} from '../lib/spider/types';
import {PULSE as C} from '../lib/spider/pulse-copy';
import {SPIDER} from '../lib/spider/copy';

const number = (value: number, digits = 2) => new Intl.NumberFormat('en-US', {maximumFractionDigits: digits}).format(value);
const clock = (time: number) => new Date(time).toLocaleTimeString('en-GB', {timeZone: 'UTC'});
type Point = {x: number; y: number; cycle: Cycle};

function HistoryChart({cycles, field, title, unit}: {cycles: Cycle[]; field: 'equity' | 'price'; title: string; unit: string}) {
  const id = useId().replaceAll(':', ''), [hovered, setHovered] = useState<number | null>(null);
  const current = useRef<Point[]>([]), [points, setPoints] = useState<Point[]>([]);
  const latest = cycles.at(-1), selected = hovered === null ? latest : cycles[Math.min(hovered, cycles.length - 1)];
  const values = cycles.map(cycle => cycle[field]), minimum = Math.min(...values), maximum = Math.max(...values);
  const range = Math.max(maximum - minimum, (maximum || 1) * .0001), floor = minimum - range * .1;
  const firstTime = cycles[0]?.time ?? 0, duration = Math.max(1, (latest?.time ?? 0) - firstTime);
  useEffect(() => {
    const target = cycles.map(cycle => ({x: 8 + (cycle.time - firstTime) / duration * 584, y: 128 - (cycle[field] - floor) / (range * 1.2) * 100, cycle}));
    if (!target.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {current.current = target; setPoints(target); return;}
    const previous = new Map(current.current.map(point => [point.cycle.time, point]));
    const tail = current.current.at(-1), started = performance.now(); let frame = 0;
    function animate(time: number) {
      const progress = Math.min(1, (time - started) / 550), eased = 1 - (1 - progress) ** 3;
      const next = target.map(point => {const from = previous.get(point.cycle.time) ?? tail ?? point; return {...point, x: from.x + (point.x - from.x) * eased, y: from.y + (point.y - from.y) * eased};});
      current.current = next; setPoints(next); if (progress < 1) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate); return () => cancelAnimationFrame(frame);
  }, [cycles, field, firstTime, duration, floor, range]);
  const path = points.map((point, i) => `${i ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  return <section className={`sp-history-chart ${field}`}><div><span>{title}</span><strong>{selected ? number(selected[field], selected[field] < 1 ? 8 : 2) : '—'} <small>{unit}</small></strong><time>{selected ? `${clock(selected.time)} UTC` : C.empty}</time></div>
    {cycles.length >= 2 && points.length >= 2 ? <svg viewBox="0 0 600 150" role="img" aria-label={`${title}: ${cycles.length} recorded checks`} onPointerLeave={() => setHovered(null)}>
      <defs><linearGradient id={`radar-${id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={field === 'equity' ? '#ae82ff' : '#62d8c1'} stopOpacity=".25"/><stop offset="1" stopOpacity="0"/></linearGradient></defs>
      {[30, 75, 120].map(y => <path key={y} d={`M8 ${y}H592`} className="sp-history-grid"/>)}
      <path d={`${path} L${points.at(-1)!.x} 150 L8 150 Z`} fill={`url(#radar-${id})`}/><path d={path} className="sp-history-line"/>
      {points.filter(point => point.cycle.action !== 'hold').map(point => <circle key={point.cycle.time} cx={point.x} cy={point.y} r="4" className={point.cycle.action}><title>{clock(point.cycle.time)} · {point.cycle.action}</title></circle>)}
      {points.map((point, i) => <rect key={point.cycle.time} x={Math.max(0, point.x - 8)} y="0" width="16" height="150" fill="transparent" onPointerEnter={() => setHovered(i)}/>)}
    </svg> : <div className="sp-history-empty"><Activity size={22}/><span>{C.empty}</span></div>}
  </section>;
}

export default function SpiderRadar({bot, previewSeconds = 5}: {bot: BotView | null; previewSeconds?: EvaluationSeconds}) {
  const [now, setNow] = useState(0);
  useEffect(() => {setNow(Date.now()); if (bot?.status !== 'running') return; const timer = setInterval(() => {if (!document.hidden) setNow(Date.now());}, 250); return () => clearInterval(timer);}, [bot?.status]);
  const cycles = bot?.cycles ?? [], latest = cycles.at(-1), seconds = bot ? bot.config.evaluationSeconds ?? 5 : previewSeconds;
  const remaining = bot?.lastEvaluationAt ? Math.max(0, (bot.lastEvaluationAt + seconds * 1000 - now) / 1000) : 0;
  const reading = bot?.tapeReading, running = bot?.status === 'running';
  const progress = Math.min(1, Math.max(0, 1 - remaining / seconds));
  const action = latest?.action ?? 'hold';
  function exportCycles() {
    if (!bot) return;
    const blob = new Blob([JSON.stringify({market: bot.config.market, config: bot.config, dataIntegrity: bot.dataIntegrity, modelUsed: false, cycles}, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `spider-checks-${bot.id}.json`; link.click(); URL.revokeObjectURL(url);
  }
  return <section className={`sp-radar ${running ? 'running' : ''}`}>
    <div className="sp-panel-title"><h2><Radar size={17}/>{C.title}</h2><span>{C.subtitle}</span><button disabled={!cycles.length} onClick={exportCycles}><Download size={13}/>{C.export}</button></div>
    <div className="sp-radar-flow" key={bot?.updatedAt ?? 'preview'}>{(['market', 'signal', 'risk', 'execution'] as const).map((stage, index) => {
      const check = bot?.trace?.find(step => step.stage === stage), status = check?.status ?? 'waiting';
      return <div className={`sp-radar-stage ${status}`} key={stage} style={{animationDelay: `${index * .12}s`}} title={check?.reason ? SPIDER.reasons[check.reason] : SPIDER.stages[stage]}><span>{status === 'passed' || status === 'filled' ? <Check size={12}/> : status === 'blocked' ? '!' : index + 1}</span><div><strong>{SPIDER.stages[stage]}</strong><small>{SPIDER.traceStatus[status]}</small></div></div>;
    })}</div>
    <div className="sp-radar-summary"><div className="sp-radar-countdown" style={{background: `conic-gradient(#bd8aff ${progress * 360}deg, #bd8aff15 0deg)`}}><span>{running ? remaining > 0 ? `${remaining.toFixed(1)}s` : '…' : '—'}</span></div>
      <div><small>{running ? C.next : bot ? C.paused : C.preview}</small><strong>{seconds}s <span>{C.strategyInterval}</span></strong><p>{remaining === 0 && running ? C.scanning : C.countNote}</p></div>
      <div className="sp-radar-counter"><strong>{bot?.cycleCount ?? 0}</strong><small>{C.checks}</small></div><div className="sp-radar-counter"><strong>{bot?.evaluationCount ?? 0}</strong><small>{C.evaluations}</small></div>
    </div>
    {bot?.config.strategy === 'tape' || !bot ? <><div className="sp-radar-metrics">
      {[{label: C.momentum, value: reading?.momentumBps == null ? '—' : `${reading.momentumBps >= 0 ? '+' : ''}${number(reading.momentumBps)} ${C.bps}`, style: (reading?.momentumBps ?? 0) >= 0 ? 'positive' : 'negative'},
        {label: C.hurdle, value: reading ? `${number(reading.thresholdBps)} ${C.bps}` : '—'},
        {label: C.pressure, value: reading ? `${reading.imbalance >= 0 ? '+' : ''}${number(reading.imbalance * 100, 1)}%` : '—'},
        {label: C.costs, value: reading ? `${number(reading.roundTripCostBps)} ${C.bps}` : '—'}].map(item => <div key={item.label}><small>{item.label}</small><strong className={item.style}>{item.value}</strong></div>)}
    </div><div className="sp-radar-gauges"><div><span>{C.strength}</span><div><i style={{width: `${Math.min(100, Math.max(0, (reading?.momentumBps ?? 0) / (reading?.thresholdBps || 1) * 100))}%`}}/></div></div><div><span>{C.pressure}</span><div className="pressure"><i style={{width: `${((reading?.imbalance ?? 0) + 1) / 2 * 100}%`}}/></div></div></div><div className="sp-radar-window"><span>{reading?.ready ? C.notForecast : C.warmup}</span><div><i style={{width: `${Math.min(100, (reading?.windowSeconds ?? 0) / 30 * 100)}%`}}/></div><small>{number(reading?.windowSeconds ?? 0, 0)} / 30{C.seconds}</small></div></> : <p className="sp-radar-bar-note">{C.strategyMode} · {C.closedBar}: {bot.signal?.bar ? `${clock(bot.signal.bar * 1000)} UTC` : '—'}. {C.cadenceNote}</p>}
    <div className={`sp-radar-result ${action}`} aria-live="polite"><span>{action === 'buy' ? <ArrowUpRight size={21}/> : action === 'sell' ? <ArrowDownRight size={21}/> : <Activity size={20}/>}</span><div><small>{C.executed}{latest ? ` · ${clock(latest.time)} UTC` : ''}</small><strong>{action === 'buy' ? C.buy : action === 'sell' ? C.sell : C.hold}</strong><p>{latest ? SPIDER.reasons[latest.reason] : C.noCycles}</p></div></div>
    <div className="sp-radar-history"><HistoryChart key={`${bot?.id ?? 'preview'}-price`} cycles={cycles} field="price" title={C.tape} unit={bot?.config.market.quote ?? ''}/><HistoryChart key={`${bot?.id ?? 'preview'}-equity`} cycles={cycles} field="equity" title={C.equity} unit={bot?.config.market.quote ?? ''}/></div>
    {cycles.length > 0 && <div className="sp-radar-strip"><small>{C.recorded}</small><div>{cycles.slice(-36).map(cycle => <span key={cycle.time} className={cycle.action} title={`${clock(cycle.time)} UTC · ${SPIDER.reasons[cycle.reason]}`}><i/></span>)}</div><span>{latest ? clock(latest.time) : ''} UTC</span></div>}
  </section>;
}
