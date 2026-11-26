/** Transport failures and reconciliation responses never prove that eBay rejected AddItem. */
export function confirmedPublishRejection(status: number, body: Record<string, unknown>): boolean {
  if (body.success === true || body.accepted === true || body.publicationUnconfirmed === true || body.reconciliationPending === true) return false;
  if ([body.externalListingId, body.external_listing_id, body.itemId, body.ItemID].some(id => /^\d{6,20}$/.test(String(id || '')))) return false;
  const detail = `${body.code || ''} ${body.error || ''}`;
  if (/reconcil|unconfirmed|already.*submitt|claim|timeout|timed out|network|unknown outcome/i.test(detail)) return false;
  return body.submissionOutcome === 'rejected' || body.accepted === false && body.publicationUnconfirmed === false
    || [400, 401, 402, 403, 422].includes(status) && typeof body.error === 'string' && Boolean(body.error.trim());
}
