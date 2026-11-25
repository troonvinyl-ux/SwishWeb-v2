interface Regions {
  regionIncluded?: { regionName: string }[];
  regionExcluded?: { regionName: string }[];
}
export interface ShippingService {
  shippingServiceCode?: string;
  shippingCarrierCode?: string;
  shippingCost?: { value: string; currency: string };
  freeShipping?: boolean;
  shipToLocations?: Regions;
}
export interface Policy {
  fulfillmentPolicyId: string;
  name?: string;
  fulfillmentType?: string;
  globalShipping?: boolean;
  localPickup?: boolean;
  shipToLocations?: Regions;
  shippingOptions?: { optionType: string; costType?: string; shippingServices?: ShippingService[] }[];
}
export interface ListingDeliveryScope {
  userId?: string;
  tenantId: string | null;
  nicheId: string;
  externalId: string;
}
