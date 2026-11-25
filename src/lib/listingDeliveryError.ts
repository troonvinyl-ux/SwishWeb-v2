export function listingDeliveryError(cause: unknown) {
  const error = cause && typeof cause === 'object' ? cause as Record<string, unknown> : {};
  const status = typeof error.status === 'number' ? error.status : undefined;
  const detail = String(error.message ?? '');
  const kind = error.invalidResponse ? 'response'
    : status === 401 || status === 403 ? 'authentication'
    : /worker boot|unknown route/i.test(detail) || status === 503 ? 'deployment'
    : /failed to fetch|network/i.test(detail) ? 'network'
    : 'response';
  const messages = {
    authentication: 'Open your authorised SWISH workspace and reconnect eBay if required.',
    deployment: 'The delivery service deployment needs repair.',
    network: 'SWISH could not reach the delivery service. Check your connection and retry.',
    response: 'SWISH could not verify the delivery policy returned by eBay.',
  };
  return Object.assign(new Error(messages[kind]), { kind, status });
}
