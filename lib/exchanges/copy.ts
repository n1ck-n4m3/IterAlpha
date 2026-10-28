export const EXCHANGE_COPY = {
  title: 'Exchange connections', summary: 'Coinbase first · shared spot architecture',
  description: 'Research and paper execution share a strategy layer. Each exchange needs its own authenticated adapter and account checks before live trading.',
  execution: 'Live order execution is not connected on any venue.',
  statuses: {implemented: 'Paper feed implemented', 'permission-required': 'Feed permission required', planned: 'Planned'},
  priority: 'First execution target', docs: 'Official API documentation',
  research: 'Local research engine', researchNote: 'Chronological strategy selection, explicit costs, cash fallback, and recorded experiments. No profitable edge has been established.',
} as const;
