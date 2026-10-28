import {z} from 'zod';

const decimal = z.number().finite().positive();
export const researchDataSchema = z.object({
  version: z.literal('iteralpha-research-data-v1'),
  venue: z.enum(['coinbase', 'binance', 'binance-us', 'okx', 'robinhood', 'kraken', 'bybit']),
  symbol: z.string().min(2).max(80), base: z.string().min(1).max(30), quote: z.string().min(1).max(30),
  interval: z.union([z.literal(60), z.literal(300), z.literal(900)]),
  source: z.object({url: z.string().url(), retrievedAt: z.string().datetime(),
    usage: z.literal('personal-research'), rightsConfirmed: z.literal(true),
    kind: z.enum(['exchange-history', 'synthetic-test'])}).strict(),
  // Rule provenance must disclose whether these were actually in force historically.
  rules: z.object({quantityStep: decimal, minQuantity: decimal, maxQuantity: decimal,
    minNotional: z.number().finite().nonnegative(), provenance: z.string().min(10).max(500)}).strict(),
  candles: z.array(z.object({time: z.number().int().positive(), open: decimal, high: decimal, low: decimal, close: decimal,
    volume: z.number().finite().nonnegative()}).strict()).min(200).max(100_000),
}).strict().superRefine((data, context) => {
  if (data.rules.maxQuantity < data.rules.minQuantity) context.addIssue({code: 'custom', message: 'Invalid quantity limits.'});
  for (let i = 0; i < data.candles.length; i++) {
    const c = data.candles[i];
    if (c.time % data.interval !== 0 || (i > 0 && c.time !== data.candles[i - 1].time + data.interval) ||
      c.low > Math.min(c.open, c.close) || c.high < Math.max(c.open, c.close)) {
      context.addIssue({code: 'custom', path: ['candles', i], message: 'Candles must have valid geometry and consecutive aligned timestamps.'});
      break;
    }
    if ((c.time + data.interval) * 1000 > Date.now()) {
      context.addIssue({code: 'custom', path: ['candles', i], message: 'Historical research accepts completed candles only.'}); break;
    }
  }
});
export type ResearchData = z.infer<typeof researchDataSchema>;

export const researchConfigSchema = z.object({
  version: z.literal('iteralpha-research-config-v1'),
  initialCash: decimal.max(1e9), allocationPercent: decimal.max(50),
  feeBps: z.number().finite().min(0).max(1000),
  spreadBps: z.number().finite().min(0).max(1000),
  slippageBps: z.number().finite().min(0).max(1000),
  stopPercent: decimal.max(20), targetPercent: decimal.max(50),
  maxDrawdownPercent: decimal.max(50), maxHoldBars: z.number().int().min(1).max(10_000),
  maxPriorVolumePercent: decimal.max(5),
  selectionBars: z.number().int().min(200).max(50_000), testBars: z.number().int().min(40).max(10_000),
  minimumTrades: z.number().int().min(1).max(1000), drawdownPenalty: z.number().finite().min(0).max(10),
}).strict();
export type ResearchConfig = z.infer<typeof researchConfigSchema>;
