import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, CheckCircle2, AlertTriangle, Tag, Square, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { callEdgeFunction, getSupabaseClientAsync } from '@/lib/supabase';
import { getActiveNicheId } from '@/lib/niche';
import { checkSharedListingStatus, endSharedEbayListing } from '@/lib/listingStatusRecovery';
import { recommendedInventoryPrice, type InventoryEntry } from '@/lib/inventoryNative';
import { reviseSharedListingPrice } from '@/lib/inventoryPriceRevision';

const activeRevisionRequests = new Set<string>();
const uncertainRevisions = new Set<string>();
function useInventoryRefresh() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ['canonical-inventory'] }),
    qc.invalidateQueries({ queryKey: ['items'] }),
    qc.invalidateQueries({ queryKey: ['listings'] }),
  ]);
}
export function ListingStatusAction({ listing, tenantId, nicheId }: {
  listing: Record<string, unknown>; tenantId: string; nicheId: string;
}) {
  const { user } = useAuth(), refresh = useInventoryRefresh();
  const listingId = String(listing.id || ''), ebayId = String(listing.external_listing_id || '');
  const scope = [user?.id, tenantId, nicheId, listingId].join(':');
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const busyRef = useRef(false);
  const [state, setState] = useState<{ scope: string; busy: boolean; notice: string; error: string }>({ scope: '', busy: false, notice: '', error: '' });
  useEffect(() => () => { scopeRef.current = ''; }, []);
  const current = state.scope === scope ? state : { scope, busy: false, notice: '', error: '' };
  const eligible = Boolean(user?.id && tenantId && listingId && /^\d{6,20}$/.test(ebayId));
  const missingBinding = /Verify your own eBay seller account|Legacy tenant connections are not inherited/i.test(current.error);
  const previousBinding = /This record belongs to a previous or unverified eBay account/i.test(current.error);
  const check = async () => {
    if (!eligible || busyRef.current || !user?.id) return;
    busyRef.current = true;
    const captured = scope;
    setState({ scope: captured, busy: true, notice: '', error: '' });
    try {
      const client = await getSupabaseClientAsync();
      if (!client) throw new Error('SWISH backend is unavailable.');
      const fresh = await checkSharedListingStatus({ client, userId: user.id, tenantId, nicheId, listingId });
      if (scopeRef.current !== captured || getActiveNicheId() !== nicheId) return;
      await refresh();
      if (scopeRef.current !== captured) return;
      if (String(fresh.external_listing_id) !== ebayId) throw new Error('The saved eBay identity changed. Review this listing.');
      const status = String(fresh.status || '').toLowerCase();
      setState({ scope: captured, busy: false, error: '', notice: status === 'active' ? 'eBay confirms live; SWISH status reconciled.' :
        'eBay confirms ' + status + '. Inventory refreshed; do not republish.' });
    } catch (error) {
      if (scopeRef.current === captured) setState({ scope: captured, busy: false, notice: '', error:
        error instanceof Error ? error.message : 'Status is unconfirmed. No listing was resubmitted.' });
    } finally { busyRef.current = false; }
  };
  return <div className="min-w-0 max-w-full space-y-1">
    <button type="button" disabled={!eligible || current.busy}
      title={eligible ? 'Read existing eBay listing status; does not submit an item' : 'No verified eBay item ID is saved yet'}
      onClick={() => void check()} className="swish-inventory-submit min-h-10 disabled:opacity-50"
      aria-label={'Check eBay listing status ' + (ebayId || listingId)}>
      <RefreshCw size={15} className={current.busy ? 'animate-spin' : ''}/><span>{current.busy ? 'Checking…' : 'Check eBay'}</span>
    </button>
    {!eligible && <p className="text-xs text-muted-foreground">No linked eBay ID — review the draft, don't submit it again if already live.</p>}
    {current.notice && <p role="status" className="text-xs text-success"><CheckCircle2 size={13} className="inline mr-1"/>{current.notice}</p>}
    {current.error && <div role="alert" className="min-w-0 max-w-full rounded-md border border-destructive/30 p-2 text-xs text-destructive">
      <p className="break-words"><AlertTriangle size={13} className="mr-1 inline"/>{missingBinding
        ? 'This SWISH member has not yet verified their own eBay seller account.'
        : previousBinding
        ? 'This historical eBay listing belongs to a different or unverified account binding. SWISH will not transfer it automatically.'
        : current.error}</p>
      {missingBinding && <Link to="/ebay" className="mt-2 inline-block font-semibold underline underline-offset-2">
        Connect my eBay account
      </Link>}
      {previousBinding && listing.item_id && <Link to={'/inventory/' + encodeURIComponent(String(listing.item_id))}
        className="mt-2 inline-block font-semibold underline underline-offset-2">
        Open inventory item for local-only archive
      </Link>}
    </div>}
  </div>;
}
/**
 * Local-only removal of an historical eBay-linked coin.
 *
 * This uses the existing owner-checked exclude_local_legacy command. It does
 * not contact eBay, end a listing, assign any member's eBay account or
 * permanently erase protected seller/audit history. SWISH moves the physical
 * item to Held and excludes it BEFORE subsequent GetItem sync reads.
 */
export function RemoveFromSwishAction({ entry, tenantId, nicheId }: {
  entry: InventoryEntry; tenantId: string; nicheId: string;
}) {
  const { user } = useAuth(), refresh = useInventoryRefresh();
  const { item, listing } = entry;
  const itemId = String(item.id || entry.id || '');
  const externalId = String(listing?.external_listing_id || '');
  const scope = [user?.id, tenantId, nicheId, itemId, externalId].join(':');
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const busyRef = useRef(false);
  const [state, setState] = useState<{scope:string;busy:boolean;message:string;error:string}>({
    scope:'',busy:false,message:'',error:'',
  });
  useEffect(() => () => { scopeRef.current=''; }, []);
  const current = state.scope===scope ? state : {scope,busy:false,message:'',error:''};
  // This rescue action applies to linked coins, never to orders, sold items,
  // arbitrary listings or another niche. Owner/ledger checks run server-side.
  const eligible = nicheId==='coins' && entry.tab==='live' &&
    Boolean(user?.id && tenantId && itemId && /^\d{6,20}$/.test(externalId)) &&
    !item.sold_at && !['sold','fulfilled','completed','held'].includes(String(item.status||'').toLowerCase());
  const removeLocally = async () => {
    if (!eligible || !user?.id || busyRef.current) return;
    const confirmed = window.confirm(
      'Remove this coin from SWISH Live inventory and future SWISH eBay sync?\n\n' +
      'eBay item: ' + externalId + '\n\n' +
      'NO request will be sent to eBay. SWISH will keep a hidden historical record rather than permanently destroy listing and account history. ' +
      'The workspace owner/admin and sale-history checks must pass.'
    );
    if (!confirmed) return;
    busyRef.current=true;
    const captured=scope;
    setState({scope:captured,busy:true,message:'',error:''});
    try {
      const client=await getSupabaseClientAsync();
      if(!client)throw new Error('SWISH backend is unavailable.');
      const result=await callEdgeFunction<{success?:boolean;archived?:boolean;externalListingId?:string;message?:string;error?:string}>(
        'swish-ebay-sync', {tenantId,nicheId:'coins',mode:'exclude_local_legacy',itemId,externalListingId:externalId},client
      );
      if(result.error)throw new Error(result.error.message);
      if(result.data?.success!==true || result.data.archived!==true ||
         result.data.externalListingId!==externalId)
        throw new Error(result.data?.error || 'Local removal was not confirmed. Nothing was changed on eBay.');
      // Confirm both the Held state and the exact exclusion identity; without
      // both we must not claim the following sync will skip this listing.
      const readback=await client.from('items').select('id,status,attributes')
        .eq('tenant_id',tenantId).eq('id',itemId).maybeSingle();
      if(readback.error || !readback.data ||
         String(readback.data.status).toLowerCase()!=='held' ||
         String(readback.data.attributes?._swish_ebay_sync_excluded||'')!==externalId)
        throw new Error('SWISH accepted local removal but the saved exclusion could not be confirmed. Refresh inventory before repeating.');
      if(scopeRef.current!==captured || getActiveNicheId()!==nicheId)return;
      await refresh();
      if(scopeRef.current===captured)setState({scope:captured,busy:false,
        message:'Removed from Live and future eBay sync. No eBay action was sent.',error:''});
    }catch(cause){
      if(scopeRef.current===captured)setState({scope:captured,busy:false,message:'',
        error:cause instanceof Error?cause.message:'Local removal could not be verified.'});
    }finally{busyRef.current=false;}
  };
  if(!eligible)return null;
  return <div className="min-w-0 max-w-full space-y-1">
    <button type="button" onClick={() => void removeLocally()} disabled={current.busy}
      className="btn-secondary min-h-10 text-xs disabled:opacity-50"
      title="Remove this coin from SWISH Live and eBay sync, with no eBay End/Delete call; retains a hidden history record">
      <Trash2 size={15}/><span>{current.busy?'Removing locally…':'Remove from SWISH only'}</span>
    </button>
    {current.message && <p role="status" className="max-w-full break-words text-xs text-success">{current.message}</p>}
    {current.error && <p role="alert" className="max-w-full break-words text-xs text-destructive">{current.error}</p>}
  </div>;
}

export function InventoryPriceAction({ entry, tenantId, nicheId }: {
  entry: InventoryEntry; tenantId: string; nicheId: string;
}) {
  const { user } = useAuth(), refresh = useInventoryRefresh();
  const listing = entry.listing, recommendation = recommendedInventoryPrice(entry);
  const id = String(listing?.id ?? ''), externalId = String(listing?.external_listing_id ?? '');
  const key = [user?.id, tenantId, nicheId, id].join(':');
  const keyRef = useRef(key); keyRef.current = key;
  const [state, setState] = useState<{ key: string; busy: boolean; message: string; error: string; blocked: boolean }>({
    key: '', busy: false, message: '', error: '', blocked: false,
  });
  useEffect(() => () => { keyRef.current = ''; }, []);
  const current = state.key === key ? state : { key, busy: false, message: '', error: '', blocked: false };
  if (!listing || recommendation === null) return null;
  const blocked = current.blocked || uncertainRevisions.has(key);
  const apply = async () => {
    if (!user?.id || !tenantId || blocked || activeRevisionRequests.has(key) || recommendation === null) return;
    const start = key;
    activeRevisionRequests.add(start);
    setState({ key: start, busy: true, message: '', error: '', blocked: false });
    try {
      const client = await getSupabaseClientAsync();
      if (!client) throw new Error('SWISH backend is unavailable.');
      const result = await reviseSharedListingPrice({
        client, userId: user.id, tenantId, nicheId, listingId: id,
        expectedExternalId: externalId, expectedPrice: Number(listing.price), newPrice: recommendation,
      });
      if (result.unconfirmed) uncertainRevisions.add(start);
      if (keyRef.current !== start || getActiveNicheId() !== nicheId) return;
      if (result.confirmed) await refresh();
      if (keyRef.current === start) setState({ key: start, busy: false, error: result.confirmed ? '' : result.message,
        message: result.confirmed ? result.message : '', blocked: result.unconfirmed });
    } catch (error) {
      // An unknown transport outcome may have reached eBay; never replay it.
      uncertainRevisions.add(start);
      if (keyRef.current === start) setState({ key: start, busy: false, message: '', blocked: true,
        error: (error instanceof Error ? error.message : 'Price change was not confirmed.') + ' Verify the live eBay price before retrying.' });
    } finally { activeRevisionRequests.delete(start); }
  };
  return <div className="space-y-1">
    <button type="button" className="swish-inventory-submit min-h-10"
      disabled={blocked || current.busy} onClick={() => void apply()}
      title={'Change only the eBay seller price from £' + Number(listing.price).toFixed(2) + ' to the saved SWISH recommendation'}
      aria-label={'Apply SWISH recommended price £' + recommendation.toFixed(2)}>
      <Tag size={15}/><span>{current.busy ? 'Updating…' : 'Apply SWISH £' + recommendation.toFixed(2)}</span>
    </button>
    {current.message && <p className="text-xs text-success" role="status">{current.message}</p>}
    {(current.error || blocked) && <p role="alert" className="text-xs text-destructive">
      {current.error || 'Price revision outcome is uncertain. Check live eBay details before retrying; nothing was resent.'}
    </p>}
  </div>;
}

/** Explicit end is the same scoped Edge route used by native SWISH.
 * Only confirmed Ended readbacks cause cache invalidation. */
export function EndEbayListingAction({ listing, tenantId, nicheId }: {
  listing: Record<string, unknown>; tenantId: string; nicheId: string;
}) {
  const { user } = useAuth(), refresh = useInventoryRefresh();
  const [ending, setEnding] = useState(false), [message, setMessage] = useState('');
  const busyRef = useRef(false);
  const id = String(listing.id || '');
  const externalId = String(listing.external_listing_id || '');
  if (!['active', 'live'].includes(String(listing.status || '').toLowerCase()) || !/^\d{6,20}$/.test(externalId)) return null;
  const end = async () => {
    if (!user?.id || !tenantId || busyRef.current) return;
    busyRef.current = true; setEnding(true); setMessage('');
    try {
      const client = await getSupabaseClientAsync();
      if (!client) throw new Error('SWISH backend is unavailable.');
      await endSharedEbayListing({ client, userId: user.id, tenantId, nicheId, listingId: id });
      await refresh();
      setMessage('eBay confirmed Ended; inventory status refreshed.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'eBay End not confirmed; status was retained.');
    } finally { busyRef.current = false; setEnding(false); }
  };
  return <div className="space-y-1">
    <button type="button" disabled={ending} onClick={() => void end()}
      title="End this existing eBay item; never delete SWISH inventory"
      className="btn-ghost min-h-10 text-xs disabled:opacity-50"><Square size={13}/>{ending ? 'Ending…' : 'End on eBay'}</button>
    {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
  </div>;
}
