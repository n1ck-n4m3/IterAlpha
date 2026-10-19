export type Action = 'buy' | 'wait' | 'hold' | 'halve' | 'sell';
export type Topic = 'trend' | 'range' | 'event';
export type TrainingTrack = 'foundations' | 'advanced';
export interface Candle { time: number; open: number; high: number; low: number; close: number; volume?: number }
export interface Evidence {
  id: string; kind: 'fact' | 'inference' | 'unknown'; title: string; text: string;
  source: string; sourceUrl?: string; publishedAt: string; availableAt: string; provenance: string;
}
export interface MarketSource {
  mode: 'synthetic' | 'historical'; provider: string; venue: string; symbol: string;
  intervalSeconds: number; retrievedAt: string; version: string; license: string; sourceUrl?: string; hash?: string;
}
export interface SceneSummary {
  id: string; title: string; subtitle: string; asset: 'BTC' | 'ETH'; topic: Topic;
  difficulty: string; objective: string; minutes: number; mode: MarketSource['mode'];
}
export interface Scene extends SceneSummary {
  version: string; source: MarketSource; candles: Candle[]; nodes: number[]; end: number;
  context?: Evidence; evidence?: Evidence[]; inference: string; uncertainty: string;
}
export interface DecisionInput { action: Action; riskPercent?: number; amountUsd?: number; stopPrice?: number; reason?: string; thesis?: string; version: number; requestId: string }
export interface Fill { id: string; side: 'buy' | 'sell'; reason: 'entry' | 'reduce' | 'exit' | 'stop' | 'end'; time: number; price: number; quantity: number; fee: number }
export interface Decision {
  id: string; requestId: string; input: DecisionInput; node: number; time: number;
  referencePrice: number; plannedQuantity: number; plannedRisk: number; actualEntryRisk: number; actualSpent?: number;
  equityBefore: number; cashAfter: number; quantityAfter: number; stopPrice: number | null;
  note: string; elapsedMs: number; submittedAt: string;
}
export interface PracticeEvent { type: 'started' | 'decision' | 'completed'; at: string; node: number }
export interface Session {
  id: string; owner: string; sceneId: string; sceneVersion: string; dataVersion: string; rubricVersion: string;
  initialCash?: number;
  track?: TrainingTrack;
  version: number; node: number; cursor: number; status: 'active' | 'completed';
  cash: number; quantity: number; averageEntry: number; stopPrice: number | null;
  decisions: Decision[]; fills: Fill[]; marks: {time: number; equity: number}[]; events: PracticeEvent[];
  createdAt: string; updatedAt: string;
}
export interface ProcessCheck { label: string; status: 'observed' | 'attention' | 'not-tested'; detail: string }
export interface DecisionReview {
  node: number; action: Action; segmentChange: number; alternateAction: Action | null;
  hindsightDifference: number | null; spent: number; received: number; fees: number;
  observation: string; improvement: string;
}
export interface Outcome { netPnl: number; returnPercent: number; fees: number; maxDrawdown: number; checks: ProcessCheck[]; nextFocus: Topic; decisionReviews: DecisionReview[] }
export interface SessionView {
  id: string; version: number; node: number; cursor: number; status: Session['status']; track: TrainingTrack; scene: SceneSummary;
  cutoff: number; intervalSeconds: number; candles: Candle[]; context: Evidence[]; source: MarketSource;
  nodeCount: number; decisionTimes: number[]; endTime: number; account: {initialCash: number; cash: number; quantity: number; equity: number; stopPrice: number | null; averageEntry: number};
  actions: Action[]; decisions: Decision[]; fills: Fill[]; outcome: Outcome | null; createdAt: string; updatedAt: string;
}
export interface CoachReply {
  mode: 'ai' | 'rules'; status: string; takeaway: string; process_observation: string;
  next_drill_reason: string; evidence_ids: string[]; question?: string; createdAt: string; promptVersion: string;
}
export interface HistoryItem { id: string; sceneId: string; title: string; asset: string; topic: Topic; status: Session['status']; decisions: number; netPnl: number; mode: MarketSource['mode']; updatedAt: string; }
export interface ProgressView {
  completed: number; uniqueScenes: number; decisions: number; returns: number; fees: number;
  topics: {topic: Topic; completed: number; total: number}[];
  observations: {title: string; detail: string}[]; recent: HistoryItem[]; nextSceneId: string | null;
}
