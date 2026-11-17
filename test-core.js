#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const scriptPath = path.join(__dirname, 'cr80-artwork-size-check.user.js');
const source = fs.readFileSync(scriptPath, 'utf8');
const start = source.indexOf('// --- core start ---');
const end = source.indexOf('// --- core end ---');
if (start === -1 || end === -1 || end <= start) {
  console.error('Could not find core markers in the userscript.');
  process.exit(1);
}

const context = { module: { exports: {} }, Math, Number, isFinite };
vm.createContext(context);
vm.runInContext(
  '(function () {\n' + source.slice(start, end) + '\n  module.exports = CR80;\n})();',
  context
);
const CR80 = context.module.exports;

let failed = 0;
function assert(name, condition, detail) {
  if (condition) {
    console.log('ok  - ' + name);
  } else {
    failed += 1;
    console.log('FAIL - ' + name + (detail ? ': ' + detail : ''));
  }
}

const trimW = CR80.mmToPx(85.6);
const trimH = CR80.mmToPx(53.98);
const bleedW = CR80.mmToPx(85.6 + 6);
const bleedH = CR80.mmToPx(53.98 + 6);
assert('trim long rounds to 1011 (PlasticCard.nz figure)', trimW === 1011, String(trimW));
assert('trim short rounds to 638 (PlasticCard.nz figure)', trimH === 638, String(trimH));
assert('3 mm bleed long rounds to 1082', bleedW === 1082, String(bleedW));
assert('3 mm bleed short rounds to 708', bleedH === 708, String(bleedH));
assert('2 mm bleed matches the checker template 1058 × 685', CR80.mmToPx(85.6 + 4) === 1058 && CR80.mmToPx(53.98 + 4) === 685);

const t = CR80.targets(300);
assert('targets().trim matches mmToPx', t.trim.long === 1011 && t.trim.short === 638);
assert('targets().bleed matches mmToPx', t.bleed.long === 1082 && t.bleed.short === 708);

const exactTrim = CR80.evaluate(1011, 638);
assert('exact trim meets trim only', exactTrim.ok && exactTrim.meetsTrim && !exactTrim.meetsBleed);
assert('exact trim verdict mentions trim-only', /trim-only/.test(exactTrim.verdict), exactTrim.verdict);

const portraitTrim = CR80.evaluate(638, 1011);
assert('portrait exact trim is accepted', portraitTrim.ok && portraitTrim.meetsTrim && !portraitTrim.meetsBleed);
assert('portrait is labelled portrait', portraitTrim.orientation === 'portrait');

const exactBleed = CR80.evaluate(1082, 708);
assert('exact bleed meets both', exactBleed.ok && exactBleed.meetsTrim && exactBleed.meetsBleed);
assert('exact bleed verdict mentions 3 mm bleed', /3 mm bleed/.test(exactBleed.verdict), exactBleed.verdict);

const portraitBleed = CR80.evaluate(708, 1082);
assert('portrait exact bleed is accepted', portraitBleed.meetsBleed);

const shortLong = CR80.evaluate(1010, 638);
assert('one pixel short on the long side fails trim', shortLong.ok && !shortLong.meetsTrim && !shortLong.meetsBleed);
assert('short image names the ppi shortfall', /Below 300 dpi/.test(shortLong.verdict), shortLong.verdict);

const shortShort = CR80.evaluate(1011, 637);
assert('one pixel short on the short side fails trim', !shortShort.meetsTrim);

const mid = CR80.evaluate(1082, 707);
assert('meets trim but not bleed when short side is 707', mid.meetsTrim && !mid.meetsBleed);

const large = CR80.evaluate(2400, 1600);
assert('a large photo meets bleed', large.meetsTrim && large.meetsBleed);
assert('ppi at trim is well above 300 for a large photo', large.ppiAtTrim > 400, String(large.ppiAtTrim));

const small = CR80.evaluate(500, 500);
assert('500 × 500 fails both', !small.meetsTrim && !small.meetsBleed);

assert('zero width is an error', CR80.evaluate(0, 1000).ok === false);
assert('negative height is an error', CR80.evaluate(1000, -1).ok === false);
assert('missing size is an error', CR80.evaluate(undefined, undefined).ok === false);

const limitingLong = CR80.evaluate(1011, 800);
assert('limiting side is the long side when that ppi is lower', /long side/.test(limitingLong.limiting), limitingLong.limiting);
const limitingShort = CR80.evaluate(2000, 638);
assert('limiting side is the short side when that ppi is lower', /short side/.test(limitingShort.limiting), limitingShort.limiting);

if (failed) {
  console.log('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nAll tests passed');
