import { Link } from 'react-router-dom';
import { listingDeliveryError } from '@/lib/listingDeliveryError';

export default function ListingDeliveryErrorNotice({ error, retrying, onRetry }: {
  error: unknown;
  retrying: boolean;
  onRetry: () => void;
}) {
  const notice = error instanceof Error && 'kind' in error && 'status' in error
    ? error as ReturnType<typeof listingDeliveryError>
    : listingDeliveryError(error);
  return <div role="alert" className="space-y-2 rounded-xl border border-border p-3 [overflow-wrap:anywhere]">
    <strong>Delivery check unavailable</strong>
    <p>{notice.message}{notice.status ? ` (HTTP ${notice.status})` : ''}</p>
    <button type="button" className="btn-secondary" disabled={retrying} onClick={onRetry}>Retry delivery check</button>
    <Link to="/ebay/account">Check eBay policies</Link>
  </div>;
}
