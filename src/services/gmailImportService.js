/**
 * services/gmailImportService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches HDFC Bank statements and Angel One holding reports from Gmail using
 * the authenticated Google OAuth2 access token already issued by Firebase.
 *
 * Architecture:
 *  - No extra login screens — reuses the token from Firebase GoogleAuthProvider
 *  - All processing is client-side; no raw email or PDFs are stored
 *  - Returns structured data that feeds directly into existing importers
 */

// ─── Gmail API base ───────────────────────────────────────────────────────────

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailGet(path, token) {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gmail API ${res.status}: ${err?.error?.message || res.statusText}`);
  }
  return res.json();
}

// ─── Search queries ───────────────────────────────────────────────────────────

const HDFC_QUERY =
  `(from:alerts@hdfcbank.net OR from:myaccount@hdfcbank.com OR from:statements@hdfcbank.com)` +
  ` (subject:Statement OR subject:"Account Statement")` +
  ` has:attachment`;

const ANGEL_QUERY =
  `(from:noreply@angelone.in OR from:reports@angelone.in)` +
  ` (subject:Holding OR subject:Portfolio OR subject:"Investment Report")` +
  ` has:attachment`;

// ─── Low-level Gmail helpers ─────────────────────────────────────────────────

async function searchMessages(token, query, maxResults = 10) {
  const params = new URLSearchParams({ q: query, maxResults });
  const data   = await gmailGet(`/messages?${params}`, token);
  return data.messages || [];
}

async function getMessage(token, messageId) {
  return gmailGet(`/messages/${messageId}?format=full`, token);
}

/**
 * Walk the MIME tree and return all parts matching the given mimeTypes.
 */
function collectParts(payload, mimeTypes) {
  const results = [];

  function walk(part) {
    if (!part) return;
    if (mimeTypes.includes(part.mimeType)) {
      results.push(part);
    }
    if (part.parts) part.parts.forEach(walk);
  }

  walk(payload);
  return results;
}

/** Download an attachment and return it as an ArrayBuffer. */
async function fetchAttachment(token, messageId, attachmentId) {
  const data = await gmailGet(
    `/messages/${messageId}/attachments/${attachmentId}`,
    token
  );
  // Gmail returns base64url — convert to ArrayBuffer
  const b64   = (data.data || "").replace(/-/g, "+").replace(/_/g, "/");
  const bin   = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** Return inline base64 body data as ArrayBuffer (for small inline attachments). */
function inlinePartToBuffer(part) {
  const raw = (part.body?.data || "").replace(/-/g, "+").replace(/_/g, "/");
  if (!raw) return null;
  const bin   = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// ─── HDFC statement parser (text-based extraction from email body) ────────────

/**
 * HDFC sends statement data in the email body as well as PDFs.
 * We parse the plain-text body since PDFs require a server-side parser.
 * Returns { transactions, accountNumber, period, openingBalance, closingBalance }
 */
function parseHdfcEmailBody(textBody) {
  const lines = textBody
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const transactions = [];
  let accountNumber  = null;
  let openingBalance = null;
  let closingBalance = null;
  let period         = null;

  // Extract account number: "A/c No: XXXX1234" or "Account Number: XXXXXXXX1234"
  for (const line of lines) {
    const acMatch = line.match(/[Aa]\/[Cc]\s*[Nn]o\.?\s*[:\-]?\s*([X\d]{4,20})/);
    if (acMatch) { accountNumber = acMatch[1]; break; }
    const acMatch2 = line.match(/[Aa]ccount\s+[Nn]umber\s*[:\-]?\s*([X\d]{4,20})/);
    if (acMatch2) { accountNumber = acMatch2[1]; break; }
  }

  // Extract period: "01-Jan-2026 to 31-Jan-2026" or "Jan 2026"
  for (const line of lines) {
    const pMatch = line.match(/(\d{2}[-\/][A-Za-z]{3}[-\/]\d{4})\s+(?:to|TO|-)\s+(\d{2}[-\/][A-Za-z]{3}[-\/]\d{4})/);
    if (pMatch) { period = `${pMatch[1]} to ${pMatch[2]}`; break; }
    const pMatch2 = line.match(/([A-Za-z]{3,9}\s+\d{4})/);
    if (pMatch2 && line.toLowerCase().includes("statement")) { period = pMatch2[1]; break; }
  }

  // Extract balances
  for (const line of lines) {
    const obMatch = line.match(/[Oo]pening\s+[Bb]alance\s*[:\-]?\s*(?:INR|Rs\.?)?\s*([\d,]+\.?\d*)/);
    if (obMatch) openingBalance = parseFloat(obMatch[1].replace(/,/g, ""));
    const cbMatch = line.match(/[Cc]losing\s+[Bb]alance\s*[:\-]?\s*(?:INR|Rs\.?)?\s*([\d,]+\.?\d*)/);
    if (cbMatch) closingBalance = parseFloat(cbMatch[1].replace(/,/g, ""));
  }

  // Parse transaction table rows:
  // Date | Description | Debit | Credit | Balance
  // Pattern: "DD/MM/YYYY  Some description  1,234.56  50,000.00  1,23,456.78"
  const txnRegex = /^(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})?\s*([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})\s*$/;
  for (const line of lines) {
    const m = line.match(txnRegex);
    if (!m) continue;
    const parseAmt = (s) => (s ? parseFloat(s.replace(/,/g, "")) : undefined);
    transactions.push({
      date:        m[1],
      description: m[2].trim(),
      debit:       parseAmt(m[3]),
      credit:      parseAmt(m[4]),
      balance:     parseAmt(m[5]) || 0,
    });
  }

  return { transactions, accountNumber, period, openingBalance, closingBalance };
}

/** Extract plain text from a Gmail message payload. */
function extractTextBody(payload) {
  const textParts = collectParts(payload, [
    "text/plain",
    "text/html",
  ]);
  for (const part of textParts) {
    const raw = part.body?.data || "";
    if (!raw) continue;
    const b64  = raw.replace(/-/g, "+").replace(/_/g, "/");
    const text = atob(b64);
    // Strip basic HTML tags if html part
    if (part.mimeType === "text/html") {
      return text.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
    }
    return text;
  }
  return "";
}

// ─── Transaction categorizer ─────────────────────────────────────────────────

const CATEGORY_RULES = [
  { category: "Salary",   patterns: [/salary/i, /payroll/i, /sal credit/i, /pay credit/i] },
  { category: "Food",     patterns: [/swiggy/i, /zomato/i, /food/i, /restaurant/i, /cafe/i, /hotel/i] },
  { category: "Shopping", patterns: [/amazon/i, /flipkart/i, /myntra/i, /meesho/i, /ajio/i, /nykaa/i] },
  { category: "Bills",    patterns: [/electricity/i, /bescom/i, /tangedco/i, /mseb/i, /mobile recharge/i, /airtel/i, /jio/i, /vodafone/i, /broadband/i, /internet/i, /bsnl/i] },
  { category: "Fuel",     patterns: [/petrol/i, /indian oil/i, /iocl/i, /hp petro/i, /bharat petroleum/i, /fuel/i] },
  { category: "Transfer", patterns: [/upi/i, /imps/i, /neft/i, /rtgs/i, /transfer/i, /trf/i] },
  { category: "ATM",      patterns: [/atm/i, /cash withdrawal/i, /cash wtd/i] },
  { category: "EMI",      patterns: [/emi/i, /loan/i, /hdfc bank emi/i] },
];

export function categorizeTransaction(description) {
  const desc = String(description || "").toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((p) => p.test(desc))) return rule.category;
  }
  return "Other";
}

// ─── Deduplication hash ───────────────────────────────────────────────────────

export function buildTxnHash(txn) {
  return `${txn.date}|${txn.amount}|${String(txn.description || "").slice(0, 40).toLowerCase()}`;
}

export function buildHoldingHash(holding) {
  return `${String(holding.symbol || holding.name || "").toLowerCase()}`;
}

// ─── Normalize HDFC transactions → WealthTracker income/expense format ────────

export function normalizeHdfcTransactions(transactions, currency = "INR") {
  const incomeEntries  = [];
  const expenseEntries = [];
  const hashes         = new Set();

  for (const txn of transactions) {
    const hash = buildTxnHash({
      date:        txn.date,
      amount:      txn.debit ?? txn.credit ?? 0,
      description: txn.description,
    });
    if (hashes.has(hash)) continue;
    hashes.add(hash);

    const category = categorizeTransaction(txn.description);
    const month    = parseTxnMonth(txn.date);
    const base     = {
      id:       `hdfc-${hash}-${Date.now()}`,
      name:     txn.description,
      currency,
      category,
      date:     txn.date,
      month,
      source:   "gmail-auto",
    };

    if (txn.credit && txn.credit > 0) {
      incomeEntries.push({ ...base, amount: txn.credit, incomeType: category === "Salary" ? "salary" : "other" });
    } else if (txn.debit && txn.debit > 0) {
      expenseEntries.push({ ...base, amount: txn.debit });
    }
  }

  return { incomeEntries, expenseEntries };
}

function parseTxnMonth(dateStr) {
  if (!dateStr) return "";
  // "DD/MM/YYYY" or "DD-MM-YYYY" or "DD-Mon-YYYY"
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length < 3) return "";
  let year, month;

  const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const mStr = parts[1].toLowerCase();
  const mIdx = monthNames.indexOf(mStr);

  if (mIdx !== -1) {
    // DD-Mon-YYYY
    year  = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    month = String(mIdx + 1).padStart(2, "0");
  } else {
    // DD/MM/YYYY
    year  = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    month = parts[1].padStart(2, "0");
  }

  return `${year}-${month}`;
}

// ─── Main HDFC fetch ─────────────────────────────────────────────────────────

export async function fetchHdfcData(gmailToken, existingHashes = new Set()) {
  const messageList = await searchMessages(gmailToken, HDFC_QUERY, 5);
  if (!messageList.length) return { incomeEntries: [], expenseEntries: [], accountInfo: null };

  const allIncome   = [];
  const allExpenses = [];
  let   accountInfo = null;

  for (const { id } of messageList.slice(0, 3)) {
    try {
      const message = await getMessage(gmailToken, id);
      const body    = extractTextBody(message.payload);
      const parsed  = parseHdfcEmailBody(body);

      if (!accountInfo && parsed.accountNumber) {
        accountInfo = {
          accountNumber:  parsed.accountNumber,
          period:         parsed.period,
          openingBalance: parsed.openingBalance,
          closingBalance: parsed.closingBalance,
        };
      }

      const { incomeEntries, expenseEntries } = normalizeHdfcTransactions(parsed.transactions);

      // Deduplicate against existing
      incomeEntries.forEach((e) => {
        const h = buildTxnHash(e);
        if (!existingHashes.has(h)) { allIncome.push(e); existingHashes.add(h); }
      });
      expenseEntries.forEach((e) => {
        const h = buildTxnHash(e);
        if (!existingHashes.has(h)) { allExpenses.push(e); existingHashes.add(h); }
      });
    } catch (err) {
      console.warn("HDFC message parse error:", err.message);
    }
  }

  return { incomeEntries: allIncome, expenseEntries: allExpenses, accountInfo };
}

// ─── Angel One: parse email body for holdings table ──────────────────────────

function parseAngelOneEmailBody(textBody) {
  const lines   = textBody.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const holdings = [];

  // Angel One sends holding tables like:
  // Symbol | Qty | Avg Price | Current Value
  // RELIANCE | 10 | 2450.00 | 2500.00
  const holdingRegex = /^([A-Z][A-Z0-9&-]{1,20})\s+\|?\s*(\d+)\s+\|?\s*([\d,]+\.?\d*)\s+\|?\s*([\d,]+\.?\d*)?/;

  for (const line of lines) {
    const m = line.match(holdingRegex);
    if (!m) continue;
    const qty          = parseInt(m[2], 10);
    const averagePrice = parseFloat(m[3].replace(/,/g, ""));
    const currentValue = m[4] ? parseFloat(m[4].replace(/,/g, "")) : undefined;
    if (!qty || !averagePrice) continue;
    holdings.push({
      symbol:       m[1],
      quantity:     qty,
      averagePrice,
      currentValue: currentValue || qty * averagePrice,
    });
  }

  return holdings;
}

/** Normalize Angel One holdings → WealthTracker asset entries */
export function normalizeAngelOneHoldings(holdings, currency = "INR") {
  const hashes = new Set();
  return holdings
    .map((h) => {
      const hash = buildHoldingHash(h);
      if (hashes.has(hash)) return null;
      hashes.add(hash);
      return {
        id:           `angel-${hash}-${Date.now()}`,
        name:         h.symbol,
        typeId:       "stocks",
        value:        h.currentValue || h.quantity * h.averagePrice,
        invested:     h.quantity * h.averagePrice,
        shares:       h.quantity,
        averagePrice: h.averagePrice,
        currency,
        notes:        `Imported from Angel One via Gmail`,
        source:       "gmail-auto",
      };
    })
    .filter(Boolean);
}

// ─── Main Angel One fetch ─────────────────────────────────────────────────────

export async function fetchAngelOneData(gmailToken, existingHashes = new Set()) {
  const messageList = await searchMessages(gmailToken, ANGEL_QUERY, 5);
  if (!messageList.length) return { holdings: [] };

  const allHoldings = [];

  for (const { id } of messageList.slice(0, 3)) {
    try {
      const message  = await getMessage(gmailToken, id);
      const body     = extractTextBody(message.payload);
      const holdings = parseAngelOneEmailBody(body);

      const normalized = normalizeAngelOneHoldings(holdings);
      normalized.forEach((h) => {
        const hash = buildHoldingHash(h);
        if (!existingHashes.has(hash)) {
          allHoldings.push(h);
          existingHashes.add(hash);
        }
      });
    } catch (err) {
      console.warn("Angel One message parse error:", err.message);
    }
  }

  return { holdings: allHoldings };
}

// ─── Full sync ────────────────────────────────────────────────────────────────

export async function runFullGmailSync(gmailToken, { incomes, expenses, assets, currency }) {
  // Build existing hash sets for deduplication
  const incomeHashes  = new Set(incomes.map((i)  => buildTxnHash({ date: i.date, amount: i.amount,  description: i.name })));
  const expenseHashes = new Set(expenses.map((e) => buildTxnHash({ date: e.date, amount: e.amount,  description: e.name })));
  const holdingHashes = new Set(assets.map((a)   => buildHoldingHash(a)));

  const combinedHashes = new Set([...incomeHashes, ...expenseHashes]);

  const [hdfcResult, angelResult] = await Promise.allSettled([
    fetchHdfcData(gmailToken, combinedHashes),
    fetchAngelOneData(gmailToken, holdingHashes),
  ]);

  const hdfc  = hdfcResult.status  === "fulfilled" ? hdfcResult.value  : { incomeEntries: [], expenseEntries: [], accountInfo: null };
  const angel = angelResult.status === "fulfilled" ? angelResult.value : { holdings: [] };

  return {
    incomeEntries:  hdfc.incomeEntries,
    expenseEntries: hdfc.expenseEntries,
    holdings:       angel.holdings,
    accountInfo:    hdfc.accountInfo,
    summary: {
      newIncome:   hdfc.incomeEntries.length,
      newExpenses: hdfc.expenseEntries.length,
      newHoldings: angel.holdings.length,
    },
  };
}
