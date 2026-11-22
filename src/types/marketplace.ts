export interface EbayConnector {
  status: string;
  seller_account_id: string | null;
  access_token_expires_at: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
  can_list: boolean | null;
  can_publish: boolean | null;
  can_reprice: boolean | null;
  can_read_orders: boolean | null;
  can_fulfil: boolean | null;
}

export function readEbayConnector(row: Record<string, unknown> | undefined): EbayConnector | null {
  if (!row) return null;
  const text = (key: string) => typeof row[key] === 'string' ? row[key] as string : null;
  const flag = (key: string) => typeof row[key] === 'boolean' ? row[key] as boolean : null;
  return { status: text('status') || 'unknown', seller_account_id: text('seller_account_id'), access_token_expires_at: text('access_token_expires_at'), connected_at: text('connected_at'), last_sync_at: text('last_sync_at'), can_list: flag('can_list'), can_publish: flag('can_publish'), can_reprice: flag('can_reprice'), can_read_orders: flag('can_read_orders'), can_fulfil: flag('can_fulfil') };
}

/** Connection status and recorded seller identity are separate facts.
 * Existing native OAuth can save valid consent without a seller account ID. */
export function ebayConnectorHeading(connector: EbayConnector | null, tenantReady: boolean, unavailable = false): string {
  if (unavailable) return 'Connection status unavailable';
  if (!tenantReady) return 'Workspace not ready';
  const seller = connector?.seller_account_id?.trim();
  if (seller) return seller;
  return connector?.status === 'connected'
    ? 'eBay connected — seller ID not recorded'
    : 'No eBay account connected';
}
