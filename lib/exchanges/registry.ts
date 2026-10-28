import type {ExchangeId, SpotBroker} from './types.ts';

export type ExchangeDefinition = {
  id: ExchangeId; name: string; priority: number;
  paperFeed: 'implemented' | 'permission-required' | 'planned';
  authenticatedExecution: 'not-implemented';
  sandbox: 'static-responses' | 'test-market' | 'demo-account' | 'verify-before-integration';
  documentation: string; note: string;
};

// This is an implementation inventory, not an account eligibility determination.
// Binance and Binance.US remain different venues. USD, USDC, and USDT are distinct.
export const EXCHANGES: readonly ExchangeDefinition[] = [
  {id: 'coinbase', name: 'Coinbase Advanced', priority: 1, paperFeed: 'permission-required', authenticatedExecution: 'not-implemented', sandbox: 'static-responses', documentation: 'https://docs.cdp.coinbase.com/coinbase-app/advanced-trade-apis/overview', note: 'First execution integration target. The existing Exchange feed is separately gated; the Advanced sandbox does not simulate market performance.'},
  {id: 'binance', name: 'Binance', priority: 2, paperFeed: 'implemented', authenticatedExecution: 'not-implemented', sandbox: 'test-market', documentation: 'https://developers.binance.com/docs/binance-spot-api-docs', note: 'Public spot feed and local paper fills are implemented. Account and regional eligibility must be checked separately.'},
  {id: 'okx', name: 'OKX', priority: 3, paperFeed: 'planned', authenticatedExecution: 'not-implemented', sandbox: 'demo-account', documentation: 'https://www.okx.com/docs-v5/en/', note: 'Planned spot adapter with explicit cash trading mode. Regional endpoints and demo credentials require separate configuration.'},
  {id: 'robinhood', name: 'Robinhood Crypto', priority: 4, paperFeed: 'planned', authenticatedExecution: 'not-implemented', sandbox: 'verify-before-integration', documentation: 'https://robinhood.com/us/en/support/articles/crypto-api/', note: 'Official Crypto API for US customers. API version, account permissions, fees, and product availability must be checked at connection time.'},
  {id: 'binance-us', name: 'Binance.US', priority: 5, paperFeed: 'planned', authenticatedExecution: 'not-implemented', sandbox: 'verify-before-integration', documentation: 'https://docs.binance.us/', note: 'Separate adapter and credentials from Binance; never substitute one for the other.'},
  {id: 'kraken', name: 'Kraken', priority: 6, paperFeed: 'planned', authenticatedExecution: 'not-implemented', sandbox: 'verify-before-integration', documentation: 'https://docs.kraken.com/api/', note: 'Planned. Validate native symbols, precision, fees, permissions, and order lifecycle before activation.'},
  {id: 'bybit', name: 'Bybit', priority: 7, paperFeed: 'planned', authenticatedExecution: 'not-implemented', sandbox: 'verify-before-integration', documentation: 'https://bybit-exchange.github.io/docs/v5/intro', note: 'Planned. Validate spot-only configuration and account availability before activation.'},
];

export function exchangeDefinition(id: string): ExchangeDefinition {
  const definition = EXCHANGES.find(exchange => exchange.id === id);
  if (!definition) throw new Error('Unsupported exchange.');
  return definition;
}

export function authenticatedBroker(id: ExchangeId, adapters: readonly SpotBroker[]): SpotBroker {
  exchangeDefinition(id);
  const matches = adapters.filter(adapter => adapter.exchange === id);
  if (matches.length !== 1) throw new Error('An explicitly configured, unique exchange adapter is required.');
  return matches[0];
}
