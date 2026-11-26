import { AlertTriangle, CheckCircle, Tag } from 'lucide-react';
import type { EbayCondition } from '@/lib/ebayMusicContract';
import type { CategorySuggestion } from '@/lib/categoryLookup';
import ListingConditionFields from '@/components/features/ListingConditionFields';
interface ListingCategoryFieldsProps {
  form: Record<string, unknown>; disabled: boolean; suggesting: boolean; suggestion: CategorySuggestion | null;
  onChange: (key: string, value: unknown) => void; onSuggest: () => void; music?: boolean; categoryError?: string | null;
  conditions?: EbayCondition[]; conditionRequired?: boolean; simpleVinylCondition?: boolean; metadataLoading?: boolean;
  metadataError?: string; onRetryConditions?: () => void;
}
export default function ListingCategoryFields({ form, disabled, suggesting, suggestion, onChange, onSuggest, music = false, categoryError, conditions, conditionRequired, simpleVinylCondition = false, metadataLoading = false, metadataError, onRetryConditions }: ListingCategoryFieldsProps) {
  const category = String(form.category || ''), categoryId = String(form.category_id || ''), categoryPath = String(form.category_path || '');
  const changeLabel = (label: string) => {
    onChange('category', label);
    if (label.trim() !== category.trim()) onChange('category_id', '');
    onChange('condition_id', ''); onChange('category_path', ''); onChange('item_specifics', {});
  };
  const useSuggestion = () => {
    if (!suggestion) return;
    const changed = categoryId !== suggestion.id;
    onChange('category', suggestion.name); onChange('category_id', suggestion.id); onChange('category_path', suggestion.categoryPath || '');
    if (changed) { onChange('condition_id', ''); onChange('item_specifics', {}); }
  };
  return <fieldset disabled={disabled} className="swish-card space-y-4 p-4 sm:p-5"><legend className="sr-only">Category and condition</legend>
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Tag size={20} className="text-primary"/>Category &amp; Condition</h2>
    {categoryError && <p role="alert" className="flex items-start gap-2 text-base leading-7 text-warning"><AlertTriangle size={22} className="mt-1 shrink-0"/><span>{categoryError}</span></p>}
    <div><label htmlFor="listing-category">eBay category</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input id="listing-category" value={category} onChange={event => changeLabel(event.target.value)} className="input-field min-w-0 flex-1" placeholder="Find the relevant eBay category"/>
        <button type="button" className="btn-secondary min-h-11 shrink-0" disabled={suggesting} onClick={onSuggest}>{suggesting ? 'Finding category…' : 'Find eBay category'}</button></div>
      {suggestion && !categoryError && <div className="mt-3 space-y-2"><p className="flex items-start gap-2 text-base text-success"><CheckCircle size={20} className="mt-1 shrink-0"/>{categoryId === suggestion.id ? `Selected: ${suggestion.name}` : `Suggestion: ${suggestion.name}`}</p>{categoryId !== suggestion.id && <button type="button" className="btn-secondary min-h-11" onClick={useSuggestion}>Use {suggestion.name}</button>}</div>}
      {categoryId && <p className="mt-2 text-base text-muted-foreground">{categoryError ? 'Category to replace' : 'Selected category'}: {category || 'eBay category'} · {categoryId}</p>}
      {!categoryError && categoryPath && <p className="mt-2 text-sm text-muted-foreground">{categoryPath}</p>}
    </div>
    <ListingConditionFields form={form} disabled={disabled || Boolean(categoryError)} onChange={onChange} music={music} conditions={conditions} conditionRequired={conditionRequired} simpleVinylCondition={simpleVinylCondition} metadataLoading={metadataLoading} metadataError={metadataError} onRetryConditions={onRetryConditions}/>
    <div><label htmlFor="listing-condition-notes">Condition description / flaws</label><textarea id="listing-condition-notes" maxLength={1000} value={String(form.condition_description || '')} onChange={event => onChange('condition_description', event.target.value)} rows={3} className="input-field mt-2" placeholder={music ? 'Media/sleeve wear, playback findings, missing inserts, defects' : 'Visible wear, damage, defects and included or missing components'}/></div>
    {metadataError && <p role="status" className="text-base leading-7 text-muted-foreground">Live eBay condition lookup error: {metadataError}. Saved selections remain; this category still requires a supported eBay condition before submitting.</p>}
    <p className="text-base text-muted-foreground">{music ? 'Category, eBay item condition, separate media/sleeve grading and notes are saved together with this draft.' : 'Category, eBay item condition and notes are saved together with this draft.'}</p>
  </fieldset>;
}
