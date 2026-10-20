import type { Candle } from '../training/types.ts';

export const marketAssets = ['BTC', 'ETH', 'SOL', 'XRP'] as const;
export type MarketAsset = typeof marketAssets[number];

const profiles: Record<MarketAsset, { base: number; seed: number; volume: number }> = {
  BTC: { base: 62000, seed: 2, volume: 380 },
  ETH: { base: 3100, seed: 7, volume: 5800 },
  SOL: { base: 160, seed: 13, volume: 19000 },
  XRP: { base: 0.65, seed: 19, volume: 2500000 },
};

function closeAt(asset: MarketAsset, bucket: number): number {
  const { base, seed } = profiles[asset];
  return base * (1 + 0.062 * Math.sin(bucket / 78 + seed) + 0.024 * Math.sin(bucket / 19 + seed * 2) + 0.008 * Math.sin(bucket / 4.3 + seed));
}

function candleAt(asset: MarketAsset, bucket: number): Candle {
  const { seed, volume } = profiles[asset];
  const open = closeAt(asset, bucket - 1);
  const close = closeAt(asset, bucket);
  const wick = 0.0015 + Math.abs(Math.sin(bucket * 1.43 + seed)) * 0.0025;
  return {
    time: bucket * 900,
    open,
    close,
    high: Math.max(open, close) * (1 + wick),
    low: Math.min(open, close) * (1 - wick),
    volume: volume * (0.65 + Math.abs(Math.sin(bucket * 0.37 + seed)) * 0.85),
  };
}

export function syntheticMarketSnapshot(selected: MarketAsset, now = Date.now()) {
  const latestBucket = Math.floor(now / 900000) - 1;
  const quotes = marketAssets.map(asset => {
    const candle = candleAt(asset, latestBucket);
    return {
      asset,
      price: candle.close,
      bid: candle.close * 0.9998,
      ask: candle.close * 1.0002,
      volume24h: profiles[asset].volume * 96,
      time: new Date((latestBucket + 1) * 900000).toISOString(),
    };
  });
  const chart = Array.from({ length: 192 }, (_, index) => candleAt(selected, latestBucket - 191 + index));
  return { source: 'Synthetic market demonstration', mode: 'synthetic' as const, selected, quotes, chart, intervalSeconds: 900, refreshedAt: new Date(now).toISOString() };
}
