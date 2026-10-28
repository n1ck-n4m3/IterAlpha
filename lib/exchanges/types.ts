export type ExchangeId = 'coinbase' | 'binance' | 'binance-us' | 'okx' | 'robinhood' | 'kraken' | 'bybit';
export type Decimal = string;

// These ports describe future authenticated adapters. No live broker is registered.
// Keep native symbols, quote units, decimal amounts, and client order IDs intact.
export type SpotInstrument = {
  exchange: ExchangeId; symbol: string; base: string; quote: string;
  baseIncrement: Decimal; quoteIncrement: Decimal;
  minimumBase: Decimal; minimumQuote: Decimal;
  status: 'tradable' | 'restricted' | 'halted'; observedAt: number;
};
export type SpotOrder = {
  clientOrderId: string; symbol: string; side: 'buy' | 'sell';
  type: 'market' | 'limit'; baseQuantity: Decimal;
  limitPrice?: Decimal; timeInForce: 'IOC' | 'GTC';
};
export type SpotOrderState = {
  clientOrderId: string; exchangeOrderId: string; symbol: string;
  status: 'pending' | 'open' | 'partially-filled' | 'filled' | 'cancelled' | 'rejected' | 'unknown';
  filledBase: Decimal; filledQuote: Decimal;
  fees: {asset: string; amount: Decimal}[]; observedAt: number;
};
export interface SpotBroker {
  readonly exchange: ExchangeId;
  readonly environment: 'sandbox' | 'live';
  instruments(): Promise<SpotInstrument[]>;
  balances(): Promise<{asset: string; available: Decimal; held: Decimal}[]>;
  preview(order: SpotOrder): Promise<{accepted: boolean; reasons: string[]}>;
  submit(order: SpotOrder): Promise<SpotOrderState>;
  findByClientOrderId(id: string, symbol: string): Promise<SpotOrderState | null>;
  cancel(exchangeOrderId: string, symbol: string): Promise<SpotOrderState>;
}
