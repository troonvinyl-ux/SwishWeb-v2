interface MusicBackendFailure { fn: string; status: number; message: string; }
function backendFailure(value: unknown): MusicBackendFailure | null {
  if (!value || typeof value !== 'object') return null;
  const failure = value as Record<string, unknown>;
  return typeof failure.fn === 'string' && typeof failure.status === 'number' && typeof failure.message === 'string'
    ? { fn: failure.fn, status: failure.status, message: failure.message } : null;
}
export function isInvalidMusicJson(value: unknown): boolean {
  const failure = backendFailure(value);
  return failure?.fn === 'swish-identify' && failure.status === 422
    && /invalid identification json/i.test(failure.message);
}
export function musicRecognitionError(value: unknown): string {
  if (isInvalidMusicJson(value)) return 'SWISH could not return valid recognition data after one recovery attempt. Your photos and edits are safe. Search by barcode, artist/title or release ID while the shared identification service is checked.';
  const failure = backendFailure(value);
  if (failure) return `[${failure.fn}] ${failure.message} (HTTP ${failure.status})`;
  return value instanceof Error ? value.message : 'Music recognition could not finish. Your photos and edits are retained.';
}
export function recoverMusicIdentification(
  request: (body: Record<string, unknown>) => Promise<Record<string, unknown>>,
  body: Record<string, unknown>, recoveryBody: Record<string, unknown>,
  allowRecovery: boolean, signal: AbortSignal, onRecovery: () => void,
): Promise<Record<string, unknown>> {
  return request(body).catch((cause: unknown) => {
    // Never replay auth/quota/network errors, another function, or an unknown mutation.
    if (!allowRecovery || signal.aborted || !isInvalidMusicJson(cause)) throw cause;
    onRecovery();
    if (signal.aborted) throw new Error('Music operation cancelled.');
    return request(recoveryBody);
  });
}
