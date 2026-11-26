import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { prepareSavedCoinPhotos } from '@/lib/itemStudio';
/** Coins auto-prepare after original photos are durably attached, as in the app. */
export function useCoinPhotoPreparation() {
  const qc = useQueryClient();
  return (userId: string, tenantId: string, itemId: string, originals: string[]) => {
    if (!originals.length) return;
    toast.info('Coin saved. Preparing matched 1600px photographs; originals are preserved.');
    void prepareSavedCoinPhotos(userId, tenantId, itemId, originals).then(result => {
      void qc.invalidateQueries({ queryKey: ['items'] });
      if (result.prepared) toast.success('Matched white-background coin photographs prepared. Originals remain available.');
      else toast.warning(result.warnings.join(' ') || 'Original photographs selected. Listing preparation can continue.');
    }, (error: unknown) => {
      void qc.invalidateQueries({ queryKey: ['items'] });
      toast.warning(`Coin and originals are saved. ${error instanceof Error ? error.message : 'Background removal is unavailable.'} Use Photos & Smart Studio on the item to retry.`);
    });
  };
}
