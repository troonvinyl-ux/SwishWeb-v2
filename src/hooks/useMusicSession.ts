import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { MUSIC_DEFAULTS, musicFormSchema } from '@/lib/musicValidation';
import { mergeMusicFields } from '@/lib/musicExtraction';
import { musicPhotoSlots } from '@/constants/music';
import { useMusicScope } from '@/hooks/useMusicScope';
import { startMusicTiming } from '@/lib/musicTiming';
import { beginScanToLive } from '@/lib/scanToLiveTiming';
import type { MusicFields, MusicValues, MusicPhoto } from '@/types/music';
import type { StudioRetainedPhoto } from '@/types/listingStudio';
export function useMusicSession() {
 const [sessionId]=useState(()=>crypto.randomUUID());
 const [photos,setPhotos]=useState<MusicPhoto[]>([]),[fields,setFields]=useState<MusicFields>({}),[selected,setSelected]=useState('front_sleeve');
 const photoRef=useRef(photos),fieldRef=useRef(fields);photoRef.current=photos;fieldRef.current=fields;
 const scope=useMusicScope(sessionId),scopeRef=useRef(scope);scopeRef.current=scope;
 const form=useForm<MusicValues>({resolver:zodResolver(musicFormSchema),defaultValues:MUSIC_DEFAULTS});
 const format=form.watch('format'),slots=musicPhotoSlots(format),activeSlot=slots.find(slot=>slot.id===selected)||slots[0];
 useEffect(()=>()=>{photoRef.current.forEach(photo=>URL.revokeObjectURL(photo.preview));},[]);
 const unreview=useCallback(()=>{form.setValue('reviewed',false);form.setValue('pressing_reviewed',false);},[form]);
 const applyFields=useCallback((incoming:MusicFields)=>{
  const next=mergeMusicFields(fieldRef.current,incoming);fieldRef.current=next;setFields(next);
  for(const[key,field]of Object.entries(next))if(key in MUSIC_DEFAULTS)form.setValue(key as keyof MusicValues,field.value,{shouldValidate:false});
  unreview();
 },[form,unreview]);
 const markUser=useCallback((key:string,value:string)=>{const next={...fieldRef.current,[key]:{value,source:'user' as const,confidence:null}};fieldRef.current=next;setFields(next);unreview();},[unreview]);
 const addFiles=useCallback((files:File[],slotId?:string)=>{
  let next=[...photoRef.current];let changed=false;
  for(const file of files){
   if(!file.size||file.type&&!file.type.startsWith('image/')){toast.error('Choose a non-empty image photo.');continue;}
   const slot=slotId?slots.find(value=>value.id===slotId):slots.find(value=>!next.some(photo=>photo.slotId===value.id));
   if(!slot){toast.error('You can keep up to 12 photos. Remove or retake one to add another.');break;}
   const old=next.find(photo=>photo.slotId===slot.id);if(old)URL.revokeObjectURL(old.preview);
   next=[...next.filter(photo=>photo.slotId!==slot.id),{slotId:slot.id,label:slot.label,file,preview:URL.createObjectURL(file)}];changed=true;
  }
  if(!changed)return;
  const current=scopeRef.current;if(current?.isCurrent()){const timingKey=`${current.userId}:${current.tenantId}:${current.sessionId}`;startMusicTiming(timingKey);beginScanToLive(timingKey);}
  photoRef.current=next;setPhotos(next);unreview();
 },[slots,unreview]);
 const setAnalysisCopy=useCallback((slotId:string,file:File,note:string)=>{
  const next=photoRef.current.map(photo=>photo.slotId===slotId?{...photo,analysisFile:file,analysisNote:note}:photo);
  photoRef.current=next;setPhotos(next);unreview();
 },[unreview]);
 const remove=useCallback((slotId:string)=>{
  photoRef.current.filter(photo=>photo.slotId===slotId).forEach(photo=>URL.revokeObjectURL(photo.preview));
  const next=photoRef.current.filter(photo=>photo.slotId!==slotId);photoRef.current=next;setPhotos(next);unreview();
 },[unreview]);
 const restoreStudioPhotos = useCallback((originals: StudioRetainedPhoto[], notes: string) => {
  const aliases: Record<string, string> = { front: 'front_sleeve', back: 'back_sleeve', media: 'label_a', matrix: 'matrix_a' };
  const retained = originals.map(photo => ({ ...photo, slotId: aliases[photo.slotId] || photo.slotId, preview: URL.createObjectURL(photo.file) }));
  photoRef.current.forEach(photo => URL.revokeObjectURL(photo.preview)); photoRef.current = retained; setPhotos(retained);
  form.setValue('condition_notes', notes); unreview();
 }, [form, unreview]);
 return {sessionId,photos,fields,setFields,form,slots,activeSlot,selected,setSelected,applyFields,markUser,addFiles,remove,setAnalysisCopy,restoreStudioPhotos};
}
