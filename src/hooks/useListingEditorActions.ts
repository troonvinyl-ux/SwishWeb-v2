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
import { completeScanToLive } from '@/lib/scanToLiveTiming';
import { hydrateListingEditor } from '@/lib/listingEditorData';
import { hasLiveSibling } from '@/lib/inventoryLifecycle';
import { useListingEditorSave } from '@/hooks/useListingEditorSave';
import type { useListingEditorDraft } from '@/hooks/useListingEditorDraft';
import type { EbayAspect } from '@/lib/ebayMusicContract';

export function useListingEditorActions(draft: ReturnType<typeof useListingEditorDraft>, userId: string | undefined, tenantId: string | null, uploads: string[], aspects: EbayAspect[] = []) {
  const saveMutation = useListingEditorSave(userId, tenantId), working = useRef(false);
  const queries = useQueryClient();
  const refreshInventory = () => Promise.all([
    queries.invalidateQueries({ queryKey: ['canonical-inventory'] }),
    queries.invalidateQueries({ queryKey: ['listings'] }),
    queries.invalidateQueries({ queryKey: ['items'] }),
  ]);
  const [publishing, setPublishing] = useState(false), [checking, setChecking] = useState(false), [error, setError] = useState<string | null>(null), [pendingExternalId, setPendingExternalId] = useState<string | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [help, setHelp] = useState<ListingHelp | null>(null);
  const scope = `${userId}:${tenantId}:${draft.form.id || ''}`, currentScope = useRef(scope); currentScope.current = scope;
  useEffect(() => { currentScope.current = scope; setPendingExternalId(readAcceptedPublication(scope)); return () => { currentScope.current = ''; }; }, [scope]);
  const isCurrent = () => currentScope.current === scope;
  const busy = publishing || checking || changingStatus || saveMutation.isPending;
  const message = (cause: unknown) => cause instanceof EdgeFunctionError ? cause.displayMessage : cause instanceof Error ? cause.message : 'SWISH could not complete the request.';
  const saveCurrent = async () => {
    const edits = draft.editRef.current, id = draft.formRef.current.id;
    const saved = await saveMutation.mutateAsync({ form: draft.formRef.current, item: draft.item, photos: draft.photos, uploads, aspects });
    if (draft.editRef.current !== edits || draft.formRef.current.id !== id) throw new Error('The draft changed while saving. Your newer edits have been kept; submit again when ready.');
    draft.commit(saved.listing, saved.item); return hydrateListingEditor(saved.listing, saved.item);
  };
  // A clean, reopened draft is already saved. Rewriting it on every Submit
  // needlessly runs the editor RPC and can produce a false readback conflict.
  // Recheck both persisted rows before publishing instead of trusting stale UI.
  const readCleanSavedDraft = async (client: Awaited<ReturnType<typeof getSupabaseClientAsync>>, listing: Record<string, unknown>) => {
    if (!client || !tenantId || !draft.item) throw new Error('The saved draft and stock are unavailable. Reload before submitting.');
    const stock = await client.from('items').select('*')
      .eq('id', listing.item_id).eq('tenant_id', tenantId).single();
    if (stock.error || !stock.data) throw new Error(stock.error?.message || 'Saved stock could not be checked. No eBay submission was requested.');
    if (String(listing.item_id) !== String(draft.item.id) || String(stock.data.tenant_id) !== tenantId ||
      !listing.updated_at || !draft.formRef.current.updated_at || !stock.data.updated_at || !draft.item.updated_at ||
      String(listing.updated_at) !== String(draft.formRef.current.updated_at) ||
      String(stock.data.updated_at) !== String(draft.item.updated_at)) {
      throw new Error('This saved draft changed since it was opened. Refresh it and check the current category and condition before submitting.');
    }
    const saved = hydrateListingEditor(listing, stock.data);
    const keys = ['title', 'description', 'price', 'category_id', 'condition', 'condition_id', 'condition_description', 'quantity', 'sku'];
    if (keys.some(key => String(saved[key] ?? '') !== String(draft.formRef.current[key] ?? ''))) {
      throw new Error('Saved category, condition or listing text differs from the open editor. Refresh the existing draft before submitting.');
    }
    return saved;
  };
  const save = async () => {
    if (working.current || busy) return false; working.current = true; setError(null);
    try { await saveCurrent(); toast.success('Listing saved'); return true; }
    catch (cause) { setError(message(cause)); toast.error(message(cause)); return false; }
    finally { working.current = false; }
  };
  const publish = async () => {
    if (working.current || busy || !userId || !tenantId || !draft.item || !draft.formRef.current.id) return;
    const accepted = readAcceptedPublication(scope);
    if (accepted || pendingExternalId) { setPendingExternalId(accepted || pendingExternalId); toast.info('eBay already accepted this listing. Refresh its status; do not submit again.'); return; }
    const id = String(draft.formRef.current.id), nicheId = listingNicheId(draft.item);
    let acceptedExternalId = '';
    working.current = true; setPublishing(true); setError(null);
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected.');
      await activateModuleScope(client, userId, tenantId, nicheId);
      // A separate verified active listing for the same canonical stock item
      // always wins over a stale draft. Never send a second AddItem request.
      const siblings = await client.from('listings').select('id,status,external_listing_id')
        .eq('tenant_id', tenantId).eq('item_id', draft.item.id).eq('marketplace_id', 'ebay');
      if (siblings.error) throw new Error('Cannot check whether this item is already live on eBay. No new submission was sent.');
      if (hasLiveSibling(siblings.data || [], id)) throw new Error('This stock item already has a recorded live eBay listing. Open Live inventory or refresh its status; do not submit this older draft again.');
      const before = await readSubmissionListing(client, tenantId, id);
      if (publicationBlock(before)) { draft.commit(before); throw new Error(publicationBlock(before)!); }
      if (before.publish_claim_id) throw new Error('SWISH is already processing this submission. Use Refresh status rather than submitting again.');
      // Only edited drafts need a write. Reopened, unchanged drafts keep their
      // saved category/condition and must not fail due to a redundant RPC save.
      // The server still validates all eBay requirements and owns publish claims.
      const form = draft.dirtyRef.current ? await saveCurrent() : await readCleanSavedDraft(client, before);
      // No AI check, seller override, browser reservation or automatic retry.
      const current = await prepareSharedSubmission(client, tenantId, id);
      if (!isCurrent()) throw new Error('The open listing changed. No eBay request was sent.');
      const result = await callEdgeFunction<Record<string, unknown>>('swish-ebay-list', { route: 'publish', tenantId, nicheId, listingId: id, listingType: form.listing_type || 'FixedPriceItem', auctionDays: Number(form.auction_duration || 7), startPrice: Number(form.start_price || form.price), reservePrice: Number(form.reserve_price || 0) || undefined, categoryId: String(current.category_id || form.category_id || ''), conditionId: String(form.condition_id || ''), mediaUrls: draft.photos }, client);
      if (result.error) throw result.error;
      const externalId = String(result.data?.externalListingId || result.data?.external_listing_id || '');
      if (result.data?.success !== true || !/^\d{6,20}$/.test(externalId)) throw new Error(String(result.data?.error || 'eBay did not confirm a listing ID. Check status before trying again.'));
      // Match the native app: eBay acceptance is distinct from canonical stock
      // reconciliation. The publish Edge function has already saved Active where
      // possible; read that back first instead of requiring a second eBay call
      // for every successful submission. Never replay AddFixedPriceItem.
      acceptedExternalId = externalId; retainAcceptedPublication(scope, externalId);
      if (!isCurrent()) return;
      setPendingExternalId(externalId);
      let fresh = await readSubmissionListing(client, tenantId, id);
      if (String(fresh.external_listing_id || '') === externalId && fresh.status === 'active') {
        const stock = await client.from('items').select('status,sold_at').eq('id', draft.item.id).eq('tenant_id', tenantId).single();
        if (stock.error || !stock.data || stock.data.sold_at || !['listed', 'active'].includes(String(stock.data.status).toLowerCase())) {
          try { fresh = await checkSharedListingStatus({ client, userId, tenantId, nicheId, listingId: id }); }
          catch { /* Preserve accepted outcome; recovery remains available. */ }
        }
      } else {
        // A delayed backend write may have recorded the external eBay ID.
        // Recover by exact saved ID only, never by re-submitting.
        if (String(fresh.external_listing_id || '') === externalId) {
          try { fresh = await checkSharedListingStatus({ client, userId, tenantId, nicheId, listingId: id }); }
          catch { /* Report pending reconciliation below. */ }
        }
      }
      if (String(fresh.external_listing_id || '') !== externalId || fresh.status !== 'active') {
        throw new Error('eBay accepted this listing, but SWISH has not yet confirmed Active status. Do not submit again; use Refresh status.');
      }
      const stock = await client.from('items').select('status,sold_at').eq('id', draft.item.id).eq('tenant_id', tenantId).single();
      const reconciled = !stock.error && stock.data && !stock.data.sold_at && ['listed','active'].includes(String(stock.data.status).toLowerCase());
      if (!isCurrent()) return;
      draft.commit(fresh);
      if (reconciled) {
        clearAcceptedPublication(scope); setPendingExternalId(null); completeScanToLive(`${userId}:${tenantId}:${id}`, externalId);
        toast.success('Listing is live on eBay and SWISH inventory is updated');
      } else {
        toast.warning('eBay listing is Active, but SWISH stock reconciliation is pending. Refresh status; do not submit again.');
      }
      void refreshInventory().catch(() => undefined);
      void draft.refresh().catch(() => undefined);
    } catch (cause) {
      const detail = message(cause), safeError = acceptedExternalId
        ? `eBay accepted listing ${acceptedExternalId}, but SWISH has not confirmed its listing and stock state. ${detail} Do not submit again; use Refresh status to reconcile the existing listing.`
        : detail;
      if (!isCurrent()) return;
      const body = cause instanceof EdgeFunctionError && cause.body && typeof cause.body === 'object' ? cause.body as Record<string, unknown> : {};
      setHelp(listingClarification(safeError, { ...body, accepted: Boolean(acceptedExternalId) || body.accepted }));
      setError(safeError); toast.error(safeError);
      // Read-only refresh after failure; never resend the marketplace request.
      void draft.refresh().catch(() => undefined);
    } finally { working.current = false; setPublishing(false); }
  };
  const checkStatus = async () => {
    if (working.current || busy || !userId || !tenantId || !draft.item || !draft.form.id) return;
    const accepted = pendingExternalId || readAcceptedPublication(scope);
    if (accepted && (!draft.form.external_listing_id || draft.form.publish_claim_id)) {
      await recoverPending(accepted);
      return;
    }
    const id = String(draft.form.id), nicheId = listingNicheId(draft.item);
    working.current = true; setChecking(true);
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected.');
      const fresh = await checkSharedListingStatus({ client, userId, tenantId, nicheId, listingId: id });
      if (pendingExternalId && (fresh.status !== 'active' || String(fresh.external_listing_id) !== pendingExternalId)) {
        throw new Error(`eBay accepted listing ${pendingExternalId}, but SWISH has not yet retained its live identity and inventory state. Do not submit again; refresh status shortly.`);
      }
      if (!isCurrent()) return;
      if (!draft.dirtyRef.current) draft.commit(fresh); await refreshInventory(); await draft.refresh(); setError(null); setHelp(null);
      if (['active', 'sold', 'ended'].includes(String(fresh.status)) && fresh.external_listing_id) { clearAcceptedPublication(scope); setPendingExternalId(null); if (fresh.status === 'active') completeScanToLive(`${userId}:${tenantId}:${id}`, String(fresh.external_listing_id)); }
      if (fresh.publish_claim_id && !fresh.external_listing_id) toast.info('Enter the eBay item number to link the pending submission.');
      else toast.success(fresh.external_listing_id ? 'Existing eBay listing checked' : 'Saved status checked. Submit when ready.');
    } catch (cause) { setError(message(cause)); toast.error(message(cause)); }
    finally { working.current = false; setChecking(false); }
  };
  // Compatibility action: marketplace status is observed, never fabricated locally.
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
    const listingId = String(draft.form.id), nicheId = listingNicheId(draft.item);
    working.current = true;
    setChecking(true);
    try {
      const client = await getSupabaseClientAsync();
      if (!client) throw new Error('SWISH backend is not connected.');
      const fresh = await recoverSharedPendingPublication({ client, userId, tenantId, nicheId, listingId, externalListingId });
      if (!isCurrent()) return;
      if (!draft.dirtyRef.current && draft.formRef.current.id === listingId) draft.commit(fresh);
      clearAcceptedPublication(scope); setPendingExternalId(null);
      setError(null); setHelp(null);
      toast.success('Existing eBay listing and SWISH inventory reconciled');
      await refreshInventory();
    } catch (cause) {
      setError(message(cause));
      toast.error(message(cause));
    } finally {
      working.current = false;
      setChecking(false);
    }
  };
  const retainedId = pendingExternalId || readAcceptedPublication(scope);
  const pendingReason = retainedId ? `eBay accepted listing ${retainedId}, but SWISH is still reconciling the saved listing and stock state. Do not submit again; use Refresh status.` : draft.form.publish_claim_id ? 'SWISH is still checking the original eBay submission. Refresh status or link its existing item number; do not submit again.' : null;
  return { publishing, checking, changingStatus, setManualStatus, busy, saving: saveMutation.isPending, reason: pendingReason || publicationBlock(draft.form), publicationExternalId: retainedId || String(draft.form.external_listing_id || ''), error, help, save, publish, checkStatus, recoverPending, canPublish: Boolean(userId && tenantId && draft.item && draft.form.id && !busy && !retainedId && !draft.form.publish_claim_id && !publicationBlock(draft.form)) };
}
