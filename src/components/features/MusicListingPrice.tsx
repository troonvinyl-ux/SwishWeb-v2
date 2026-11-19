import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useMusicScope } from '@/hooks/useMusicScope';
import { getDiscogsRelease } from '@/lib/discogs';
import { musicSnapshotFromItem, savedMusicPrice } from '@/lib/musicSavedItem';
import { researchMusicPrice } from '@/lib/musicQuickSale';
import { formatCurrency } from '@/lib/utils';
import { captureRecord } from '@/lib/captureRequest';
import MusicTimingResult from '@/components/features/MusicTimingResult';
import type { MusicPrice } from '@/types/music';
interface MusicListingPriceProps {item:Record<string,unknown>|null;onApply:(price:number)=>void;disabled:boolean;}
export default function MusicListingPrice({item,onApply,disabled}:MusicListingPriceProps) {
 const scope=useMusicScope(String(item?.id||'listing')),qc=useQueryClient(),[fresh,setFresh]=useState<{key:string;value:MusicPrice}|null>(null),key=`${item?.id}:${item?.updated_at}`,latest=useRef(key);latest.current=key;
 const price=useMutation({mutationFn:async()=>{if(!scope||!item||item.tenant_id!==scope.tenantId||item.specialist_id!=='vinyl_records')throw new Error('Open the saved music item in Tunes Flip.');const originalKey=key,snapshot=musicSnapshotFromItem(item),id=Number(captureRecord(item.attributes).discogs_release_id);snapshot.release=await getDiscogsRelease(qc,scope,id);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),85000);return researchMusicPrice(scope,snapshot,controller.signal).then(value=>({key:originalKey,value})).finally(()=>clearTimeout(timer));},retry:false,onSuccess:result=>{if(scope?.isCurrent()&&latest.current===result.key){setFresh(result);toast.success('Quick-sale estimate ready. Click the tick to use it.');}},onError:(error:Error)=>toast.error(error.message)});
 if(item?.specialist_id!=='vinyl_records')return null;
 const result=fresh?.key===key?fresh.value:savedMusicPrice(item);
 return <div className="mt-3 space-y-3"><MusicTimingResult/><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary min-h-11" disabled={disabled||price.isPending} onClick={()=>price.mutate()}><Zap size={18}/>{price.isPending?'Researching…':'AI QUICK SALE PRICE'}</button><button type="button" className="btn-secondary min-h-11" disabled={disabled||!result||price.isPending} onClick={()=>result&&onApply(result.quick)} aria-label="Insert SWISH quick-sale price beside eBay price"><Check size={18}/>{result?`Use ${formatCurrency(result.quick)}`:'Use estimate'}</button></div>{result&&<><dl className="grid gap-2 sm:grid-cols-3">{[['Estimated market',result.market],['Quick-sale price',result.quick],['Minimum offer',result.minimum]].map(([label,value])=><div key={label} className="rounded-xl border border-border p-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold text-primary">{formatCurrency(Number(value))}</dd></div>)}</dl><p className="text-sm text-muted-foreground">{result.basis==='sold_supported_estimate'?'Sold-supported market estimate':result.basis==='asking_context_estimate'?'AI estimate with asking-price context':'AI-only estimate — no verified comparable sales'} · {result.confidence}</p><p className="text-sm leading-6 text-muted-foreground">{result.explanation}</p></>}</div>;
}
