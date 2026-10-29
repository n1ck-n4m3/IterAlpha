'use client';
import {useState} from 'react';
import {FileSearch} from 'lucide-react';
import type {BotView} from '../lib/spider/types';
import {SPIDER as C} from '../lib/spider/copy';
const number = (value: number, digits = 2) => new Intl.NumberFormat('en-US', {maximumFractionDigits: digits}).format(value);
export default function SpiderEvidence({bot, initialTime, defaultOpen = false}: {bot: BotView | null; initialTime?: number; defaultOpen?: boolean}) {
  const [selected, setSelected] = useState(initialTime ? String(initialTime) : 'latest');
  const cycles = bot?.cycles ?? [], latest = cycles.at(-1), cycle = selected === 'latest' ? latest : cycles.find(item => item.time === Number(selected)) ?? latest, evidence = cycle?.evidence;
  return <details open={defaultOpen} className="sp-evidence" key={bot?.id ?? 'preview'}><summary><FileSearch size={16}/><span>{C.evidence.title}<small>{C.evidence.subtitle}</small></span></summary><div className="sp-evidence-body">
    <label>{C.evidence.check}<select aria-label={C.evidence.check} value={selected} onChange={event => setSelected(event.target.value)}><option value="latest">{C.evidence.latest}</option>{[...cycles].reverse().slice(0, 180).map(item => <option key={item.time} value={item.time}>{new Date(item.time).toISOString().slice(11, 19)} UTC · {item.action.toUpperCase()}</option>)}</select></label>
    {evidence && cycle ? <><div className="sp-evidence-grid">{[
      [C.evidence.engine, C.ruleEngine], [C.evidence.model, C.modelPending], [C.evidence.proposal, evidence.proposedAction?.toUpperCase() ?? C.evidence.notEvaluated],
      [C.evidence.actual, cycle.action.toUpperCase()], [C.evidence.bidAsk, `${number(evidence.bid, 8)} / ${number(evidence.ask, 8)}`],
      [C.evidence.age, `${evidence.quoteAgeMs} ms`], [C.spread, `${number(evidence.spreadBps, 3)} bps`], [C.evidence.costs, `${number(evidence.feeBps)} / ${number(evidence.slippageBps)} bps`],
      [C.evidence.cash, `${number(evidence.cashBefore, 8)} ${bot?.config.market.quote}`], [C.evidence.position, `${number(evidence.quantityBefore, 8)} ${bot?.config.market.base}`],
    ].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><ol>{evidence.checks.map((check, index) => <li key={`${check.stage}-${index}`} className={check.status}><span>{C.stages[check.stage]}</span><strong>{C.traceStatus[check.status]}</strong>{check.reason && <p>{C.reasons[check.reason]}</p>}</li>)}</ol><p>{C.evidence.source}: {evidence.source} · {evidence.feed} · {new Date(evidence.quoteTime).toISOString()}</p><p>{C.evidence.note}</p></> : <p>{C.evidence.empty}</p>}
  </div></details>;
}
