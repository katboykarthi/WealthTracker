/**
 * Liability calculation helpers
 * All functions gracefully handle missing fields (old records).
 */

/** Returns the number of whole months between two date strings / Date objects. */
export function monthsBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s) || isNaN(e)) return 0;
  return Math.max(
    0,
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  );
}

/**
 * Calculates the current outstanding balance using the EMI-reduction method.
 * Falls back to liability.value if EMI fields are absent (legacy records).
 *
 * @param {object} liability
 * @returns {number} outstanding amount in ₹
 */
export function calcOutstanding(liability) {
  const { principal, emi, startDate, endDate, value } = liability ?? {};
  const p = Number(principal) || 0;
  const e = Number(emi) || 0;

  // Legacy record — no EMI data
  if (!e || !startDate) return Number(value) || p;

  const today = new Date();
  const start = new Date(startDate);
  if (isNaN(start)) return Number(value) || p;

  const paidMonths = Math.max(
    0,
    (today.getFullYear() - start.getFullYear()) * 12 +
      (today.getMonth() - start.getMonth())
  );
  return Math.max(0, p - paidMonths * e);
}

/**
 * Returns the auto-calculated end date (YYYY-MM-DD) from principal and EMI.
 * Returns null if inputs are invalid.
 */
export function calcEndDate(principal, emi, startDate) {
  const p = Number(principal);
  const e = Number(emi);
  if (!p || !e || e <= 0 || !startDate) return null;
  const months = Math.ceil(p / e);
  const start = new Date(startDate);
  if (isNaN(start)) return null;
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  return end.toISOString().slice(0, 10);
}

/**
 * Returns the number of months remaining until endDate (from today).
 * Returns 0 if the loan is already past its end date.
 */
export function calcMonthsRemaining(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (isNaN(end)) return null;
  const today = new Date();
  const months =
    (end.getFullYear() - today.getFullYear()) * 12 +
    (end.getMonth() - today.getMonth());
  return Math.max(0, months);
}

/**
 * Returns a human-readable "closing in" string.
 * e.g. "8 months", "2 yrs 3 mo", "CLOSED"
 */
export function formatClosingIn(endDate) {
  const months = calcMonthsRemaining(endDate);
  if (months === null) return "—";
  if (months === 0) return "CLOSED";
  if (months < 12) return `${months} mo`;
  const yrs = Math.floor(months / 12);
  const mo = months % 12;
  return mo > 0 ? `${yrs} yr ${mo} mo` : `${yrs} yr`;
}

/**
 * Returns the % of the loan paid off (0–100).
 */
export function calcPctPaid(liability) {
  const p = Number(liability?.principal) || Number(liability?.value) || 0;
  if (!p) return 0;
  const outstanding = calcOutstanding(liability);
  return Math.min(100, Math.max(0, Math.round(((p - outstanding) / p) * 100)));
}
