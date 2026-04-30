const priceFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pctFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'always',
});

const compactFmt = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatPrice(v: number | null): string {
  if (v == null) return '—';
  return priceFmt.format(v);
}

export function formatPct(v: number | null): string {
  if (v == null) return '—';
  return `${pctFmt.format(v)}%`;
}

export function formatVolume(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return compactFmt.format(v);
}

export function changeClass(v: number | null): 'up' | 'down' | 'flat' {
  if (v == null) return 'flat';
  if (v > 0) return 'up';
  if (v < 0) return 'down';
  return 'flat';
}
