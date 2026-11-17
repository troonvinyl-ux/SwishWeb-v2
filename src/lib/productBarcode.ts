/** Native GTIN/ISBN checks. QR URLs are data, never arbitrary fetch targets. */
export function normalizeProductBarcode(value: string, type = ''): string | null {
  let code = value.trim();
  if (type === 'qr' || /^https?:/i.test(code)) code = code.match(/(?:\/01\/|\(01\))(\d{14})(?:\D|$)/)?.[1] ?? '';
  code = code.replace(/[\s-]/g, '');
  if (type === 'upc_e' && /^\d{8}$/.test(code)) {
    const [system, a, b, c, d, e, last, check] = code;
    if (!['0', '1'].includes(system)) return null;
    const body = ['0', '1', '2'].includes(last) ? `${a}${b}${last}0000${c}${d}${e}` : last === '3' ? `${a}${b}${c}00000${d}${e}` : last === '4' ? `${a}${b}${c}${d}00000${e}` : `${a}${b}${c}${d}${e}0000${last}`;
    code = `${system}${body}${check}`;
  }
  if (/^\d{9}[\dX]$/i.test(code)) {
    if (code.split('').reduce((sum, digit, index) => sum + (digit.toUpperCase() === 'X' ? 10 : Number(digit)) * (10 - index), 0) % 11 !== 0) return null;
    const base = '978' + code.slice(0, 9); code = base + String((10 - base.split('').reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10) % 10);
  }
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return null;
  const digits = code.split('').map(Number), check = digits.pop();
  return (10 - digits.reverse().reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 3 : 1), 0) % 10) % 10 === check ? code : null;
}
export function sameProductBarcode(left: string, right: string): boolean { return Boolean(left && right && left.padStart(14, '0') === right.padStart(14, '0')); }
