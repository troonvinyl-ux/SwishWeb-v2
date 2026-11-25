/** Match native transient-failure semantics: a timeout is never an access denial. */
export function isBackendUnavailable(value: unknown): boolean {
  const message = value instanceof Error ? value.message : String(value || '');
  if (/\b(401|402|403|42501)\b|access denied|permission denied|entitlement|session changed|scope mismatch|expired authentication/i.test(message)) return false;
  return /connection pool|acquiring connection|pool timeout|gateway timeout|timed out|timeout|network|failed to fetch|could not reach|\b(499|502|503|504|57014)\b|temporarily unavailable/i.test(message);
}
export function describeBackendFailure(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value || 'SWISH could not complete the request.');
  if (/worker boot|failed to create the graph|module not found|file:\/\/\/|<html/i.test(message)) return 'The shared service is unavailable. Your saved items and photos are unchanged; retry after the deployment is repaired.';
  return isBackendUnavailable(message) ? 'The backend request took too long. Your saved items and photos are unchanged. Wait briefly, then retry.' : message;
}
