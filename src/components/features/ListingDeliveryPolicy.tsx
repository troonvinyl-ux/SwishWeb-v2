import { useListingDeliveryPolicy } from '@/hooks/useListingDeliveryPolicy';
import { deliveryCharge as charge, deliveryRegionNames as regionNames } from '@/lib/listingDeliveryPolicy';
import type { ListingDeliveryScope } from '@/types/listingDelivery';
import ListingDeliveryErrorNotice from '@/components/features/ListingDeliveryErrorNotice';

export default function ListingDeliveryPolicy({ userId, tenantId, nicheId, externalId }: ListingDeliveryScope) {
  const lookup = useListingDeliveryPolicy({ userId, tenantId, nicheId, externalId });

  if (externalId) return <p>Check the published delivery options on <a className="underline" href={`https://www.ebay.co.uk/itm/${encodeURIComponent(externalId)}`}>this eBay listing</a>.</p>;
  if (lookup.isPending) return <p role="status">{userId && tenantId ? 'Checking the selected eBay delivery policy…' : 'Sign in to check the selected eBay delivery policy.'}</p>;
  if (lookup.isError) return <ListingDeliveryErrorNotice error={lookup.error} retrying={lookup.isFetching} onRetry={() => void lookup.refetch()} />;

  const policy = lookup.data;
  if (!policy) return <p>No eBay delivery policy is selected.</p>;
  const destinations = regionNames(policy.shipToLocations?.regionIncluded);
  const exclusions = regionNames(policy.shipToLocations?.regionExcluded);
  return <div className="min-w-0 max-w-full space-y-3 rounded-xl border border-border p-3 [overflow-wrap:anywhere]">
    <div><p className="text-sm text-muted-foreground">Selected policy for this draft</p><strong>{policy.name || policy.fulfillmentPolicyId}</strong></div>
    {policy.fulfillmentType === 'SIMPLE_DELIVERY' && <p>UK · eBay Simple Delivery</p>}
    {policy.shippingOptions?.flatMap((option, optionIndex) => option.shippingServices?.map((service, serviceIndex) => {
      const coverage = regionNames(service.shipToLocations?.regionIncluded);
      return <div key={`${optionIndex}-${serviceIndex}`}>
        <p className="text-sm text-muted-foreground">{option.optionType === 'DOMESTIC' ? 'UK postage' : option.optionType === 'INTERNATIONAL' ? 'International postage' : option.optionType}</p>
        <p>{service.shippingServiceCode || service.shippingCarrierCode || 'Service name unavailable'} · {charge(service, option.costType)}</p>
        {coverage && <p className="text-sm">{coverage}</p>}
      </div>;
    }) ?? [])}
    {policy.globalShipping === true && <p>eBay Global Shipping Programme</p>}
    {destinations && <p>Destinations · {destinations}</p>}
    {exclusions && <p>Excluded · {exclusions}</p>}
    <p>Collection · {policy.localPickup === true ? 'Available' : policy.localPickup === false ? 'Off' : 'Not confirmed by eBay'}</p>
    {!policy.shippingOptions?.some(option => option.shippingServices?.length) && <p>eBay did not return individual postage services or charges for this policy.</p>}
  </div>;
}
