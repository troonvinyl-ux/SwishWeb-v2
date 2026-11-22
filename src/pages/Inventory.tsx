import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTable } from '@/hooks/useSupabaseQuery';
import { Package, Search, Plus, RefreshCw, AlertTriangle, Archive, Pencil, Store, CheckCircle2, Coins, Info } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { checkSharedListingStatus } from '@/lib/listingStatusRecovery';
import { resolvedInventoryListings } from '@/lib/inventoryLifecycle';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { getActiveNicheId, getSpecialistIdsForNiche } from '@/lib/niche';
import { asRecord } from '@/lib/itemPhotos';
import InventoryCard from '@/components/features/InventoryCard';
import type { InventoryTab } from '@/types/inventory';
const TABS = [{ id: 'stock', label: 'In Stock', icon: Archive }, { id: 'draft', label: 'Draft', icon: Pencil }, { id: 'live', label: 'Live', icon: Store }, { id: 'sold', label: 'Sold', icon: CheckCircle2 }] as const;
export default function Inventory() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const [checkingId, setCheckingId] = useState(''), [checkError, setCheckError] = useState('');
  const tab: InventoryTab = TABS.some(value => value.id === params.get('tab')) ? params.get('tab') as InventoryTab : 'stock';
  const setTab = (value: InventoryTab) => { const next = new URLSearchParams(params); next.set('tab', value); setParams(next, { replace: true }); };
  const [search, setSearch] = useState(params.get('q') || ''), qc = useQueryClient();
  const externalSearch = params.get('q') || '';
  useEffect(() => { setSearch(externalSearch); }, [externalSearch]);
  const tenant = useCurrentTenantId(), tenantId = tenant.tenantId, niche = getActiveNicheId();
  const specialistIds = getSpecialistIdsForNiche(niche);
  const stockQuery = useTable('items', { order: { column: 'created_at', ascending: false }, filter: { tenant_id: tenantId }, inFilter: { specialist_id: specialistIds }, allPages: true, enabled: Boolean(tenantId) && specialistIds.length > 0 });
  const listingsQuery = useTable('listings', { select: '*, items!inner(id, specialist_id, canonical_title, media, attributes, condition)', order: { column: 'created_at', ascending: false }, filter: { tenant_id: tenantId, marketplace_id: 'ebay' }, inFilter: { 'items.specialist_id': specialistIds }, allPages: true, enabled: Boolean(tenantId) && specialistIds.length > 0 });
  const allStock = stockQuery.data || [], allListings = listingsQuery.data || [];
  const sold = allStock.filter(row => row.status === 'sold');
  const { draft: drafts, live } = resolvedInventoryListings(allListings);
  const listedIds = new Set(allListings.filter(row => !['ended', 'failed', 'cancelled', 'deleted'].includes(String(row.status).toLowerCase())).map(row => String(row.item_id || '')));
  const stock = allStock.filter(row => row.status !== 'sold' && !listedIds.has(String(row.id)));
  const counts: Record<InventoryTab, number> = { stock: stock.length, draft: drafts.length, live: live.length, sold: sold.length };
  const physicalItems = useMemo(() => new Map(allStock.map(row => [String(row.id), row])), [allStock]);
  const visible = useMemo(() => {
    const base = tab === 'stock' ? stock : tab === 'draft' ? drafts : tab === 'live' ? live : sold;
    const query = search.trim().toLowerCase();
    return base.filter(row => !query || [row.canonical_title, row.title, row.listing_title, row.name, asRecord(row.items).canonical_title, row.sku].some(value => String(value || '').toLowerCase().includes(query)));
  }, [tab, stock, drafts, live, sold, search]);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['items'] }); void qc.invalidateQueries({ queryKey: ['listings'] }); };
  const checkEbayStatus = async (listingId: string) => {
    if (!user || !tenantId || checkingId) return;
    setCheckingId(listingId); setCheckError('');
    try {
      const client = await getSupabaseClientAsync();
      if (!client) throw new Error('SWISH is not connected.');
      const checked = await checkSharedListingStatus({ client, userId: user.id, tenantId, nicheId: niche, listingId });
      if (getActiveNicheId() !== niche) throw new Error('Workspace changed while checking eBay status.');
      await Promise.all(['items', 'listings'].map(table => qc.invalidateQueries({ queryKey: [table] })));
      if (!checked.external_listing_id) throw new Error('There is no saved eBay listing ID to check. Find the seller listing under eBay Import and link it to the correct item.');
      if (checked.status !== 'active') setCheckError(`eBay confirmed this listing is ${String(checked.status)}. Check its recorded inventory status before taking further action.`);
    } catch (reason) { setCheckError(reason instanceof Error ? reason.message : 'Status check unavailable. Do not submit this item twice.'); }
    finally { setCheckingId(''); }
  };
  const loading = tenant.isLoading || stockQuery.isLoading || listingsQuery.isLoading;
  const error = tenant.error || stockQuery.error || listingsQuery.error;
  const noun = niche === 'coins' ? 'coins' : 'items';
  return <div className="swish-inventory-page animate-fade-in">
    <header className="swish-inventory-header"><div className="swish-inventory-mark">{niche === 'coins' ? <Coins size={24} /> : <Package size={24} />}</div><div className="min-w-0 flex-1"><h1>{niche === 'coins' ? 'Coins Inventory' : niche === 'clothing' ? 'Fashion Inventory' : 'Inventory'}</h1><p>{loading || error ? 'Loading your workspace inventory' : `${allStock.length} unique items · ${counts.live} live · ${counts.sold} sold`}</p></div><Link to="/ebay/import" className="btn-secondary min-h-11" aria-label="Import existing eBay listings">Import eBay</Link><Link to="/inventory/new" className="swish-inventory-add" aria-label="Add new item"><Plus size={24} /></Link></header>
    <nav className="swish-inventory-tabs" aria-label="Inventory status">{TABS.map(({ id, label, icon: Icon }) => <button key={id} type="button" data-status={id} aria-pressed={tab === id} onClick={() => setTab(id)} className={tab === id ? 'is-selected' : ''}><Icon size={18} /><span>{label}</span><b>{loading || error ? '—' : counts[id]}</b></button>)}</nav>
    <div className="swish-inventory-search"><Search size={20} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${noun}…`} aria-label={`Search ${noun}`} /><button type="button" onClick={refresh} aria-label="Refresh inventory"><RefreshCw size={20} /></button></div>
    {!loading && !error && <p className="text-muted-foreground text-sm mb-4">{TABS.find(value => value.id === tab)?.label} · {visible.length} {noun} · Newest first</p>}
    {tab === 'draft' && drafts.length > 0 && <div className="swish-inventory-info"><Info size={18} /><span>These drafts are not confirmed live in SWISH. If an item is already on eBay, check its saved listing status or import and link the existing seller listing before submitting again.</span></div>}
    {checkError && <div role="alert" className="swish-inventory-info"><AlertTriangle size={18}/><span>{checkError}</span></div>}
    {tab === 'live' && live.length > 0 && <div className="swish-inventory-info is-live"><Store size={18} /><span>{live.length} listings live on eBay</span></div>}
    <section className="swish-inventory-list" aria-live="polite">{loading ? <div className="swish-inventory-empty">Loading inventory…</div> : error ? <div className="swish-inventory-empty" role="alert"><AlertTriangle size={28} /><strong>Could not load inventory</strong><span>{error.message}</span><button type="button" className="btn-secondary" onClick={refresh}>Try again</button></div> : !visible.length ? <div className="swish-inventory-empty"><Package size={40} /><strong>{search ? 'No matching items' : `No ${tab === 'stock' ? 'stock items' : tab === 'draft' ? 'draft listings' : tab === 'live' ? 'live listings' : 'sold items'} found`}</strong><span>{search ? 'Try another title or reference.' : 'Your saved workspace records will appear here.'}</span>{tab === 'stock' && <Link className="swish-inventory-empty-cta" to="/inventory/new"><Plus size={18} />Add an item</Link>}</div> : visible.map(row => {
      const item = row.item_id ? physicalItems.get(String(row.item_id)) || asRecord(row.items) : row;
      return <InventoryCard key={String(row.id)} row={row} item={item} tab={tab} onCheckListing={checkEbayStatus} checkingId={checkingId} />;
    })}</section>
  </div>;
}
