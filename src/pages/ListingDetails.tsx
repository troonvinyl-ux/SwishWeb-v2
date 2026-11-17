import { useParams, Link } from 'react-router-dom';
import { useTableRow } from '@/hooks/useSupabaseQuery';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { getActiveNicheId, getSpecialistIdsForNiche } from '@/lib/niche';
import ItemDetailWorkspace from '@/components/features/ItemDetailWorkspace';
export default function ListingDetails() {
  const { id } = useParams<{ id: string }>(), tenant = useCurrentTenantId();
  const listing = useTableRow('listings', id, '*', tenant.tenantId);
  const item = useTableRow('items', typeof listing.data?.item_id === 'string' ? listing.data.item_id : null, '*', tenant.tenantId);
  if (tenant.isLoading || listing.isLoading || item.isLoading) return <div role="status" className="swish-card p-6 text-muted-foreground">Loading stock listing overview…</div>;
  if (tenant.error || listing.error || !listing.data || !tenant.tenantId) return <section className="swish-card p-6 space-y-4" role="alert"><h1 className="text-xl font-semibold">Listing overview unavailable</h1><p className="text-muted-foreground">{tenant.error?.message || listing.error?.message || 'This listing was not found in your SWISH workspace.'}</p><Link to="/inventory" className="btn-secondary">Back to inventory</Link></section>;
  if (item.error || (item.data && !getSpecialistIdsForNiche(getActiveNicheId()).includes(String(item.data.specialist_id)))) return <section role="alert" className="swish-card p-6 space-y-3"><h1 className="text-xl font-semibold">Linked item unavailable</h1><p className="text-muted-foreground">Reopen this listing in its specialist workspace before using market value or Re-ID.</p><Link to="/niches" className="btn-secondary">Choose workspace</Link></section>;
  return <ItemDetailWorkspace item={item.data ?? null} listing={listing.data} />;
}
