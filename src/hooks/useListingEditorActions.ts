import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getSupabaseClientAsync, callEdgeFunction, EdgeFunctionError } from '@/lib/supabase';
import { activateModuleScope, verifyModuleScope } from '@/lib/moduleScope';
import { getActiveNicheId, getSpecialistIdsForNiche } from '@/lib/niche';
import { listingReadiness, publicationBlock } from '@/lib/listingReadiness';
import { parseListingVerification, type VerificationResult } from '@/lib/listingVerification';
import { checkSharedListingStatus } from '@/lib/listingStatusRecovery';
import { completeScanToLive } from '@/lib/scanToLiveTiming';
import { amendListingConflict } from '@/lib/amendListingConflict';
import { confirmedPublicationRejection, type PublicationReply } from '@/lib/publicationRecovery';
import type { ConfirmedMusicDetails } from '@/lib/listingEditorData';
import type { ListingConflict, ListingConflictAnswer } from '@/types/listingConflict';
import { usePublicationAttempt } from '@/hooks/usePublicationAttempt';
import { useListingEditorSave } from '@/hooks/useListingEditorSave';
import type { useListingEditorDraft } from '@/hooks/useListingEditorDraft';
export function useListingEditorActions(draft: ReturnType<typeof useListingEditorDraft>, userId: string | undefined, tenantId: string | null, uploads: string[]) {
  const id = String(draft.form.id || ''), attempt = usePublicationAttempt(userId, tenantId, id), saveMutation = useListingEditorSave(userId, tenantId), working = useRef(false), verifiedRevision = useRef('');
  const [verification, setVerification] = useState<VerificationResult | null>(null), [confirm, setConfirm] = useState(false);
  const [preflighting, setPreflighting] = useState(false), [publishing, setPublishing] = useState(false), [checking, setChecking] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => { if (verifiedRevision.current !== draft.revisionRef.current) { setVerification(null); setConfirm(false); } }, [draft.revision, draft.revisionRef]);
  const checks = listingReadiness({ listing: draft.form, item: draft.item, tenantId, specialistIds: getSpecialistIdsForNiche(getActiveNicheId()), photos: draft.photos, dirty: draft.dirty });
  const reason = publicationBlock(draft.form) || (attempt.attempted ? attempt.outcome === 'rejected' ? 'A confirmed rejection needs fresh status checking before another submission.' : 'A previous submission needs inspection. Check eBay and saved status; its outcome must not be guessed.' : null);
  const busy = publishing || preflighting || checking || saveMutation.isPending, fail = checks.some(check => check.status === 'fail');
  const showError = (cause: unknown) => cause instanceof EdgeFunctionError ? cause.displayMessage : cause instanceof Error ? cause.message : 'SWISH operation unavailable';
  const saveCurrent = async (form = draft.formRef.current, confirmedMusic?: ConfirmedMusicDetails) => {
    const edits = draft.editRef.current;
    const saved = await saveMutation.mutateAsync({ form, item: draft.item, photos: draft.photos, uploads, confirmedMusic });
    if (draft.editRef.current !== edits || String(draft.formRef.current.id) !== id) throw new Error('You changed the draft during saving. Your newer edits are retained; save and check this version.');
    draft.commit(saved.listing, saved.item); return saved;
  };
  const save = async () => {
    if (working.current || busy) return; working.current = true;
    try { await saveCurrent(); setError(null); toast.success('Category, condition and stock details saved and read back in SWISH'); }
    catch (cause) { setError(showError(cause)); toast.error(showError(cause)); } finally { working.current = false; }
  };
  const preflight = async (notes?: string, correction?: { form: Record<string, unknown>; confirmedMusic?: ConfirmedMusicDetails }) => {
    if (!id || !userId || !tenantId || !draft.item || busy || working.current) return;
    if (notes && (!verification || verification.failures.length || fail || !verification.warnings.length)) { toast.error('Resolve blocking issues before recording seller review.'); return; }
    if (publicationBlock(draft.form) || attempt.attempted && attempt.outcome !== 'rejected') { toast.error('Inspect the existing submission before saving or checking a new version.'); return; }
    working.current = true; setPreflighting(true); setVerification(null); setError(null);
    try {
      if (draft.dirtyRef.current || correction) await saveCurrent(correction?.form || draft.formRef.current, correction?.confirmedMusic);
      const revision = draft.revisionRef.current, client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected');
      await activateModuleScope(client, userId, tenantId, getActiveNicheId());
      if (attempt.outcome === 'rejected') { const fresh = await checkSharedListingStatus({ client, userId, tenantId, nicheId: getActiveNicheId(), listingId: id }); if (!attempt.reconcileRejected(fresh)) throw new Error('The existing submission still needs inspection. Nothing was resent.'); }
      const result = await callEdgeFunction<Record<string, unknown>>('swish-verify', { listing_id: id, tenant_id: tenantId, ...(notes ? { human_override: true, override_notes: notes } : {}) }, client);
      if (result.error) throw result.error;
      if (!result.data || draft.revisionRef.current !== revision) throw new Error('Draft changed or verification was unavailable. Save and verify the current version.');
      const verdict = parseListingVerification(result.data); verifiedRevision.current = revision; setVerification(verdict);
      if (verdict.passed) toast.success(notes ? 'Seller review recorded. Confirm publication when ready.' : 'Saved draft checked. Review advisory warnings, then confirm publication.');
      else toast.warning('Answer the conflicting facts or correct the blocking fields below.');
    } catch (cause) { setError(showError(cause)); toast.error(showError(cause)); } finally { working.current = false; setPreflighting(false); }
  };
  const resolveConflict = async (conflict: ListingConflict, answer: ListingConflictAnswer) => {
    if (!draft.item || busy || working.current) return;
    try { await preflight(undefined, amendListingConflict(draft.formRef.current, draft.item, conflict, answer)); }
    catch (cause) { toast.error(showError(cause)); }
  };
  const publish = async () => {
    if (!verification?.passed || verifiedRevision.current !== draft.revisionRef.current || !userId || !tenantId || busy || working.current || draft.dirty || reason || fail) { toast.error('Save, resolve readiness issues and pass verification before publication.'); return; }
    working.current = true; setPublishing(true); setError(null); let dispatched = false; let reply: PublicationReply = { status: 0, body: null };
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected');
      await verifyModuleScope(client, userId, tenantId, getActiveNicheId());
      await attempt.reserve(); dispatched = true;
      const result = await callEdgeFunction<Record<string, unknown>>('swish-ebay-list', { route: 'publish', tenantId, listingId: id, listingType: draft.form.listing_type || 'FixedPriceItem', auctionDays: Number(draft.form.auction_duration || 7), startPrice: Number(draft.form.start_price || draft.form.price), reservePrice: Number(draft.form.reserve_price || 0) || undefined, categoryId: String(draft.form.category_id || ''), mediaUrls: draft.photos }, client);
      reply = { status: result.error?.status || 200, body: result.error?.body || result.data };
      if (result.error) throw result.error;
      if (result.data?.success !== true || !/^\d+$/.test(String(result.data.externalListingId || ''))) throw new Error(String(result.data?.error || 'The eBay listing ID was not confirmed. Check status; do not resubmit.'));
      const externalId = String(result.data.externalListingId); attempt.settle(reply, true, 'eBay returned the listing ID.'); draft.commit({ status: 'active', external_listing_id: externalId }); setVerification(null); toast.success('Listing accepted by eBay');
      void checkSharedListingStatus({ client, userId, tenantId, nicheId: getActiveNicheId(), listingId: id }).then(fresh => { if (fresh.status === 'active' && String(fresh.external_listing_id) === externalId) completeScanToLive(`${userId}:${tenantId}:${id}`, externalId); void draft.refresh(); }).catch(() => toast.warning('eBay accepted the listing. Live status confirmation is pending; do not resend.'));
    } catch (cause) {
      const message = showError(cause); if (dispatched) attempt.settle(reply, false, message); setError(message);
      if (dispatched && confirmedPublicationRejection(reply)) { const client = await getSupabaseClientAsync(); if (client) await checkSharedListingStatus({ client, userId: userId!, tenantId: tenantId!, nicheId: getActiveNicheId(), listingId: id }).then(fresh => { attempt.reconcileRejected(fresh); }).catch(() => toast.warning('Retry eligibility is not confirmed. Check saved status.')); }
      toast.warning('Review the response below. Answer conflicts in this same draft; an uncertain submission will not be resent.');
    } finally { working.current = false; setPublishing(false); setConfirm(false); }
  };
  const checkStatus = async () => {
    if (!userId || !tenantId || !id || busy || working.current) return; working.current = true; setChecking(true);
    try {
      const client = await getSupabaseClientAsync(); if (!client) throw new Error('SWISH backend is not connected');
      const fresh = await checkSharedListingStatus({ client, userId, tenantId, nicheId: getActiveNicheId(), listingId: id });
      const released = attempt.reconcileRejected(fresh); if (!draft.dirtyRef.current) draft.commit(fresh); await draft.refresh();
      if (fresh.status === 'active' && fresh.external_listing_id) completeScanToLive(`${userId}:${tenantId}:${id}`, String(fresh.external_listing_id));
      if (released) { setError(null); setVerification(null); toast.success('Confirmed rejection checked. Correct facts and check before an explicit new attempt.'); }
      else if (fresh.external_listing_id) toast.success('Existing eBay status checked. Nothing was resubmitted.');
      else toast.warning('No retry permission inferred. Use eBay sync and inspect the earlier submission.');
    } catch (cause) { toast.error(showError(cause)); } finally { working.current = false; setChecking(false); }
  };
  return { verification, confirm, setConfirm, preflighting, publishing, checking, busy, saving: saveMutation.isPending, checks, reason, error: error || (attempt.outcome !== 'published' ? attempt.detail || null : null), save, preflight, resolveConflict, publish, checkStatus, canPublish: Boolean(verification?.passed && verifiedRevision.current === draft.revisionRef.current && !busy && !draft.dirty && !reason && !fail), canSellerReview: !busy && !draft.dirty && !fail };
}
