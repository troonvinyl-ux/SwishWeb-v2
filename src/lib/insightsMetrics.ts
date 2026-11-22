/**
 * Financial figures are never estimated from a truncated sample.
 * Sales revenue comes from confirmed sales rows, whereas order-value
 * metrics come from recorded orders; the two ledgers are never added.
 */
export type InsightRow = Record<string, unknown>;

function money(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function orderAmount(row: InsightRow): number | null {
  return money(row.total_amount ?? row.sale_price);
}

function monthKey(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return null;
  return `${instant.getUTCFullYear()}-${String(instant.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function monthlyTotals(rows: InsightRow[], dateField: string, amount: (row: InsightRow) => number | null) {
  const months = new Map<string, { key: string; month: string; count: number; value: number }>();
  for (const row of rows) {
    const key = monthKey(row[dateField]);
    const value = amount(row);
    // Do not chart partial or invalid ledger rows as genuine activity.
    if (!key || value === null) return null;
    const entry = months.get(key) || { key, month: monthLabel(key), count: 0, value: 0 };
    entry.count++;
    entry.value += value;
    months.set(key, entry);
  }
  return [...months.values()].sort((left, right) => left.key.localeCompare(right.key)).slice(-12);
}

export function buildInsightsMetrics(sales: InsightRow[], orders: InsightRow[], items: InsightRow[]) {
  const saleAmounts = sales.map(row => money(row.sale_price));
  const orderAmounts = orders.map(orderAmount);
  const validSales = saleAmounts.every(value => value !== null);
  const validOrders = orderAmounts.every(value => value !== null);
  const realisedRevenue = sales.length && validSales ? saleAmounts.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  const orderValue = orders.length && validOrders ? orderAmounts.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  const bySpecialist = new Map<string, number>();
  for (const item of items) {
    const specialist = String(item.specialist_id || 'Uncategorised');
    bySpecialist.set(specialist, (bySpecialist.get(specialist) || 0) + 1);
  }
  return {
    inventoryCount: items.length,
    orderCount: orders.length,
    recordedSaleCount: sales.length,
    realisedRevenue,
    orderValue,
    averageOrderValue: orderValue === null ? null : orderValue / orders.length,
    salesByMonth: validSales ? monthlyTotals(sales, 'sold_at', row => money(row.sale_price)) : null,
    ordersByMonth: validOrders ? monthlyTotals(orders, 'created_at', orderAmount) : null,
    inventoryBySpecialist: [...bySpecialist].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count })),
    salesIncomplete: sales.length > 0 && !validSales,
    ordersIncomplete: orders.length > 0 && !validOrders,
  };
}
