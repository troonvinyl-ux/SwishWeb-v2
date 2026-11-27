import { useState } from 'react';
import { Image, FileText, ListChecks, Truck, Tag, ChevronRight, Sparkles, BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { itemPricing } from '@/lib/itemPricing';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { useListingEditorDraft } from '@/hooks/useListingEditorDraft';
import { useListingEditorActions } from '@/hooks/useListingEditorActions';
import { useListingCategorySuggestion } from '@/hooks/useListingCategorySuggestion';
import { useCoinSpecificPrefill } from '@/hooks/useCoinSpecificPrefill';
import ListingCoinIdentity from '@/components/features/ListingCoinIdentity';
import { useListingPhotoUploads } from '@/hooks/useListingPhotoUploads';
import { useListingCoinPhotoPreparation } from '@/hooks/useListingCoinPhotoPreparation';
import { syncMusicConditionText } from '@/lib/musicConditionText';
import { publicationBlock } from '@/lib/listingReadiness';
import { listingNicheId } from '@/lib/listingSubmission';
import { coinListingCategoryIssue } from '@/lib/listingCoinCategory';
import { getActiveNicheId } from '@/lib/niche';
import { useEbayCategoryMetadata } from '@/hooks/useEbayCategoryMetadata';
import type { MusicValues } from '@/types/music';
import ListingMarketSummary from '@/components/features/ListingMarketSummary';
import ListingReadySummary from '@/components/features/ListingReadySummary';
import ListingQuickPrice from '@/components/features/ListingQuickPrice';
import ListingPublishConfirmation from '@/components/features/ListingPublishConfirmation';
import RapidListingFooter from '@/components/features/RapidListingFooter';
import RapidCoinPriceChoices from '@/components/features/RapidCoinPriceChoices';
import type { RapidCoinJob } from '@/types/rapidCoin';
import { listingDescriptionText } from '@/lib/listingPresentation';
import PublicationStatus from '@/components/features/PublicationStatus';
import ListingPublishFeedback from '@/components/features/ListingPublishFeedback';
import ListingEditorPhotos from '@/components/features/ListingEditorPhotos';
import ListingTitleFields from '@/components/features/ListingTitleFields';
import ListingDeliveryPolicy from '@/components/features/ListingDeliveryPolicy';
import ListingSaleFields from '@/components/features/ListingSaleFields';
import ListingCategoryFields from '@/components/features/ListingCategoryFields';
import ListingCategoryBrowser from '@/components/features/ListingCategoryBrowser';
import EbayItemSpecifics from '@/components/features/EbayItemSpecifics';
import MusicItemSpecifics from '@/components/features/MusicItemSpecifics';
import { supportedEbayCondition, vinylRecordConditionPolicy } from '@/lib/ebayMusicContract';

interface ListingEditorProps { listingId?: string; rapid?: { job: RapidCoinJob; approved: boolean; onNext: () => void }; }
export default function ListingEditor({ listingId, rapid }: ListingEditorProps = {}) {
  const { id: routeId } = useParams<{ id: string }>(), id = listingId || routeId, { user } = useAuth(), tenant = useCurrentTenantId();
  const [params, setParams] = useSearchParams(), navigate = useNavigate();
  const requestedSection = params.get('section') || 'overview';
  const section = ['overview','description','specifics','pricing','delivery','photos','research','preview'].includes(requestedSection) ? requestedSection : 'overview';
  const open = (next: string) => { const p = new URLSearchParams(params); if (next === 'overview') p.delete('section'); else p.set('section', next); setParams(p, { replace: true }); };
  const [confirming, setConfirming] = useState(false);
  const [recoveryItemNumber, setRecoveryItemNumber] = useState('');
  const draft = useListingEditorDraft(id, tenant.tenantId);
  const coinStudio = useListingCoinPhotoPreparation(draft, user?.id, tenant.tenantId);
  const upload = useListingPhotoUploads(String(draft.form.item_id || ''), urls => draft.setPhotos(current => [...current, ...urls]));
  const nicheId = draft.item ? listingNicheId(draft.item) : getActiveNicheId();
  const specialistId = String(draft.item?.specialist_id || '');
  const categoryId = String(draft.form.category_id || '').trim();
  const categoryIssue = coinListingCategoryIssue(draft.form, draft.item);
  const music = specialistId === 'vinyl_records';
  const vinylPolicy = vinylRecordConditionPolicy(categoryId, specialistId);
  const metadata = useEbayCategoryMetadata(user?.id, tenant.tenantId, nicheId, categoryIssue ? '' : categoryId, specialistId);
  const conditionPolicy = vinylPolicy ?? metadata.data;
  const actions = useListingEditorActions(draft, user?.id, tenant.tenantId, upload.photos.map(photo => photo.url), metadata.data?.aspects);
  const category = useListingCategorySuggestion(draft, user?.id, tenant.tenantId);
  // New / Used for EBAY_GB Vinyl Records is available immediately; eBay's
  // shared backend still validates actual category policy at publication.
  useCoinSpecificPrefill(draft, metadata.data?.aspects, nicheId, actions.busy || category.busy || Boolean(categoryIssue || publicationBlock(draft.form)));
  const conditionReady = Boolean(!categoryIssue && categoryId && conditionPolicy &&
    supportedEbayCondition(draft.form.condition_id, conditionPolicy.conditions, conditionPolicy.conditionRequired));
  const disabled = actions.busy || coinStudio.busy || upload.busy || category.busy || Boolean(publicationBlock(draft.form));
  if (tenant.isLoading || draft.loading) return <div role="status" className="swish-card p-6 text-muted-foreground">Loading the shared SWISH listing…</div>;
  if (tenant.error || draft.error) return <section role="alert" className="swish-card space-y-4 p-5"><h1 className="text-xl font-semibold">Listing unavailable</h1><p>{tenant.error?.message || draft.error?.message}</p><Link to="/listings" className="btn-secondary">Back to listings</Link></section>;
  const selectedSpecifics = draft.form.item_specifics && typeof draft.form.item_specifics === 'object' ? draft.form.item_specifics as Record<string, unknown> : {};
  const specificsReady = !categoryIssue && Boolean(metadata.data) && !metadata.data?.aspectError && (metadata.data?.aspects || []).every(aspect => !aspect.required || (typeof selectedSpecifics[aspect.name] === 'string' && String(selectedSpecifics[aspect.name]).trim() && (!aspect.selectionOnly || aspect.values.includes(String(selectedSpecifics[aspect.name])))));
  const price = itemPricing(draft.item, draft.form);
  const active = ['active', 'live'].includes(String(draft.form.status));
  const auction = draft.form.listing_type === 'Chinese';
  const sellingPrice = auction ? Number(draft.form.start_price || draft.form.price) : price.actual;
  const hasPrice = sellingPrice !== null && Number.isFinite(sellingPrice) && sellingPrice > 0;
  const resolveHelp = (target: string) => {
    if (target === 'status') { void actions.checkStatus(); return; }
    if (target === 'connection') { navigate('/ebay'); return; }
    if (target === 'account') { navigate('/ebay/account'); return; }
    if (target === 'inventory') { navigate(`/inventory/${draft.form.item_id}`); return; }
    open(target === 'delivery' ? 'delivery' : target);
    if (target === 'specifics') void metadata.refetch();
  };
  const rows = [
    { key: 'description', label: 'Title & description', hint: draft.form.title ? 'View or edit' : 'Add a title', Icon: FileText },
    { key: 'specifics', label: 'Listing specifics', hint: conditionReady && specificsReady ? 'Review item details' : 'Check required details', Icon: ListChecks },
    { key: 'pricing', label: 'Pricing', hint: price.actual === null ? 'Set your price' : formatCurrency(price.actual), Icon: Tag },
    { key: 'delivery', label: 'Delivery', hint: 'View selected postage and collection', Icon: Truck },
    { key: 'research', label: 'Research & valuation', hint: 'More information', Icon: BarChart3 },
  ];
  const row = (entry: typeof rows[number]) => <button key={entry.key} type="button" className="flip-row" onClick={() => open(entry.key)}><entry.Icon size={22}/><span><strong>{entry.label}</strong><small>{entry.hint}</small></span><ChevronRight size={20}/></button>;
  const canSubmit = actions.canPublish && !coinStudio.busy && !upload.busy && !category.busy && conditionReady && specificsReady && draft.photos.length > 0 && Boolean(String(draft.form.title || '').trim()) && hasPrice;
  const missing = categoryIssue || (!conditionReady || !specificsReady ? 'Check the category, condition and required item details.' : !draft.photos.length ? 'Add a listing photo.' : !String(draft.form.title || '').trim() ? 'Add a title.' : !hasPrice ? 'Set your selling price.' : '');
  return <div className="flip-listing w-full min-w-0 max-w-4xl mx-auto space-y-4">
    <header className="flip-header"><Link to={rapid ? '/rapid/coins' : `/listings/${id}`} className="btn-ghost" aria-label="Back to saved listing"><ArrowLeft size={22}/></Link><span className="flip-brand">SWISH<span>Flip</span></span><button type="button" className="btn-ghost" onClick={() => void actions.checkStatus()} disabled={actions.busy || !draft.form.id} aria-label="Refresh status"><RefreshCw size={20}/></button></header>
    <PublicationStatus reason={actions.reason} externalId={actions.publicationExternalId} refreshing={actions.checking} onRefresh={() => void actions.checkStatus()} />
    <ListingPublishFeedback message={actions.error} help={actions.help} onResolve={resolveHelp} />
    {Boolean(draft.form.publish_claim_id) && !draft.form.external_listing_id &&
      <section key={id} className="swish-card space-y-3 p-4">
        <h2 className="font-semibold">Check the original submission</h2><p className="text-base leading-7 text-muted-foreground">If this coin is not on eBay, use Refresh status or eBay sync first. An item number is needed only when eBay actually created a listing; SWISH must verify the original claim before retrying.</p>
        <label htmlFor="recovery-item-number" className="block">eBay item number</label>
        <input id="recovery-item-number" className="input-field" inputMode="numeric" maxLength={20}
          value={recoveryItemNumber || actions.publicationExternalId}
          onChange={event => setRecoveryItemNumber(event.target.value.replace(/\D/g, ''))} />
        <button type="button" className="btn-secondary"
          disabled={actions.busy || draft.dirty || !/^\d{6,20}$/.test(recoveryItemNumber || actions.publicationExternalId)}
          onClick={() => void actions.recoverPending(recoveryItemNumber || actions.publicationExternalId)}>
          {actions.checking ? 'Checking eBay…' : 'Link existing eBay listing'}
        </button>
      </section>}
    <div hidden={section !== 'overview'}>
      <h1 className="flip-heading">{active ? 'Your live listing' : 'Ready to list'}</h1><p className="mb-4 text-muted-foreground">{draft.dirty ? 'Unsaved changes · Review your edits before publishing' : active ? 'Saved eBay identity · Refresh to verify the marketplace state' : 'Saved draft · Review the actual item, price and delivery'}</p>
      <div className="flip-overview-grid">
        <ListingReadySummary form={draft.form} item={draft.item} photos={draft.photos} onOpen={open} />
        <div className="space-y-3"><ListingQuickPrice value={auction ? draft.form.start_price || draft.form.price : draft.form.price} auction={auction} disabled={disabled} onChange={value => draft.change(auction ? 'start_price' : 'price', value)} onOpen={() => open('pricing')} />
        {rapid && <RapidCoinPriceChoices item={draft.item} disabled={disabled} onApply={value => draft.change(auction ? 'start_price' : 'price', value)} />}
        {missing && <button type="button" className="flip-advice" onClick={() => open(!conditionReady || !specificsReady ? 'specifics' : !draft.photos.length ? 'photos' : !String(draft.form.title || '').trim() ? 'description' : 'pricing')}><Sparkles size={20}/><span>{missing}</span><ChevronRight size={18}/></button>}
        {draft.form.id && draft.form.marketplace_id === 'ebay' && <section className="space-y-2 rounded-xl border border-border p-3"><h2 className="font-semibold">SWISH listing status · {active ? 'Live' : String(draft.form.status || 'Draft').replace(/_/g, ' ')}</h2><p className="text-sm text-muted-foreground">Marketplace status and stock are reconciled by the shared service, not changed locally.</p><button type="button" className="btn-secondary min-h-11" disabled={actions.busy} onClick={() => void actions.checkStatus()}>Refresh saved status</button></section>}
        <div className="space-y-1">{row({ key: 'photos', label: 'Coin & listing photos', hint: `${draft.photos.length} selected · Prepare centred white photos`, Icon: Image })}{rows.map(row)}<Link className="flip-row" to={`/inventory/${draft.form.item_id}`}><ListChecks size={22}/><span><strong>Advanced details</strong><small>Inventory, cost and specialist information</small></span><ChevronRight size={20}/></Link></div>
        {!rapid && !publicationBlock(draft.form) && <button type="button" className="flip-primary" disabled={!canSubmit} onClick={() => setConfirming(true)}>{actions.publishing ? 'Publishing…' : 'List on eBay'}</button>}
        {!canSubmit && !active && <p className="text-sm text-muted-foreground">{actions.reason || missing || 'Wait for the listing checks to finish, or save your draft.'}</p>}
        <ListingPublishConfirmation open={confirming && canSubmit} onOpenChange={setConfirming} onConfirm={() => { setConfirming(false); void actions.publish(); }} />
        {!rapid && <button type="button" onClick={() => void actions.save()} disabled={disabled || !tenant.tenantId || !draft.form.id} className="flip-secondary">{actions.saving ? 'Saving…' : 'Save for later'}</button>}
        <p className="text-center text-sm text-muted-foreground">Prepared with SWISH · Seller-reviewed before publication</p></div>
      </div>
    </div>
    {section !== 'overview' && <div className="flex items-center gap-3"><button type="button" className="btn-ghost" onClick={() => open('overview')}><ArrowLeft size={20}/> Overview</button><h1 className="flip-heading">{section === 'photos' ? 'Your photos' : section === 'preview' ? 'Preview listing' : rows.find(r => r.key === section)?.label || 'Listing details'}</h1></div>}
    <div hidden={section !== 'description'} className="space-y-3"><p className="flip-advice"><Sparkles size={20}/> Check your title and buyer description.</p>
    <ListingTitleFields form={draft.form} onChange={draft.change} disabled={disabled} />
      <button type="button" className="flip-row" onClick={() => open('specifics')}><ListChecks size={20}/><span><strong>Condition</strong><small>{String(draft.form.condition || 'Choose condition')}</small></span><ChevronRight size={20}/></button>
      <button type="button" className="flip-row" onClick={() => open('photos')}><Image size={20}/><span><strong>Photos for buyers</strong><small>{draft.photos.length} selected · Manage photos</small></span><ChevronRight size={20}/></button>
      <button type="button" className="flip-row" onClick={() => open('preview')}><FileText size={20}/><span><strong>Preview listing</strong><small>See your buyer-facing text</small></span><ChevronRight size={20}/></button><div className="flex gap-2">{draft.photos.slice(0,3).map(url => <img key={url} src={url} alt="Selected buyer photo" className="w-24 h-24 object-contain rounded-lg border border-border"/>)}</div>
    </div>
    <div hidden={section !== 'photos'}>    <ListingEditorPhotos draft={draft} upload={upload} disabled={disabled} coinStudio={coinStudio} /></div>
    <div hidden={section !== 'specifics'} className="space-y-3">
    {!specificsReady && <p role="status" className="flip-advice">Check the required item specifics. {metadata.data?.aspectError || ''}</p>}
    {nicheId === 'coins' && <ListingCoinIdentity item={draft.item} title={String(draft.form.title || '')} form={draft.form} disabled={disabled} onChange={draft.change} />}
    {category.progress && <p role="status" className="text-base text-muted-foreground">{category.progress}</p>}
    <ListingCategoryFields form={draft.form} music={music} coins={nicheId === 'coins'} categoryError={categoryIssue || category.error} conditions={conditionPolicy?.conditions} conditionRequired={conditionPolicy?.conditionRequired} simpleVinylCondition={Boolean(vinylPolicy)} metadataLoading={!vinylPolicy && (metadata.isLoading || metadata.isFetching)} metadataError={!vinylPolicy ? metadata.error?.message : undefined} onRetryConditions={!vinylPolicy ? () => void metadata.refetch() : undefined} onChange={draft.change} disabled={disabled} suggesting={category.busy} suggestion={category.suggestion} onSuggest={() => void category.suggest()} />
    {nicheId === 'coins' && <ListingCategoryBrowser browser={category.browser} disabled={disabled} />}
    <EbayItemSpecifics categoryId={categoryId} aspects={metadata.data?.aspects || []} value={draft.form.item_specifics} disabled={disabled} onChanged={value => draft.change('item_specifics', value)} />
    <MusicItemSpecifics item={draft.item} values={draft.form.music_values as MusicValues | undefined} aspects={metadata.data?.aspects} disabled={disabled} onChanged={values => { draft.change('music_values', values); const description = syncMusicConditionText(String(draft.formRef.current.description || ''), values); if (description !== draft.formRef.current.description) draft.change('description', description); }} />

    </div>
    {section === 'pricing' && <div className="space-y-3">
      {price.suggested !== null && <div className="flip-advice"><Sparkles size={24}/><div><small>SWISH AI suggestion</small><p className="text-3xl font-bold">{formatCurrency(price.suggested)}</p><button type="button" className="btn-secondary mt-2" disabled={disabled} onClick={() => draft.change('price',price.suggested)}>Use suggested price</button></div></div>}
      <ListingSaleFields form={draft.form} item={draft.item} onChange={draft.change} disabled={disabled} section="pricing" />
      <button className="flip-row" type="button" onClick={() => open('research')}><BarChart3 size={20}/><span><strong>Market research</strong><small>View pricing evidence</small></span><ChevronRight size={20}/></button>
    </div>}
    {section === 'delivery' && <div><ListingSaleFields form={draft.form} item={draft.item} onChange={draft.change} disabled={disabled} section="delivery" deliveryPolicy={<ListingDeliveryPolicy userId={user?.id} tenantId={tenant.tenantId} nicheId={nicheId} externalId={String(draft.form.external_listing_id || '')} />} /></div>}
    <div hidden={section !== 'research'}>    <ListingMarketSummary item={draft.item} userId={user?.id} tenantId={tenant.tenantId} nicheId={nicheId} disabled={disabled} onApply={price => draft.change('price', price)} />
</div>
    {section === 'preview' && <section className="swish-card p-4 space-y-3">{draft.photos[0] && <img src={draft.photos[0]} alt="Listing cover" className="w-full max-h-72 object-contain"/>}<h2 className="text-xl font-bold">{String(draft.form.title || '')}</h2><p className="text-2xl font-bold">{price.actual === null ? 'Price not set' : formatCurrency(price.actual)}</p><p>{String(draft.form.condition || '')}</p><p className="whitespace-pre-wrap break-words">{listingDescriptionText(draft.form.description)}</p><p className="text-sm text-muted-foreground">Draft preview · final buyer charges and delivery are confirmed by eBay.</p></section>}
    {!rapid && section !== 'overview' && <button type="button" className="flip-primary" disabled={disabled} onClick={async () => { if (!draft.dirty || await actions.save()) open('overview'); }}>Done · Save changes</button>}
    {rapid && <RapidListingFooter key={rapid.job.id} job={rapid.job} approved={rapid.approved} actions={actions} canSubmit={canSubmit} loaded={!draft.loading && !metadata.isLoading && !metadata.isFetching && !category.busy && Boolean(categoryIssue || metadata.data || metadata.error)} onNext={rapid.onNext} onEdit={() => open('description')} />}
  </div>;
}
