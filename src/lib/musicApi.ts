import { callEdgeFunction } from '@/lib/supabase';
import { assertCaptureScope, captureRecord, captureText } from '@/lib/captureRequest';
import { prepareScanPhotos } from '@/lib/sharedScanPhotos';
import { extractMusicAnalysis, mergeMusicFields } from '@/lib/musicExtraction';
import { musicIdentificationRequest } from '@/lib/musicIdentificationRequest';
import { recoverMusicIdentification } from '@/lib/musicRecognitionErrors';
import type { CaptureScope } from '@/types/capture';
import type { MusicAnalysis, MusicFields, MusicPhoto } from '@/types/music';
export async function musicRequest(scope:CaptureScope,name:string,body:Record<string,unknown>,signal?:AbortSignal):Promise<Record<string,unknown>> {
 await assertCaptureScope(scope);if(signal?.aborted)throw new Error('Music operation cancelled.');
 const response=await callEdgeFunction<Record<string,unknown>>(name,{...body,tenantId:scope.tenantId,nicheId:'tunes_flip'},scope.client,{signal});
 if(response.error)throw response.error;await assertCaptureScope(scope);
 if(!response.data||response.data.success===false||response.data.error)throw new Error(captureText(response.data?.message??response.data?.error)||'SWISH did not confirm this operation.');return response.data;
}
export async function identifyMusicPhotos(scope:CaptureScope,photos:MusicPhoto[],known:MusicFields,signal:AbortSignal,onProgress?:(analysis:MusicAnalysis|null,message:string)=>void):Promise<MusicAnalysis> {
 if(!photos.length||photos.length>12)throw new Error('Use one to twelve original photographs.');
 let fields=known;const warnings:string[]=[];let followUp='',recovered=false;
 for(let start=0;start<photos.length;start+=8){
  const batch=photos.slice(start,start+8).map(photo=>({...photo,file:photo.analysisFile||photo.file,label:`${photo.label}${photo.analysisNote?` (${photo.analysisNote})`:''}`.slice(0,120)})),prepared=await prepareScanPhotos(batch);
  const payload=musicIdentificationRequest(prepared,fields);
  if(signal.aborted)throw new Error('Music operation cancelled.');
  if(prepared.images.some(image=>image.length>800000)||new TextEncoder().encode(JSON.stringify({...payload,tenantId:scope.tenantId,nicheId:'tunes_flip'})).length>6000000)throw new Error('Analysis copies exceed the shared SWISH limit. Retake a smaller photo; all originals remain unchanged.');
  const response=await recoverMusicIdentification(body=>musicRequest(scope,'swish-identify',body,signal),payload,musicIdentificationRequest(prepared,fields,true),!recovered,signal,()=>{recovered=true;onProgress?.(null,'SWISH returned invalid recognition data. Retrying once with a compact JSON request…');});
  if(signal.aborted)throw new Error('Music operation cancelled.');
  const result=extractMusicAnalysis(response);fields=mergeMusicFields(fields,result.fields);warnings.push(...result.warnings);followUp=result.followUp;
  onProgress?.({fields,warnings:[...new Set(warnings)],followUp},'Photo details recognised.');
 }
 return {fields,warnings:[...new Set(warnings)],followUp};
}
export function musicObject(value:unknown):Record<string,unknown>{return captureRecord(value);}
