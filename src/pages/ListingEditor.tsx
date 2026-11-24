import { ArrowLeft, Save, Send, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { useListingEditorDraft } from '@/hooks/useListingEditorDraft';
import { useListingEditorActions } from '@/hooks/useListingEditorActions';
import { useListingCategorySuggestion } from '@/hooks/useListingCategorySuggestion';
import { useListingPhotoUploads } from '@/hooks/useListingPhotoUploads';
import { syncMusicConditionText } from '@/lib/musicConditionText';
import { publicationBlock } from '@/lib/listingReadiness';
import { listingNicheId } from '@/lib/listingSubmission';
import { getActiveNicheId } from '@/lib/niche';
import { useEbayCategoryMetadata } from '@/hooks/useEbayCategoryMetadata';
import type { MusicValues } from '@/types/music';
import RecommendedPriceButton from '@/components/features/RecommendedPriceButton';
import PublicationStatus from '@/components/features/PublicationStatus';
import ListingPublishFeedback from '@/components/features/ListingPublishFeedback';
import ListingEditorPhotos from '@/components/features/ListingEditorPhotos';
import ListingTitleFields from '@/components/features/ListingTitleFields';
import ListingSaleFields from '@/components/features/ListingSaleFields';
import ListingCategoryFields from '@/components/features/ListingCategoryFields';
import EbayItemSpecifics from '@/components/features/EbayItemSpecifics';
import MusicItemSpecifics from '@/components/features/MusicItemSpecifics';
import { supportedEbayCondition, vinylRecordConditionPolicy } from '@/lib/ebayMusicContract';

export default function ListingEditor() {
  const { id } = useParams<{ id: string }>(), { user } = useAuth(), tenant = useCurrentTenantId();
  const draft = useListingEditorDraft(id, tenant.tenantId);
  const upload = useListingPhotoUploads(String(draft.form.item_id || ''), urls => draft.setPhotos(current => [...current, ...urls]));
  const nicheId = draft.item ? listingNicheId(draft.item) : getActiveNicheId();
  const specialistId = String(draft.item?.specialist_id || '');
  const categoryId = String(draft.form.category_id || '').trim();
  const music = specialistId === 'vinyl_records';
  const vinylPolicy = vinylRecordConditionPolicy(categoryId, specialistId);
  const metadata = useEbayCategoryMetadata(user?.id, tenant.tenantId, nicheId, categoryId, specialistId);
  const conditionPolicy = vinylPolicy ?? metadata.data;
  const actions = useListingEditorActions(draft, user?.id, tenant.tenantId, upload.photos.map(photo => photo.url), metadata.data?.aspects);
  const category = useListingCategorySuggestion(draft, user?.id, tenant.tenantId);
  // New / Used for EBAY_GB Vinyl Records is available immediately; eBay's
  // shared backend still validates actual category policy at publication.
  const conditionReady = !music || Boolean(categoryId && conditionPolicy &&
    supportedEbayCondition(draft.form.condition_id, conditionPolicy.conditions, conditionPolicy.conditionRequired));
  const disabled = actions.busy || upload.busy || category.busy || Boolean(publicationBlock(draft.form));
  if (tenant.isLoading || draft.loading) return <div role="status" className="swish-card p-6 text-muted-foreground">Loading the shared SWISH listing…</div>;
  if (tenant.error || draft.error) return <section role="alert" className="swish-card space-y-4 p-5"><h1 className="text-xl font-semibold">Listing unavailable</h1><p>{tenant.error?.message || draft.error?.message}</p><Link to="/listings" className="btn-secondary">Back to listings</Link></section>;
  return <div className="w-full min-w-0 max-w-4xl space-y-4">
    <header className="flex flex-wrap items-center gap-3"><Link to="/listings" aria-label="Back to listings" className="btn-ghost min-h-11 min-w-11"><ArrowLeft size={20} /></Link><div className="min-w-0 flex-1"><h1 className="page-title">Edit Listing</h1><Link to={`/listings/${id}`} className="text-primary underline">Back to listing overview</Link></div></header>
    <section aria-label="Submit listing" className="swish-card space-y-4 p-4 sm:p-5">
      <h2 className="text-lg font-semibold">Ready to sell</h2>
      <p className="text-base leading-7 text-muted-foreground">Submit saves your changes and sends this listing to your connected eBay account. No separate AI check or seller-review step.</p>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void actions.publish()} disabled={!actions.canPublish || upload.busy || category.busy || !conditionReady} className="btn-primary min-h-11 disabled:opacity-50"><Send size={18} />{actions.publishing ? 'Submitting…' : 'Submit to eBay'}</button><button type="button" onClick={() => void actions.save()} disabled={disabled || !tenant.tenantId || !draft.form.id} className="btn-secondary min-h-11 disabled:opacity-50"><Save size={18} />{actions.saving ? 'Saving…' : 'Save draft'}</button><button type="button" onClick={() => void actions.checkStatus()} disabled={actions.busy || upload.busy || category.busy || !draft.form.id} className="btn-ghost min-h-11 disabled:opacity-50"><RefreshCw size={18} />{actions.checking ? 'Checking…' : 'Refresh status'}</button></div>
      {music && !conditionReady && <p role="status" className="text-sm text-warning">{!categoryId ? 'The eBay category ID is missing. Use Find eBay category, confirm the correct category, then select its condition.' : 'Choose an eBay category-compatible condition below and save the draft before submitting. Record and sleeve grades stay separate.'}</p>}
    </section>
    <PublicationStatus reason={actions.reason} externalId={actions.publicationExternalId} refreshing={actions.checking} onRefresh={() => void actions.checkStatus()} />
    <ListingPublishFeedback message={actions.error} />
    {draft.item?.specialist_id !== 'vinyl_records' && <RecommendedPriceButton marketValue={draft.item?.valuation_mid} suggestedPrice={draft.item?.expected_selling_price} onApply={price => draft.change('price', price)} />}
    <ListingEditorPhotos draft={draft} upload={upload} disabled={disabled} />
    <ListingTitleFields form={draft.form} onChange={draft.change} disabled={disabled} />
    <ListingSaleFields form={draft.form} item={draft.item} onChange={draft.change} disabled={disabled} />
    <ListingCategoryFields form={draft.form} music={music} conditions={conditionPolicy?.conditions} conditionRequired={conditionPolicy?.conditionRequired} simpleVinylCondition={Boolean(vinylPolicy)} metadataLoading={!vinylPolicy && (metadata.isLoading || metadata.isFetching)} metadataError={!vinylPolicy ? metadata.error?.message : undefined} onRetryConditions={!vinylPolicy ? () => void metadata.refetch() : undefined} onChange={draft.change} disabled={disabled} suggesting={category.busy} suggestion={category.suggestion} onSuggest={() => void category.suggest()} />
    <EbayItemSpecifics categoryId={categoryId} aspects={metadata.data?.aspects || []} value={draft.form.item_specifics} disabled={disabled} onChanged={value => draft.change('item_specifics', value)} />
    <MusicItemSpecifics item={draft.item} values={draft.form.music_values as MusicValues | undefined} aspects={metadata.data?.aspects} disabled={disabled} onChanged={values => { draft.change('music_values', values); const description = syncMusicConditionText(String(draft.formRef.current.description || ''), values); if (description !== draft.formRef.current.description) draft.change('description', description); }} />
  </div>;
}
