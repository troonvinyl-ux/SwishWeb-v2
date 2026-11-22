import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');
const source = await readFile('src/lib/insightsMetrics.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  reportDiagnostics: true,
});
const { buildInsightsMetrics } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`
);
const date = '2026-11-22T12:00:00Z';

test('the Insights dependency exports the calculation function and row contract', async () => {
  assert.equal(typeof buildInsightsMetrics, 'function');
  assert.match(source, /export interface InsightRow/);
  assert.equal(compiled.diagnostics?.filter(row => row.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  const page = await readFile('src/pages/Insights.tsx', 'utf8');
  assert.match(page, /buildInsightsMetrics, type InsightRow/);
  assert.match(page, /range\(start, start \+ PAGE_SIZE - 1\)/);
  assert.match(page, /eq\('tenant_id', tenantId\)/);
  assert.match(page, /in\('items.specialist_id', specialistIds\)/);
});

test('sales revenue uses only the ledger, orders use actual amounts, and stock labels are readable', () => {
  const result = buildInsightsMetrics(
    [{ sale_price: '10.10', sold_at: date }, { sale_price: 20.20, sold_at: date }],
    [{ total_amount: '100', sale_price: 999, created_at: date }, { sale_price: '20', created_at: date }],
    [{ specialist_id: 'vinyl_records' }, { specialist_id: 'vinyl_records' }, { specialist_id: 'coins' }],
  );
  assert.equal(result.realisedRevenue, 30.30);
  assert.equal(result.averageOrderValue, 60);
  assert.equal(result.orderCount, 2);
  assert.equal(result.recordedSaleCount, 2);
  assert.equal(result.inventoryCount, 3);
  assert.deepEqual(result.salesByMonth, [{ month: 'Nov 2026', value: 30.30 }]);
  assert.deepEqual(result.ordersByMonth, [{ month: 'Nov 2026', count: 2 }]);
  assert.deepEqual(result.inventoryBySpecialist, [{ name: 'Vinyl records', count: 2 }, { name: 'Coins', count: 1 }]);
});

test('empty ledger never implies realised revenue from orders or invented sales', () => {
  const empty = buildInsightsMetrics([], [], []);
  assert.equal(empty.realisedRevenue, null);
  assert.equal(empty.averageOrderValue, null);
  assert.equal(empty.salesIncomplete, false);
  assert.equal(empty.ordersIncomplete, false);
  assert.deepEqual(empty.salesByMonth, []);
  const ordersOnly = buildInsightsMetrics([], [{ total_amount: 500, created_at: date }], []);
  assert.equal(ordersOnly.realisedRevenue, null);
  assert.equal(ordersOnly.recordedSaleCount, 0);
  assert.equal(ordersOnly.averageOrderValue, 500);
});

test('zero is valid and never falls through to a different order amount', () => {
  const result = buildInsightsMetrics([{ sale_price: 0, sold_at: date }], [{ total_amount: 0, sale_price: 200, created_at: date }], []);
  assert.equal(result.realisedRevenue, 0);
  assert.equal(result.averageOrderValue, 0);
  assert.equal(result.salesIncomplete, false);
  assert.equal(result.ordersIncomplete, false);
});

test('missing or invalid amounts hide related values and charts but retain complete counts', () => {
  for (const invalid of [undefined, null, '', '   ', false, [], {}, -1, NaN, Infinity, '0x10', 'invalid']) {
    const result = buildInsightsMetrics(
      [{ sale_price: 10, sold_at: date }, { sale_price: invalid, sold_at: date }],
      [{ total_amount: invalid, created_at: date }], [{ specialist_id: 'coins' }],
    );
    assert.equal(result.realisedRevenue, null);
    assert.equal(result.averageOrderValue, null);
    assert.equal(result.salesByMonth, null);
    assert.equal(result.ordersByMonth, null);
    assert.equal(result.salesIncomplete, true);
    assert.equal(result.ordersIncomplete, true);
    assert.equal(result.recordedSaleCount, 2);
    assert.equal(result.orderCount, 1);
    assert.equal(result.inventoryCount, 1);
  }
  const invalidPrimary = buildInsightsMetrics([], [{ total_amount: '', sale_price: 50, created_at: date }], []);
  assert.equal(invalidPrimary.averageOrderValue, null);
});

test('months are chronological and UTC-stable; undated rows cannot produce partial charts', () => {
  const result = buildInsightsMetrics([
    { sale_price: 10, sold_at: '2026-02-01T00:30:00+01:00' },
    { sale_price: 20, sold_at: '2025-12-31T12:00:00Z' },
  ], [], []);
  assert.deepEqual(result.salesByMonth, [{ month: 'Dec 2025', value: 20 }, { month: 'Jan 2026', value: 10 }]);
  for (const invalid of [undefined, '', 'bad date']) {
    const incomplete = buildInsightsMetrics([{ sale_price: 10, sold_at: invalid }], [{ total_amount: 20, created_at: invalid }], []);
    assert.equal(incomplete.realisedRevenue, 10);
    assert.equal(incomplete.averageOrderValue, 20);
    assert.equal(incomplete.salesByMonth, null);
    assert.equal(incomplete.ordersByMonth, null);
  }
});

test('totals use every supplied record, do not mutate input, and reject unsafe totals', () => {
  const sales = Object.freeze(Array.from({ length: 1201 }, () => Object.freeze({ sale_price: '1.00', sold_at: date })));
  const result = buildInsightsMetrics(sales, [], []);
  assert.equal(result.recordedSaleCount, 1201);
  assert.equal(result.realisedRevenue, 1201);
  assert.equal(result.salesByMonth[0].value, 1201);
  const overflow = buildInsightsMetrics([{ sale_price: Number.MAX_VALUE, sold_at: date }], [], []);
  assert.equal(overflow.realisedRevenue, null);
  assert.equal(overflow.salesIncomplete, true);
  assert.equal(overflow.salesByMonth, null);
});
