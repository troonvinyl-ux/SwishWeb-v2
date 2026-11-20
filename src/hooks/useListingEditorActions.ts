import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getSupabaseClientAsync, callEdgeFunction, EdgeFunctionError } from '@/lib/supabase';
import { activateModuleScope, verifyModuleScope } from '@/lib/moduleScope';
import { getActiveNicheId, getSpecialistIdsForNiche } from '@/lib/niche';
import { listingReadiness, publicationBlock } from '@/lib/listingReadiness';
import { parseListingVerification, type VerificationResult } from '@/lib/listingVerification';
import { checkSharedListingStatus } from '@/lib/listingStatusRecovery';
import { usePublicationAttempt } from '@/hooks/usePublicationAttempt';
import { useListingEditorSave } from '@/hooks/useListingEditorSave';
import type { useListingEditorDraft } from '@/hooks/useListingEditorDraft';
import type { PublicationReply } from '@/lib/publicationRecovery';
export function useListingEditorActions(draft: ReturnType<typeof useListingEditorDraft>, userId: string | undefined, tenantId: string | null, uploads: string[]) {
  const id = String(draft.form.id || ''), attempt = usePublicationAttempt(userId, tenantId, id), saveMutation = useListingEditorSave(userId, tenantId);
  const [verification, setVerification] = useState<VerificationResult | null>(null), [confirm, setConfirm] = useState(false);
  const [preflighting, setPreflighting] = useState(false), [publishing, setPublishing] = useState(false), [checking, setChecking] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => { setVerification(null); setConfirm(false); }, [draft.revision]);
  const checks = listingReadiness({ listing: draft.form, item: draft.item, tenantId, specialistIds: getSpecialistIdsForNiche(getActiveNicheId()), photos: draft.photos, dirty: draft.dirty });
  const reason = publicationBlock(draft.form) || (attempt.attempted ? attempt.outcome === 'rejected' ? 'The service confirmed a rejection. Check status / retry eligibility to release this browser lock only if no listing or pending claim exists.' : 'A previous submission needs inspection. Check eBay and saved status; its outcome must not be guessed.' : null);
  const busy = publishing || preflighting || checking || saveMutation.isPending;
  const fail = checks.some(check => check.status === 'fail');
  const showError = (cause: unknown) => cause instanceof EdgeFunctionError ? cause.displayMessage : cause instanceof Error ? cause.message : 'SWISH operation unavailable';
  const save = () => saveMutation.mutate({ form: draft.form, item: draft.item, photos: draft.photos, uploads }, { onSuccess: saved => { draft.commit(saved); toast.success('Listing, condition and stock details saved in SWISH'); }, onError: cause => toast.error(cause.message) });
  const preflight = async (notes?: string) => {
    if (!id || !userId || !tenantId || draft.dirty || busy) { toast.error('Save the current draft and open your workspace before verification.'); return; }
    if (notes && (!verification || verification.failures.length || fail || !verification.warnings.length)) { toast.error('Resolve blocking issues before recording seller review.'); return; }
    const revision = draft.revisionRef.current; setPreflighting(true); setVerification(null);
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected');
      await activateModuleScope(client, userId, tenantId, getActiveNicheId());
      const result = await callEdgeFunction<Record<string, unknown>>('swish-verify', { listing_id: id, tenant_id: tenantId, ...(notes ? { human_override: true, override_notes: notes } : {}) }, client);
      if (result.error) throw result.error;
      if (!result.data || draft.revisionRef.current !== revision) throw new Error('Draft changed or verification was unavailable. Save and verify the current version.');
      const verdict = parseListingVerification(result.data); setVerification(verdict);
      if (verdict.passed) toast.success(notes ? 'Seller review recorded. Explicitly confirm publication when ready.' : `Preflight passed${verdict.warnings.length ? '; review advisory warnings below' : ''}.`);
      else toast.error(`${verdict.failures.length} blocking issue(s). Review verification below.`);
    } catch (cause) { toast.error(showError(cause)); } finally { setPreflighting(false); }
  };
  const publish = async () => {
    if (!verification?.passed || !userId || !tenantId || busy || draft.dirty || reason || fail) { toast.error('Save, resolve readiness issues and pass verification before publication.'); return; }
    setPublishing(true); setError(null); let dispatched = false; let reply: PublicationReply = { status: 0, body: null };
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected');
      await verifyModuleScope(client, userId, tenantId, getActiveNicheId());
      await attempt.reserve(); dispatched = true;
      const result = await callEdgeFunction<Record<string, unknown>>('swish-ebay-list', { route: 'publish', tenantId, listingId: id, listingType: draft.form.listing_type || 'FixedPriceItem', auctionDays: Number(draft.form.auction_duration || 7), startPrice: Number(draft.form.start_price || draft.form.price), reservePrice: Number(draft.form.reserve_price || 0) || undefined, categoryId: String(draft.form.category_id || ''), mediaUrls: draft.photos }, client);
      reply = { status: result.error?.status || 200, body: result.error?.body || result.data };
      if (result.error) throw result.error;
      if (result.data?.success !== true) throw new Error(String(result.data?.error || 'The eBay operation was not confirmed.'));
      if (!/^\d+$/.test(String(result.data.externalListingId || ''))) throw new Error('eBay reported success without a listing ID. Check saved status; do not resubmit.');
      attempt.settle(reply, true, 'eBay returned the listing ID.'); draft.commit({ status: 'active', external_listing_id: result.data.externalListingId }); setVerification(null); toast.success('Listing published to eBay'); void draft.refresh();
    } catch (cause) { const message = showError(cause); if (dispatched) attempt.settle(reply, false, message); setError(message); toast.error('Submission not confirmed. Review the response and recovery actions below.'); }
    finally { setPublishing(false); setConfirm(false); }
  };
  const checkStatus = async () => {
    if (!userId || !tenantId || !id || busy) return; setChecking(true);
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected');
      const fresh = await checkSharedListingStatus({ client, userId, tenantId, nicheId: getActiveNicheId(), listingId: id });
      const released = attempt.reconcileRejected(fresh); if (!draft.dirtyRef.current) draft.commit(fresh); await draft.refresh();
      if (released) { setError(null); setVerification(null); toast.success('Confirmed rejection checked. Review and preflight before an explicit new attempt.'); }
      else if (fresh.external_listing_id) toast.success('Existing eBay status checked. Nothing was resubmitted.');
      else toast.warning('No retry permission inferred. Use eBay sync and inspect the earlier submission.');
    } catch (cause) { toast.error(showError(cause)); } finally { setChecking(false); }
  };
  return { verification, confirm, setConfirm, preflighting, publishing, checking, busy, saving: saveMutation.isPending, checks, reason, error: error || (attempt.outcome !== 'published' ? attempt.detail || null : null), save, preflight, publish, checkStatus, canPublish: Boolean(verification?.passed && !busy && !draft.dirty && !reason && !fail), canSellerReview: !busy && !draft.dirty && !fail };
}
