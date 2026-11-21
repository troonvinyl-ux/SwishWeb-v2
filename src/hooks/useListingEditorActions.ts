import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { getSupabaseClientAsync, callEdgeFunction, EdgeFunctionError } from '@/lib/supabase';
import { activateModuleScope } from '@/lib/moduleScope';
import { publicationBlock } from '@/lib/listingReadiness';
import { checkSharedListingStatus } from '@/lib/listingStatusRecovery';
import { listingNicheId, readSubmissionListing, prepareSharedSubmission } from '@/lib/listingSubmission';
import { completeScanToLive } from '@/lib/scanToLiveTiming';
import { hydrateListingEditor } from '@/lib/listingEditorData';
import { useListingEditorSave } from '@/hooks/useListingEditorSave';
import type { useListingEditorDraft } from '@/hooks/useListingEditorDraft';
import type { EbayAspect } from '@/lib/ebayMusicContract';

export function useListingEditorActions(draft: ReturnType<typeof useListingEditorDraft>, userId: string | undefined, tenantId: string | null, uploads: string[], aspects: EbayAspect[] = []) {
  const saveMutation = useListingEditorSave(userId, tenantId), working = useRef(false);
  const [publishing, setPublishing] = useState(false), [checking, setChecking] = useState(false), [error, setError] = useState<string | null>(null), [pendingExternalId, setPendingExternalId] = useState<string | null>(null);
  const busy = publishing || checking || saveMutation.isPending;
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
    if (working.current || busy) return; working.current = true; setError(null);
    try { await saveCurrent(); toast.success('Listing saved'); }
    catch (cause) { setError(message(cause)); toast.error(message(cause)); }
    finally { working.current = false; }
  };
  const publish = async () => {
    if (working.current || busy || !userId || !tenantId || !draft.item || !draft.formRef.current.id) return;
    const id = String(draft.formRef.current.id), nicheId = listingNicheId(draft.item);
    let acceptedExternalId = '';
    working.current = true; setPublishing(true); setError(null);
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected.');
      await activateModuleScope(client, userId, tenantId, nicheId);
      const before = await readSubmissionListing(client, tenantId, id);
      if (publicationBlock(before)) { draft.commit(before); throw new Error(publicationBlock(before)!); }
      if (before.publish_claim_id) throw new Error('SWISH is already processing this submission. Use Refresh status rather than submitting again.');
      // Only edited drafts need a write. Reopened, unchanged drafts keep their
      // saved category/condition and must not fail due to a redundant RPC save.
      // The server still validates all eBay requirements and owns publish claims.
      const form = draft.dirtyRef.current ? await saveCurrent() : await readCleanSavedDraft(client, before);
      // No AI check, seller override, browser reservation or automatic retry.
      const current = await prepareSharedSubmission(client, tenantId, id);
      const result = await callEdgeFunction<Record<string, unknown>>('swish-ebay-list', { route: 'publish', tenantId, nicheId, listingId: id, listingType: form.listing_type || 'FixedPriceItem', auctionDays: Number(form.auction_duration || 7), startPrice: Number(form.start_price || form.price), reservePrice: Number(form.reserve_price || 0) || undefined, categoryId: String(current.category_id || form.category_id || ''), conditionId: String(form.condition_id || ''), mediaUrls: draft.photos }, client);
      if (result.error) throw result.error;
      const externalId = String(result.data?.externalListingId || result.data?.external_listing_id || '');
      if (result.data?.success !== true || !/^\d+$/.test(externalId)) throw new Error(String(result.data?.error || 'eBay did not confirm a listing ID. Check status before trying again.'));
      // eBay has accepted an ID, but that is not yet proof that the saved listing
      // and its canonical stock item have both left Draft. Keep the editor locked
      // until the existing status-only reconciliation confirms the full handoff.
      acceptedExternalId = externalId; setPendingExternalId(externalId);
      const fresh = await checkSharedListingStatus({ client, userId, tenantId, nicheId, listingId: id });
      if (fresh.status !== 'active' || String(fresh.external_listing_id) !== externalId) throw new Error('eBay accepted this listing, but SWISH did not retain the same live listing identity. Do not submit again; refresh status to reconcile it.');
      draft.commit(fresh); setPendingExternalId(null); completeScanToLive(`${userId}:${tenantId}:${id}`, externalId);
      toast.success('Listing is live on eBay and SWISH inventory is updated');
      void draft.refresh().catch(() => undefined);
    } catch (cause) {
      const detail = message(cause), safeError = acceptedExternalId
        ? `eBay accepted listing ${acceptedExternalId}, but SWISH has not confirmed its listing and stock state. ${detail} Do not submit again; use Refresh status to reconcile the existing listing.`
        : detail;
      setError(safeError); toast.error(safeError);
      // Read-only refresh after failure; never resend the marketplace request.
      void draft.refresh().catch(() => undefined);
    } finally { working.current = false; setPublishing(false); }
  };
  const checkStatus = async () => {
    if (working.current || busy || !userId || !tenantId || !draft.item || !draft.form.id) return;
    const id = String(draft.form.id), nicheId = listingNicheId(draft.item);
    working.current = true; setChecking(true);
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected.');
      const fresh = await checkSharedListingStatus({ client, userId, tenantId, nicheId, listingId: id });
      if (pendingExternalId && (fresh.status !== 'active' || String(fresh.external_listing_id) !== pendingExternalId)) {
        throw new Error(`eBay accepted listing ${pendingExternalId}, but SWISH has not yet retained its live identity and inventory state. Do not submit again; refresh status shortly.`);
      }
      if (!draft.dirtyRef.current) draft.commit(fresh); await draft.refresh(); setError(null);
      if (fresh.status === 'active' && fresh.external_listing_id) { setPendingExternalId(null); completeScanToLive(`${userId}:${tenantId}:${id}`, String(fresh.external_listing_id)); }
      toast.success(fresh.external_listing_id ? 'Existing eBay listing checked' : fresh.publish_claim_id ? 'SWISH still has a pending submission' : 'Saved status checked. Submit when ready.');
    } catch (cause) { setError(message(cause)); toast.error(message(cause)); }
    finally { working.current = false; setChecking(false); }
  };
  const pendingReason = pendingExternalId ? `eBay accepted listing ${pendingExternalId}, but SWISH is still reconciling the saved listing and stock state. Do not submit again; use Refresh status.` : null;
  return { publishing, checking, busy, saving: saveMutation.isPending, reason: pendingReason || publicationBlock(draft.form), publicationExternalId: pendingExternalId || String(draft.form.external_listing_id || ''), error, save, publish, checkStatus, canPublish: Boolean(userId && tenantId && draft.item && draft.form.id && !busy && !pendingExternalId && !publicationBlock(draft.form)) };
}
