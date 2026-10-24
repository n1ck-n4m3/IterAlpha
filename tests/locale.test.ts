import assert from 'node:assert/strict';
import test from 'node:test';
import {LOCALES,localeNames,resolveLocale,translate} from '../lib/locale-copy.ts';

test('all available languages have a name and core translated controls', () => {
  for(const locale of LOCALES){
    assert.ok(localeNames[locale]);
    assert.ok(translate(locale,'startTraining'));
    assert.ok(translate(locale,'indicatorWarning'));
    assert.ok(translate(locale,'translationScope'));
  }
});

test('browser language matching resolves regional variants', () => {
  assert.equal(resolveLocale('zh-HK'),'zh-TW');
  assert.equal(resolveLocale('es-MX'),'es');
  assert.equal(resolveLocale('pt-PT'),'pt-BR');
  assert.equal(resolveLocale('unlisted'),'en');
});
