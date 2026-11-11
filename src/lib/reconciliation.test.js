import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEveningResult, filterArchiveRecords, parseEuro } from './reconciliation.js';

test('German currency parsing handles thousands and decimals', () => {
  assert.equal(parseEuro('1.234,56'), 1234.56);
  assert.equal(parseEuro('150,00'), 150);
  assert.equal(parseEuro('1 234,56 €'), 1234.56);
  assert.equal(parseEuro('1234.56'), 1234.56);
  assert.equal(parseEuro(''), 0);
});

test('open company invoices are added once to the reconciliation', () => {
  assert.equal(calculateEveningResult({
    cashLeft: '150,00', card: '1.579,60', openInvoices: '680,20',
    payouts: '75,00', sales: '2.358,90'
  }), 125.9);
});

test('Rotary invoice amounts can be excluded by passing zero', () => {
  const result = calculateEveningResult({ cashLeft: 100, sales: 100, openInvoices: 0 });
  assert.equal(result, 0);
});

test('regular and Rotary archives are mutually exclusive', () => {
  const rows = [
    { number: '1', kind: 'Abendkasse' },
    { number: '2', kind: 'Montags Rotary' },
    { number: '3', kind: 'Abendkasse' }
  ];
  assert.deepEqual(filterArchiveRecords(rows, false).map(x => x.number), ['1', '3']);
  assert.deepEqual(filterArchiveRecords(rows, true).map(x => x.number), ['2']);
});

test('400 deterministic reconciliation cases preserve arithmetic and archive partition', () => {
  for (let i = 0; i < 400; i++) {
    const cash = (i * 17) % 10000 / 100;
    const card = (i * 29) % 20000 / 100;
    const invoices = (i * 31) % 5000 / 100;
    const payouts = (i * 7) % 3000 / 100;
    const vouchers = (i * 11) % 1000 / 100;
    const receipts = (i * 13) % 2000 / 100;
    const other = (i * 19) % 700 / 100;
    const sales = (i * 37) % 40000 / 100;
    const expected = cash + card + invoices + payouts + vouchers + receipts + other - sales;
    const actual = calculateEveningResult({ cashLeft: cash, card, openInvoices: invoices, payouts, vouchers, receipts, other, sales });
    assert.ok(Math.abs(actual - expected) < 1e-9, 'case ' + i + ' arithmetic mismatch');

    const rows = [
      { id: i, kind: 'Abendkasse' },
      { id: i, kind: 'Montags Rotary' }
    ];
    const regular = filterArchiveRecords(rows, false);
    const rotary = filterArchiveRecords(rows, true);
    assert.equal(regular.length, 1);
    assert.equal(rotary.length, 1);
    assert.notEqual(regular[0].kind, 'Montags Rotary');
    assert.equal(rotary[0].kind, 'Montags Rotary');
  }
});
