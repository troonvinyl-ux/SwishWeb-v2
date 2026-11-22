export interface InsightRow { [key: string]: unknown; }
export interface InsightsMetrics {
  inventoryCount: number;
  orderCount: number;
  recordedSaleCount: number;
  averageOrderValue: number | null;
  realisedRevenue: number | null;
  ordersIncomplete: boolean;
  salesIncomplete: boolean;
  salesByMonth: Array<{ month: string; value: number }> | null;
  ordersByMonth: Array<{ month: string; count: number }> | null;
  inventoryBySpecialist: Array<{ name: string; count: number }>;
}

/** PostgreSQL numeric strings are accepted; missing values are never coerced to zero. */
function amount(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\+?\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function moneyTotal(values: Array<number | null>): number | null {
  if (!values.length || values.some(value => value === null)) return null;
  const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  return Number.isFinite(total) && total <= Number.MAX_SAFE_INTEGER / 100
    ? Math.round(total * 100) / 100 : null;
}
function monthKey(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 7) : null;
}
const monthLabel = (key: string) => new Intl.DateTimeFormat('en-GB', {
  month: 'short', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${key}-01T00:00:00Z`));

/** Input is the complete, tenant/niche-filtered readback. Never merge orders into the sales ledger. */
export function buildInsightsMetrics(sales: InsightRow[], orders: InsightRow[], items: InsightRow[]): InsightsMetrics {
  const saleAmounts = sales.map(row => amount(row.sale_price));
  // Preserve a recorded zero; use the legacy field only when total_amount is absent.
  const orderAmounts = orders.map(row => amount(row.total_amount ?? row.sale_price));
  const realisedRevenue = moneyTotal(saleAmounts);
  const orderTotal = moneyTotal(orderAmounts);
  const salesIncomplete = sales.length > 0 && realisedRevenue === null;
  const ordersIncomplete = orders.length > 0 && orderTotal === null;
  const salesMonths = new Map<string, number[]>();
  const orderMonths = new Map<string, number>();
  let saleDatesComplete = true, orderDatesComplete = true;
  sales.forEach((row, index) => {
    const key = monthKey(row.sold_at);
    if (!key) { saleDatesComplete = false; return; }
    const value = saleAmounts[index];
    if (value !== null) salesMonths.set(key, [...(salesMonths.get(key) || []), value]);
  });
  orders.forEach(row => {
    const key = monthKey(row.created_at);
    if (!key) { orderDatesComplete = false; return; }
    orderMonths.set(key, (orderMonths.get(key) || 0) + 1);
  });
  const specialists = new Map<string, number>();
  items.forEach(row => {
    const id = typeof row.specialist_id === 'string' ? row.specialist_id.trim() : '';
    const name = id ? id.replace(/[_-]+/g, ' ').replace(/^./, letter => letter.toUpperCase()) : 'Unassigned specialist';
    specialists.set(name, (specialists.get(name) || 0) + 1);
  });
  return {
    inventoryCount: items.length, orderCount: orders.length, recordedSaleCount: sales.length,
    averageOrderValue: orderTotal === null ? null : Math.round((orderTotal / orders.length) * 100) / 100,
    realisedRevenue, ordersIncomplete, salesIncomplete,
    salesByMonth: salesIncomplete || !saleDatesComplete ? null : [...salesMonths.entries()]
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => ({ month: monthLabel(key), value: moneyTotal(values)! })),
    ordersByMonth: ordersIncomplete || !orderDatesComplete ? null : [...orderMonths.entries()]
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ month: monthLabel(key), count })),
    inventoryBySpecialist: [...specialists.entries()].map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}
