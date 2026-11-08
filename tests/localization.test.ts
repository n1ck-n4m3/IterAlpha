import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement,type ReactElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LOCALES} from '../lib/locale-copy.ts';
import {localizeText,messageCatalogs,messageSource} from '../lib/i18n/text.ts';
import {localizeTree} from '../lib/i18n/react-tree.ts';

test('every selectable locale has complete messages and preserves interpolation parameters',()=>{
  const keys=Object.keys(messageSource).sort();assert(keys.length>850);
  for(const locale of LOCALES){const catalog=messageCatalogs[locale];assert.deepEqual(Object.keys(catalog).sort(),keys,locale);
    for(const key of keys){assert(catalog[key]?.trim(),`${locale}:${key}`);assert.deepEqual((catalog[key].match(/\{\d+\}/g)??[]).sort(),(messageSource[key].match(/\{\d+\}/g)??[]).sort(),`${locale}:${key}`);}}
});
test('locale rendering translates display and accessibility copy without changing actions or protocol values',()=>{
  const onClick=()=>{},node=createElement('button',{'aria-label':'Start agent',value:'running',onClick},'Start agent');
  const translated=localizeTree(node,'zh-CN') as ReactElement<any>;
  assert.equal(translated.props.children,'启动智能体');assert.equal(translated.props['aria-label'],'启动智能体');assert.equal(translated.props.value,'running');assert.equal(translated.props.onClick,onClick);
  const original=localizeTree(node,'en') as ReactElement<any>;
  assert.equal(original.props.children,'Start agent');assert.equal(original.props.onClick,onClick);
  const option=localizeTree(createElement('option',{value:'tape'},'Book pulse'),'zh-CN') as ReactElement<any>;assert.equal(option.props.value,'tape');assert.equal(option.props.children,'盘口脉冲');
  const siblings=localizeTree([node,createElement('span',null,'Home')],'zh-CN') as ReactElement[];
  assert(siblings.every(child=>child.key!==null));assert.equal((siblings[0].props as any).onClick,onClick);
  for(const locale of LOCALES){const next=localizeTree([node,createElement('span',null,'Home')],locale) as ReactElement[];assert.deepEqual(next.map(child=>child.key),siblings.map(child=>child.key));}
  const ClientLink=(_props:Record<string,unknown>)=>null;
  const link=localizeTree(createElement(ClientLink,{href:'/app?view=spider','aria-label':'Open agent',onClick},'Open agent'),'zh-CN') as ReactElement<any>;
  assert.equal(link.props.href,'/app?view=spider');assert.equal(link.props['aria-label'],'打开智能体');assert.equal(link.props.onClick,onClick);
});
test('stored notes and exported code remain original while surrounding labels are localized',()=>{
  const note=localizeTree(createElement('span',{'data-i18n':'source',title:'Home'},'Home'),'zh-CN') as ReactElement<any>;
  assert.equal(note.props.children,'Home');assert.equal(note.props.title,'主页');
  const code=createElement('pre',null,'{"action":"buy"}');assert.equal(localizeTree(code,'zh-CN'),code);
  const unsafe=renderToStaticMarkup(localizeTree(createElement('p',null,'<script>alert(1)</script>'),'zh-CN'));
  assert(unsafe.includes('&lt;script&gt;'));assert(!unsafe.includes('<script>'));
});
test('dynamic amounts retain their values and audio volume is distinct from market volume',()=>{
  const error=localizeText('zh-CN','Increase the balance or allocation. This market requires at least 5 USDT per order.');
  assert.equal(error,'请增加余额或入场比例。此市场每笔订单至少需要 5 USDT。');
  assert.equal(localizeText('zh-CN','Signal 5m'),'信号周期 5 分钟');
  assert.equal(localizeText('zh-CN','Audio volume'),'音量');assert.equal(localizeText('zh-CN','Volume'),'成交量');
  assert.equal(localizeText('de','Audio volume'),'Lautstärke');
  assert.equal(localizeText('zh-CN','BTC / USDT'),'BTC / USDT');
  assert.equal(localizeText('zh-CN','Recorded check · 21:18:26 UTC'),'已保存检查 · 21:18:26 UTC');
  assert.equal(localizeText('zh-CN','BUY DEPTH 84% · SELL DEPTH 16%'),'买盘深度 84% · 卖盘深度 16%');
  assert(!localizeText('zh-CN','24H').includes('H'));
  assert.equal(localizeText('zh-CN','Create another agent'),'创建另一个智能体');
  assert.equal(localizeText('zh-CN','Select a spot market, virtual balance, and strategy. Review the entry budget and exit distances.'),'选择现货市场、虚拟本金和策略，确认入场预算与止损止盈幅度。');
});
