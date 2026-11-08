import test from 'node:test';
import assert from 'node:assert/strict';
import {clientNavigationTarget} from '../lib/site-navigation.ts';
const currentUrl='https://iteralpha.example/app?view=spider';
test('normal site navigation stays client-side and retains view, mode, and anchor destinations',()=>{
  assert.equal(clientNavigationTarget({href:'/',currentUrl}),'/');
  assert.equal(clientNavigationTarget({href:'/app?view=review',currentUrl}),'/app?view=review');
  assert.equal(clientNavigationTarget({href:'https://iteralpha.example/app?mode=pro#chart',currentUrl}),'/app?mode=pro#chart');
  assert.equal(clientNavigationTarget({href:'#evidence',currentUrl}),null);
});
test('site links preserve new-tab, download, external, cancelled, and modified-click behavior',()=>{
  for(const intent of [{button:1},{metaKey:true},{ctrlKey:true},{shiftKey:true},{altKey:true},{target:'_blank'},{target:'_top'},{download:''},{download:true},{defaultPrevented:true}])assert.equal(clientNavigationTarget({href:'/',currentUrl,...intent}),null);
  for(const href of ['https://elsewhere.example/','//elsewhere.example/','mailto:hello@example.com','javascript:alert(1)'])assert.equal(clientNavigationTarget({href,currentUrl}),null);
});
