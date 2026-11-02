import type {Snapshot} from './types.ts';

export const VISIBLE_BOOK_LEVELS = 10;
/** Quote-value imbalance of visible resting orders, never trader counts or executed flow. */
export function visibleBookBalance(snapshot: Pick<Snapshot, 'bids'|'asks'>) {
  const bids=snapshot.bids.slice(0,VISIBLE_BOOK_LEVELS),asks=snapshot.asks.slice(0,VISIBLE_BOOK_LEVELS);
  const bidValue=bids.reduce((sum,level)=>sum+level.price*level.quantity,0);
  const askValue=asks.reduce((sum,level)=>sum+level.price*level.quantity,0),total=bidValue+askValue;
  return {bids,asks,bidValue,askValue,bidShare:total>0?bidValue/total:null,imbalance:total>0?(bidValue-askValue)/total:0};
}
