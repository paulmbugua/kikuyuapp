export const formatNumber = (value: number | string | null | undefined): string => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-KE', {
    notation: Math.abs(amount) >= 1_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(amount);
};

export const formatCurrency = (value: number | string | null | undefined): string =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
