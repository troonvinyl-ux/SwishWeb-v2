export function isSwishHomeRoute(hostname: string, pathname: string, hasProduct: boolean): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '').split(':')[0];
  return pathname === '/' && !hasProduct && !host.endsWith('.swishflip.co.uk');
}
