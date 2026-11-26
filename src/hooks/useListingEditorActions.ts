import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSupabaseClientAsync, callEdgeFunction, EdgeFunctionError } from '@/lib/supabase';
import { activateModuleScope } from '@/lib/moduleScope';
import { publicationBlock } from '@/lib/listingReadiness';
import { checkSharedListingStatus, recoverSharedPendingPublication, endSharedEbayListing } from '@/lib/listingStatusRecovery';
import { readAcceptedPublication, retainAcceptedPublication, clearAcceptedPublication } from '@/lib/acceptedPublication';
import { listingClarification, type ListingHelp } from '@/lib/listingClarification';
import { listingNicheId, readSubmissionListing, prepareSharedSubmission } from '@/lib/listingSubmission';
import { coinListingCategoryIssue } from '@/lib/listingCoinCategory';
import { completeScanToLive } from '@/lib/scanToLiveTiming';
import { hydrateListingEditor } from '@/lib/listingEditorData';
import { hasLiveSibling } from '@/lib/inventoryLifecycle';
import { asRecord } from '@/lib/itemPhotos';
import { beginRapidPublication, recordRapidPublication, rapidPublicationBlocked } from '@/lib/rapidCoinPublication';
import { reconcileRapidPublication, noteRapidPublishRejection } from '@/lib/rapidPublicationRecovery';
import { confirmedPublishRejection } from '@/lib/listingPublishOutcome';
import { useListingEditorSave } from '@/hooks/useListingEditorSave';
import type { useListingEditorDraft } from '@/hooks/useListingEditorDraft';
import type { EbayAspect } from '@/lib/ebayMusicContract';

export function useListingEditorActions(draft: ReturnType<typeof useListingEditorDraft>, userId: string | undefined, tenantId: string | null, uploads: string[], aspects: EbayAspect[] = []) {
  const saveMutation = useListingEditorSave(userId, tenantId), working = useRef(false), queries = useQueryClient();
  const refreshInventory = () => Promise.all([
    queries.invalidateQueries({ queryKey: ['canonical-inventory'] }), queries.invalidateQueries({ queryKey: ['listings'] }), queries.invalidateQueries({ queryKey: ['items'] }),
  ]);
  const [publishing, setPublishing] = useState(false), [checking, setChecking] = useState(false), [changingStatus, setChangingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null), [pendingExternalId, setPendingExternalId] = useState<string | null>(null);
  const [help, setHelp] = useState<ListingHelp | null>(null), [rapidBlocked, setRapidBlocked] = useState(false);
  const scope = `${userId}:${tenantId}:${draft.form.id || ''}`, currentScope = useRef(scope); currentScope.current = scope;
  const rapid = Boolean(asRecord(draft.item?.attributes)._rapid_capture_id);
  useEffect(() => { currentScope.current = scope; setError(null); setHelp(null); setPendingExternalId(readAcceptedPublication(scope)); return () => { currentScope.current = ''; }; }, [scope]);
  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      if (!rapid || !userId || !tenantId || !draft.form.id) { if (mounted) setRapidBlocked(false); return; }
      void rapidPublicationBlocked(userId, tenantId, String(draft.form.id)).then(blocked => { if (mounted) setRapidBlocked(blocked); }, () => { if (mounted) setRapidBlocked(true); });
    };
    refresh(); window.addEventListener('swish-rapid-change', refresh);
    return () => { mounted = false; window.removeEventListener('swish-rapid-change', refresh); };
  }, [scope, rapid]);
  const isCurrent = () => currentScope.current === scope;
  const busy = publishing || checking || changingStatus || saveMutation.isPending;
  const message = (cause: unknown) => cause instanceof EdgeFunctionError ? cause.displayMessage : cause instanceof Error ? cause.message : 'SWISH could not complete the request.';
  const saveCurrent = async () => {
    const edits = draft.editRef.current, id = draft.formRef.current.id;
    const saved = await saveMutation.mutateAsync({ form: draft.formRef.current, item: draft.item, photos: draft.photos, uploads, aspects });
    if (draft.editRef.current !== edits || draft.formRef.current.id !== id) throw new Error('The draft changed while saving. Your newer edits have been kept; submit again when ready.');
    draft.commit(saved.listing, saved.item); return hydrateListingEditor(saved.listing, saved.item);
  };
  // Clean reopened drafts do not need a redundant editor RPC, but both saved versions must match.
  const readCleanSavedDraft = async (client: Awaited<ReturnType<typeof getSupabaseClientAsync>>, listing: Record<string, unknown>) => {
    if (!client || !tenantId || !draft.item) throw new Error('The saved draft and stock are unavailable. Reload before submitting.');
    const stock = await client.from('items').select('*').eq('id', listing.item_id).eq('tenant_id', tenantId).single();
    if (stock.error || !stock.data) throw new Error(stock.error?.message || 'Saved stock could not be checked. No eBay submission was requested.');
    if (String(listing.item_id) !== String(draft.item.id) || String(stock.data.tenant_id) !== tenantId || !listing.updated_at || !draft.formRef.current.updated_at || !stock.data.updated_at || !draft.item.updated_at || String(listing.updated_at) !== String(draft.formRef.current.updated_at) || String(stock.data.updated_at) !== String(draft.item.updated_at)) throw new Error('This saved draft changed since it was opened. Refresh it and check the current category and condition before submitting.');
    const saved = hydrateListingEditor(listing, stock.data), keys = ['title', 'description', 'price', 'category_id', 'condition', 'condition_id', 'condition_description', 'quantity', 'sku'];
    if (keys.some(key => String(saved[key] ?? '') !== String(draft.formRef.current[key] ?? ''))) throw new Error('Saved category, condition or listing text differs from the open editor. Refresh the existing draft before submitting.');
    return saved;
  };
  const save = async () => {
    if (working.current || busy) return false; working.current = true; setError(null);
    try { await saveCurrent(); if (rapid && userId && tenantId) await recordRapidPublication(userId, tenantId, String(draft.form.id), 'draft_saved'); toast.success('Listing saved'); return true; }
    catch (cause) { if (isCurrent()) setError(message(cause)); toast.error(message(cause)); return false; }
    finally { working.current = false; }
  };
  const publish = async (): Promise<boolean> => {
    if (working.current || busy || !userId || !tenantId || !draft.item || !draft.formRef.current.id) return false;
    const accepted = readAcceptedPublication(scope);
    if (accepted || pendingExternalId) { setPendingExternalId(accepted || pendingExternalId); toast.info('eBay already accepted this listing. Refresh its status; do not submit again.'); return false; }
    const id = String(draft.formRef.current.id), nicheId = listingNicheId(draft.item);
    let acceptedExternalId = '', rapidAttempted = false, rejected = false;
    working.current = true; setPublishing(true); setError(null); setHelp(null);
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected.');
      await activateModuleScope(client, userId, tenantId, nicheId);
      if (rapid && await rapidPublicationBlocked(userId, tenantId, id)) {
        const retry = await reconcileRapidPublication({ client, userId, tenantId, nicheId, listingId: id });
        if (isCurrent()) setRapidBlocked(retry.blocked);
        if (retry.blocked) throw new Error(retry.message);
      }
      // The exact physical stock ID, not its title, owns every intended publication.
      const siblings = await client.from('listings').select('id,status,external_listing_id').eq('tenant_id', tenantId).eq('item_id', draft.item.id).eq('marketplace_id', 'ebay');
      if (siblings.error) throw new Error('Cannot check whether this item is already live on eBay. No new submission was sent.');
      if (hasLiveSibling(siblings.data || [], id)) throw new Error('This stock item already has a recorded live eBay listing. Open Live inventory or refresh its status; do not submit this older draft again.');
      const before = await readSubmissionListing(client, tenantId, id);
      if (publicationBlock(before)) { if (!draft.dirtyRef.current) draft.commit(before); throw new Error(publicationBlock(before)!); }
      if (before.publish_claim_id) throw new Error('SWISH is already processing this submission. Use Refresh status rather than submitting again.');
      const categoryIssue = coinListingCategoryIssue(draft.formRef.current, draft.item);
      if (categoryIssue) throw new Error(categoryIssue);
      const form = draft.dirtyRef.current ? await saveCurrent() : await readCleanSavedDraft(client, before);
      const savedCategoryIssue = coinListingCategoryIssue(form, draft.item);
      if (savedCategoryIssue) throw new Error(savedCategoryIssue);
      const current = await prepareSharedSubmission(client, tenantId, id);
      if (!isCurrent()) throw new Error('The open listing changed. No eBay request was sent.');
      if (rapid) rapidAttempted = await beginRapidPublication(userId, tenantId, id);
      const result = await callEdgeFunction<Record<string, unknown>>('swish-ebay-list', { route: 'publish', tenantId, nicheId, listingId: id, listingType: form.listing_type || 'FixedPriceItem', auctionDays: Number(form.auction_duration || 7), startPrice: Number(form.start_price || form.price), reservePrice: Number(form.reserve_price || 0) || undefined, categoryId: String(current.category_id || form.category_id || ''), conditionId: String(form.condition_id || ''), mediaUrls: draft.photos }, client);
      const acceptedBody = result.error ? asRecord(result.error.body) : asRecord(result.data);
      const returnedId = String(acceptedBody.externalListingId || acceptedBody.external_listing_id || acceptedBody.itemId || '');
      if (/^\d{6,20}$/.test(returnedId) && (acceptedBody.success === true || acceptedBody.accepted === true)) {
        acceptedExternalId = returnedId; retainAcceptedPublication(scope, returnedId);
        if (rapid) await recordRapidPublication(userId, tenantId, id, 'accepted_pending', returnedId);
      }
      rejected = !acceptedExternalId && confirmedPublishRejection(result.error?.status ?? 200, acceptedBody);
      if (result.error) throw result.error;
      const externalId = String(result.data?.externalListingId || result.data?.external_listing_id || '');
      if (result.data?.success !== true || !/^\d{6,20}$/.test(externalId)) throw new Error(String(result.data?.error || 'eBay did not confirm a listing ID. Check status before trying again.'));
      acceptedExternalId = externalId; retainAcceptedPublication(scope, externalId);
      if (!isCurrent()) return false;
      setPendingExternalId(externalId);
      let fresh = await readSubmissionListing(client, tenantId, id);
      if (String(fresh.external_listing_id || '') === externalId && fresh.status === 'active') {
        const stock = await client.from('items').select('status,sold_at').eq('id', draft.item.id).eq('tenant_id', tenantId).single();
        if (stock.error || !stock.data || stock.data.sold_at || !['listed', 'active'].includes(String(stock.data.status).toLowerCase())) {
          try { fresh = await checkSharedListingStatus({ client, userId, tenantId, nicheId, listingId: id }); } catch { /* Keep the accepted identity, never replay AddItem. */ }
        }
      } else if (String(fresh.external_listing_id || '') === externalId) {
        try { fresh = await checkSharedListingStatus({ client, userId, tenantId, nicheId, listingId: id }); } catch { /* Preserve acceptance for safe recovery. */ }
      }
      if (String(fresh.external_listing_id || '') !== externalId || fresh.status !== 'active') throw new Error('eBay accepted this listing, but SWISH has not yet confirmed Active status. Do not submit again; use Refresh status.');
      const stock = await client.from('items').select('status,sold_at').eq('id', draft.item.id).eq('tenant_id', tenantId).single();
      const reconciled = !stock.error && Boolean(stock.data && !stock.data.sold_at && ['listed','active'].includes(String(stock.data.status).toLowerCase()));
      if (!isCurrent()) return false;
      draft.commit(fresh);
      if (reconciled) {
        if (rapid) await recordRapidPublication(userId, tenantId, id, 'published', externalId);
        clearAcceptedPublication(scope); setPendingExternalId(null); completeScanToLive(`${userId}:${tenantId}:${id}`, externalId);
        toast.success('Listing is live on eBay and SWISH inventory is updated');
      } else toast.warning('eBay listing is Active, but SWISH stock reconciliation is pending. Refresh status; do not submit again.');
      void refreshInventory().catch(() => undefined); void draft.refresh().catch(() => undefined);
      return reconciled;
    } catch (cause) {
      if (rapid && rapidAttempted && !acceptedExternalId) {
        if (rejected) await noteRapidPublishRejection(userId, tenantId, id, message(cause)).catch(() => undefined);
        else await recordRapidPublication(userId, tenantId, id, 'uncertain').catch(() => undefined);
        if (isCurrent()) setRapidBlocked(true);
      }
      const detail = message(cause), safeError = acceptedExternalId ? `eBay accepted listing ${acceptedExternalId}, but SWISH has not confirmed its listing and stock state. ${detail} Do not submit again; use Refresh status to reconcile the existing listing.` : detail;
      if (!isCurrent()) return false;
      const body = cause instanceof EdgeFunctionError ? asRecord(cause.body) : {};
      setHelp(listingClarification(safeError, { ...body, accepted: Boolean(acceptedExternalId) || body.accepted })); setError(safeError); toast.error(safeError);
      void draft.refresh().catch(() => undefined);
      return false;
    } finally { working.current = false; setPublishing(false); }
  };
  const checkStatus = async () => {
    if (working.current || busy || !userId || !tenantId || !draft.item || !draft.form.id) return;
    const accepted = pendingExternalId || readAcceptedPublication(scope);
    if (accepted && (!draft.form.external_listing_id || draft.form.publish_claim_id)) { await recoverPending(accepted); return; }
    const id = String(draft.form.id), nicheId = listingNicheId(draft.item);
    working.current = true; setChecking(true);
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected.');
      const fresh = await checkSharedListingStatus({ client, userId, tenantId, nicheId, listingId: id });
      if (accepted && (fresh.status !== 'active' || String(fresh.external_listing_id) !== accepted)) throw new Error(`eBay accepted listing ${accepted}, but SWISH has not yet retained its live identity and inventory state. Do not submit again; refresh status shortly.`);
      if (!isCurrent()) return;
      if (!draft.dirtyRef.current) draft.commit(fresh);
      await refreshInventory(); await draft.refresh();
      if (!isCurrent()) return;
      setError(null); setHelp(null);
      if (['active', 'sold', 'ended'].includes(String(fresh.status)) && fresh.external_listing_id) {
        if (rapid) await recordRapidPublication(userId, tenantId, id, 'published', String(fresh.external_listing_id));
        clearAcceptedPublication(scope); setPendingExternalId(null);
        if (fresh.status === 'active') completeScanToLive(`${userId}:${tenantId}:${id}`, String(fresh.external_listing_id));
      }
      if (rapid && !fresh.external_listing_id && !fresh.publish_claim_id) {
        const retry = await reconcileRapidPublication({ client, userId, tenantId, nicheId, listingId: id });
        if (!isCurrent()) return;
        setRapidBlocked(retry.blocked);
        if (retry.blocked) { setError(retry.message); setHelp(listingClarification(retry.message, { publicationUnconfirmed: true })); toast.info(retry.message); return; }
        toast.success(retry.message || 'Saved draft checked. Review and submit when ready.');
      } else if (fresh.publish_claim_id && !fresh.external_listing_id) toast.info('SWISH still retains the original claim. Use eBay sync; link an item number only if eBay actually created it. Nothing was resent.');
      else toast.success(fresh.external_listing_id ? 'Existing eBay listing checked' : 'Saved status checked. Submit when ready.');
    } catch (cause) { if (isCurrent()) setError(message(cause)); toast.error(message(cause)); }
    finally { working.current = false; setChecking(false); }
  };
  const setManualStatus = async (status: 'draft' | 'active' | 'sold' | 'ended') => {
    if (status !== 'ended') { await checkStatus(); return; }
    if (working.current || busy || draft.dirtyRef.current || !userId || !tenantId || !draft.item || !draft.form.id) return;
    working.current = true; setChangingStatus(true);
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected.');
      const fresh = await endSharedEbayListing({ client, userId, tenantId, nicheId: listingNicheId(draft.item), listingId: String(draft.form.id) });
      if (isCurrent()) { draft.commit(fresh); setError(null); await refreshInventory(); toast.success('eBay confirmed the listing has ended'); }
    } catch (cause) { if (isCurrent()) { setError(message(cause)); toast.error(message(cause)); } }
    finally { working.current = false; setChangingStatus(false); }
  };
  const recoverPending = async (externalListingId: string) => {
    if (working.current || !userId || !tenantId || !draft.item || !draft.form.id) return;
    const listingId = String(draft.form.id), nicheId = listingNicheId(draft.item); working.current = true; setChecking(true);
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected.');
      const fresh = await recoverSharedPendingPublication({ client, userId, tenantId, nicheId, listingId, externalListingId });
      if (!isCurrent()) return;
      if (!draft.dirtyRef.current && draft.formRef.current.id === listingId) draft.commit(fresh);
      if (rapid) await recordRapidPublication(userId, tenantId, listingId, 'published', externalListingId);
      clearAcceptedPublication(scope); setPendingExternalId(null); setError(null); setHelp(null);
      toast.success('Existing eBay listing and SWISH inventory reconciled'); await refreshInventory(); await draft.refresh();
    } catch (cause) { if (isCurrent()) setError(message(cause)); toast.error(message(cause)); }
    finally { working.current = false; setChecking(false); }
  };
  const retainedId = pendingExternalId || readAcceptedPublication(scope);
  const pendingReason = retainedId ? `eBay accepted listing ${retainedId}, but SWISH is still reconciling the saved listing and stock state. Do not submit again; use Refresh status.` : draft.form.publish_claim_id ? 'SWISH is still checking the original eBay submission. Refresh status or link its existing item number; do not submit again.' : rapidBlocked ? 'The rapid queue retains an earlier attempt. Refresh status to check its server claim and unlock this same draft when safe.' : null;
  const categoryIssue = coinListingCategoryIssue(draft.form, draft.item);
  return { publishing, checking, changingStatus, setManualStatus, busy, saving: saveMutation.isPending, reason: pendingReason || publicationBlock(draft.form) || categoryIssue, publicationExternalId: retainedId || String(draft.form.external_listing_id || ''), error, help, save, publish, checkStatus, recoverPending, canPublish: Boolean(userId && tenantId && draft.item && draft.form.id && !busy && !retainedId && !rapidBlocked && !draft.form.publish_claim_id && !publicationBlock(draft.form) && !categoryIssue) };
}
