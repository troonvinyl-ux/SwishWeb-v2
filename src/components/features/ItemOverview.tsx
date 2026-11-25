import { asRecord } from '@/lib/itemPhotos';
import { displayValue } from '@/lib/itemPricing';
import { captureNumistaReference } from '@/lib/numistaCapture';
import NumistaCaptureReview from '@/components/features/NumistaCaptureReview';
import ItemPricingSummary from '@/components/features/ItemPricingSummary';
import { savedIdentification } from '@/lib/identificationResult';
import { identificationText } from '@/lib/identificationFields';
import { getSpecialistIdsForNiche } from '@/lib/niche';
interface ItemOverviewProps { item: Record<string, unknown> | null; listing: Record<string, unknown> | null; }
export default function ItemOverview({ item, listing }: ItemOverviewProps) {
  const attrs = asRecord(item?.attributes), dimensions = asRecord(item?.dimensions_mm), identity = savedIdentification(item);
  const coin = getSpecialistIdsForNiche('coins').includes(String(item?.specialist_id));
  const first = (...values: unknown[]) => values.map(identificationText).find(value => value !== undefined);
  const fields = [
    ['Condition', first(item?.condition, identity.condition)], ['Denomination', first(item?.denomination, identity.denomination)],
    ['Ruler / maker', first(item?.ruler, item?.manufacturer, identity.ruler)], ['Issuer', first(identity.issuer)],
    ['Period', first(item?.period, identity.period)], ['Mint', first(item?.mint, identity.mint)],
    ['Year / date range', first(item?.year_made, identity.year)], ['Country', first(item?.country_of_origin, identity.country)],
    ['Material', first(item?.material, identity.metal)], ['Catalogue reference / hint', first(item?.catalogue_number, identity.reference)],
    ['Weight (g)', first(item?.weight_grams, attrs.supplied_weight_g, attrs.weight_g)], ['Diameter (mm)', first(item?.diameter_mm, dimensions.diameter, attrs.supplied_diameter_mm, attrs.diameter_mm)],
    ['Obverse', first(identity.obverseDescription)], ['Reverse', first(identity.reverseDescription)], ['Visible inscription', first(identity.legendFragment)],
  ].filter(([, value]) => coin || value !== undefined);
  return <div className="space-y-4">
    <ItemPricingSummary item={item} listing={listing} />
    <section className="swish-card p-5 space-y-4"><h2 className="text-lg font-semibold">{listing ? 'Listing details' : 'Item overview'}</h2>
      {listing && <dl className="grid grid-cols-2 gap-4"><div><dt className="text-sm text-muted-foreground">Marketplace</dt><dd>eBay</dd></div><div><dt className="text-sm text-muted-foreground">Status</dt><dd className="capitalize">{displayValue(listing.status)}</dd></div></dl>}
      <p className="leading-relaxed whitespace-pre-line text-muted-foreground">{displayValue(listing?.description || item?.description || identity.description)}</p>
      {fields.length > 0 && <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4">{fields.map(([label, value]) => <div key={String(label)}><dt className="text-sm text-muted-foreground">{String(label)}</dt><dd className="mt-1 break-words">{value === undefined ? 'Unknown — not established' : displayValue(value)}</dd></div>)}</dl>}
    </section>
    {captureNumistaReference(attrs) && <NumistaCaptureReview reference={captureNumistaReference(attrs)} />}
    {listing && <section className="swish-card p-5 space-y-2"><h2 className="text-lg font-semibold">Delivery</h2><p>Check saved eBay delivery settings</p><p className="text-sm text-muted-foreground leading-relaxed">The existing SWISH eBay delivery policy remains unchanged. Check the live listing for its current buyer-facing terms.</p></section>}
    {item && <section className="swish-card p-5 space-y-3"><h2 className="text-lg font-semibold">Inventory</h2><dl className="grid grid-cols-2 gap-4"><div><dt className="text-sm text-muted-foreground">SKU / inventory reference</dt><dd className="break-words">{displayValue(item.inventory_id || item.sku)}</dd></div><div><dt className="text-sm text-muted-foreground">Storage location</dt><dd>{displayValue(item.storage_location || attrs.location)}</dd></div></dl><p className="text-sm text-muted-foreground leading-relaxed">Inventory records describe what you own. SWISH intelligence and the marketplace listing remain separate.</p></section>}
  </div>;
}
