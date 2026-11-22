import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Package, Search, Plus, RefreshCw, AlertTriangle, Archive, Pencil, Store, CheckCircle2, Coins, Info, ArrowDownUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { readNativeInventory } from '@/lib/inventoryNativeRead';
import { INVENTORY_ORDERS, orderInventory, searchInventory, type CanonicalTab, type InventoryOrder } from '@/lib/inventoryNative';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { getActiveNicheId, getSpecialistIdsForNiche } from '@/lib/niche';
import InventoryCard from '@/components/features/InventoryCard';

const TABS = [
  { id: 'stock', label: 'In Stock', icon: Archive },
  { id: 'draft', label: 'Draft', icon: Pencil },
  { id: 'live', label: 'Live', icon: Store },
  { id: 'sold', label: 'Sold', icon: CheckCircle2 },
] as const;

export default function Inventory() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const tenant = useCurrentTenantId();
  const tenantId = tenant.tenantId, niche = getActiveNicheId();
  const specialists = getSpecialistIdsForNiche(niche);
  const scope = [user?.id, tenantId, niche].join(':');
  const tab: CanonicalTab = TABS.some(value => value.id === params.get('tab'))
    ? params.get('tab') as CanonicalTab : 'stock';
  const setTab = (value: CanonicalTab) => {
    const next = new URLSearchParams(params); next.set('tab', value); setParams(next, { replace: true });
  };
  const [search, setSearch] = useState({ scope, text: params.get('q') || '' });
  const [sort, setSort] = useState<InventoryOrder>('newest');
  const externalSearch = params.get('q') || '';
  useEffect(() => { setSearch({ scope, text: externalSearch }); }, [scope, externalSearch]);
  const query = useQuery({
    queryKey: ['canonical-inventory', user?.id, tenantId, niche],
    enabled: Boolean(user?.id && tenantId && specialists.length),
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
    queryFn: async ({ signal }) => {
      const client = await getSupabaseClientAsync();
      if (!client || !user?.id || !tenantId) throw new Error('Your SWISH account is not connected.');
      return readNativeInventory(client, user.id, tenantId, niche, specialists, signal);
    },
  });
  const entries = query.data?.entries || [], counts = query.data?.counts;
  const effectiveSearch = search.scope === scope ? search.text : '';
  const visible = useMemo(() => orderInventory(searchInventory(
    entries.filter(entry => entry.tab === tab), effectiveSearch,
  ), sort), [entries, tab, effectiveSearch, sort]);
  const refresh = () => { void query.refetch(); };
  const loading = tenant.isLoading || query.isPending;
  const error = tenant.error || query.error;
  const noun = niche === 'coins' ? 'coins' : 'items';
  return <div className="swish-inventory-page animate-fade-in">
    <header className="swish-inventory-header">
      <div className="swish-inventory-mark">{niche === 'coins' ? <Coins size={24}/> : <Package size={24}/>}</div>
      <div className="min-w-0 flex-1">
        <h1>{niche === 'coins' ? 'Coins Inventory' : niche === 'clothing' ? 'Fashion Inventory' : 'Inventory'}</h1>
        <p>{loading || error || !counts ? 'Verifying canonical SWISH inventory' :
          counts.total + ' unique items · ' + counts.live + ' live · ' + counts.sold + ' sold'}</p>
      </div>
      <Link to="/ebay/import" className="btn-secondary min-h-11" aria-label="Import existing eBay listings">Import eBay</Link>
      <Link to="/inventory/new" className="swish-inventory-add" aria-label="Add new item"><Plus size={24}/></Link>
    </header>
    <nav className="swish-inventory-tabs" aria-label="Inventory status">
      {TABS.map(({ id, label, icon: Icon }) => <button key={id} type="button"
        data-status={id} aria-pressed={tab === id} onClick={() => setTab(id)}
        className={tab === id ? 'is-selected' : ''}>
        <Icon size={18}/><span>{label}</span><b>{loading || error || !counts ? '—' : counts[id]}</b>
      </button>)}
    </nav>
    <div className="swish-inventory-search">
      <Search size={20}/>
      <input value={effectiveSearch} onChange={event => setSearch({ scope, text: event.target.value })}
        placeholder={'Search ' + noun + ', SWISH ID or catalogue…'} aria-label={'Search ' + noun}/>
      <label className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowDownUp size={16}/><span className="sr-only">Inventory order</span>
        <select aria-label="Sort inventory" className="input-field min-w-0" value={sort}
          onChange={e => setSort(e.target.value as InventoryOrder)}>
          {INVENTORY_ORDERS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      <button type="button" onClick={refresh} disabled={query.isFetching} aria-label="Refresh inventory from SWISH">
        <RefreshCw size={20} className={query.isFetching ? 'animate-spin' : ''}/>
      </button>
    </div>
    {!loading && !error && counts && <p className="text-muted-foreground text-sm mb-4">
      {TABS.find(value => value.id === tab)?.label} · {visible.length} matching of {counts[tab]} {noun} ·
      {' '}{INVENTORY_ORDERS.find(option => option.id === sort)?.label}
    </p>}
    {tab === 'draft' && !loading && counts && counts.draft > 0 && <div className="swish-inventory-info">
      <Info size={18}/><span>Drafts are not confirmed live. Use Check eBay where an item ID is saved;
      otherwise review/import the existing seller listing before submitting again.</span>
    </div>}
    {tab === 'live' && !loading && counts && counts.live > 0 && <div className="swish-inventory-info is-live">
      <Store size={18}/><span>{counts.live} unique stock items with a live listing ·
      { ' '}Check eBay reads status without republishing. Suggested-price changes require your click and live readback.</span>
    </div>}
    <section className="swish-inventory-list" aria-live="polite">
      {loading ? <div className="swish-inventory-empty" role="status">Verifying inventory…</div> :
        error ? <div className="swish-inventory-empty" role="alert">
          <AlertTriangle size={28}/><strong>Canonical inventory could not be verified</strong>
          <span>{error.message}</span><button type="button" className="btn-secondary" onClick={refresh}>Try again</button>
        </div> : !visible.length ? <div className="swish-inventory-empty">
          <Package size={40}/><strong>{effectiveSearch ? 'No matching items' :
            'No ' + TABS.find(value => value.id === tab)?.label.toLowerCase() + ' items found'}</strong>
          <span>{effectiveSearch ? 'Try another title, SWISH ID, catalogue or storage location.' :
            'Your canonical OnSpace Cloud inventory will appear here.'}</span>
          {tab === 'stock' && <Link className="swish-inventory-empty-cta" to="/inventory/new">
            <Plus size={18}/>Add an item</Link>}
        </div> : visible.map(entry => <InventoryCard key={entry.id} entry={entry} tenantId={tenantId!} nicheId={niche}/>)}
    </section>
  </div>;
}
