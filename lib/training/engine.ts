import type { Candle, DecisionInput, DecisionReview, Fill, Outcome, Scene, Session, SessionView } from './types.ts';

export const RULES = { initialCash: 10_000, feeRate: 0.001, slippageRate: 0.0005, maxOpenRiskPercent: 2, version: 'spot-v2' };
export const initialCashOf = (session: Session) => session.initialCash ?? RULES.initialCash;
export class TrainingError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function allowedActions(session: Session): DecisionInput['action'][] {
  return session.status === 'completed' ? [] : session.quantity > 0 ? ['buy', 'hold', 'halve', 'sell'] : ['buy', 'wait'];
}
export function openRisk(quantity: number, entry: number, stop: number) {
  return Math.max(0, quantity * (entry * (1 + RULES.feeRate) - stop * (1 - RULES.slippageRate) * (1 - RULES.feeRate)));
}
export function estimateOrder(cash: number, price: number, stop: number, riskPercent: number, equity = cash, existingRisk = 0, amountUsd?: number) {
  const entry = price * (1 + RULES.slippageRate);
  const stopExit = stop * (1 - RULES.slippageRate) * (1 - RULES.feeRate);
  const unitRisk = entry * (1 + RULES.feeRate) - stopExit;
  if (!(unitRisk > 0 && stop > 0 && stop < price)) return { quantity: 0, risk: 0, cost: 0, budget: 0, withinLimit: false };
  const headroom = Math.max(0, equity * RULES.maxOpenRiskPercent / 100 - existingRisk);
  const budget = amountUsd === undefined ? Math.min(equity * riskPercent / 100, headroom) : headroom;
  const costPerUnit = entry * (1 + RULES.feeRate);
  const targetCost = amountUsd === undefined ? cash : Math.min(cash, amountUsd);
  const desiredQuantity = amountUsd === undefined ? Math.min(budget / unitRisk, targetCost / costPerUnit) : targetCost / costPerUnit;
  const quantity = Math.floor(Math.max(0, desiredQuantity) * 1e8) / 1e8;
  const risk = quantity * unitRisk;
  return { quantity, risk, cost: quantity * costPerUnit, budget, withinLimit: quantity > 0 && (amountUsd !== undefined || risk <= headroom + 0.01) };
}
export function createSession(scene: Scene, owner: string, id: string, now: string, initialCash = RULES.initialCash, track: Session['track'] = 'foundations'): Session {
  return { id, owner, sceneId: scene.id, sceneVersion: scene.version, dataVersion: scene.source.version, rubricVersion: RULES.version,
    initialCash, track, version: 0, node: 0, cursor: scene.nodes[0], status: 'active', cash: initialCash, quantity: 0,
    averageEntry: 0, stopPrice: null, decisions: [], fills: [], marks: [{time: scene.candles[scene.nodes[0]].time, equity: initialCash}],
    events: [{type: 'started', at: now, node: 0}], createdAt: now, updatedAt: now };
}
function sell(session: Session, quantity: number, basePrice: number, time: number, reason: Fill['reason']) {
  const price = basePrice * (1 - RULES.slippageRate);
  const fee = quantity * price * RULES.feeRate;
  session.cash += quantity * price - fee;
  session.quantity = Math.max(0, session.quantity - quantity);
  session.fills.push({ id: `${session.id}-f${session.fills.length}`, side: 'sell', reason, price, quantity, fee, time });
  if (session.quantity < 1e-10) { session.quantity = 0; session.averageEntry = 0; session.stopPrice = null; }
}
export function advanceSession(original: Session, scene: Scene, input: DecisionInput, now: string): Session {
  const duplicate = original.decisions.find(d => d.requestId === input.requestId);
  if (duplicate) {
    if (JSON.stringify(duplicate.input) !== JSON.stringify(input)) throw new TrainingError('This request ID was already used for a different decision.', 409);
    return original;
  }
  if (original.sceneVersion !== scene.version || original.dataVersion !== scene.source.version) throw new TrainingError('This scene has changed. Start a new session.', 409);
  if (input.version !== original.version) throw new TrainingError('Your session changed in another tab. Refresh to continue.', 409);
  if (!allowedActions(original).includes(input.action)) throw new TrainingError('This action is not available for the current position.');
  if (original.track === 'advanced' && (!input.reason || !input.thesis || input.thesis.trim().length < 10)) throw new TrainingError('Advanced practice requires a decision reason and a journal note of at least 10 characters.');
  const price = scene.candles[original.cursor].close;
  const stop = input.stopPrice ?? 0;
  const risk = input.riskPercent ?? 0;
  const amount = input.amountUsd;
  const hasRisk = input.riskPercent !== undefined;
  const hasAmount = amount !== undefined;
  if (input.action === 'buy' && (hasRisk === hasAmount || !Number.isFinite(stop) || stop <= 0 || stop >= price * 0.999 || (original.quantity === 0 && stop < price * 0.8) || (original.quantity > 0 && Math.abs(stop - original.stopPrice!) > 0.01) || (hasRisk && (!Number.isFinite(risk) || risk < 0.25 || risk > 2)) || (hasAmount && (!Number.isFinite(amount) || amount! < 10 || amount! > original.cash + 0.01)))) {
    throw new TrainingError('Choose one sizing method, a valid stop, and an order of at least $10 within available cash. An existing stop cannot be moved.');
  }
  const session = structuredClone(original);
  const equityBefore = session.cash + session.quantity * price;
  const previousRisk = session.stopPrice === null ? 0 : openRisk(session.quantity, session.averageEntry, session.stopPrice);
  const estimate = input.action === 'buy' ? estimateOrder(session.cash, price, stop, risk, equityBefore, previousRisk, amount) : {quantity: 0, risk: 0, cost: 0, budget: 0, withinLimit: true};
  if (input.action === 'buy' && !estimate.withinLimit) throw new TrainingError('This order exceeds available cash or the selected risk budget. Reduce the order size.');
  const target = scene.nodes[session.node + 1] ?? scene.end;
  let actualEntryRisk = 0;
  let actualSpent = 0;
  let note = input.action === 'wait' ? 'Stayed in cash for this interval.' : input.action === 'hold' ? 'Kept the existing position and stop.' : '';
  for (let index = session.cursor + 1; index <= target; index++) {
    const candle = scene.candles[index];
    const first = index === session.cursor + 1;
    // A pre-existing protective stop takes precedence at a gap through its price.
    if (session.quantity && session.stopPrice !== null && candle.open <= session.stopPrice) sell(session, session.quantity, candle.open, candle.time, 'stop');
    if (first && input.action === 'buy') {
      if (candle.open <= stop) {
        note = 'Entry cancelled: the next open was at or below the chosen stop.';
      } else {
        const fillPrice = candle.open * (1 + RULES.slippageRate);
        const spendingLimit = amount === undefined ? session.cash : Math.min(session.cash, amount);
        const affordable = Math.floor(spendingLimit / (fillPrice * (1 + RULES.feeRate)) * 1e8) / 1e8;
        const quantity = Math.min(estimate.quantity, affordable);
        const fee = quantity * fillPrice * RULES.feeRate;
        if (quantity > 0) {
          session.cash = Math.max(0, session.cash - quantity * fillPrice - fee);
          const previousQuantity = session.quantity;
          session.quantity += quantity;
          session.averageEntry = (previousQuantity * session.averageEntry + quantity * fillPrice) / session.quantity;
          session.stopPrice = stop;
          session.fills.push({id: `${session.id}-f${session.fills.length}`, side: 'buy', reason: 'entry', time: candle.time, price: fillPrice, quantity, fee});
          actualSpent = quantity * fillPrice + fee;
          actualEntryRisk = quantity * (fillPrice * (1 + RULES.feeRate) - stop * (1 - RULES.slippageRate) * (1 - RULES.feeRate));
          note = previousQuantity > 0 ? 'Added to the position at the next open; the original stop stayed fixed.' : 'Quantity was committed before the next open; fees and slippage are included.';
        } else note = 'Entry cancelled: available cash cannot fund the order.';
      }
    }
    if (first && session.quantity > 0 && (input.action === 'halve' || input.action === 'sell')) {
      sell(session, input.action === 'halve' ? session.quantity / 2 : session.quantity, candle.open, candle.time, input.action === 'halve' ? 'reduce' : 'exit');
      note = input.action === 'halve' ? 'Reduced the position by half at the next open.' : 'Closed the position at the next open.';
    }
    if (session.quantity && session.stopPrice !== null && candle.low <= session.stopPrice) sell(session, session.quantity, Math.min(candle.open, session.stopPrice), candle.time, 'stop');
    session.marks.push({time: candle.time + scene.source.intervalSeconds, equity: session.cash + session.quantity * candle.close});
  }
  session.decisions.push({id: `${session.id}-d${session.node}`, requestId: input.requestId, input, node: session.node,
    time: scene.candles[original.cursor].time + scene.source.intervalSeconds, referencePrice: price,
    plannedQuantity: estimate.quantity, plannedRisk: estimate.risk, actualEntryRisk, actualSpent, equityBefore,
    cashAfter: session.cash, quantityAfter: session.quantity, stopPrice: input.action === 'buy' ? stop : original.stopPrice,
    note, elapsedMs: Math.max(0, Date.parse(now) - Date.parse(original.updatedAt)), submittedAt: now});
  session.events.push({type: 'decision', at: now, node: session.node});
  session.cursor = target; session.node++; session.version++; session.updatedAt = now;
  if (session.node === scene.nodes.length) {
    session.status = 'completed';
    const last = scene.candles[target];
    if (session.quantity > 0) sell(session, session.quantity, last.close, last.time + scene.source.intervalSeconds, 'end');
    session.marks.push({time: last.time + scene.source.intervalSeconds, equity: session.cash});
    session.events.push({type: 'completed', at: now, node: session.node});
  }
  return session;
}
export function evaluate(session: Session, scene: Scene): Outcome {
  const initialCash = initialCashOf(session);
  const netPnl = session.cash + session.quantity * scene.candles[session.cursor].close - initialCash;
  const entries = session.decisions.filter(d => d.input.action === 'buy');
  const filled = entries.filter(d => d.actualEntryRisk > 0);
  const exceeded = filled.filter(d => d.input.riskPercent !== undefined && d.actualEntryRisk > d.equityBefore * d.input.riskPercent / 100 + 0.01);
  const decisionReviews: DecisionReview[] = [];
  let replay = createSession(scene, session.owner, session.id, session.createdAt, initialCash);
  for (const decision of session.decisions) {
    const before = replay;
    const fillCount = before.fills.length;
    const actual = advanceSession(before, scene, decision.input, decision.submittedAt);
    const nextPrice = scene.candles[actual.cursor].close;
    const actualEquity = actual.cash + actual.quantity * nextPrice;
    const alternateAction = decision.input.action === 'buy' ? (before.quantity ? 'hold' : 'wait') : decision.input.action === 'sell' || decision.input.action === 'halve' ? 'hold' : null;
    let hindsightDifference: number | null = null;
    if (alternateAction) {
      const alternate = advanceSession(before, scene, {action:alternateAction,version:before.version,requestId:`${decision.requestId}-comparison`}, decision.submittedAt);
      hindsightDifference = actualEquity - alternate.cash - alternate.quantity * nextPrice;
    }
    const fills = actual.fills.slice(fillCount);
    const spent = fills.filter(f => f.side === 'buy').reduce((sum,f) => sum + f.quantity * f.price + f.fee,0);
    const received = fills.filter(f => f.side === 'sell').reduce((sum,f) => sum + f.quantity * f.price - f.fee,0);
    const fees = fills.reduce((sum,f) => sum + f.fee,0);
    const gapExceeded = decision.input.action === 'buy' && decision.input.riskPercent !== undefined && decision.actualEntryRisk > decision.equityBefore * decision.input.riskPercent / 100 + 0.01;
    const baseObservation = gapExceeded ? 'The next-open fill increased stop-distance risk beyond the planned budget.' :
      decision.input.action === 'buy' && !spent ? 'The order did not fill, so this step did not create a new position.' :
      decision.input.action === 'buy' ? `The order spent $${spent.toFixed(2)} including fees. The recorded stop stayed in place.` :
      decision.input.action === 'wait' ? 'You stayed in cash for this interval.' :
      decision.input.action === 'hold' ? 'You kept the existing position and its stop.' :
      decision.input.action === 'halve' ? 'You reduced exposure by half at the next open.' : 'You closed the position at the next open.';
    const comparison = alternateAction && hindsightDifference !== null && Math.abs(hindsightDifference) >= 0.01 ?
      ` On this revealed path, the result was $${Math.abs(hindsightDifference).toFixed(2)} ${hindsightDifference > 0 ? 'higher' : 'lower'} than ${alternateAction}. That does not, by itself, make the decision good or bad.` : '';
    const observation = baseObservation + comparison;
    const improvement = gapExceeded ? 'Before the next entry, leave room for price gaps or choose a smaller size.' :
      decision.input.action === 'buy' && hindsightDifference !== null && hindsightDifference < -0.01 ? 'Before adding exposure again, write the specific confirmation available at the cutoff and compare it with the extra cost and risk.' :
      decision.input.action === 'buy' ? 'Compare the planned spend and stop loss with the fill, then explain why this entry was justified at the cutoff.' :
      decision.input.action === 'wait' || decision.input.action === 'hold' ? 'Name the information that would change this decision before seeing the next candles.' :
      hindsightDifference !== null && hindsightDifference < -0.01 ? 'Write down what new evidence justified reducing exposure before the next candles appeared; compare that reason with simply keeping the original stop.' :
      'Compare this exit with keeping the original stop; explain what new evidence changed your plan.';
    decisionReviews.push({node:decision.node,action:decision.input.action,segmentChange:actualEquity-decision.equityBefore,alternateAction,hindsightDifference,spent,received,fees,observation,improvement});
    replay = actual;
  }
  let peak = initialCash; let maxDrawdown = 0;
  for (const mark of session.marks) { peak = Math.max(peak, mark.equity); maxDrawdown = Math.max(maxDrawdown, (peak - mark.equity) / peak * 100); }
  return { netPnl, returnPercent: netPnl / initialCash * 100, fees: session.fills.reduce((sum, f) => sum + f.fee, 0), maxDrawdown,
    checks: [
      {label: 'Defined the risk', status: entries.length ? 'observed' : 'not-tested', detail: entries.length ? `A stop and order size were recorded before each of your ${entries.length} buy decisions.` : 'You stayed in cash. Position sizing was not tested in this round.'},
      {label: 'Execution versus plan', status: exceeded.length ? 'attention' : filled.length ? 'observed' : 'not-tested', detail: exceeded.length ? `${exceeded.length} entry filled with risk above the chosen risk target because of the next-open price. A stop is not a guaranteed loss limit.` : filled.length ? 'Filled buy orders recorded their actual price, spend and stop-distance risk. Later gaps can still exceed the plan.' : 'There was no filled buy order to compare with a plan.'},
      {label: 'Protected the position', status: session.fills.some(f => f.reason === 'stop') ? 'observed' : filled.length ? 'observed' : 'not-tested', detail: filled.length ? `${session.fills.filter(f => f.reason === 'stop').length} protective stop execution(s). Stops remained fixed; this does not measure discretionary discipline.` : 'No position was opened; protective exits were not tested.'}
    ], nextFocus: exceeded.length ? 'range' : scene.topic, decisionReviews };
}
export function aggregateCandles(candles: Candle[], seconds: number, cutoff: number): Candle[] {
  const buckets = new Map<number, Candle[]>();
  for (const candle of candles) { const start = Math.floor(candle.time / seconds) * seconds; const group = buckets.get(start) ?? []; group.push(candle); buckets.set(start, group); }
  return [...buckets].filter(([time, group]) => time + seconds <= cutoff && group.length === seconds / 900 && group[0].time === time).map(([time, group]) => ({time, open: group[0].open, high: Math.max(...group.map(c => c.high)), low: Math.min(...group.map(c => c.low)), close: group[group.length - 1].close, ...(group.every(c => c.volume !== undefined) ? {volume: group.reduce((s,c) => s + c.volume!, 0)} : {})}));
}
export function sessionView(session: Session, scene: Scene, context: SessionView['context']): SessionView {
  const {id, title, subtitle, asset, topic, difficulty, objective, minutes, mode} = scene;
  const cutoff = scene.candles[session.cursor].time + scene.source.intervalSeconds;
  return {id: session.id, version: session.version, node: session.node, cursor: session.cursor, status: session.status, track: session.track ?? 'foundations',
    scene: {id, title, subtitle, asset, topic, difficulty, objective, minutes, mode},
    cutoff, intervalSeconds: scene.source.intervalSeconds, candles: scene.candles.slice(0, session.cursor + 1),
    context: context.filter(e => Date.parse(e.availableAt) <= cutoff * 1000), source: scene.source,
    nodeCount: scene.nodes.length, decisionTimes: scene.nodes.map(n => scene.candles[n].time + scene.source.intervalSeconds),
    endTime: scene.candles[scene.end].time + scene.source.intervalSeconds,
    account: {initialCash: initialCashOf(session), cash: session.cash, quantity: session.quantity, equity: session.cash + session.quantity * scene.candles[session.cursor].close, stopPrice: session.stopPrice, averageEntry: session.averageEntry},
    actions: allowedActions(session), decisions: session.decisions, fills: session.fills,
    outcome: session.status === 'completed' ? evaluate(session, scene) : null, createdAt: session.createdAt, updatedAt: session.updatedAt};
}
