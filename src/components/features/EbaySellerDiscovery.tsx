import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Download, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { getActiveNicheId } from '@/lib/niche';
import { checkSharedListingStatus } from '@/lib/listingStatusRecovery';
import { discoverEbayInventory, importDiscoveredEbayListing, repairVerifiedEbaySellerLinks, type SellerDiscovery, type SellerBindingRepairProgress } from '@/lib/ebaySellerImport';

interface Props { tenantId: string | null }
const explanation = (error: unknown) => error instanceof Error ? error.message : 'Seller listings could not be checked.';
/** Explicit, read-first eBay discovery; never publishes or guesses a draft-to-eBay identity. */
export default function EbaySellerDiscovery({ tenantId }: Props) {
  const { user } = useAuth(), qc = useQueryClient(), niche = getActiveNicheId();
  const [discovery, setDiscovery] = useState<SellerDiscovery | null>(null);
  const [busy, setBusy] = useState(false), [importing, setImporting] = useState(''), [repairing, setRepairing] = useState(false);
  const [repairState, setRepairState] = useState<{scope:string;summary:SellerBindingRepairProgress;complete:boolean}|null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [scope, setScope] = useState('');
  const scopeKey = `${user?.id || ''}:${tenantId || ''}:${niche}`, relevant = scope === scopeKey;
  const shownRepair = repairState?.scope===scopeKey ? repairState : null;
  const repairAll = async () => {
    if(busy||repairing||importing||!tenantId||!user||niche!=='coins')return;
    setRepairing(true);setError('');setNotice('');setRepairState(null);
    try{
      const client=await getSupabaseClientAsync();
      if(!client)throw new Error('SWISH backend is unavailable.');
      const result=await repairVerifiedEbaySellerLinks(client,user.id,tenantId,niche,summary=>{
        if(getActiveNicheId()===niche)setRepairState({scope:scopeKey,summary,complete:false});
      });
      if(getActiveNicheId()!==niche)return;
      setRepairState({scope:scopeKey,summary:result,complete:true});
      await Promise.all(['items','listings','canonical-inventory'].map(queryKey=>qc.invalidateQueries({queryKey:[queryKey]})));
      setNotice(`Verified seller ${result.verifiedSeller}: ${result.updated} linked coin records repaired; ${result.alreadyLinked} already correct; ${result.conflicts} ownership conflicts; ${result.unlinked} eBay records not in SWISH. No listings, prices, inventory status or photos were changed.`);
    }catch(reason){setError(explanation(reason)+' Any earlier confirmed repair pages remain saved; you can safely re-run the same eBay read.');}
    finally{setRepairing(false);}
  };
  const scan = async () => {
    if (busy || repairing || importing || !tenantId || !user) return;
    setBusy(true); setError(''); setNotice(''); setDiscovery(null); setSelected({}); setCompleted(new Set());
    try {
      const client = await getSupabaseClientAsync();
      if (!client) throw new Error('SWISH is not connected.');
      const result = await discoverEbayInventory(client, user.id, tenantId, niche);
      if (getActiveNicheId() !== niche) throw new Error('Workspace changed during discovery. Reopen the correct niche.');
      setDiscovery(result); setScope(scopeKey);
      setNotice(`Found ${result.candidates.length} unlinked active eBay listing(s) for this niche. Nothing was imported automatically.`);
    } catch (reason) { setError(explanation(reason)); }
    finally { setBusy(false); }
  };
  const take = async (itemId: string) => {
    if (!relevant || !discovery || !user || !tenantId || busy || repairing || importing || completed.has(itemId)) return;
    const candidate = discovery.candidates.find(row => row.listing.itemId === itemId);
    if (!candidate) return;
    const chosen = selected[itemId] || '';
    if (candidate.matches.length && (!chosen || !candidate.matches.some(item => item.id === chosen))) {
      setError('This eBay listing matches saved SWISH stock. Choose the correct existing item explicitly; do not create a duplicate.');
      return;
    }
    setError(''); setNotice(''); setImporting(itemId);
    try {
      if (getActiveNicheId() !== niche) throw new Error('The specialist changed. Reopen the correct workspace.');
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH is not connected.');
      const result = await importDiscoveredEbayListing(client, user.id, tenantId, niche, candidate.listing, chosen || undefined);
      setCompleted(previous => new Set([...previous, itemId]));
      await Promise.all(['items', 'listings'].map(table => qc.invalidateQueries({ queryKey: [table] })));
      try {
        const fresh = await checkSharedListingStatus({ client, userId: user.id, tenantId, nicheId: niche, listingId: result.listingId });
        if (String(fresh.status).toLowerCase() !== 'active') throw new Error('The live status still needs review.');
        setNotice(`eBay listing ${itemId} is linked to SWISH stock and the live status was confirmed.`);
      } catch {
        setNotice(`eBay listing ${itemId} was linked and saved, but live stock reconciliation needs another status check. Do not import it again; use Update linked listings.`);
      }
    } catch (reason) { setError(explanation(reason)); }
    finally { setImporting(''); }
  };
  const available = relevant && discovery ? discovery.candidates.filter(row => !completed.has(row.listing.itemId)) : [];
  return <section className="swish-card space-y-4 p-4 sm:p-5" aria-label="Discover listings from the connected eBay account">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Import listings already on eBay</h2><p className="mt-1 text-sm text-muted-foreground">Read listings from your connected seller account, including records created outside SWISH. Imports go into the same inventory and stay in the correct specialist. This does not submit or relist anything.</p></div>
      <button type="button" onClick={() => void scan()} disabled={!tenantId || !user || busy || repairing || Boolean(importing)} className="btn-secondary min-h-11"><RefreshCw size={18} className={busy ? 'animate-spin' : ''}/>{busy ? 'Checking eBay…' : 'Find unlinked eBay listings'}</button>
    </div>
    {niche==='coins' && <div className="rounded-xl border border-border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary min-h-11" disabled={!user||!tenantId||busy||repairing||Boolean(importing)}
          onClick={()=>void repairAll()}>
          <RefreshCw size={17} className={repairing?'animate-spin':''}/>
          {repairing?'Reading seller listings & repairing…':'Re-import & Repair eBay Links'}
        </button>
        <p className="text-xs text-muted-foreground flex-1">Automatically matches existing Coins by exact eBay item number and fills the verified member, account and binding IDs. Includes active, sold and unsold eBay pages. No relisting or manual row editing.</p>
      </div>
      {shownRepair && <p role="status" className="text-xs text-muted-foreground">
        Seller: {shownRepair.summary.verifiedSeller} · {shownRepair.summary.section} page {shownRepair.summary.page}/{shownRepair.summary.totalPages} ·
        {' '}{shownRepair.summary.updated} repaired · {shownRepair.summary.alreadyLinked} correct · {shownRepair.summary.conflicts} conflicts · {shownRepair.summary.unlinked} unlinked
        {shownRepair.complete?' · Finished':''}
      </p>}
    </div>}
    {error && <p role="alert" className="text-sm text-destructive flex gap-2"><AlertCircle size={18}/>{error}</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {relevant && discovery && <div className="space-y-3">
      <p className="text-sm text-muted-foreground">eBay active: {discovery.activeReported ?? 'not reported'} · Fetched active: {discovery.activeFetched} · SWISH linked: {discovery.existing} (in the checked response) · {discovery.ignoredNotActive} not confirmed active · {discovery.excludedForReview} excluded for classification review. {discovery.truncated ? 'The seller response reached its 400-listing limit; not all listings may have been checked.' : ''}</p>
      {!available.length && <p className="text-sm text-muted-foreground">No new active listings ready for import in this checked niche.</p>}
      {available.map(({ listing, matches }) => <article key={listing.itemId} className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex flex-wrap justify-between gap-2"><div><strong className="text-sm">{listing.title}</strong><p className="text-xs text-muted-foreground">eBay #{listing.itemId} · {listing.categoryName || 'Category not named'} · Active · £{listing.price.toFixed(2)}</p></div></div>
        {matches.length > 0 && <div><label htmlFor={`ebay-match-${listing.itemId}`} className="text-sm">Existing SWISH item with this title — choose which record to link</label><select id={`ebay-match-${listing.itemId}`} value={selected[listing.itemId] || ''} className="input-field mt-1" onChange={event => setSelected(previous => ({ ...previous, [listing.itemId]: event.target.value }))}><option value="">Choose a stock item (required)</option>{matches.map(match => <option key={match.id} value={match.id}>{match.title} · {match.status}</option>)}</select><p className="text-xs text-muted-foreground mt-1">No automatic title-based merging. The selected existing item will be linked using the canonical atomic import.</p></div>}
        <button type="button" className="btn-primary min-h-11" disabled={Boolean(importing) || busy || (matches.length > 0 && !selected[listing.itemId])} onClick={() => void take(listing.itemId)}><Download size={16}/>{importing === listing.itemId ? 'Saving link…' : matches.length ? 'Link chosen stock to eBay' : 'Import to inventory'}</button>
      </article>)}
      {completed.size > 0 && <p className="text-sm text-success flex gap-2"><CheckCircle2 size={18}/>{completed.size} seller listing(s) linked during this review. Refresh the inventory to see their status.</p>}
      <p className="text-xs text-muted-foreground">Listings that cannot be classified to this niche are not silently imported. Select the correct specialist before running discovery again. Category and seller price are imported as source facts, not as AI grades or independent valuations.</p>
    </div>}
  </section>;
}
