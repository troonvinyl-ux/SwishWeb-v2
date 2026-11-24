import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { researchMusicPrice } from '@/lib/musicQuickSale';
import { saveMusicCapture } from '@/lib/musicPersistence';
import { musicFormSchema } from '@/lib/musicValidation';
import { isFreshMusicRelease } from '@/lib/musicRelease';
import { musicInventoryAttributes } from '@/lib/musicListing';
import { assertCaptureScope } from '@/lib/captureRequest';
import type { CaptureScope } from '@/types/capture';
import type { MusicPrice, MusicSaveCheckpoint, MusicSnapshot, MusicValues } from '@/types/music';
export function useMusicSale(scope:CaptureScope|null,snapshot:MusicSnapshot) {
 const navigate=useNavigate(),qc=useQueryClient();
 const [pricing,setPricing]=useState<MusicPrice|null>(null),[message,setMessage]=useState(''),[error,setError]=useState(''),[locked,setLocked]=useState(false),[saveTiming,setSaveTiming]=useState<number|null>(null);
 const saving=useRef(false),checkpoint=useRef<MusicSaveCheckpoint>({itemId:crypto.randomUUID()}),latest=useRef({scope,snapshot});latest.current={scope,snapshot};
 const v=snapshot.values;
 const pricingKey=JSON.stringify({release:snapshot.release?.id,artist:v.artist,title:v.release_title,format:v.format,label:v.label,catalogue:v.catalogue_number,year:v.year,country:v.country,media:v.media_grade,sleeve:v.sleeve_grade,notes:v.condition_notes,features:v.features,edition:v.edition,observedDiscCount:v.observed_disc_count,expectedDiscCount:snapshot.release?.discCount,playTested:v.play_tested,reviewed:v.reviewed});
 const currentKey=useRef(pricingKey);currentKey.current=pricingKey;
 useEffect(()=>{setPricing(null);},[pricingKey]);
 const price=useMutation({retry:false,mutationFn:async()=>{
  const current=latest.current.scope,key=currentKey.current;if(!current)throw new Error('Reopen Tunes Flip before pricing.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),85000);
  return researchMusicPrice(current,latest.current.snapshot,controller.signal).then(result=>({result,key})).finally(()=>clearTimeout(timer));
 },onSuccess:({result,key})=>{if(latest.current.scope?.isCurrent()&&currentKey.current===key){setPricing(result);setError('');toast.success('Quick-sale estimate ready. Your eBay price is unchanged.');}},onError:(cause:Error)=>{if(latest.current.scope?.isCurrent()){setError(cause.message);toast.error(cause.message);}}});
 const save=useMutation({retry:false,mutationFn:async(draft:boolean)=>{
  if(saving.current)throw new Error('This item is already being saved.');
  const current=latest.current.scope;if(!current)throw new Error('Open your verified SWISH workspace before saving.');
  const started=performance.now(),values=musicFormSchema.parse(latest.current.snapshot.values) as MusicValues;
  if(draft&&!values.reviewed)throw new Error('Check the release details and mark them reviewed before creating a draft.');
  if(latest.current.snapshot.release&&!isFreshMusicRelease(latest.current.snapshot.release))throw new Error('Search and confirm a fresh catalogue release before saving.');
  if(new TextEncoder().encode(JSON.stringify(musicInventoryAttributes(latest.current.snapshot))).length>90000)throw new Error('Shorten the music metadata before saving; your photos are unchanged.');
  await assertCaptureScope(current);if(saving.current)throw new Error('This item is already being saved.');saving.current=true;
  checkpoint.current.snapshot??={...latest.current.snapshot,values,pricing};setLocked(true);setError('');
  return saveMusicCapture({scope:current,snapshot:checkpoint.current.snapshot,checkpoint:checkpoint.current,draft,progress:value=>{if(current.isCurrent())setMessage(value);}}).then(result=>({...result,elapsed:Math.round(performance.now()-started)})).finally(()=>{saving.current=false;});
 },onSuccess:result=>{
  if(!latest.current.scope?.isCurrent())return;
  setSaveTiming(result.elapsed);void qc.invalidateQueries({queryKey:['items']});void qc.invalidateQueries({queryKey:['listings']});
  toast.success(result.listingId?'eBay draft saved. Nothing has been published.':'Music item and original photos saved.');
  navigate(result.listingId?`/listings/${result.listingId}/edit`:`/inventory/${result.itemId}`);
 },onError:(cause:Error)=>{if(latest.current.scope?.isCurrent()){setError(cause.message);toast.error(cause.message);}}});
 return {pricing,price,save,message,error,locked,saveTiming,itemId:checkpoint.current.inserted?checkpoint.current.itemId:null};
}
