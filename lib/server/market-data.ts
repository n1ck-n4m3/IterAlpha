import {z} from 'zod';
import type {Candle,MarketSource} from '../training/types.ts';

const candleSchema=z.object({time:z.number().int().positive(),open:z.number().positive(),high:z.number().positive(),low:z.number().positive(),close:z.number().positive(),volume:z.number().nonnegative().optional()}).strict();
const sourceSchema=z.object({mode:z.literal('historical'),provider:z.string().min(1),venue:z.string().min(1),symbol:z.enum(['BTC-USD','ETH-USD']),intervalSeconds:z.literal(900),retrievedAt:z.string().datetime(),version:z.string().min(1),license:z.string().min(20),sourceUrl:z.string().url(),hash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export const snapshotSchema=z.object({sceneId:z.string(),editorReviewed:z.literal(true),displayRightsConfirmed:z.literal(true),source:sourceSchema,candles:z.array(candleSchema).length(88)}).strict();
export type HistoricalSnapshot=z.infer<typeof snapshotSchema>;
export interface MarketDataAdapter { read(snapshot:unknown): {candles:Candle[];source:MarketSource;sceneId:string} }
export class HistoricalSnapshotAdapter implements MarketDataAdapter {
  read(input:unknown):HistoricalSnapshot{
    const result=snapshotSchema.parse(input);
    for(let i=0;i<result.candles.length;i++){
      const candle=result.candles[i];
      if(candle.high<Math.max(candle.open,candle.close)||candle.low>Math.min(candle.open,candle.close)||candle.time%900!==0)throw new Error('Invalid candle geometry or UTC alignment.');
      if(i&&candle.time-result.candles[i-1].time!==900)throw new Error('Snapshot has missing, duplicate or out-of-order candles.');
    }
    return result;
  }
}
