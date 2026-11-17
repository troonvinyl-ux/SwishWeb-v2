import { NICHE_SPECIALISTS, type SwishNicheId } from '@/lib/niche';

export interface VerifiedNicheAccess {
  nicheIds: SwishNicheId[];
  owner: boolean;
}

/** Only canonical product IDs from authenticated backend verification are represented. */
export function parseNicheEntitlements(payload: unknown, owner: boolean): VerifiedNicheAccess {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Membership verification returned no valid result. Refresh access and retry.');
  }
  const result = payload as Record<string, unknown>;
  if (typeof result.error === 'string' && result.error.trim()) throw new Error(result.error);
  if (typeof result.subscribed !== 'boolean') {
    throw new Error('Membership verification returned an incomplete result. Refresh access and retry.');
  }
  const productionIds = Object.keys(NICHE_SPECIALISTS) as SwishNicheId[];
  if (owner) return { owner: true, nicheIds: productionIds };
  if (result.subscribed && !Array.isArray(result.niche_entitlements)) {
    throw new Error('Your membership was verified, but its niche entitlements were not returned. Refresh access; if this continues, check the deployed SWISH membership service.');
  }
  const ids: unknown[] = Array.isArray(result.niche_entitlements) ? result.niche_entitlements : [];
  return {
    owner: false,
    nicheIds: [...new Set(ids.filter((id): id is SwishNicheId =>
      typeof id === 'string' && Object.prototype.hasOwnProperty.call(NICHE_SPECIALISTS, id),
    ))],
  };
}
