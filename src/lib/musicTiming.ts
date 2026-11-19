interface MusicTiming { seconds:number; stage:'inventory_saved'|'draft_saved'; recordedAt:string; }
const starts=new Map<string,number>(),results=new Map<string,MusicTiming>(),listeners=new Set<()=>void>();
export function startMusicTiming(key:string):void {if(!starts.has(key))starts.set(key,performance.now());}
export function recordMusicTiming(key:string,stage:MusicTiming['stage']):void {const start=starts.get(key);if(start===undefined)return;const result={seconds:Math.round((performance.now()-start)/100)/10,stage,recordedAt:new Date().toISOString()};results.set(key.slice(0,key.lastIndexOf(':')),result);starts.delete(key);console.log('[SWISH Music] Measured workflow timing (not live publication)',result);listeners.forEach(listener=>listener());}
export function getMusicTiming(key:string):MusicTiming|null {return results.get(key)||null;}
export function subscribeMusicTiming(listener:()=>void):()=>void {listeners.add(listener);return()=>{listeners.delete(listener);};}
