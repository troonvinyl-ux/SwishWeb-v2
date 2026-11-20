import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { saveSharedListingEditor } from '@/lib/listingEditorSave';
interface EditorSave { form: Record<string, unknown>; item: Record<string, unknown> | null; photos: string[]; uploads: string[]; }
export function useListingEditorSave(userId: string | undefined, tenantId: string | null) {
  const queries = useQueryClient();
  return useMutation({
    mutationFn: async (input: EditorSave) => {
      const client = await getSupabaseClientAsync();
      if (!client || !userId || !tenantId || !input.item) throw new Error('Your SWISH workspace and stock item are not ready.');
      return saveSharedListingEditor({ ...input, item: input.item, client, userId, tenantId });
    },
    retry: false,
    onSuccess: () => { void queries.invalidateQueries({ queryKey: ['listings'] }); void queries.invalidateQueries({ queryKey: ['items'] }); },
  });
}
