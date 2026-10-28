import {backtest, type BacktestResult, type ResearchPolicy} from './backtest.ts';
import type {ResearchConfig, ResearchData} from './schema.ts';

export const RESEARCH_REVISION = 'spot-closed-bar-walk-forward-v1';
export const CANDIDATES = ['trend', 'reversion', 'breakout'] as const;
type CandidateResult = {policy: ResearchPolicy; eligible: boolean; score: number; result: BacktestResult};
export type ResearchFold = {
  selectionStart: number; selectionEnd: number; testStart: number; testEnd: number;
  selected: ResearchPolicy; riskOverride: boolean; candidates: CandidateResult[];
  test: BacktestResult; buyHold: BacktestResult;
};

export function selectPolicy(results: BacktestResult[], config: ResearchConfig): {selected: ResearchPolicy; candidates: CandidateResult[]} {
  const candidates = results.map(result => ({policy: result.policy, result,
    score: result.returnPercent - config.drawdownPenalty * result.maxDrawdownPercent,
    eligible: result.closedTrades >= config.minimumTrades && result.netPnl > 0 && !result.halted && result.maxDrawdownPercent < config.maxDrawdownPercent}));
  // Cash is the default when no candidate beats its zero-return score after the penalty.
  const winner = candidates.filter(row => row.eligible && row.score > 0).sort((a, b) => b.score - a.score || a.policy.localeCompare(b.policy))[0];
  return {selected: winner?.policy ?? 'cash', candidates};
}

export function walkForward(data: ResearchData, config: ResearchConfig) {
  const firstTest = 160 + config.selectionBars;
  if (firstTest + config.testBars > data.candles.length) throw new Error('Not enough consecutive candles for one selection and test fold.');
  const folds: ResearchFold[] = [];
  let equity = config.initialCash, baselineEquity = config.initialCash, peak = equity, maximumDrawdown = 0, halted = false;
  for (let start = firstTest; start + config.testBars <= data.candles.length; start += config.testBars) {
    const selected = selectPolicy(CANDIDATES.map(policy => backtest(data, config, policy, start - config.selectionBars, start)), config);
    const riskOverride = halted;
    const policy = riskOverride ? 'cash' : selected.selected;
    const test = backtest(data, {...config, initialCash: equity}, policy, start, start + config.testBars, {peakEquity: peak, halted});
    const buyHold = backtest(data, {...config, initialCash: baselineEquity}, 'buy-hold', start, start + config.testBars);
    for (const mark of test.equity) {peak = Math.max(peak, mark.value); maximumDrawdown = Math.max(maximumDrawdown, (peak - mark.value) / peak * 100);}
    peak = Math.max(peak, test.peakEquity); halted ||= test.halted;
    equity = test.finalCash; baselineEquity = buyHold.finalCash;
    folds.push({selectionStart: data.candles[start - config.selectionBars].time, selectionEnd: data.candles[start].time,
      testStart: data.candles[start].time, testEnd: test.end, selected: policy, riskOverride, candidates: selected.candidates, test, buyHold});
  }
  const fills = folds.flatMap(fold => fold.test.fills), closed = fills.filter(fill => fill.side === 'sell');
  const totalNetPnl = equity - config.initialCash;
  return {revision: RESEARCH_REVISION, status: 'research-only' as const, modelUsed: false, liveFundsEnabled: false,
    sourceKind: data.source.kind, totalCandidatesPerFold: CANDIDATES.length, folds,
    summary: {initialCash: config.initialCash, finalCash: equity, netPnl: totalNetPnl, returnPercent: (equity / config.initialCash - 1) * 100,
      maxDrawdownPercent: Math.max(maximumDrawdown, ...folds.map(fold => fold.test.maxDrawdownPercent)),
      closedTrades: closed.length, meanNetPnlPerTrade: closed.length ? totalNetPnl / closed.length : null,
      winRate: closed.length ? closed.filter(fill => fill.netPnl! > 0).length / closed.length * 100 : null,
      fees: folds.reduce((sum, fold) => sum + fold.test.fees, 0),
      cashReturnPercent: 0, buyHoldReturnPercent: (baselineEquity / config.initialCash - 1) * 100,
      untestedTailBars: data.candles.length - firstTest - folds.length * config.testBars},
    limitations: [
      'Historical results do not establish future profitability or a game-theoretic optimum.',
      'Finite rule selection; no model inference, model training, online learning, or live orders.',
      'OHLC fills approximate execution; historical spread, L2 depth, queueing, latency, and partial fills are not reconstructed.',
      'Fees, spread, slippage, volume capacity, and instrument rules are supplied assumptions; verify them for the target account and period.',
      'Both stop and target in one bar resolves to the adverse exit. Intrabar exit timestamps indicate the containing bar end, not actual event time.',
      'Each selection and test window starts flat and liquidates at its end; resulting churn and costs are included.',
      'Candidate selection uses only earlier bars, but rerunning after inspecting test outcomes contaminates an untouched evaluation.',
      'Buy-and-hold uses the same initial allocation per fold, not matched volatility or continuous full-period holding.',
      'Drawdown uses sampled opens, closes, and executions; intrabar peaks and market impact are not fully observed.',
      'Mean net PnL is an observed sample average, not a calibrated forecast of expected value.',
      'Multi-venue data does not establish execution quality or permission to trade on another venue.',
    ]};
}
