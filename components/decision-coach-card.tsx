'use client';
import { useState } from 'react';
import { ArrowRight, BrainCircuit, CircleHelp, ShieldAlert, Sparkles } from 'lucide-react';
import type { CoachReply, SessionView } from '../lib/training/types';
import { COPY } from '../lib/ui-copy';
import { LEARNING_COPY as C } from '../lib/learning-copy';
import {DECISION_COPY} from '../lib/decision-copy';
import { decisionCoachMetrics } from '../lib/training/coach-metrics';

const money = (value: number) => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 2}).format(value);

export default function DecisionCoachCard({session, reply}: {session: SessionView; reply: CoachReply | null}) {
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null);
  const decision = session.decisions.at(-1);
  if (!decision) return null;
  const action = decision.input.action;
  const category = action === 'buy' ? 'buy' : action === 'sell' || action === 'halve' ? 'sell' : action === 'hold' ? 'hold' : 'wait';
  const questions = C.coach.followUps[category];
  const metrics = decisionCoachMetrics(session);
  const latest = session.candles.at(-1)?.close;
  const observedMove = latest && decision.referencePrice > 0 ? (latest / decision.referencePrice - 1) * 100 : null;
  return <section className="decision-coach-card" aria-label={C.coach.aria}>
    <div className="decision-coach-top"><span className="decision-coach-emblem"><BrainCircuit size={21}/></span><div><small>{C.coach.eyebrow} · {reply?.mode === 'ai' ? C.coach.ai : C.coach.previewEyebrow}</small><h2>{C.coach.title}</h2></div><span className="decision-coach-mode">{reply?.mode === 'ai' ? C.coach.ai : C.coach.preview}</span></div>
    <p className="decision-coach-disclosure">{reply?.mode === 'ai' ? C.coach.aiNote : C.coach.previewNote}</p>
    <div className="decision-coach-metrics">
      <div><span>{C.coach.action}</span><strong>{COPY.actions[action]}</strong></div>
      {action === 'buy' && <div><span>{C.coach.spent}</span><strong>{money(decision.actualSpent ?? 0)}</strong></div>}
      {(action === 'sell' || action === 'halve') && <div><span>{C.coach.received}</span><strong>{money(metrics.saleProceeds)}</strong></div>}
      <div><span>{C.coach.exposure}</span><strong>{Math.max(0, metrics.exposurePercent).toFixed(1)}%</strong></div>
      <div><span>{C.coach.risk}</span><strong>{!session.account.quantity ? C.coach.noPosition : metrics.stopDownside===null ? C.coach.noStop : `${money(metrics.stopDownside)} · ${metrics.stopDownsidePercent.toFixed(2)}%`}</strong></div>
      {action==='buy'&&metrics.entryRisk>0&&<div><span>{C.coach.entryRisk}</span><strong>{money(metrics.entryRisk)}</strong></div>}
    </div>
    <div className="decision-coach-analysis"><div><span><Sparkles size={14}/>{C.coach.process}</span><p>{reply?.process_observation ?? C.coach.analyzing}</p></div><div><span><ArrowRight size={14}/>{C.coach.next}</span><p>{reply?.takeaway ?? decision.note}</p></div></div>
    {reply?.decisionAssessment?.status==='ready'&&<details className="coach-details"><summary>{DECISION_COPY.title}</summary><p>{DECISION_COPY.supportLabel}: {DECISION_COPY.support[reply.decisionAssessment.support]}</p><p>{DECISION_COPY.focusLabel}: {DECISION_COPY.focus[reply.decisionAssessment.focus]}</p><p>{DECISION_COPY.note}</p><small>{reply.decisionAssessment.model} · {reply.decisionAssessment.quantization} · {reply.decisionAssessment.latencyMs} ms</small></details>}
    <p className="decision-coach-risk"><ShieldAlert size={14}/>{C.coach.riskCaveat}</p>
    {observedMove !== null && <div className="decision-coach-outcome"><span>{C.coach.outcome}</span><strong className={observedMove >= 0 ? 'positive' : 'negative'}>{observedMove >= 0 ? '+' : ''}{observedMove.toFixed(2)}%</strong><small>{C.coach.outcomeNote}</small></div>}
    <div className="decision-coach-followups"><strong><CircleHelp size={15}/>{C.coach.questions}</strong><div>{questions.map((item, index) => <button type="button" key={item.question} className={selectedQuestion === index ? 'active' : ''} onClick={() => setSelectedQuestion(selectedQuestion === index ? null : index)}>{item.question}<ArrowRight size={13}/></button>)}</div>{selectedQuestion !== null && <p className="decision-coach-answer"><span>{C.coach.answer}</span>{questions[selectedQuestion].answer}</p>}</div>
  </section>;
}
