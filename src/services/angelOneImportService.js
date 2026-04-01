import * as XLSX from "xlsx";
import { ASSET_TYPES } from "../constants";
import { sanitizeInput } from "../utils/security";

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

  value = value
    .replace(/rs\.?/gi, "")
    .replace(/inr/gi, "")
    .replace(/,/g, "")
    .replace(/[^\d.\-]/g, "")
    .trim();

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.abs(parsed);
}

function parseOptionalAmount(rawValue) {
  const parsed = parseAmountValue(rawValue);
  return parsed > 0 ? parsed : undefined;
}

function normalizeExchange(rawValue) {
  const value = String(rawValue || "").trim().toUpperCase();
  return value || undefined;
}

function resolveAssetTypeId(rawType) {
  const text = String(rawType || "").toLowerCase();

  // Try match by id
  const direct = ASSET_TYPES.find((type) => type.id.toLowerCase() === text);
  if (direct) return direct.id;

  // Try match by label
  const byLabel = ASSET_TYPES.find((type) =>
    String(type.label || "").toLowerCase().includes(text) || text.includes(String(type.label || "").toLowerCase())
  );
  if (byLabel) return byLabel.id;

  // Heuristics for common AngelOne segments
  if (text.includes("eq") || text.includes("equity") || text.includes("shares") || text.includes("stock")) {
    const equity = ASSET_TYPES.find((type) => type.id === "stocks") || ASSET_TYPES[0];
    return equity.id;
  }

  if (text.includes("mf") || text.includes("mutual")) {
    const mf = ASSET_TYPES.find((type) => type.id === "mutualfunds" || type.id === "mutual_funds");
    if (mf) return mf.id;
  }

  if (text.includes("gold")) {
    const gold = ASSET_TYPES.find((type) => type.id === "gold");
    if (gold) return gold.id;
  }

  // Fallback: treat as stocks
  const fallback = ASSET_TYPES.find((type) => type.id === "stocks") || ASSET_TYPES[0];
  return fallback.id;
}

function buildNotes(row, indices) {
  const parts = [];

  if (indices.isinIndex >= 0 && row[indices.isinIndex]) {
    parts.push(`ISIN: ${String(row[indices.isinIndex]).trim()}`);
  }

  if (indices.qtyIndex >= 0 && row[indices.qtyIndex]) {
    const rawQty = String(row[indices.qtyIndex]).trim();
    // Only treat as quantity if it looks numeric; avoid values like "Equity"
    if (/^\d+(\.\d+)?$/.test(rawQty.replace(/,/g, ""))) {
      parts.push(`Qty: ${rawQty}`);
    }
  }

  if (indices.clientCodeIndex >= 0 && row[indices.clientCodeIndex]) {
    parts.push(`Client: ${String(row[indices.clientCodeIndex]).trim()}`);
  }

  return parts.join(" | ");
}

function isLikelySummaryRow(rawName, rawType) {
  const name = String(rawName || "").toLowerCase();
  const type = String(rawType || "").toLowerCase();

  const text = `${name} ${type}`;
  if (!text.trim()) return false;

  return [
    "total",
    "grand total",
    "overall",
    "net holding value",
    "net holdings value",
    "portfolio value",
    "net portfolio value",
  ].some((token) => text.includes(token));
}

function parseAngelOneRows(rawRows) {
  const rows = (rawRows || []).map((row) =>
    Array.isArray(row) ? row.map((cell) => String(cell ?? "").trim()) : []
  );

  if (rows.length < 2) return [];

  let headerRowIndex = 0;
  let headers = rows[0].map(normalizeHeader);

  for (let i = 0; i < Math.min(rows.length, 10); i += 1) {
    const normalized = rows[i].map(normalizeHeader);
    const hasName = normalized.some(
      (h) => h.includes("scrip") || h.includes("symbol") || h.includes("security") || h.includes("stock") || h.includes("company")
    );
    const hasCurrentValue = normalized.some(
      (h) => h.includes("current value") || h.includes("current value rs") || h.includes("market value") || h === "value"
    );

    if (hasName && hasCurrentValue) {
      headerRowIndex = i;
      headers = normalized;
      break;
    }
  }

  let nameIndex = findHeaderIndex(headers, [
    "scrip name",
    "scrip",
    "symbol",
    "security",
    "company name",
    "stock name",
  ]);

  const symbolIndex = findHeaderIndex(headers, [
    "symbol",
    "trading symbol",
    "trading symbol / security name",
    "tradingsymbol",
    "ticker",
  ]);
  const typeIndex = findHeaderIndex(headers, [
    "type",
    "segment",
    "product",
    "asset type",
  ]);
  const exchangeIndex = findHeaderIndex(headers, [
    "exchange",
    "exch",
    "market",
  ]);

  let valueIndex = findHeaderIndex(headers, [
    "current value",
    "current value rs",
    "current value (rs)",
    "current value (rs.)",
    "market value",
    "value",
  ]);
  const ltpIndex = findHeaderIndex(headers, [
    "ltp",
    "last traded price",
    "last traded price (rs)",
    "current price",
    "cmp",
    "market price",
  ]);
  const avgPriceIndex = findHeaderIndex(headers, [
    "avg cost",
    "average cost",
    "avg price",
    "avg purchase price",
    "buy avg",
    "cost price",
  ]);

  const isinIndex = findHeaderIndex(headers, ["isin"]);
  const qtyIndex = findHeaderIndex(headers, ["qty", "quantity", "holdings", "holding qty"]);
  const clientCodeIndex = findHeaderIndex(headers, ["client id", "client code"]);

  const indices = { isinIndex, qtyIndex, clientCodeIndex };
  const entries = [];

  // Heuristic re-check: if our initial name/value guesses clearly look wrong on sample rows,
  // try to infer better columns based on content patterns.
  const sampleRows = [];
  for (let i = headerRowIndex + 1; i < rows.length && sampleRows.length < 5; i += 1) {
    const r = rows[i];
    if (r && r.some((cell) => String(cell || "").trim().length > 0)) {
      sampleRows.push(r);
    }
  }

  if (sampleRows.length > 0) {
    const first = sampleRows[0];

    // If name column looks purely numeric (like a serial no), try to pick a better text column.
    if (
      nameIndex >= 0 &&
      first[nameIndex] &&
      /^[\d,.\s]+$/.test(String(first[nameIndex]).trim())
    ) {
      let bestNameIndex = nameIndex;
      for (let col = 0; col < first.length; col += 1) {
        const cell = String(first[col] || "").trim();
        if (!cell) continue;
        // Prefer columns with letters (stock name/scrip) over numeric-only cells
        if (/[A-Za-z]/.test(cell) && !/^\d+(\.\d+)?$/.test(cell.replace(/,/g, ""))) {
          bestNameIndex = col;
          break;
        }
      }
      nameIndex = bestNameIndex;
    }

    // If value column we picked is not numeric in sample, try to find a numeric-looking column.
    if (
      valueIndex >= 0 &&
      first[valueIndex] &&
      !/^\d+(\.\d+)?$/.test(String(first[valueIndex]).trim().replace(/[,₹\s]/g, ""))
    ) {
      let bestValueIndex = valueIndex;
      for (let col = 0; col < first.length; col += 1) {
        const cell = String(first[col] || "").trim();
        if (!cell) continue;
        const numericCandidate = cell.replace(/[,₹\s]/g, "");
        if (/^\d+(\.\d+)?$/.test(numericCandidate)) {
          bestValueIndex = col;
          break;
        }
      }
      valueIndex = bestValueIndex;
    }
  }

  for (let lineIndex = headerRowIndex + 1; lineIndex < rows.length; lineIndex += 1) {
    const row = rows[lineIndex];
    if (!row || !row.some((cell) => String(cell || "").trim().length > 0)) continue;

    const rawName = nameIndex >= 0 ? row[nameIndex] : "";
    const rawType = typeIndex >= 0 ? row[typeIndex] : "";
    const rawValue = valueIndex >= 0 ? row[valueIndex] : "";

    // Skip obvious summary / total rows so they don't double-count holdings
    if (isLikelySummaryRow(rawName, rawType)) {
      continue;
    }

    const name = sanitizeInput(rawName || "", "text");
    const notes = sanitizeInput(buildNotes(row, indices), "text");
    const value = sanitizeInput(parseAmountValue(rawValue), "number");
    const quantity = qtyIndex >= 0 ? parseOptionalAmount(row[qtyIndex]) : undefined;
    const currentPrice = ltpIndex >= 0 ? parseOptionalAmount(row[ltpIndex]) : undefined;
    const avgPrice = avgPriceIndex >= 0 ? parseOptionalAmount(row[avgPriceIndex]) : undefined;
    const rawSymbol = symbolIndex >= 0 ? row[symbolIndex] : rawName;
    const symbol = sanitizeInput(String(rawSymbol || "").trim().toUpperCase(), "text") || undefined;
    const exchange = normalizeExchange(exchangeIndex >= 0 ? row[exchangeIndex] : "");

    if (!name || value <= 0) continue;

    entries.push({
      name,
      rawType,
      notes,
      value,
      quantity,
      symbol,
      exchange,
      cmp: currentPrice,
      avgPrice,
    });
  }

  return entries;
}

export async function parseAngelOneHoldingsFile(file) {
  const fileName = String(file?.name || "").toLowerCase();
  if (!file) return [];

  if (fileName.endsWith(".xls") || fileName.endsWith(".xlsx")) {
    try {
      const fileBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(fileBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) return [];

      const firstSheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", raw: false });
      return parseAngelOneRows(rows);
    } catch (error) {
      // If Excel parsing fails, fall through and try treating it as text/CSV below.
    }
  }

  // Fallback: try CSV text if user uploads a CSV instead of Excel
  const text = await file.text();
  if (!text) return [];

  try {
    const workbook = XLSX.read(text, { type: "string" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const firstSheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "", raw: false });
    return parseAngelOneRows(rows);
  } catch (error) {
    // As a last resort, attempt a very naive CSV split if it's plain text
    const lines = text.split(/\r?\n/).filter((line) => line && line.trim().length > 0);
    if (lines.length < 2) return [];
    const rows = lines.map((line) => line.split(","));
    return parseAngelOneRows(rows);
  }
}

export function buildAngelOneAssetEntries(parsedRows, currency) {
  const baseId = Date.now();

  return parsedRows.map((row, index) => {
    const typeId = resolveAssetTypeId(row.rawType);
    const quantity = row.quantity && row.quantity > 0 ? row.quantity : undefined;
    const cmp = row.cmp && row.cmp > 0
      ? row.cmp
      : quantity
        ? Number((row.value / quantity).toFixed(2))
        : undefined;
    const invested = quantity && row.avgPrice && row.avgPrice > 0
      ? Number((quantity * row.avgPrice).toFixed(2))
      : undefined;
    const pnl = invested && invested > 0 ? Number((row.value - invested).toFixed(2)) : undefined;
    const pnlPct = invested && invested > 0 ? ((row.value - invested) / invested) * 100 : undefined;

    const baseEntry = {
      // id will be re-assigned/upserted in the store; this is a temporary stable key
      id: baseId + index + 1,
      typeId,
      name: row.name,
      value: row.value,
      currency,
      notes: row.notes || "",
      source: "angelone",
    };

    if (typeId === "stocks") {
      return {
        ...baseEntry,
        symbol: row.symbol,
        exchange: row.exchange || "NSE",
        shares: quantity,
        avgPrice: row.avgPrice,
        cmp,
        invested,
        pnl,
        pnlPct,
        priceUpdatedAt: cmp ? new Date(baseId).toISOString() : undefined,
      };
    }

    if (typeId === "mutual_funds") {
      return {
        ...baseEntry,
        symbol: row.symbol,
        exchange: row.exchange || "MUTUALFUND",
        units: quantity,
        avgNav: row.avgPrice,
        cmp,
        invested,
        pnl,
        pnlPct,
        priceUpdatedAt: cmp ? new Date(baseId).toISOString() : undefined,
      };
    }

    return baseEntry;
  });
}

