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
} as const;
