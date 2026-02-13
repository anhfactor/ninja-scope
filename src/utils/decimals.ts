/**
 * Injective uses large integer representations with decimal places.
 * This utility normalizes them to standard floating-point numbers.
 *
 * Spot price conversion:
 *   humanPrice = rawPrice × 10^(baseDecimals - quoteDecimals)
 *   humanQuantity = rawQuantity / 10^baseDecimals
 *
 * Derivative price conversion:
 *   humanPrice = rawPrice (already in quote terms)
 *   humanQuantity = rawQuantity
 */

export function safeParseFloat(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

export interface TokenDecimals {
  baseDecimals: number;
  quoteDecimals: number;
}

export function humanReadableSpotPrice(rawPrice: string | number, decimals: TokenDecimals): string {
  const raw = safeParseFloat(rawPrice);
  if (raw === 0) return '0';
  const human = raw * Math.pow(10, decimals.baseDecimals - decimals.quoteDecimals);
  return formatNumber(human);
}

export function humanReadableSpotQuantity(rawQuantity: string | number, baseDecimals: number): string {
  const raw = safeParseFloat(rawQuantity);
  if (raw === 0) return '0';
  const human = raw / Math.pow(10, baseDecimals);
  return formatNumber(human);
}

export function humanReadableDerivativePrice(rawPrice: string | number): string {
  const raw = safeParseFloat(rawPrice);
  if (raw === 0) return '0';
  return formatNumber(raw);
}

export function humanReadableDerivativeQuantity(rawQuantity: string | number): string {
  const raw = safeParseFloat(rawQuantity);
  if (raw === 0) return '0';
  return formatNumber(raw);
}

function formatNumber(num: number): string {
  if (num === 0) return '0';
  if (Math.abs(num) >= 1) return parseFloat(num.toPrecision(10)).toString();
  if (Math.abs(num) >= 0.00001) return parseFloat(num.toPrecision(8)).toString();
  return num.toExponential(6);
}
