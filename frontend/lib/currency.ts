export interface CurrencyDef {
  code: string;
  symbol: string;
  name: string;
}

export const CURRENCIES: CurrencyDef[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
];

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.symbol || '$';
}

export function formatMoneyWithSymbol(
  symbol: string,
  amount: number,
  options?: { maximumFractionDigits?: number }
): string {
  const sign = amount < 0 ? '-' : '';
  const digits = options?.maximumFractionDigits ?? 0;
  return `${sign}${symbol}${Math.abs(amount).toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}
