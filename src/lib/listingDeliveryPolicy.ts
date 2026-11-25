import { activateModuleScope } from '@/lib/moduleScope';
import { callEdgeFunction, getSupabaseClientAsync } from '@/lib/supabase';
import { listingDeliveryError } from '@/lib/listingDeliveryError';
import type { ListingDeliveryScope, Policy, ShippingService } from '@/types/listingDelivery';

export async function loadListingDeliveryPolicy({ userId, tenantId, nicheId }: ListingDeliveryScope): Promise<Policy | null> {
  if (!userId || !tenantId) throw listingDeliveryError({ status: 401 });
  const client = await getSupabaseClientAsync();
  if (!client) throw listingDeliveryError({ message: 'Failed to fetch' });
  await activateModuleScope(client, userId, tenantId, nicheId);
  const { data, error } = await callEdgeFunction<{ policy: Policy | null }>(
    'swish-ebay-list', { route: 'get_selected_delivery_policy', tenantId, nicheId }, client,
  );
  if (error) throw listingDeliveryError(error);
  if (data?.policy === null) return null;
  const policy = data?.policy;
  if (!policy || typeof policy.fulfillmentPolicyId !== 'string' || !policy.fulfillmentPolicyId ||
    (policy.shippingOptions !== undefined && !Array.isArray(policy.shippingOptions))) {
    throw listingDeliveryError({ invalidResponse: true });
  }
  return policy;
}

export function deliveryCharge(service: ShippingService, costType?: string) {
  const amount = service.shippingCost;
  if (service.freeShipping === true) return 'Free for buyer';
  if (amount?.currency === 'GBP' && /^\d+(\.\d{1,2})?$/.test(amount.value)) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(amount.value));
  }
  if (amount?.currency && amount?.value) return `${amount.currency} ${amount.value}`;
  return costType === 'CALCULATED' ? 'Calculated by eBay' : 'Price unavailable';
}

export function deliveryRegionNames(regions?: { regionName: string }[]) {
  return regions?.map(region => region.regionName).filter(Boolean).join(', ');
}
