export const COPY = {
  nav: {train:'Play',market:'Market',review:'Review',progress:'Progress'},
  actions: {buy:'Buy',wait:'Wait',hold:'Hold',halve:'Sell half',sell:'Sell all'},
  topics: {trend:'Trend & pullback',range:'Range & patience',event:'Events & uncertainty'},
  reasons: ['Price structure','Defined risk','Need confirmation','Event uncertainty'],
  questions: ['What could I improve?','How did costs affect this round?','What should I practise next?'],
  demo: 'Simulated prices · No real money',
  tracks: {
    foundations: {label:'Foundations',eyebrow:'GUIDED PRACTICE',intro:'Start with the essentials. Read the context, size an order, and see how a protective stop works before reviewing your choice.',brief:'Read the facts and interpretations, then decide what you would do.',emptyTrace:'Choose an action to build your decision history.'},
    advanced: {label:'Advanced practice',eyebrow:'PROCESS DRILL',intro:'Work from facts and uncertainty. Record your reason and thesis before the next price segment is revealed.',brief:'Interpretations are hidden. Form your own thesis from facts and uncertainty.',emptyTrace:'Record a reason and thesis before each reveal.'},
  },
  drills: {
    foundations: {
      trend: ['Start by locating the 16-candle direction. A recent rise is an observation, not a reason to spend all your cash.', 'Compare your stop with the recent low. If the stop is too close to normal movement, the position may exit before your idea is tested.', 'After each reveal, compare your original reason with the new price and volume facts. You may wait even if you hold cash.'],
      range: ['Identify the recent high and low. Inside a range, both a break and a rejection remain possible.', 'Look at the distance from entry to stop. A narrow range can make fees and slippage relatively more important.', 'Before buying, name the evidence that would make you abandon the range idea. Waiting is a complete decision.'],
      event: ['Read a dated source only if it was available at this checkpoint. A headline alone does not reveal how much the market expected.', 'A wider recent range means a fixed stop may be reached more easily. Check the USD loss preview before committing.', 'Do not turn a simulated price move into a claim about what a real announcement caused. Keep fact and interpretation separate.'],
    },
    advanced: {
      trend: ['Write your entry condition, invalidation level, and the cash you will keep available.', 'Check whether your size changed because of new evidence or only because the last segment moved.', 'Compare your recorded thesis with the next revealed segment; separate process quality from profit.'],
      range: ['Specify what would confirm a break versus a failed test of the range.', 'Account for execution cost before treating a small projected move as meaningful.', 'Decide what observation would reverse your view, and record it before reveal.'],
      event: ['Distinguish a source timestamp from the time the event occurred.', 'State what is known, what is inferred, and what remains unobserved.', 'Size for uncertainty without claiming the headline predicts the next candle.'],
    },
  },
} as const;
