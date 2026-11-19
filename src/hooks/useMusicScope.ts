import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { getSupabaseClient } from '@/lib/supabase';
import { getActiveNicheId } from '@/lib/niche';
import type { CaptureScope } from '@/types/capture';
export function useMusicScope(sessionId:string):CaptureScope|null {
 const {user}=useAuth(),{tenantId}=useCurrentTenantId(),client=getSupabaseClient(),key=`${user?.id}:${tenantId}:${sessionId}`,current=useRef(key),mounted=useRef(true);current.current=key;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 return client&&user&&tenantId?{client,userId:user.id,tenantId,nicheId:'tunes_flip',sessionId,isCurrent:()=>mounted.current&&current.current===key&&getActiveNicheId()==='tunes_flip'}:null;
}
