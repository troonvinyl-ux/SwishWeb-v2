import { useQuery } from '@tanstack/react-query';
import { activateModuleScope } from '@/lib/moduleScope';
import { callEdgeFunction, getSupabaseClientAsync } from '@/lib/supabase';

interface Regions {
  regionIncluded?: { regionName: string }[];
  regionExcluded?: { regionName: string }[];
}
interface ShippingService {
  shippingServiceCode?: string;
  shippingCarrierCode?: string;
  shippingCost?: { value: string; currency: string };
  freeShipping?: boolean;
  shipToLocations?: Regions;
}
interface Policy {
  fulfillmentPolicyId: string;
  name?: string;
  fulfillmentType?: string;
  globalShipping?: boolean;
  localPickup?: boolean;
  shipToLocations?: Regions;
  shippingOptions?: { optionType: string; costType?: string; shippingServices?: ShippingService[] }[];
}
interface Props {
  userId?: string;
  tenantId: string | null;
  nicheId: string;
  externalId: string;
}

function charge(service: ShippingService, costType?: string) {
  const amount = service.shippingCost;
  if (service.freeShipping === true) return 'Free for buyer';
  if (amount?.currency === 'GBP' && /^\d+(\.\d{1,2})?$/.test(amount.value)) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(amount.value));
  }
  if (amount?.currency && amount?.value) return `${amount.currency} ${amount.value}`;
  return costType === 'CALCULATED' ? 'Calculated by eBay' : 'Price unavailable';
}

function regionNames(regions?: { regionName: string }[]) {
  return regions?.map(region => region.regionName).filter(Boolean).join(', ');
}

export default function ListingDeliveryPolicy({ userId, tenantId, nicheId, externalId }: Props) {
  const lookup = useQuery({
    queryKey: ['selected-delivery-policy', userId, tenantId, nicheId],
    enabled: Boolean(userId && tenantId && !externalId),
    retry: false,
    queryFn: async () => {
      const client = await getSupabaseClientAsync();
      if (!client || !userId || !tenantId) throw new Error('Open your workspace to check postage.');
      await activateModuleScope(client, userId, tenantId, nicheId);
      const { data, error } = await callEdgeFunction<{ policy: Policy | null }>(
        'swish-ebay-list', { route: 'get_selected_delivery_policy', tenantId, nicheId }, client,
      );
      if (error || !data) throw error ?? new Error('eBay delivery details are unavailable.');
      return data.policy;
    },
  });

  if (externalId) return <p>Check the published delivery options on <a className="underline" href={`https://www.ebay.co.uk/itm/${encodeURIComponent(externalId)}`}>this eBay listing</a>.</p>;
  if (lookup.isPending) return <p role="status">{userId && tenantId ? 'Checking the selected eBay delivery policy…' : 'Sign in to check the selected eBay delivery policy.'}</p>;
  if (lookup.isError) return <div role="alert" className="space-y-2">
    <p>Could not verify the selected delivery policy. {lookup.error.message}</p>
    <button type="button" className="btn-secondary" onClick={() => void lookup.refetch()}>Retry delivery check</button>
  </div>;

  const policy = lookup.data;
  if (!policy) return <p>No eBay delivery policy is selected.</p>;
  const destinations = regionNames(policy.shipToLocations?.regionIncluded);
  const exclusions = regionNames(policy.shipToLocations?.regionExcluded);
  return <div className="space-y-3 rounded-xl border border-border p-3">
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
