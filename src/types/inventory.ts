export type InventoryTab = 'stock' | 'draft' | 'live' | 'sold';
export interface InventoryCardProps { row: Record<string, unknown>; item: Record<string, unknown> | null; tab: InventoryTab; onCheckListing?: (id: string) => Promise<void>; checkingId?: string; }
