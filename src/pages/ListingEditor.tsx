import { useState } from 'react';
import { Image, FileText, ListChecks, Truck, Tag, ChevronRight, Sparkles, BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { itemPricing } from '@/lib/itemPricing';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
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
import ListingMarketSummary from '@/components/features/ListingMarketSummary';
import PublicationStatus from '@/components/features/PublicationStatus';
import ListingPublishFeedback from '@/components/features/ListingPublishFeedback';
import ListingEditorPhotos from '@/components/features/ListingEditorPhotos';
import ListingTitleFields from '@/components/features/ListingTitleFields';
import ListingDeliveryPolicy from '@/components/features/ListingDeliveryPolicy';
import ListingSaleFields from '@/components/features/ListingSaleFields';
import ListingCategoryFields from '@/components/features/ListingCategoryFields';
import EbayItemSpecifics from '@/components/features/EbayItemSpecifics';
import MusicItemSpecifics from '@/components/features/MusicItemSpecifics';
import { supportedEbayCondition, vinylRecordConditionPolicy } from '@/lib/ebayMusicContract';

export default function ListingEditor() {
  const { id } = useParams<{ id: string }>(), { user } = useAuth(), tenant = useCurrentTenantId();
  const [params, setParams] = useSearchParams();
  const requestedSection = params.get('section') || 'overview';
  const section = ['overview','description','specifics','pricing','delivery','photos','research','preview'].includes(requestedSection) ? requestedSection : 'overview';
  const open = (next: string) => { const p = new URLSearchParams(params); if (next === 'overview') p.delete('section'); else p.set('section', next); setParams(p, { replace: true }); };
  const [confirming, setConfirming] = useState(false);
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
  const conditionReady = Boolean(categoryId && conditionPolicy &&
    supportedEbayCondition(draft.form.condition_id, conditionPolicy.conditions, conditionPolicy.conditionRequired));
  const disabled = actions.busy || upload.busy || category.busy || Boolean(publicationBlock(draft.form));
  if (tenant.isLoading || draft.loading) return <div role="status" className="swish-card p-6 text-muted-foreground">Loading the shared SWISH listing…</div>;
  if (tenant.error || draft.error) return <section role="alert" className="swish-card space-y-4 p-5"><h1 className="text-xl font-semibold">Listing unavailable</h1><p>{tenant.error?.message || draft.error?.message}</p><Link to="/listings" className="btn-secondary">Back to listings</Link></section>;
  const selectedSpecifics = draft.form.item_specifics && typeof draft.form.item_specifics === 'object' ? draft.form.item_specifics as Record<string, unknown> : {};
  const specificsReady = !metadata.data?.aspectError && (metadata.data?.aspects || []).every(aspect => !aspect.required || (typeof selectedSpecifics[aspect.name] === 'string' && String(selectedSpecifics[aspect.name]).trim() && (!aspect.selectionOnly || aspect.values.includes(String(selectedSpecifics[aspect.name])))));
  const price = itemPricing(draft.item, draft.form);
  const active = ['active', 'live'].includes(String(draft.form.status));
  const rows = [
    { key: 'description', label: 'Title & description', hint: draft.form.title ? 'View or edit' : 'Add a title', Icon: FileText },
    { key: 'specifics', label: 'Listing specifics', hint: conditionReady && specificsReady ? 'Review item details' : 'Check required details', Icon: ListChecks },
    { key: 'pricing', label: 'Pricing', hint: price.actual === null ? 'Set your price' : formatCurrency(price.actual), Icon: Tag },
    { key: 'delivery', label: 'Delivery', hint: 'View selected postage and collection', Icon: Truck },
    { key: 'research', label: 'Research & valuation', hint: 'More information', Icon: BarChart3 },
  ];
  const row = (entry: typeof rows[number]) => <button key={entry.key} type="button" className="flip-row" onClick={() => open(entry.key)}><entry.Icon size={22}/><span><strong>{entry.label}</strong><small>{entry.hint}</small></span><ChevronRight size={20}/></button>;
  const canSubmit = actions.canPublish && !upload.busy && !category.busy && conditionReady && specificsReady && draft.photos.length > 0 && Boolean(String(draft.form.title || '').trim()) && price.actual !== null;
  const missing = !conditionReady || !specificsReady ? 'Check the category, condition and required item details.' : !draft.photos.length ? 'Add a listing photo.' : !String(draft.form.title || '').trim() ? 'Add a title.' : price.actual === null ? 'Set your selling price.' : '';
  return <div className="flip-listing w-full min-w-0 max-w-4xl mx-auto space-y-4">
    <header className="flip-header"><Link to={`/listings/${id}`} className="btn-ghost" aria-label="Back to saved listing"><ArrowLeft size={22}/></Link><span className="flip-brand">SWISH<span>Flip</span></span><button type="button" className="btn-ghost" onClick={() => void actions.checkStatus()} disabled={actions.busy || !draft.form.id} aria-label="Refresh status"><RefreshCw size={20}/></button></header>
    <PublicationStatus reason={actions.reason} externalId={actions.publicationExternalId} refreshing={actions.checking} onRefresh={() => void actions.checkStatus()} />
    <ListingPublishFeedback message={actions.error} />
    <div hidden={section !== 'overview'}>
      <h1 className="flip-heading">{active ? 'Your listing is live!' : 'Ready to sell?'}</h1>
      <div className="flip-overview-grid">
        <div><button type="button" className="flip-cover" onClick={() => open('photos')}>{draft.photos[0] ? <img src={draft.photos[0]} alt="Main listing photo"/> : <Image size={48}/>}<span><Image size={18}/>{draft.photos.length} photos · View or edit <ChevronRight size={18}/></span></button><h2 className="text-xl font-bold mt-3 break-words">{String(draft.form.title || 'Your item')}</h2><p className="text-sm text-muted-foreground">{[draft.form.category, draft.form.condition].filter(Boolean).map(String).join(' · ')}</p></div>
        <div className="space-y-3"><button type="button" className="flip-price" onClick={() => open('pricing')}><Tag size={24}/><span><small>{price.actual === null ? 'Suggested selling price' : 'Selling price'}</small><strong>{(price.actual ?? price.suggested) === null ? 'Set price' : formatCurrency((price.actual ?? price.suggested)!)}</strong></span><ChevronRight size={20}/></button>
        {missing && <button type="button" className="flip-advice" onClick={() => open(!conditionReady || !specificsReady ? 'specifics' : !draft.photos.length ? 'photos' : !String(draft.form.title || '').trim() ? 'description' : 'pricing')}><Sparkles size={20}/><span>{missing}</span><ChevronRight size={18}/></button>}
        {draft.form.id && draft.form.marketplace_id === 'ebay' && <div className="space-y-2 rounded-xl border border-border p-3">
          <label htmlFor="manual-listing-status" className="block font-semibold">SWISH listing status</label>
          <select id="manual-listing-status" className="input-field"
            value={draft.form.status === 'live' ? 'active' : String(draft.form.status || '')}
            disabled={actions.busy || upload.busy || draft.dirty}
            onChange={event => {
              const next = event.target.value;
              if (next === 'draft' || next === 'active' || next === 'sold' || next === 'ended') void actions.setManualStatus(next);
            }}>
            <option value="" disabled>Choose status</option>
            {!['draft', 'active', 'live', 'sold', 'ended'].includes(String(draft.form.status || '')) &&
              Boolean(draft.form.status) && <option value={String(draft.form.status)} disabled>{String(draft.form.status)}</option>}
            <option value="draft" disabled={Boolean(draft.form.external_listing_id)}>Draft</option>
            <option value="active">Live</option>
            <option value="sold">Sold</option>
            <option value="ended">Ended</option>
          </select>
          <p className="text-sm text-muted-foreground">{actions.changingStatus ? 'Saving status…' : draft.dirty ? 'Save your edits to change status.' : 'Updates the status in SWISH only.'}</p>
        </div>}
        <div className="space-y-1">{rows.map(row)}<Link className="flip-row" to={`/inventory/${draft.form.item_id}`}><ListChecks size={22}/><span><strong>Advanced details</strong><small>Inventory, cost and specialist information</small></span><ChevronRight size={20}/></Link></div>
        <button type="button" className="flip-primary" disabled={!canSubmit} onClick={() => setConfirming(true)}>{actions.publishing ? 'Publishing…' : 'List on eBay'}</button>
        {!canSubmit && <p className="text-sm text-muted-foreground">{actions.reason || missing || 'Wait for the listing checks to finish, or save your draft.'}</p>}
        {confirming && canSubmit && <div className="flip-advice"><div className="space-y-2"><strong>Publish this listing to your connected eBay account?</strong><p className="text-sm">Check your price, photos, condition and delivery before confirming.</p><div className="flex gap-2 flex-wrap"><button className="btn-primary" type="button" onClick={() => { setConfirming(false); void actions.publish(); }}>Confirm publication</button><button className="btn-secondary" type="button" onClick={() => setConfirming(false)}>Cancel</button></div></div></div>}
        <button type="button" onClick={() => void actions.save()} disabled={disabled || !tenant.tenantId || !draft.form.id} className="flip-secondary">{actions.saving ? 'Saving…' : 'Save for later'}</button>
        <p className="text-center text-sm text-muted-foreground">✦ Powered by SWISH AI</p></div>
      </div>
    </div>
    {section !== 'overview' && <div className="flex items-center gap-3"><button type="button" className="btn-ghost" onClick={() => open('overview')}><ArrowLeft size={20}/> Overview</button><h1 className="flip-heading">{section === 'photos' ? 'Your photos' : section === 'preview' ? 'Preview listing' : rows.find(r => r.key === section)?.label || 'Listing details'}</h1></div>}
    <div hidden={section !== 'description'} className="space-y-3"><p className="flip-advice"><Sparkles size={20}/> Check your title and buyer description.</p>
    <ListingTitleFields form={draft.form} onChange={draft.change} disabled={disabled} />
      <button type="button" className="flip-row" onClick={() => open('specifics')}><ListChecks size={20}/><span><strong>Condition</strong><small>{String(draft.form.condition || 'Choose condition')}</small></span><ChevronRight size={20}/></button>
      <button type="button" className="flip-row" onClick={() => open('photos')}><Image size={20}/><span><strong>Photos for buyers</strong><small>{draft.photos.length} selected · Manage photos</small></span><ChevronRight size={20}/></button>
      <button type="button" className="flip-row" onClick={() => open('preview')}><FileText size={20}/><span><strong>Preview listing</strong><small>See your buyer-facing text</small></span><ChevronRight size={20}/></button><div className="flex gap-2">{draft.photos.slice(0,3).map(url => <img key={url} src={url} alt="Selected buyer photo" className="w-24 h-24 object-contain rounded-lg border border-border"/>)}</div>
    </div>
    <div hidden={section !== 'photos'}>    <ListingEditorPhotos draft={draft} upload={upload} disabled={disabled} /></div>
    <div hidden={section !== 'specifics'} className="space-y-3">
    {!specificsReady && <p role="status" className="flip-advice">Check the required item specifics. {metadata.data?.aspectError || ''}</p>}
    <ListingCategoryFields form={draft.form} music={music} conditions={conditionPolicy?.conditions} conditionRequired={conditionPolicy?.conditionRequired} simpleVinylCondition={Boolean(vinylPolicy)} metadataLoading={!vinylPolicy && (metadata.isLoading || metadata.isFetching)} metadataError={!vinylPolicy ? metadata.error?.message : undefined} onRetryConditions={!vinylPolicy ? () => void metadata.refetch() : undefined} onChange={draft.change} disabled={disabled} suggesting={category.busy} suggestion={category.suggestion} onSuggest={() => void category.suggest()} />
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
    {section === 'preview' && <section className="swish-card p-4 space-y-3">{draft.photos[0] && <img src={draft.photos[0]} alt="Listing cover" className="w-full max-h-72 object-contain"/>}<h2 className="text-xl font-bold">{String(draft.form.title || '')}</h2><p className="text-2xl font-bold">{price.actual === null ? 'Price not set' : formatCurrency(price.actual)}</p><p>{String(draft.form.condition || '')}</p><p className="whitespace-pre-wrap break-words">{String(draft.form.description || '')}</p><p className="text-sm text-muted-foreground">Draft preview · final buyer charges and delivery are confirmed by eBay.</p></section>}
    {section !== 'overview' && <button type="button" className="flip-primary" disabled={disabled} onClick={async () => { if (!draft.dirty || await actions.save()) open('overview'); }}>Done · Save changes</button>}
  </div>;
}
