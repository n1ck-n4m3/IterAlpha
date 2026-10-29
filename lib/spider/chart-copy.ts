export const SPIDER_CHART = {
  entry: 'ENTRY', target: 'TARGET', loading: 'Building the live chart…', failed: 'The interactive chart could not load. Refresh the workspace.',
  aria: 'Interactive live market chart. Drag to pan, scroll to zoom, and hover to inspect candles.',
  ma: 'MA 7 / 25', ema: 'EMA 9', bands: 'Bollinger 20', volume: 'Volume', macd: 'MACD', rsi: 'RSI',
  reset: 'Fit chart', hint: 'Drag to pan · Scroll to zoom · Crosshair for OHLC · UTC',
} as const;
