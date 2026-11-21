import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { saveSharedListingEditor } from '@/lib/listingEditorSave';
import type { ConfirmedMusicDetails } from '@/lib/listingEditorData';
import type { EbayAspect } from '@/lib/ebayMusicContract';
interface EditorSave { form: Record<string, unknown>; item: Record<string, unknown> | null; photos: string[]; uploads: string[]; confirmedMusic?: ConfirmedMusicDetails; aspects?: EbayAspect[]; }
export function useListingEditorSave(userId: string | undefined, tenantId: string | null) {
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async (input: EditorSave) => {
      const client = await getSupabaseClientAsync();
      if (!client || !userId || !tenantId || !input.item) throw new Error('Your SWISH workspace and stock item are not ready.');
      return saveSharedListingEditor({ ...input, item: input.item, client, userId, tenantId });
    },
    retry: false,
    onSuccess: saved => {
      // Publish both readbacks to cache before any refetch can hydrate the editor.
      queries.setQueriesData({ queryKey: ['listings', String(saved.listing.id), '*', tenantId, userId] }, saved.listing);
      queries.setQueriesData({ queryKey: ['items', String(saved.item.id), '*', tenantId, userId] }, saved.item);
      void queries.invalidateQueries({ queryKey: ['listings'], refetchType: 'none' });
      void queries.invalidateQueries({ queryKey: ['items'], refetchType: 'none' });
    },
  });
}
