import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useMusicScope } from '@/hooks/useMusicScope';
import { musicRequest } from '@/lib/musicApi';
import { captureStrings, assertCaptureScope } from '@/lib/captureRequest';
import { toast } from 'sonner';
export default function MusicConnectionCheck() {
 const scope=useMusicScope('connection-check'),[status,setStatus]=useState('Not checked in this browser session.');
 const owner=useQuery({queryKey:['music_owner_check',scope?.userId,scope?.tenantId],enabled:!!scope,retry:false,queryFn:async()=>{if(!scope)return false;await assertCaptureScope(scope);const result=await scope.client.rpc('swish_is_platform_owner');if(result.error)throw new Error('Owner access could not be checked.');return result.data===true;}});
 const check=useMutation({retry:false,mutationFn:async(action:'status'|'health')=>{if(!scope)throw new Error('Open Tunes Flip first.');const data=await musicRequest(scope,'swish-discogs',{action});return {action,data};},onSuccess:({action,data})=>{if(!scope?.isCurrent())return;setStatus(action==='health'?`Connection check: ${String(data.connectivity||'Not confirmed')}. Read-only catalogue request; no inventory or seller data changed.`:`Configured: ${data.configured===true?'yes':'no'} · Commercial-use approval: ${data.commercialUseApproved===true?'yes':'no'}${captureStrings(data.missing).length?` · Missing server variables: ${captureStrings(data.missing).join(', ')}`:''}`);},onError:(error:Error)=>{setStatus(error.message);toast.error(error.message);}});
 if(owner.data!==true)return null;
 return <section className="space-y-3 rounded-2xl border border-border p-4"><h3 className="font-semibold text-foreground">Owner · existing SWISH Discogs connection</h3><p role="status">{status}</p><div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary min-h-11" disabled={check.isPending} onClick={()=>check.mutate('status')}>Check server configuration</button><button type="button" className="btn-secondary min-h-11" disabled={check.isPending} onClick={()=>check.mutate('health')}>{check.isPending?'Checking…':'Run read-only catalogue check'}</button></div><p className="text-sm">Configure credentials only in the original SWISH deployment’s server secrets. This check never receives credential values.</p></section>;
}
