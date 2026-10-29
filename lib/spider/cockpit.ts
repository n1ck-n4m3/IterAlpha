import type {BotView, Cycle, Reason, Trace} from './types.ts';
export const PIPELINE = ['market', 'signal', 'risk', 'execution'] as const;
export type CockpitMode = 'preview' | 'paused' | 'live' | 'offline' | 'replay';
export function cockpitMode(bot: BotView | null, fresh: boolean, replay: Cycle | null): CockpitMode {
  if (replay) return 'replay';
  if (!fresh) return 'offline';
  if (!bot) return 'preview';
  return bot.status === 'running' ? 'live' : 'paused';
}
export function cycleChecks(bot: BotView | null, replay: Cycle | null): Trace[] {
  return replay ? replay.evidence?.checks ?? [] : bot?.trace ?? [];
}
export function executionResult(cycle: Cycle | null): 'buy' | 'sell' | 'hold' | 'empty' {
  return cycle?.action ?? 'empty';
}
export function normalizedSeries(values: number[], width = 240, height = 46): string {
  if (values.length < 2 || values.some(value => !Number.isFinite(value))) return '';
  const min = Math.min(...values), max = Math.max(...values), range = Math.max(max - min, Math.abs(max) * .00001, .000001);
  return values.map((value, index) => `${index ? 'L' : 'M'}${(index / (values.length - 1) * width).toFixed(2)},${(height - 5 - (value - min) / range * (height - 10)).toFixed(2)}`).join(' ');
}
export const COCKPIT = {
  invalidExits: 'Stop distance must be 0.2–10% and target distance 0.4–20%.', title: 'SPIDER', subtitle: 'AUTONOMOUS PAPER TERMINAL', session: 'SESSION', virtual: 'VIRTUAL FUNDS', rules: 'RULE ENGINE', model: 'MODEL OFFLINE',
  market: 'Market', chart: 'MARKET VIEW', arena: 'SPIDER ACTIVITY', depth: 'LIQUIDITY', position: 'POSITION', tape: 'DECISION TAPE', timeline: 'CHECK REPLAY',
  stage: {market: 'OBSERVE', signal: 'DECIDE', risk: 'GUARD', execution: 'EXECUTE'},
  stageHint: {market: 'Fresh quotes and order-book depth', signal: 'Evaluate the selected strategy', risk: 'Check costs, exposure, and limits', execution: 'Paper fill or wait'},
  mode: {preview: 'OBSERVING', paused: 'STANDBY', live: 'SPIDER ACTIVE', offline: 'NO FRESH FEED', replay: 'RECORDED CHECK'},
  action: {buy: 'PAPER BUY', sell: 'PAPER SELL', hold: 'WAIT / HOLD', empty: 'AWAITING FIRST CHECK'},
  status: {passed: 'CLEAR', waiting: 'WAIT', blocked: 'BLOCKED', filled: 'FILLED'},
  activeRead: 'READING FEED', activeDecision: 'CHECKING STRATEGY', recorded: 'LAST CHECK', noRecord: 'No check recorded', cadence: 'EVAL', warmup: 'OBSERVATION WINDOW',
  checks: 'CHECKS', fills: 'FILLS', next: 'NEXT CHECK', equity: 'EQUITY', pnl: 'NET P&L', drawdown: 'DRAWDOWN', winRate: 'WIN RATE',
  pressure: 'BOOK PRESSURE', move: '30s MOVE', hurdle: 'ENTRY HURDLE', cost: 'COST FLOOR', quoteAge: 'SNAPSHOT AGE',
  chartTime: 'Chart', signalTime: 'Signal', seconds: 's', bps: 'bp', cooldown: 'Fill cooldown', fee: 'Fee', slippage: 'Slippage',
  setup: 'Configure spider', strategy: 'STRATEGY', balance: 'Virtual balance', allocation: 'Entry allocation', stop: 'Stop distance', target: 'Profit target',
  deploy: 'DEPLOY SPIDER', resume: 'RESUME SPIDER', pause: 'PAUSE SPIDER', close: 'CLOSE & PAUSE', pending: 'CONFIRMING…', new: 'NEW SPIDER',
  settings: 'Controls', accounts: 'Accounts', evidence: 'Evidence', connections: 'Connections', info: 'About this session',
  audio: 'Sound settings', motion: 'Toggle visual motion', motionOn: 'Motion on', motionOff: 'Motion off', inspect: 'Inspect check',
  live: 'LIVE', replay: 'REPLAY', playReplay: 'Play recorded checks', pauseReplay: 'Pause replay', returnLive: 'Return to live monitoring', seek: 'Recorded check position',
  replayNote: 'Replays saved checks. The market chart and live depth remain live; historical order books are not reconstructed.',
  observed: 'OBSERVED MARKET PRICE', accountValue: 'PAPER ACCOUNT VALUE', noHistory: 'Your check history appears here',
  noFills: 'No paper fills yet', noDepth: 'Waiting for exchange depth', noCycles: 'Deploy to begin recording decisions', noAccount: 'Choose a strategy. Deploy with virtual funds.',
  safe: 'Spot · long only', unverified: 'BROWSER FEED · UNVERIFIED', serverFeed: 'SERVER FEED', pausedExposure: 'POSITION OPEN · EXITS PAUSED',
  flat: 'FLAT', cash: 'Cash', invested: 'Spot value', entry: 'ENTRY', stopPrice: 'STOP', targetPrice: 'TARGET', mark: 'BID',
  bid: 'BID', ask: 'ASK', buySide: 'BUY DEPTH', sellSide: 'SELL DEPTH', spread: 'SPREAD',
  emptyWin: 'No completed trades', sample: 'closed trades', launchHint: '5-second evaluation · orders only when rules pass',
  closePanel: 'Close panel', search: 'Search active spot pairs', all: 'All venues', pair: 'PAIR', source: 'SOURCE',
  latest: 'Latest', export: 'Export', exportFills: 'Export fills', exportChecks: 'Export checks', advanced: 'Execution settings', strategyDetail: 'Strategy details',
  strategyNames: {tape: 'Tape pulse', trend: 'Trend rider', reversion: 'Range scout', breakout: 'Breakout hunter'},
  strategyTags: {tape: 'FAST MOMENTUM', trend: 'FOLLOW TREND', reversion: 'MEAN REVERSION', breakout: 'VOLUME BREAKOUT'},
  ledger: 'Paper ledger', details: 'FULL EVIDENCE', refresh: 'Reconnect', locked: 'Pause before creating another spider',
  about: 'Real exchange quotes. Virtual orders. Recorded decisions.',
  aboutDetail: 'This terminal runs the selected rule strategy with virtual funds. No AI model or authenticated exchange account is connected. Animation replays recorded checks; it does not represent a model thinking or an unconfirmed trade.',
  semantics: 'Short labels show saved checks. A rule proposal is separate from a paper fill. Hover a result or open Evidence for its full explanation.',
  liveLimit: 'Browser-driven execution pauses when this workspace is hidden or closed. A paused open position has no automatic exits.',
  costLimit: 'Paper fills include configured fees and adverse slippage. Visible depth is checked; queue position and exchange latency are not simulated.',
  rights: 'Coinbase is awaiting configured data permissions. Browser-supplied quotes are unverified and excluded from rankings.',
  stale: 'Feed interrupted. No orders from stale prices.',
  reasons: {
    'tape-entry': 'Momentum + bid pressure', 'tape-exit': 'Momentum reversed', 'tape-warming': 'Building the observation window', 'tape-waiting': 'Waiting for confirmation',
    'cost-gate': 'Move below trading costs', cooldown: 'Fill cooldown active', 'bar-wait': 'Waiting for a closed candle', 'cadence-wait': 'Next evaluation pending',
    'trend-entry': 'Trend confirmed', 'trend-exit': 'Trend lost', 'reversion-entry': 'Recovery confirmed', 'reversion-exit': 'Recovery target reached',
    'breakout-entry': 'Breakout + volume', 'breakout-exit': 'Breakout failed', waiting: 'No qualifying setup', warming: 'Collecting closed candles',
    stop: 'Stop triggered', target: 'Target reached', timeout: 'Time cap reached', drawdown: 'Drawdown guard triggered', 'manual-close': 'Manual close',
    spread: 'Spread too wide', liquidity: 'Insufficient depth', 'small-order': 'Order below market limits', stale: 'Stale snapshot', 'feed-unavailable': 'Feed unavailable',
    gap: 'Monitoring interrupted', paused: 'Execution paused', resumed: 'Execution resumed', started: 'Spider deployed',
  } satisfies Record<Reason, string>,
} as const;
