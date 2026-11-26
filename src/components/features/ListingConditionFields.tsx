import { ebayConditionId, supportedEbayCondition, type EbayCondition } from '@/lib/ebayMusicContract';
interface ListingConditionFieldsProps {
  form: Record<string, unknown>; disabled: boolean; onChange: (key: string, value: unknown) => void;
  music: boolean; conditions?: EbayCondition[]; conditionRequired?: boolean; simpleVinylCondition: boolean;
  metadataLoading: boolean; metadataError?: string; onRetryConditions?: () => void;
}
export default function ListingConditionFields({ form, disabled, onChange, music, conditions, conditionRequired, simpleVinylCondition, metadataLoading, metadataError, onRetryConditions }: ListingConditionFieldsProps) {
  const options = conditions ?? [], policyLoaded = conditionRequired !== undefined;
  const savedCondition = Object.prototype.hasOwnProperty.call(form, 'condition_id') ? String(form.condition_id ?? '') : ebayConditionId(form.condition);
  const invalidSavedCondition = policyLoaded && savedCondition && !supportedEbayCondition(savedCondition, options, conditionRequired === true);
  const selected = invalidSavedCondition || !policyLoaded ? '' : savedCondition;
  return <div><label htmlFor="listing-condition">eBay item condition</label>
    <select id="listing-condition" value={selected} disabled={disabled || !form.category_id || !policyLoaded || options.length === 0} onChange={event => { const option = options.find(row => row.id === event.target.value); onChange('condition', option?.label || ''); onChange('condition_id', event.target.value); }} className="input-field mt-2"><option value="">{metadataLoading && music && !simpleVinylCondition ? 'Loading eBay conditions…' : 'Choose eBay item condition'}</option>{options.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select>
    {simpleVinylCondition && <p className="mt-2 text-sm text-muted-foreground">Choose New or Used. Record and sleeve grades are saved separately; eBay checks the selected condition when you submit.</p>}
    {invalidSavedCondition && <p role="alert" className="mt-2 text-sm text-warning">Saved eBay condition “{String(form.condition || savedCondition)}” (ID {savedCondition}) is not supported by this category. Choose a supported option shown here and save this draft; your record and sleeve grades stay unchanged.</p>}
    {!policyLoaded && <p role="status" className="mt-2 text-sm text-muted-foreground">{!form.category_id ? 'No saved eBay category ID. Use Find eBay category and confirm a final category before choosing a condition.' : metadataLoading ? 'Checking conditions supported by the current eBay category…' : 'No condition policy has loaded. Retry the lookup; this category has no verified recovery options.'}</p>}
    {policyLoaded && conditionRequired === false && options.length === 0 && <div className="mt-2 space-y-2"><p className="text-sm text-muted-foreground">eBay does not require a condition for this category.</p>{savedCondition && <button type="button" className="btn-secondary min-h-11" disabled={disabled} onClick={() => { onChange('condition_id', ''); onChange('condition', ''); }}>Clear the saved, unsupported eBay condition</button>}</div>}
    {Boolean(form.category_id) && (metadataError || !policyLoaded && !metadataLoading) && onRetryConditions && <button type="button" className="btn-secondary mt-2 min-h-11" onClick={onRetryConditions} disabled={disabled || metadataLoading}>Retry eBay condition lookup</button>}
    <p className="mt-2 text-base leading-7 text-muted-foreground">{music ? 'Item condition is separate from Record / CD / Cassette and sleeve / case grading above. Brand New requires unopened, unused stock.' : 'The shared eBay service validates the supported conditions for this category.'}</p>
  </div>;
}
