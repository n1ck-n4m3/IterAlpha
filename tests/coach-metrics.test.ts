import assert from 'node:assert/strict';
import test from 'node:test';
import {decisionCoachMetrics} from '../lib/training/coach-metrics.ts';
import type {SessionView} from '../lib/training/types.ts';

const sample=()=>({
  account:{initialCash:400,cash:200,quantity:2,equity:400,stopPrice:90,averageEntry:95},
  candles:[{time:100,open:100,high:100,low:100,close:100}],
  decisions:[{time:100,actualEntryRisk:8}],fills:[],
} as unknown as SessionView);

test('coach shows total current stop downside separately from the latest entry risk',()=>{
  const metrics=decisionCoachMetrics(sample());
  assert.equal(metrics.exposurePercent,50);
  assert.equal(metrics.entryRisk,8);
  assert(Math.abs(metrics.stopDownside!-20.26991)<1e-8);
  assert(Math.abs(metrics.stopDownsidePercent-5.0674775)<1e-8);
});

test('a position closed during the reveal does not retain a current stop exposure',()=>{
  const session=sample();session.account.quantity=0;session.account.stopPrice=null;
  const metrics=decisionCoachMetrics(session);
  assert.equal(metrics.exposurePercent,0);assert.equal(metrics.stopDownside,null);
  assert.equal(metrics.entryRisk,8);
});

test('sale proceeds exclude earlier fills, protective stops and terminal liquidation',()=>{
  const session=sample();
  session.fills=[
    {id:'old',side:'sell',reason:'reduce',time:99,price:100,quantity:1,fee:.1},
    {id:'chosen',side:'sell',reason:'reduce',time:100,price:100,quantity:.5,fee:.05},
    {id:'stop',side:'sell',reason:'stop',time:101,price:90,quantity:.5,fee:.045},
    {id:'end',side:'sell',reason:'end',time:102,price:100,quantity:1,fee:.1},
  ];
  assert.equal(decisionCoachMetrics(session).saleProceeds,49.95);
});
