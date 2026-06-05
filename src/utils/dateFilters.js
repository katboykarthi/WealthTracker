/**
 * utils/dateFilters.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Date-range helpers used by Income, Expenses, and Insights pages.
 * Previously inlined inside AppPages.jsx (~90 lines repeated across 3 pages).
 */

export function getCurrentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getDateRangeForFilter(filterKey) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (filterKey) {
    case "this_month": {
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
      };
    }
    case "last_month": {
      return {
        start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        end: new Date(today.getFullYear(), today.getMonth(), 0),
      };
    }
    case "3m":  return { start: new Date(today.getFullYear(), today.getMonth() - 2,  1), end: today };
    case "6m":  return { start: new Date(today.getFullYear(), today.getMonth() - 5,  1), end: today };
    case "12m": return { start: new Date(today.getFullYear(), today.getMonth() - 11, 1), end: today };
    default: return null; // "all" → no range filter
  }
}

export function getDateRangeForMonth(monthValue) {
  const [year, month] = String(monthValue || "").split("-").map(Number);
  if (!year || !month) return null;
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 0) };
}

/** Parse the date out of an income/expense entry (supports `month` or `date` field). */
export function parseEntryDate(entry) {
  if (entry.month) {
    const [y, m] = entry.month.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }
  if (entry.date) return new Date(entry.date);
  return null;
}

export function getMonthValueFromEntry(entry) {
  const date = parseEntryDate(entry);
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(monthValue) {
  const range = getDateRangeForMonth(monthValue);
  if (!range) return String(monthValue || "");
  return range.start.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function buildMonthOptions(entries = []) {
  const monthValues = Array.from(
    new Set(entries.map(getMonthValueFromEntry).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));

  if (monthValues.length === 0) monthValues.push(getCurrentMonthValue());

  return [
    { value: "all", label: "All Months" },
    ...monthValues.map((value) => ({ value, label: formatMonthLabel(value) })),
  ];
}

export function filterByRange(entries, range, options = {}) {
  const { includeUndated = true } = options;
  if (!range) return entries;
  return entries.filter((e) => {
    const d = parseEntryDate(e);
    if (!d) return includeUndated;
    return d >= range.start && d <= range.end;
  });
}

/** Build month-grouped bar chart data for Income vs Expenses trend. */
export function buildMonthlyTrendData(incomes, expenses, range) {
  const monthMap = {};

  const addToMap = (entries, key) => {
    entries.forEach((e) => {
      const d = parseEntryDate(e);
      if (!d) return;
      if (range && (d < range.start || d > range.end)) return;
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (!monthMap[label]) monthMap[label] = { month: label, income: 0, expense: 0, _ts: d.getTime() };
      monthMap[label][key] += e.amount || 0;
    });
  };

  addToMap(incomes, "income");
  addToMap(expenses, "expense");

  return Object.values(monthMap)
    .sort((a, b) => a._ts - b._ts)
    .map(({ month, income, expense }) => ({ month, income, expense, net: income - expense }));
}
