import type {Config} from './types.ts';

export function executionCosts(config: Pick<Config, 'feeBps' | 'slippageBps'>) {
  return {fee: (config.feeBps ?? 10) / 10_000, slippage: (config.slippageBps ?? 5) / 10_000};
}

// Fee/slippage assumptions are user inputs, not a venue-specific fee quotation.
export function roundTripCostBps(config: Pick<Config, 'feeBps' | 'slippageBps'>, bid: number, ask: number) {
  const {fee, slippage} = executionCosts(config);
  return ((ask * (1 + slippage) * (1 + fee)) / (bid * (1 - slippage) * (1 - fee)) - 1) * 10_000;
}
