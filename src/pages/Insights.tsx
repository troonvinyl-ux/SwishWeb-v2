import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { getActiveNicheId, getSpecialistIdsForNiche } from '@/lib/niche';
import { getSupabaseClient, getSupabaseClientAsync } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { buildInsightsMetrics, type InsightRow } from '@/lib/insightsMetrics';

const PAGE_SIZE = 500;

/** Paginate the full tenant/niche result set instead of calling 100 rows "total". */
async function readAllRows(table: 'items' | 'orders' | 'sales', tenantId: string, specialistIds: string[]): Promise<InsightRow[]> {
  const client = getSupabaseClient() || await getSupabaseClientAsync();
  if (!client) throw new Error('SWISH backend is unavailable. Retry after the connection is restored.');
  const result: InsightRow[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    let request = client.from(table)
      .select(table === 'items' ? 'id,specialist_id' : table === 'sales'
        ? 'id,sold_at,sale_price,items!inner(specialist_id)'
        : 'id,created_at,total_amount,sale_price,items!inner(specialist_id)')
      .eq('tenant_id', tenantId);
    if (table === 'items') request = request.in('specialist_id', specialistIds);
    else request = request.eq('marketplace_id', 'ebay').in('items.specialist_id', specialistIds);
    const ordered = request.order(table === 'sales' ? 'sold_at' : 'created_at', { ascending: true })
      .order('id', { ascending: true });
    const { data, error } = await ordered.range(start, start + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not read ${table}: ${error.message}`);
    const page = (data || []) as unknown as InsightRow[];
    result.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return result;
}

export default function Insights() {
  const { user } = useAuth();
  const { tenantId, isLoading: tenantLoading, error: tenantError, refetch: retryTenant } = useCurrentTenantId();
  const niche = getActiveNicheId();
  const specialistIds = getSpecialistIdsForNiche(niche);
  const query = useQuery({
    queryKey: ['insights-reconciled', user?.id, tenantId, niche],
    enabled: Boolean(user?.id && tenantId && specialistIds.length),
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      if (!tenantId || !specialistIds.length) throw new Error('Select a valid specialist workspace.');
      const [sales, orders, items] = await Promise.all([
        readAllRows('sales', tenantId, specialistIds),
        readAllRows('orders', tenantId, specialistIds),
        readAllRows('items', tenantId, specialistIds),
      ]);
      return buildInsightsMetrics(sales, orders, items);
    },
  });
  const fetching = tenantLoading || query.isFetching;
  const error = tenantError || query.error;
  const data = !error ? query.data : null;
  const refresh = () => {
    if (!tenantId) void retryTenant();
    else void query.refetch();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Insights</h1>
          <p className="page-subtitle">Recorded eBay sales and orders, plus actual stock · {niche}</p>
        </div>
        <button type="button" onClick={refresh} disabled={fetching} aria-label="Refresh insights from SWISH" className="btn-secondary min-h-11">
          <RefreshCw className={`h-4 w-4 ${fetching ? 'animate-spin' : ''}`} aria-hidden="true" />
          {fetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error && <section role="alert" className="swish-card space-y-3 border-destructive/40 p-5">
        <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Insights unavailable</p>
        <p className="text-sm text-muted-foreground">{error.message}. No partial totals or graphs are shown.</p>
        <button type="button" onClick={refresh} disabled={fetching} className="btn-secondary">Retry data refresh</button>
      </section>}
      {!error && fetching && !data && <div role="status" className="swish-card p-6 text-sm text-muted-foreground">Loading complete workspace records…</div>}
      {!error && !fetching && !tenantId && <div className="swish-card p-6 text-sm text-muted-foreground">No current workspace is available for Insights.</div>}
      {!error && !fetching && !specialistIds.length && <div className="swish-card p-6 text-sm text-muted-foreground">Select a recognised specialist workspace to view its records.</div>}

      {data && <>
        {fetching && <p role="status" className="text-sm text-muted-foreground">Refreshing figures from SWISH…</p>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="stat-card"><div className="stat-value">{data.inventoryCount.toLocaleString('en-GB')}</div><div className="stat-label">Inventory items</div></div>
          <div className="stat-card"><div className="stat-value">{data.orderCount.toLocaleString('en-GB')}</div><div className="stat-label">Recorded eBay orders</div></div>
          {data.averageOrderValue !== null && <div className="stat-card"><div className="stat-value">{formatCurrency(data.averageOrderValue)}</div><div className="stat-label">Average recorded order value</div></div>}
          {data.realisedRevenue !== null && <div className="stat-card"><div className="stat-value">{formatCurrency(data.realisedRevenue)}</div><div className="stat-label">Recorded eBay sales value</div></div>}
        </div>

        {(data.ordersIncomplete || data.salesIncomplete) && <p role="alert" className="text-sm text-warning">Some financial records contain missing or invalid amounts. Unverifiable values and related charts are hidden; counts use the complete fetched records.</p>}
        {!data.recordedSaleCount && <p className="text-sm text-muted-foreground">No confirmed sales are recorded in the sales ledger for this workspace. No sales revenue is being inferred from orders.</p>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.salesByMonth && data.salesByMonth.length > 0 && <section className="swish-card p-4">
            <h2 className="mb-4 text-sm font-semibold">Recorded sales value by month</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.salesByMonth} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={value => formatCurrency(Number(value))} />
                <Bar dataKey="value" name="Sales value" fill="#F5A623" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>}
          {data.ordersByMonth && data.ordersByMonth.length > 0 && <section className="swish-card p-4">
            <h2 className="mb-4 text-sm font-semibold">Recorded orders by month</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.ordersByMonth} margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="Orders" stroke="#4A90D9" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </section>}
          {data.inventoryBySpecialist.length > 0 && <section className="swish-card p-4 lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold">Inventory by specialist</h2>
            <ResponsiveContainer width="100%" height={Math.max(180, data.inventoryBySpecialist.length * 35)}>
              <BarChart data={data.inventoryBySpecialist} layout="vertical" margin={{ top: 0, right: 30, left: 80, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                <Tooltip />
                <Bar dataKey="count" name="Stock items" fill="#F5A623" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>}
        </div>
        {!data.inventoryCount && !data.orderCount && !data.recordedSaleCount && <div className="swish-card p-8 text-sm text-muted-foreground">This workspace has no inventory, eBay orders or recorded sales yet.</div>}
        <p className="text-xs text-muted-foreground">Values are calculated from all pages of the signed-in tenant and active specialist, not a top-100 sample. Recorded sales value comes from the sales ledger; order value is not called realised revenue. A refresh performs fresh server requests.</p>
      </>}
    </div>
  );
}
