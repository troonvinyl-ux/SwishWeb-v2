import { useSyncExternalStore } from 'react';
import { useMusicScope } from '@/hooks/useMusicScope';
import { getMusicTiming, subscribeMusicTiming } from '@/lib/musicTiming';
export default function MusicTimingResult() {
 const scope=useMusicScope('timing'),key=`${scope?.userId}:${scope?.tenantId}`,result=useSyncExternalStore(subscribeMusicTiming,()=>getMusicTiming(key),()=>null);
 return result?<p role="status" className="rounded-xl border border-border p-3 text-sm text-muted-foreground">Measured in this browser: {result.seconds.toFixed(1)} seconds from the first photo being added to {result.stage==='draft_saved'?'saved draft readback':'saved inventory and photo attachment'}. This is not a live eBay publication time or a guaranteed target.</p>:null;
}
