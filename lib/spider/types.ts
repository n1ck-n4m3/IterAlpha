import type {Candle} from '../training/types.ts';
import type {ExchangeId} from '../exchanges/types.ts';

// Only implemented feeds belong here; roadmap venues must not enter runtime routing.
export type Venue = Extract<ExchangeId, 'binance' | 'coinbase'>;
export type Interval = 60 | 300 | 900;
export type BarStrategy = 'trend' | 'reversion' | 'breakout';
export type Strategy = BarStrategy | 'tape';
export type EvaluationSeconds = 5 | 15 | 30;
export type Market = {
  id: string; venue: Venue; symbol: string; base: string; quote: string;
  quantityStep: number; minQuantity: number; maxQuantity: number; minNotional: number;
};
export type Level = {price: number; quantity: number};
export type Snapshot = {
  market: Market; interval: Interval; candles: Candle[];
  bids: Level[]; asks: Level[]; price: number; bid: number; ask: number;
  quoteTime: number; fetchedAt: number; change24h: number | null;
  mode: 'live'; source: string;
};
export type Reason = 'trend-entry' | 'trend-exit' | 'reversion-entry' | 'reversion-exit' |
  'breakout-entry' | 'breakout-exit' | 'waiting' | 'warming' | 'stop' | 'target' |
  'timeout' | 'drawdown' | 'manual-close' | 'spread' | 'liquidity' | 'small-order' |
  'stale' | 'feed-unavailable' | 'gap' | 'paused' | 'resumed' | 'started' |
  'tape-entry' | 'tape-exit' | 'tape-warming' | 'tape-waiting' | 'cost-gate' | 'cooldown' | 'bar-wait' | 'cadence-wait';
export type Signal = {action: 'buy' | 'sell' | 'hold'; reason: Reason; bar: number; indicators: {fast: number | null; slow: number | null; rsi: number | null; macd: number | null; breakout: number | null}};
export type Config = {feedMode?: 'server' | 'browser'; market: Market; strategy: Strategy; interval: Interval; initialCash: number; allocationPercent: number; stopPercent: number; targetPercent: number;
  evaluationSeconds?: EvaluationSeconds; cooldownSeconds?: number; feeBps?: number; slippageBps?: number};
export type Trade = {id: string; side: 'buy' | 'sell'; time: number; quantity: number; price: number; fee: number; notional: number; reason: Reason; netPnl: number | null};
export type Event = {time: number; reason: Reason; action: 'buy' | 'sell' | 'hold' | 'pause' | 'resume'};
export type Trace = {stage: 'market' | 'signal' | 'risk' | 'execution'; status: 'passed' | 'waiting' | 'blocked' | 'filled'; reason?: Reason};
export type TapePoint = {time: number; quoteTime: number; mid: number};
export type TapeReading = {samples: number; windowSeconds: number; momentumBps: number | null; spreadBps: number; imbalance: number;
  roundTripCostBps: number; thresholdBps: number; ready: boolean};
export type Cycle = {time: number; equity: number; price: number; action: 'buy' | 'sell' | 'hold'; reason: Reason; strategyEvaluated: boolean};
export type Bot = {
  id: string; owner: string; version: number; status: 'running' | 'paused'; config: Config;
  cash: number; quantity: number; entryCost: number; entryPrice: number; entryTime: number;
  stop: number | null; target: number | null; lastBar: number; lastTick: number;
  lastMark: number; peakEquity: number; maxDrawdown: number; fees: number;
  realizedPnl: number; closedTrades: number; wins: number; losses: number;
  trace?: Trace[]; trades: Trade[]; events: Event[]; signal: Signal | null; createdAt: number; updatedAt: number;
  tape?: TapePoint[]; tapeReading?: TapeReading; lastEvaluationAt?: number; cycleCount?: number; evaluationCount?: number; cycles?: Cycle[];
};
export type BotView = Omit<Bot, 'owner'> & {dataIntegrity:'browser-provided'|'server-observed';rankEligible:false};
export type BotStats = {equity: number; netPnl: number; returnPercent: number; unrealizedPnl: number; winRate: number | null; closedTrades: number; realizedPnl: number; fees: number; maxDrawdown: number};
