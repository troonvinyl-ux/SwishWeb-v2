import { assertCaptureScope, captureText, captureRecord } from '@/lib/captureRequest';
import { parseNumistaNumber } from '@/lib/numistaCapture';
import { scanPhotoStoragePath } from '@/lib/sharedScanPhotos';
import type { CaptureScope, CapturePhoto } from '@/types/capture';
export async function persistCaptureItem(scope:CaptureScope,result:Record<string,unknown>,specialistId:string,answers:Record<string,string>,mode:string):Promise<string>{
  await assertCaptureScope(scope);
  const attributes={...result,...captureRecord(result.attributesInferred),...captureRecord(result.attributes),...captureRecord(result.attributesConfirmed),...answers,captureMode:mode,
    _scan_provenance:{identification:'AI suggestion — not physical confirmation',seller_fields:Object.keys(answers).filter(key=>answers[key]?.trim())},
    ...(scope.nicheId==='coins'?{supplied_weight_g:Number(answers.weight),supplied_diameter_mm:Number(answers.diameter)}:{})};
  const saved=await scope.client.from('items').insert({tenant_id:scope.tenantId,specialist_id:specialistId,canonical_title:captureText(result.canonicalTitle ?? result.title),description:captureText(result.description),condition:answers.condition||'',condition_notes:answers.condition_notes||answers.flaws||answers.issues||'',status:'review',attributes,media:[],warnings:['Review AI suggestions against the actual item.'],...(scope.nicheId==='coins'?{weight_grams:Number(answers.weight),dimensions_mm:{diameter:Number(answers.diameter)}}:{})}).select('id,attributes').single();
  if(saved.error || !saved.data?.id)throw new Error(saved.error?.message || 'Item creation was not confirmed. Inspect inventory before retrying.');
  const expectedNumistaId=parseNumistaNumber(answers.numista_type_id ?? answers.numista_number);
  if(scope.nicheId==='coins' && expectedNumistaId){
    const stored=saved.data.attributes && typeof saved.data.attributes==='object' && !Array.isArray(saved.data.attributes) ? saved.data.attributes as Record<string,unknown> : {};
    const retainedId=parseNumistaNumber(stored.numista_type_id ?? stored.numista_number);
    if(retainedId!==expectedNumistaId || stored._numista_reference_source!=='seller_reference')throw new Error(`Coin saved, but Numista N#${expectedNumistaId} was not retained. Open the saved item and correct the reference before creating a draft.`);
  }
  return String(saved.data.id);
}
export async function persistCapturePhotos(scope:CaptureScope,itemId:string,photos:CapturePhoto[],existing:Record<string,string>,checkpoint:(value:Record<string,string>)=>void):Promise<string[]>{
  const urls={...existing};for(const photo of photos){if(urls[photo.slotId])continue;await assertCaptureScope(scope);const path=scanPhotoStoragePath(itemId,photo.slotId,photo.file);const saved=await scope.client.storage.from('item-images').upload(path,photo.file,{contentType:photo.file.type || 'image/jpeg',upsert:false});if(saved.error)throw new Error(saved.error.message);const url=scope.client.storage.from('item-images').getPublicUrl(path).data.publicUrl;urls[photo.slotId]=url;checkpoint({...urls});}
  await assertCaptureScope(scope);const media=photos.map(photo=>urls[photo.slotId]).filter(Boolean);const saved=await scope.client.from('items').update({media}).eq('id',itemId).eq('tenant_id',scope.tenantId).select('id').single();if(saved.error || !saved.data)throw new Error(saved.error?.message || 'Photo attachment was not confirmed.');return media;
}
