import { ArrowLeft, Save, Send, Zap } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { useListingEditorDraft } from '@/hooks/useListingEditorDraft';
import { useListingEditorActions } from '@/hooks/useListingEditorActions';
import { useListingCategorySuggestion } from '@/hooks/useListingCategorySuggestion';
import { useListingPhotoUploads } from '@/hooks/useListingPhotoUploads';
import { syncMusicConditionText } from '@/lib/musicConditionText';
import { publicationBlock } from '@/lib/listingReadiness';
import RecommendedPriceButton from '@/components/features/RecommendedPriceButton';
import ListingReadiness from '@/components/features/ListingReadiness';
import ListingVerification from '@/components/features/ListingVerification';
import PublicationStatus from '@/components/features/PublicationStatus';
import ListingPublishFeedback from '@/components/features/ListingPublishFeedback';
import SellerListingReview from '@/components/features/SellerListingReview';
import PublishConfirmation from '@/components/features/PublishConfirmation';
import ListingEditorPhotos from '@/components/features/ListingEditorPhotos';
import ListingTitleFields from '@/components/features/ListingTitleFields';
import ListingSaleFields from '@/components/features/ListingSaleFields';
import ListingCategoryFields from '@/components/features/ListingCategoryFields';
import MusicItemSpecifics from '@/components/features/MusicItemSpecifics';
export default function ListingEditor() {
  const { id } = useParams<{ id: string }>(), { user } = useAuth(), tenant = useCurrentTenantId();
  const draft = useListingEditorDraft(id, tenant.tenantId);
  const upload = useListingPhotoUploads(String(draft.form.item_id || ''), urls => draft.setPhotos(current => [...current, ...urls]));
  const actions = useListingEditorActions(draft, user?.id, tenant.tenantId, upload.photos.map(photo => photo.url));
  const category = useListingCategorySuggestion(draft, user?.id, tenant.tenantId);
  const disabled = actions.busy || upload.busy || Boolean(publicationBlock(draft.form));
  const canVerify = !actions.busy && !upload.busy && !draft.dirty && Boolean(draft.form.id);
  if (tenant.isLoading || draft.loading) return <div role="status" className="swish-card p-6 text-muted-foreground">Loading the shared SWISH listing…</div>;
  if (tenant.error || draft.error) return <section role="alert" className="swish-card space-y-4 p-5"><h1 className="text-xl font-semibold">Listing unavailable</h1><p>{tenant.error?.message || draft.error?.message}</p><Link to="/listings" className="btn-secondary">Back to listings</Link></section>;
  return <div className="w-full min-w-0 max-w-4xl space-y-4"><header className="flex flex-wrap items-center gap-3"><Link to="/listings" aria-label="Back to listings" className="btn-ghost min-h-11 min-w-11"><ArrowLeft size={20} /></Link><div className="min-w-0 flex-1"><h1 className="page-title">Edit Listing</h1><Link to={`/listings/${id}`} className="text-primary underline">Back to listing overview</Link></div><div className="flex w-full flex-wrap gap-2 sm:w-auto"><button type="button" onClick={() => void actions.preflight()} disabled={!canVerify} className="btn-secondary min-h-11"><Zap size={18} />{actions.preflighting ? 'Checking…' : 'Preflight'}</button><button type="button" onClick={() => actions.setConfirm(true)} disabled={!actions.canPublish || upload.busy} className={actions.canPublish ? 'btn-primary min-h-11' : 'btn-ghost min-h-11'}><Send size={18} />{actions.publishing ? 'Publishing…' : 'Publish'}</button><button type="button" onClick={actions.save} disabled={disabled || !tenant.tenantId || !draft.form.id} className={actions.canPublish ? 'btn-secondary min-h-11' : 'btn-primary min-h-11'}><Save size={18} />{actions.saving ? 'Saving…' : 'Save'}</button></div></header>
    <PublicationStatus reason={actions.reason} externalId={String(draft.form.external_listing_id || '')} refreshing={actions.checking} onRefresh={() => void actions.checkStatus()} />
    <ListingPublishFeedback message={actions.error} />
    <ListingReadiness checks={actions.checks} />
    {draft.item?.specialist_id !== 'vinyl_records' && <RecommendedPriceButton marketValue={draft.item?.valuation_mid || draft.item?.expected_selling_price} onApply={price => draft.change('price', price)} />}
    <ListingVerification result={actions.verification} />
    <SellerListingReview key={JSON.stringify(actions.verification)} result={actions.verification} disabled={!actions.canSellerReview || upload.busy} onApprove={notes => actions.preflight(notes)} />
    <PublishConfirmation open={actions.confirm} onOpenChange={actions.setConfirm} title={String(draft.form.title || '')} price={Number(draft.form.price || 0)} busy={actions.publishing} onConfirm={() => void actions.publish()} />
    <p className="text-base leading-7 text-muted-foreground">Save changes, run preflight, review advisory warnings, then explicitly confirm publication. eBay requirements and duplicate protection remain enforced by the shared service.</p>
    <ListingEditorPhotos draft={draft} upload={upload} disabled={disabled} />
    <ListingTitleFields form={draft.form} onChange={draft.change} disabled={disabled} />
    <ListingSaleFields form={draft.form} item={draft.item} onChange={draft.change} disabled={disabled} />
    <MusicItemSpecifics item={draft.item} disabled={disabled} onChanged={values => { const description = syncMusicConditionText(String(draft.form.description || ''), values); if (description !== draft.form.description) draft.change('description', description); if (/^Media\s/i.test(String(draft.form.condition || ''))) draft.change('condition', `Media ${values.media_grade || 'ungraded'}; sleeve ${values.sleeve_grade || 'ungraded'}`); }} />
    <ListingCategoryFields form={draft.form} onChange={draft.change} disabled={disabled} suggesting={category.busy} suggestion={category.suggestion} onSuggest={() => void category.suggest()} />
  </div>;
}
