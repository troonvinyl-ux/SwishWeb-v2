import type { SupabaseClient } from '@supabase/supabase-js';
import { activateModuleScope } from '@/lib/moduleScope';
import { listingNicheId } from '@/lib/listingSubmission';
import { availableItemPhotos, asRecord } from '@/lib/itemPhotos';
import { permanentListingPhoto, publicationBlock } from '@/lib/listingReadiness';
import { listingSpecifics, type ConfirmedMusicDetails, type ListingEditorSaveResult } from '@/lib/listingEditorData';
import { retainListingEditorMetadata } from '@/lib/listingEditorMetadata';
import { ebayConditionId, ebayMusicGrade, musicGradeAspects, normalizeMusicSpecifics, type EbayAspect } from '@/lib/ebayMusicContract';
import { musicSpecifics } from '@/lib/musicListing';
import { musicFormSchema } from '@/lib/musicValidation';
import type { MusicValues } from '@/types/music';
import { syncMusicConditionText } from '@/lib/musicConditionText';
import { jsonEqual } from '@/lib/jsonEquality';
import { coinListingCategoryIssue } from '@/lib/listingCoinCategory';
interface EditorSaveInput { client: SupabaseClient; userId: string; tenantId: string; form: Record<string, unknown>; item: Record<string, unknown>; photos: string[]; uploads: string[]; confirmedMusic?: ConfirmedMusicDetails; aspects?: EbayAspect[]; }
interface ReadbackMismatch { field: string; expected: unknown; actual: unknown; }
const sameValue = (expected: unknown, actual: unknown) => jsonEqual(expected, actual);
const mismatch = (field: string, expected: unknown, actual: unknown): ReadbackMismatch | null => sameValue(expected, actual) ? null : { field, expected, actual };
const numericMismatch = (field: string, expected: number, actual: unknown): ReadbackMismatch | null => actual === null || actual === undefined ? mismatch(field, expected, actual) : mismatch(field, expected, Number(actual));
const normalizedSpecifics = (value: unknown) => Object.entries(listingSpecifics(value)).sort(([left], [right]) => left.localeCompare(right));
/** Report individual persisted fields without treating a valid draft as publishable. */
function throwReadbackMismatch(stage: 'atomic save' | 'metadata retention', listingId: unknown, mismatches: ReadbackMismatch[]) {
  console.warn('[SWISH Editor] saved draft readback mismatch', { stage, listingId, mismatches });
  const fields = mismatches.map(value => value.field).join(', ');
  throw new Error(`SWISH ${stage} readback differs for: ${fields}. Your edits remain on screen; no eBay submission was requested. Reload this same draft and retry.`);
}
/** Native listingEditorService's atomic RPC, not web-only listings columns. */
export async function saveSharedListingEditor({ client, userId, tenantId, form, item, photos, uploads, confirmedMusic, aspects = [] }: EditorSaveInput): Promise<ListingEditorSaveResult> {
  if (!form.id || form.tenant_id !== tenantId || item.tenant_id !== tenantId || item.id !== form.item_id) throw new Error('Open a saved listing and its stock item in this workspace.');
  if (publicationBlock(form)) throw new Error('Inspect the existing submission before editing this draft.');
  const categoryIssue = coinListingCategoryIssue(form, item);
  if (form.category_id && categoryIssue) throw new Error(categoryIssue);
  const title = String(form.title || '').trim(), price = Number(form.price), quantity = Number(form.quantity || 1);
  if (!title || title.length > 80 || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 1) throw new Error('Enter a title of up to 80 characters, a non-negative price and a whole quantity.');
  const shipping = Number(form.shipping_cost || 0), floor = Number(form.floor_price || 0), ceiling = Number(form.ceiling_price || 0);
  if ([shipping, floor, ceiling].some(value => !Number.isFinite(value) || value < 0)) throw new Error('Enter valid non-negative shipping and price limits.');
  const allowed = new Set([...availableItemPhotos(item), ...uploads]);
  if (photos.length > 12 || photos.some(url => !permanentListingPhoto(url) || !allowed.has(url))) throw new Error('Use up to 12 saved item photos. Uploaded photos will be attached to this same item.');
  await activateModuleScope(client, userId, tenantId, listingNicheId(item));
  const attrs = asRecord(item.attributes);
  const music = confirmedMusic || {};
  if (Object.keys(music).length && item.specialist_id !== 'vinyl_records') throw new Error('Music corrections require the original Tunes Flip stock item.');
  const parsed = form.music_values ? musicFormSchema.safeParse(form.music_values) : null;
  if (parsed && !parsed.success) throw new Error(parsed.error.issues[0]?.message || 'Check the edited music details.');
  const musicValues = parsed?.success ? parsed.data as MusicValues : null;
  // A scan may prepare evidence-backed specifics before the seller opens the
  // editor. Prefer the seller's in-editor changes when present, while retaining
  // existing specifics for older drafts that have not been opened yet.
  let specificsMap = Object.prototype.hasOwnProperty.call(form, 'item_specifics')
    ? listingSpecifics(form.item_specifics)
    : listingSpecifics(attrs.ebay_item_specifics);
  if (item.specialist_id === 'vinyl_records') {
    if (musicValues) {
      const names = musicGradeAspects(musicValues.format);
      for (const name of ['Record Grading', 'Sleeve Grading', 'CD Grading', 'Cassette Condition', 'Case Condition']) if (name !== names.media && name !== names.sleeve) delete specificsMap[name];
      for (const [key, name] of [['media_grade', names.media], ['sleeve_grade', names.sleeve]] as const) { if (musicValues[key]) specificsMap[name] = ebayMusicGrade(musicValues[key]); else delete specificsMap[name]; }
      specificsMap = { ...specificsMap, ...musicSpecifics(musicValues) };
    }
    specificsMap = normalizeMusicSpecifics(specificsMap, aspects);
  }
  for (const key of ['media_grade', 'sleeve_grade'] as const) if (music[key]) {
    if (!/^(M|NM|EX|VG\+|VG|G\+|G|F|P|W)$/.test(music[key]!)) throw new Error('Choose a supported media or sleeve grade.');
    const names = musicGradeAspects(musicValues?.format || attrs.format);
    const name = key === 'media_grade' ? names.media : names.sleeve;
    specificsMap[name] = ebayMusicGrade(music[key], aspects.find(row => row.name === name)?.values);
  }
  const specifics = Object.entries(specificsMap).map(([name, value]) => ({ name: name.trim(), value: String(value).trim() })).filter(value => value.name && value.value);
  if (specifics.length > 25 || new Set(specifics.map(value => value.name.toLowerCase())).size !== specifics.length || specifics.some(value => value.name.length > 65 || value.value.length > 65)) throw new Error('eBay specifics must be unique and no more than 65 characters per name/value. Edit the music specifics; no value was truncated.');
  const conditionNotes = String(form.condition_description ?? item.condition_notes ?? item.condition_grade ?? '');
  // A partially hydrated editor must not erase the selected eBay category or
  // condition stored with the draft. Reuse the saved condition ID only for the
  // same category; a category change requires a fresh compatible selection.
  const savedCategoryId = String(attrs.ebay_category_id || item.ebay_category_id || '');
  const categoryId = String(Object.prototype.hasOwnProperty.call(form, 'category_id') ? form.category_id ?? '' : savedCategoryId).trim();
  const categoryChanged = categoryId !== savedCategoryId;
  const categoryName = String(form.category || (!categoryChanged ? attrs.ebay_category_name || item.ebay_category_name : '') || '').trim();
  const conditionId = String(Object.prototype.hasOwnProperty.call(form, 'condition_id') ? form.condition_id ?? '' : (!categoryChanged ? attrs.ebay_condition_id || item.ebay_condition_id || ebayConditionId(form.condition) : '') || '').trim();
  const description = musicValues ? syncMusicConditionText(String(form.description || ''), musicValues) : String(form.description || '');
  if (conditionNotes.length > 1000) throw new Error('Keep eBay condition notes to 1,000 characters.');
  const listingOptions = { listingType: form.listing_type === 'Chinese' ? 'Chinese' : 'FixedPriceItem', auctionDays: Number(form.auction_duration || 7), startPrice: String(form.start_price || price), reservePrice: String(form.reserve_price || ''), bestOfferEnabled: form.best_offer_enabled === true, dispatchDays: Number(form.dispatch_days || 3) };
  const response = await client.rpc('swish_save_listing_editor', {
    p_tenant_id: tenantId, p_listing_id: String(form.id),
    p_listing_patch: { title, description, price, shipping_cost: shipping, floor_price: floor, ceiling_price: ceiling, category_id: categoryId || null },
    p_item_patch: { condition: String(form.condition || item.condition || ''), condition_grade: conditionNotes, condition_notes: conditionNotes, quantity, sku: String(form.sku || item.sku || ''), ebay_category_id: categoryId, ebay_category_name: categoryName, ebay_condition_id: conditionId, ebay_listing_media: photos, ebay_listing_options: listingOptions },
    p_specifics: specifics,
  });
  if (response.error) throw new Error(response.error.message);
  if (!response.data) throw new Error('SWISH did not confirm the editor save. Reopen this saved draft; it was not published.');
  const [read, current] = await Promise.all([
    client.from('listings').select('*').eq('id', form.id).eq('tenant_id', tenantId).single(),
    client.from('items').select('*').eq('id', item.id).eq('tenant_id', tenantId).single(),
  ]);
  if (read.error || !read.data || current.error || !current.data) throw new Error(read.error?.message || current.error?.message || 'Save completed but readback is unavailable. Your edits remain on screen.');
  // The shared RPC writes premium-editor notes to condition_notes. It retains
  // condition_grade for legacy stock, so comparing condition_grade here created
  // a false unsafe-save warning for every correctly saved vinyl draft.
  const currentNotes = current.data.condition_notes;
  const legacyNotes = current.data.condition_grade;
  const persistedNotes = currentNotes === null || currentNotes === undefined || (currentNotes === '' && legacyNotes === conditionNotes) ? legacyNotes : currentNotes;
  const atomicMismatches = [
    mismatch('listing.title', title, read.data.title),
    mismatch('listing.description', description, read.data.description),
    numericMismatch('listing.price', price, read.data.price),
    numericMismatch('listing.shipping_cost', shipping, read.data.shipping_cost),
    numericMismatch('listing.floor_price', floor, read.data.floor_price),
    numericMismatch('listing.ceiling_price', ceiling, read.data.ceiling_price),
    mismatch('listing.category_id', categoryId, String(read.data.category_id || '')),
    mismatch('item.condition', String(form.condition || item.condition || ''), String(current.data.condition || '')),
    mismatch('item.condition_notes', conditionNotes, String(persistedNotes || '')),
    numericMismatch('item.quantity', quantity, current.data.quantity),
    mismatch('item.sku', String(form.sku || item.sku || ''), String(current.data.sku || '')),
    mismatch('item.attributes.ebay_item_specifics', normalizedSpecifics(specifics), normalizedSpecifics(asRecord(current.data.attributes).ebay_item_specifics)),
  ].filter((value): value is ReadbackMismatch => Boolean(value));
  if (atomicMismatches.length) throwReadbackMismatch('atomic save', form.id, atomicMismatches);
  const retained = await retainListingEditorMetadata({ client, item: current.data, form: { ...form, category_id: categoryId, category: categoryName, condition_id: conditionId }, photos, uploads, options: listingOptions, confirmedMusic, categoryChanged });
  const retainedAttrs = asRecord(retained.attributes);
  const retainedMismatches = [
    mismatch('item.condition', String(form.condition || item.condition || ''), String(retained.condition || '')),
    mismatch('item.condition_notes', conditionNotes, String(retained.condition_notes || '')),
    mismatch('item.attributes.ebay_category_id', categoryId, String(retainedAttrs.ebay_category_id || '')),
    mismatch('item.attributes.ebay_category_name', categoryName, String(retainedAttrs.ebay_category_name || '')),
    mismatch('item.attributes.ebay_condition_id', conditionId, String(retainedAttrs.ebay_condition_id || '')),
    mismatch('item.attributes.ebay_item_specifics', normalizedSpecifics(specifics), normalizedSpecifics(retainedAttrs.ebay_item_specifics)),
    mismatch('item.attributes.ebay_listing_media', photos, retainedAttrs.ebay_listing_media),
    mismatch('item.attributes.ebay_listing_options', listingOptions, retainedAttrs.ebay_listing_options),
  ].filter((value): value is ReadbackMismatch => Boolean(value));
  if (retainedMismatches.length) throwReadbackMismatch('metadata retention', form.id, retainedMismatches);
  console.log('[SWISH Editor] Category and condition readback confirmed');
  return { listing: read.data, item: retained };
}
