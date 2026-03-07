import * as XLSX from "xlsx";
import { sanitizeInput } from "../utils/security";

function parseCsvRow(row) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    const next = row[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findHeaderIndex(headers, candidates) {
  return headers.findIndex((header) =>
    candidates.some((candidate) => header === candidate || header.includes(candidate))
  );
}

function parseAmountValue(rawValue) {
  if (rawValue == null) return 0;

  let value = String(rawValue).trim();
  if (!value) return 0;

  let sign = 1;

  if (/^\(.*\)$/.test(value)) {
    sign = -1;
    value = value.slice(1, -1);
  }

  if (/dr$/i.test(value)) {
    sign = -1;
    value = value.replace(/dr$/i, "");
  } else if (/cr$/i.test(value)) {
    sign = 1;
    value = value.replace(/cr$/i, "");
  }

  value = value
    .replace(/rs\.?/gi, "")
    .replace(/inr/gi, "")
    .replace(/,/g, "")
    .replace(/[^\d.\-]/g, "")
    .trim();

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;

  return sign * Math.abs(parsed);
}

function looksLikeTransactionDate(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return false;

  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(value)) return true;
  if (/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}$/.test(value)) return true;

  if (/^\d{4,6}$/.test(value)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 20000 && numeric < 80000) {
      return true;
    }
  }

  return false;
}

function isLikelySummaryRow(narration, hasDate) {
  if (hasDate) return false;

  const text = String(narration || "").toLowerCase();
  if (!text) return true;

  return [
    "total",
    "opening balance",
    "closing balance",
    "statement summary",
    "balance brought forward",
    "brought forward",
    "carried forward",
    "b/f",
    "c/f",
  ].some((token) => text.includes(token));
}

function parseHdfcStatementRows(rawRows) {
  const rows = (rawRows || [])
    .map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "").trim()) : []));

  if (rows.length < 2) return [];

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i += 1) {
    const normalized = rows[i].map(normalizeHeader);
    const hasDate = normalized.some((h) => h.includes("date") || h.includes("value dt") || h.includes("value date"));
    const hasDescription = normalized.some((h) => h.includes("narration") || h.includes("description") || h.includes("particular"));
    const hasAmount = normalized.some((h) => h.includes("withdrawal") || h.includes("deposit") || h.includes("debit") || h.includes("credit") || h === "amount");

    if (hasDate && hasDescription && hasAmount) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) headerRowIndex = 0;

  const headers = rows[headerRowIndex].map(normalizeHeader);

  const dateIndex = findHeaderIndex(headers, ["date", "transaction date", "txn date", "value dt", "value date"]);
  const narrationIndex = findHeaderIndex(headers, ["narration", "description", "particulars", "particular", "remarks", "details"]);
  const withdrawalIndex = findHeaderIndex(headers, ["withdrawal amt", "withdrawal amount", "debit amount", "debit"]);
  const depositIndex = findHeaderIndex(headers, ["deposit amt", "deposit amount", "credit amount", "credit"]);
  const amountIndex = findHeaderIndex(headers, ["amount", "transaction amount", "txn amount", "amt"]);
  const drCrIndex = findHeaderIndex(headers, ["dr/cr", "cr/dr", "dr cr", "cr dr", "type", "transaction type"]);

  const entries = [];

  for (let lineIndex = headerRowIndex + 1; lineIndex < rows.length; lineIndex += 1) {
    const row = rows[lineIndex];
    if (!row || !row.some((cell) => String(cell || "").trim().length > 0)) continue;

    const narrationRaw = narrationIndex >= 0 ? row[narrationIndex] : "";
    const dateRaw = dateIndex >= 0 ? row[dateIndex] : "";
    const hasDate = looksLikeTransactionDate(dateRaw);

    const narration = sanitizeInput(narrationRaw || "Imported HDFC transaction", "text");
    const date = sanitizeInput(dateRaw || "", "text");

    if (isLikelySummaryRow(narrationRaw, hasDate)) continue;

    let creditAmount = 0;
    let debitAmount = 0;

    if (depositIndex >= 0) {
      creditAmount = Math.abs(parseAmountValue(row[depositIndex]));
    }

    if (withdrawalIndex >= 0) {
      debitAmount = Math.abs(parseAmountValue(row[withdrawalIndex]));
    }

    if (creditAmount === 0 && debitAmount === 0 && amountIndex >= 0) {
      const amountValue = parseAmountValue(row[amountIndex]);
      const directionRaw = drCrIndex >= 0 ? String(row[drCrIndex] || "").toLowerCase() : "";

      if (directionRaw.includes("dr") || directionRaw.includes("debit")) {
        debitAmount = Math.abs(amountValue);
      } else if (directionRaw.includes("cr") || directionRaw.includes("credit")) {
        creditAmount = Math.abs(amountValue);
      } else if (amountValue < 0) {
        debitAmount = Math.abs(amountValue);
      } else {
        creditAmount = Math.abs(amountValue);
      }
    }

    if (!hasDate && creditAmount > 0 && debitAmount > 0) continue;

    if (creditAmount > 0) {
      entries.push({
        type: "credit",
        name: narration || "Imported credit",
        amount: creditAmount,
        date,
      });
    }

    if (debitAmount > 0) {
      entries.push({
        type: "debit",
        name: narration || "Imported debit",
        amount: debitAmount,
        date,
      });
    }
  }

  return entries;
}

function parseHdfcStatementCsv(csvText) {
  const lines = String(csvText || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line && line.trim().length > 0);

  if (lines.length < 2) return [];

  const rows = lines.map((line) => parseCsvRow(line));
  return parseHdfcStatementRows(rows);
}

export async function parseHdfcStatementFile(file) {
  const fileName = String(file?.name || "").toLowerCase();
  if (!file) return [];

  if (fileName.endsWith(".xls") || fileName.endsWith(".xlsx")) {
    const fileBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(fileBuffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const firstSheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", raw: false });
    return parseHdfcStatementRows(rows);
  }

  const csvText = await file.text();
  return parseHdfcStatementCsv(csvText);
}

export function buildImportedHdfcEntries(parsedEntries, currency) {
  const creditEntries = parsedEntries.filter((entry) => entry.type === "credit" && entry.amount > 0);
  const debitEntries = parsedEntries.filter((entry) => entry.type === "debit" && entry.amount > 0);
  const baseId = Date.now();

  const incomeEntries = creditEntries
    .map((entry, index) => ({
      id: baseId + index + 1,
      name: sanitizeInput(entry.name, "text") || "Imported income",
      amount: sanitizeInput(entry.amount, "number"),
      currency,
    }))
    .filter((entry) => entry.amount > 0);

  const expenseEntries = debitEntries
    .map((entry, index) => ({
      id: baseId + incomeEntries.length + index + 1,
      name: sanitizeInput(entry.name, "text") || "Imported expense",
      amount: sanitizeInput(entry.amount, "number"),
      currency,
    }))
    .filter((entry) => entry.amount > 0);

  return { incomeEntries, expenseEntries };
}
