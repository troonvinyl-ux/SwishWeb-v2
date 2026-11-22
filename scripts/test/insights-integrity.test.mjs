import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');
const module = { exports: {} };
const source = readFileSync('src/lib/insightsMetrics.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error).length || 0, 0);
new Function('module', 'exports', compiled.outputText)(module, module.exports);
const { buildInsightsMetrics, monthlyTotals } = module.exports;

test('analytics reconcile complete multi-page-sized ledgers without an artificial 100-row limit', () => {
  const sales = Array.from({ length: 1105 }, (_, id) => ({ id: String(id), sale_price: '2.50', sold_at: '2026-11-02T11:00:00Z' }));
  const orders = Array.from({ length: 1105 }, (_, id) => ({ id: String(id), total_amount: '4.00', created_at: '2026-11-03T11:00:00Z' }));
  const items = Array.from({ length: 1207 }, (_, id) => ({ id: String(id), specialist_id: id % 2 ? 'coins' : 'coins_uk' }));
  const m = buildInsightsMetrics(sales, orders, items);
  assert.equal(m.inventoryCount, 1207);
  assert.equal(m.orderCount, 1105);
  assert.equal(m.realisedRevenue, 2762.5);
  assert.equal(m.orderValue, 4420);
  assert.equal(m.averageOrderValue, 4);
  assert.equal(m.inventoryBySpecialist.reduce((sum, row) => sum + row.count, 0), m.inventoryCount);
  assert.equal(m.salesByMonth.reduce((sum, row) => sum + row.value, 0), m.realisedRevenue);
  assert.equal(m.ordersByMonth.reduce((sum, row) => sum + row.count, 0), m.orderCount);
});

test('monthly chart is chronological even for reverse-sorted records and across years', () => {
  const rows = [
    { sold_at: '2026-11-02T00:00:00Z', sale_price: '3' },
    { sold_at: '2025-12-20T00:00:00Z', sale_price: '1' },
    { sold_at: '2026-01-10T00:00:00Z', sale_price: '2' },
  ];
  const chart = monthlyTotals(rows, 'sold_at', row => Number(row.sale_price));
  assert.deepEqual(chart.map(row => row.key), ['2025-12', '2026-01', '2026-11']);
  assert.deepEqual(chart.map(row => row.value), [1, 2, 3]);
});

test('missing values and invalid dates hide revenue or chart rather than rendering fabricated zero', () => {
  const m = buildInsightsMetrics(
    [{ sold_at: '2026-11-02T00:00:00Z', sale_price: null }],
    [{ created_at: '2026-11-03T00:00:00Z', total_amount: 'unknown' }],
    [],
  );
  assert.equal(m.realisedRevenue, null);
  assert.equal(m.averageOrderValue, null);
  assert.equal(m.salesByMonth, null);
  assert.equal(m.ordersByMonth, null);
  assert.equal(m.salesIncomplete, true);
  assert.equal(m.ordersIncomplete, true);
  const invalidDate = buildInsightsMetrics([{ sold_at: 'not-a-date', sale_price: 4 }], [], []);
  assert.equal(invalidDate.realisedRevenue, 4);
  assert.equal(invalidDate.salesByMonth, null);
  assert.equal(buildInsightsMetrics([], [], []).realisedRevenue, null);
});

test('insights must scope every paginated query to tenant and niche, and refresh the same query', () => {
  const page = readFileSync('src/pages/Insights.tsx', 'utf8');
  assert.match(page, /\.eq\('tenant_id', tenantId\)/);
  assert.match(page, /\.in\('specialist_id', specialistIds\)/);
  assert.match(page, /\.in\('items.specialist_id', specialistIds\)/);
  assert.match(page, /\.range\(start, start \+ PAGE_SIZE - 1\)/);
  assert.match(page, /query\.refetch\(\)/);
  assert.doesNotMatch(page, /limit:\s*100|Math\.random|setTimeout/);
  assert.doesNotMatch(page, /\.from\('inventory'\)/);
});
