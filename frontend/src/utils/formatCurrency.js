const formatter = new Intl.NumberFormat('vi-VN');

export function formatCurrency(amount, fallback = '—') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return fallback;
  return `${formatter.format(n)}đ`;
}

export default { formatCurrency };
