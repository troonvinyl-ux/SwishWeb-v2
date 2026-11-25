import { useQuery } from '@tanstack/react-query';
import { loadListingDeliveryPolicy } from '@/lib/listingDeliveryPolicy';
import type { ListingDeliveryScope } from '@/types/listingDelivery';

export function useListingDeliveryPolicy(scope: ListingDeliveryScope) {
  const { userId, tenantId, nicheId, externalId } = scope;
  return useQuery({
    queryKey: ['selected-delivery-policy', userId, tenantId, nicheId],
    enabled: Boolean(userId && tenantId && !externalId),
    retry: false,
    queryFn: () => loadListingDeliveryPolicy(scope),
  });
}
