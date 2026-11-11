export function parseEuro(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '').trim().replace(/\s/g, '').replace(/€/g, '');
  if (!raw) return 0;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateEveningResult({ cashLeft = 0, card = 0, payouts = 0, vouchers = 0, other = 0, receipts = 0, openInvoices = 0, sales = 0 } = {}) {
  return parseEuro(cashLeft) + parseEuro(card) + parseEuro(payouts) +
    parseEuro(vouchers) + parseEuro(other) + parseEuro(receipts) +
    parseEuro(openInvoices) - parseEuro(sales);
}

export function filterArchiveRecords(records, rotaryOnly = false) {
  return (Array.isArray(records) ? records : []).filter(record =>
    rotaryOnly ? record?.kind === 'Montags Rotary' : record?.kind !== 'Montags Rotary'
  );
}
