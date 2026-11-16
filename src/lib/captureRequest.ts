import { callEdgeFunction } from '@/lib/supabase';
import { verifyModuleScope } from '@/lib/moduleScope';
import type { CaptureScope } from '@/types/capture';
export function captureRecord(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function captureText(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
export function captureStrings(value: unknown): string[] { return Array.isArray(value) ? value.filter((entry):entry is string=>typeof entry==='string') : []; }
export async function assertCaptureScope(scope: CaptureScope): Promise<void> {
  if(!scope.isCurrent()) throw new Error('The capture workspace changed.');
  await verifyModuleScope(scope.client,scope.userId,scope.tenantId,scope.nicheId);
  if(!scope.isCurrent()) throw new Error('The capture workspace changed.');
}
export async function captureRequest(scope: CaptureScope, name: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  await assertCaptureScope(scope); const result=await callEdgeFunction<Record<string, unknown>>(name,{...body,tenantId:scope.tenantId,nicheId:scope.nicheId},scope.client);
  if(result.error) throw result.error; await assertCaptureScope(scope);
  if(!result.data || result.data.success===false)throw new Error(captureText(result.data?.error)||'The operation was not confirmed.');return result.data;
}
