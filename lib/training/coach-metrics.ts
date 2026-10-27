import type {SessionView} from './types.ts';
import {RULES} from './engine.ts';

export function decisionCoachMetrics(session:SessionView) {
  const decision=session.decisions.at(-1);
  const price=session.candles.at(-1)?.close??0;
  const positionValue=session.account.quantity*price;
  const stopProceeds=session.account.stopPrice===null?null:session.account.quantity*session.account.stopPrice*(1-RULES.slippageRate)*(1-RULES.feeRate);
  const stopDownside=stopProceeds===null?null:Math.max(0,positionValue-stopProceeds);
  return {
    exposurePercent:session.account.equity>0?positionValue/session.account.equity*100:0,
    stopDownside,
    stopDownsidePercent:stopDownside!==null&&session.account.equity>0?stopDownside/session.account.equity*100:0,
    entryRisk:decision?.actualEntryRisk??0,
    saleProceeds:decision?session.fills.filter(fill=>fill.side==='sell'&&(fill.reason==='reduce'||fill.reason==='exit')&&fill.time>=decision.time).reduce((sum,fill)=>sum+fill.quantity*fill.price-fill.fee,0):0,
  };
}
