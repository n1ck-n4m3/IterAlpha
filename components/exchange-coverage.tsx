import {ArrowUpRight, ChevronDown, Layers3} from 'lucide-react';
import {EXCHANGES} from '../lib/exchanges/registry';
import {EXCHANGE_COPY as C} from '../lib/exchanges/copy';

export default function ExchangeCoverage() {
  return <details className="sp-exchanges">
    <summary><Layers3 size={16}/><span><strong>{C.title}</strong><small>{C.summary}</small></span><ChevronDown size={15}/></summary>
    <div className="sp-exchange-body"><p>{C.description}</p><div className="sp-exchange-grid">{EXCHANGES.map(exchange =>
      <article key={exchange.id} className={exchange.priority === 1 ? 'first' : ''}>
        <div><h3>{exchange.name}</h3><span className={`sp-exchange-tag ${exchange.paperFeed}`}>{C.statuses[exchange.paperFeed]}</span></div>
        {exchange.priority === 1 && <small>{C.priority}</small>}<p>{exchange.note}</p>
        <a href={exchange.documentation} target="_blank" rel="noreferrer">{C.docs}<ArrowUpRight size={12}/></a>
      </article>)}</div><div className="sp-exchange-research"><div><strong>{C.research}</strong><p>{C.researchNote}</p></div><a href="https://github.com/n1ck-n4m3/IterAlpha/blob/main/docs/CRYPTO-GTO-RESEARCH.md" target="_blank" rel="noreferrer">GitHub<ArrowUpRight size={13}/></a></div><p>{C.execution}</p></div>
  </details>;
}
