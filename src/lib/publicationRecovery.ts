export interface PublicationReply { status: number; body: unknown; }
export interface PublicationReservation { version: 2; outcome: 'pending' | 'rejected' | 'uncertain' | 'published'; detail?: string; }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
/** Only an explicit server rejection is retryable. A timeout/HTTP error alone is not proof. */
export function confirmedPublicationRejection({ status, body }: PublicationReply): boolean {
  const value = object(body), message = String(value.error || value.message || ''), code = String(value.code || '');
  if (value.success === true || value.accepted === true || value.publicationUnconfirmed === true || /RECONCILIATION|UNCONFIRMED|ALREADY_SUBMITTED/i.test(code)) return false;
  if (/unconfirmed|not confirmed|needs inspection|already submitted|already published|outcome.*unknown/i.test(message)) return false;
  return status >= 200 && status < 500 && Boolean(message) && (value.accepted === false || value.publicationAttempted === false || /no eBay request (?:was )?sent/i.test(message));
}
export function rejectedAttemptCanRetry(reservation: PublicationReservation | null, listing: Record<string, unknown>, tenantId: string, listingId: string): boolean {
  return reservation?.outcome === 'rejected' && listing.id === listingId && listing.tenant_id === tenantId && Object.prototype.hasOwnProperty.call(listing, 'publish_claim_id') && listing.publish_claim_id === null && !listing.external_listing_id && !listing.published_at && !listing.ended_at && ['draft', 'verified', 'review', 'review_required', 'failed', 'error'].includes(String(listing.status).toLowerCase());
}
export function readPublicationReservation(value: string | null): PublicationReservation | null {
  if (!value) return null;
  try {
    const parsed = object(JSON.parse(value));
    if (parsed.version === 2 && ['pending', 'rejected', 'uncertain', 'published'].includes(String(parsed.outcome))) return parsed as unknown as PublicationReservation;
  } catch { /* Legacy timestamps are uncertain, not permission to submit again. */ }
  return { version: 2, outcome: 'uncertain', detail: 'An earlier submission has no recorded outcome in this browser. Check eBay before any further action.' };
}
