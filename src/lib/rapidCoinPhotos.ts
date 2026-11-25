import { rapidPhotoFile } from '@/lib/rapidCoinDatabase';
import { assertCaptureScope } from '@/lib/captureRequest';
import type { CapturePhoto, CaptureScope } from '@/types/capture';
import type { RapidCoinJob } from '@/types/rapidCoin';
export async function loadRapidPhotos(job: RapidCoinJob): Promise<CapturePhoto[]> {
  const photos: CapturePhoto[] = [];
  for (const photo of job.photos) photos.push({ ...photo, file: await rapidPhotoFile(job, photo.id), preview: '' });
  return photos;
}
/** Deterministic content-addressed original paths survive a lost upload response. Never overwrite a coin photo. */
export async function uploadRapidOriginals(scope: CaptureScope, job: RapidCoinJob, photos: CapturePhoto[], keep: (urls: Record<string, string>) => Promise<void>): Promise<Record<string, string>> {
  const urls = { ...job.checkpoint.photos };
  for (const photo of photos) {
    if (urls[photo.slotId]) continue;
    await assertCaptureScope(scope);
    const bytes = await photo.file.arrayBuffer(), hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(b => b.toString(16).padStart(2, '0')).join('');
    const ext = photo.file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'jpg';
    const path = `${job.id}/${photo.slotId}-${hash}.${ext}`, bucket = scope.client.storage.from('item-images');
    const uploaded = await bucket.upload(path, photo.file, { contentType: photo.file.type || 'image/jpeg', upsert: false });
    if (uploaded.error) {
      const existing = await bucket.download(path);
      if (existing.error || !existing.data) throw new Error(uploaded.error.message);
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await existing.data.arrayBuffer()))).map(b => b.toString(16).padStart(2, '0')).join('');
      if (digest !== hash) throw new Error('Stored original differs from this capture. No photo was overwritten.');
    }
    urls[photo.slotId] = bucket.getPublicUrl(path).data.publicUrl;
    await keep({ ...urls });
  }
  return urls;
}
