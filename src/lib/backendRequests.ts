import type { SupabaseClient } from '@supabase/supabase-js';
import { queueBackendRead, type ReadPriority } from '@/lib/backendReadQueue';
import { isBackendUnavailable } from '@/lib/backendAvailability';
const clients = new WeakMap<object, number>();
const flights = new Map<string, Promise<unknown>>();
const failures = new Map<string, { until: number; error: Error }>();
let clientId = 0;
/** Private, in-memory session partition. Never persist or log this key. */
export async function backendDataScope(client: SupabaseClient): Promise<string> {
  if (!clients.has(client)) clients.set(client, ++clientId);
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error('Your authenticated session could not be checked.');
  return `${clients.get(client)}:${data.session?.access_token || 'no-session'}`;
}
export async function shareBackendRequest<T>(client: SupabaseClient, key: string, operation: () => Promise<T>): Promise<T> {
  const identity = `${await backendDataScope(client)}:${key}`;
  const pending = flights.get(identity);
  if (pending) return pending as Promise<T>;
  const request = Promise.resolve().then(operation);
  flights.set(identity, request);
  return request.finally(() => { if (flights.get(identity) === request) flights.delete(identity); });
}
/** Bounded SELECT/read RPC only; marketplace and save mutations must never use this governor. */
export async function backendRead<T>(client: SupabaseClient, key: string, operation: (signal: AbortSignal) => PromiseLike<T>, priority: ReadPriority = 'foreground', timeoutMs = 12000): Promise<T> {
  const scope = await backendDataScope(client), identity = `${scope}:read:${key}`;
  const pending = flights.get(identity);
  if (pending) return pending as Promise<T>;
  const failure = failures.get(identity);
  if (failure && failure.until > Date.now()) throw failure.error;
  const request = queueBackendRead(async signal => {
    if (await backendDataScope(client) !== scope) throw new Error('Authenticated session changed before backend dispatch.');
    if (signal.aborted) throw new Error('Backend read expired before dispatch.');
    const value = await operation(signal);
    const result = value as { error?: { message?: string }; status?: number } | null;
    if (result?.error) throw new Error(`${result.status ? `[${result.status}] ` : ''}${result.error.message || 'Backend read failed.'}`);
    if (await backendDataScope(client) !== scope) throw new Error('Authenticated session changed during backend read.');
    if (signal.aborted) throw new Error('Backend read expired.');
    return value;
  }, priority, timeoutMs);
  flights.set(identity, request);
  return request.then(value => { failures.delete(identity); return value; }, cause => {
    const error = cause instanceof Error ? cause : new Error('Backend read failed.');
    if (isBackendUnavailable(error)) failures.set(identity, { until: Date.now() + 5000, error });
    if (failures.size > 128) for (const [key, entry] of failures) if (entry.until <= Date.now()) failures.delete(key);
    while (failures.size > 128) failures.delete(failures.keys().next().value!);
    throw error;
  }).finally(() => { if (flights.get(identity) === request) flights.delete(identity); });
}
