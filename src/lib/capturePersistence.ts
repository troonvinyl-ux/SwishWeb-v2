import { assertCaptureScope, captureText } from '@/lib/captureRequest';
import { scanPhotoStoragePath } from '@/lib/sharedScanPhotos';
import type { CaptureScope, CapturePhoto } from '@/types/capture';
export async function persistCaptureItem(scope:CaptureScope,result:Record<string,unknown>,specialistId:string,answers:Record<string,string>,mode:string):Promise<string>{
  await assertCaptureScope(scope);
  const saved=await scope.client.from('items').insert({tenant_id:scope.tenantId,specialist_id:specialistId,canonical_title:captureText(result.canonicalTitle ?? result.title),status:'review',attributes:{...result,...answers,captureMode:mode},media:[],warnings:['Review AI suggestions against the actual item.']}).select('id').single();
  if(saved.error || !saved.data?.id)throw new Error(saved.error?.message || 'Item creation was not confirmed. Inspect inventory before retrying.');return String(saved.data.id);
}
export async function persistCapturePhotos(scope:CaptureScope,itemId:string,photos:CapturePhoto[],existing:Record<string,string>,checkpoint:(value:Record<string,string>)=>void):Promise<string[]>{
  const urls={...existing};for(const photo of photos){if(urls[photo.slotId])continue;await assertCaptureScope(scope);const path=scanPhotoStoragePath(itemId,photo.slotId,photo.file);const saved=await scope.client.storage.from('item-images').upload(path,photo.file,{contentType:photo.file.type || 'image/jpeg',upsert:false});if(saved.error)throw new Error(saved.error.message);const url=scope.client.storage.from('item-images').getPublicUrl(path).data.publicUrl;urls[photo.slotId]=url;checkpoint({...urls});}
  await assertCaptureScope(scope);const media=photos.map(photo=>urls[photo.slotId]).filter(Boolean);const saved=await scope.client.from('items').update({media}).eq('id',itemId).eq('tenant_id',scope.tenantId).select('id').single();if(saved.error || !saved.data)throw new Error(saved.error?.message || 'Photo attachment was not confirmed.');return media;
}
