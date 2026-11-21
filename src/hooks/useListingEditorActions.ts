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
  const [publishing, setPublishing] = useState(false), [checking, setChecking] = useState(false), [error, setError] = useState<string | null>(null);
  const busy = publishing || checking || saveMutation.isPending;
  const message = (cause: unknown) => cause instanceof EdgeFunctionError ? cause.displayMessage : cause instanceof Error ? cause.message : 'SWISH could not complete the request.';
  const saveCurrent = async () => {
    const edits = draft.editRef.current, id = draft.formRef.current.id;
    const saved = await saveMutation.mutateAsync({ form: draft.formRef.current, item: draft.item, photos: draft.photos, uploads, aspects });
    if (draft.editRef.current !== edits || draft.formRef.current.id !== id) throw new Error('The draft changed while saving. Your newer edits have been kept; submit again when ready.');
    draft.commit(saved.listing, saved.item); return hydrateListingEditor(saved.listing, saved.item);
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
    working.current = true; setPublishing(true); setError(null);
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected.');
      await activateModuleScope(client, userId, tenantId, nicheId);
      const before = await readSubmissionListing(client, tenantId, id);
      if (publicationBlock(before)) { draft.commit(before); throw new Error(publicationBlock(before)!); }
      if (before.publish_claim_id && draft.dirtyRef.current) throw new Error('SWISH is processing an existing submission. Check its status before saving changes.');
      // Save even an unchanged legacy draft to normalize abbreviated grades and persist condition IDs.
      // A server-owned pending claim is never edited or cleared here.
      const form = before.publish_claim_id ? draft.formRef.current : await saveCurrent();
      // No AI check, seller override, browser reservation or automatic retry.
      const current = await prepareSharedSubmission(client, tenantId, id);
      const result = await callEdgeFunction<Record<string, unknown>>('swish-ebay-list', { route: 'publish', tenantId, nicheId, listingId: id, listingType: form.listing_type || 'FixedPriceItem', auctionDays: Number(form.auction_duration || 7), startPrice: Number(form.start_price || form.price), reservePrice: Number(form.reserve_price || 0) || undefined, categoryId: String(current.category_id || form.category_id || ''), conditionId: String(form.condition_id || ''), mediaUrls: draft.photos }, client);
      if (result.error) throw result.error;
      const externalId = String(result.data?.externalListingId || result.data?.external_listing_id || '');
      if (result.data?.success !== true || !/^\d+$/.test(externalId)) throw new Error(String(result.data?.error || 'eBay did not confirm a listing ID. Check status before trying again.'));
      draft.commit({ status: 'active', external_listing_id: externalId }); toast.success('Listing accepted by eBay');
      void checkSharedListingStatus({ client, userId, tenantId, nicheId, listingId: id }).then(fresh => {
        if (fresh.status === 'active' && String(fresh.external_listing_id) === externalId) completeScanToLive(`${userId}:${tenantId}:${id}`, externalId);
        void draft.refresh();
      }).catch(() => toast.warning('eBay accepted the listing; saved status is still updating.'));
    } catch (cause) {
      setError(message(cause)); toast.error(message(cause));
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
      if (!draft.dirtyRef.current) draft.commit(fresh); await draft.refresh(); setError(null);
      if (fresh.status === 'active' && fresh.external_listing_id) completeScanToLive(`${userId}:${tenantId}:${id}`, String(fresh.external_listing_id));
      toast.success(fresh.external_listing_id ? 'Existing eBay listing checked' : fresh.publish_claim_id ? 'SWISH still has a pending submission' : 'Saved status checked. Submit when ready.');
    } catch (cause) { setError(message(cause)); toast.error(message(cause)); }
    finally { working.current = false; setChecking(false); }
  };
  return { publishing, checking, busy, saving: saveMutation.isPending, reason: publicationBlock(draft.form), error, save, publish, checkStatus, canPublish: Boolean(userId && tenantId && draft.item && draft.form.id && !busy && !publicationBlock(draft.form)) };
}
