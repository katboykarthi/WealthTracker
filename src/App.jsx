import { useState, useEffect, useRef, useMemo } from "react";
import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { applyTheme, cardStyle as sharedCardStyle, inputStyle as sharedInputStyle, labelStyle as sharedLabelStyle, buttonStyles, fontFamily, serifFontFamily, heroGradient, onboardingGradient } from "./styles";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import * as XLSX from "xlsx";
import { CURRENCIES, ASSET_TYPES, LIABILITY_TYPES, NAV_ITEMS, GOAL_ICONS } from "./constants";
import { formatCurrency } from "./utils/formatting";
import { sanitizeInput } from "./utils/security";
import { auth, db, googleProvider, isFirebaseConfigured } from "./firebase";

const TOAST_EVENT_NAME = "wealthtracker:toast";

function notifyApp(message, type = "info") {
  const text = String(message || "").trim();
  if (!text) return;

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT_NAME, {
        detail: { message: text, type },
      })
    );
  }
}

// Mobile detection hook
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return isMobile;
}

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

    // Summary/footer rows can contain statement-level totals in both columns.
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

async function parseHdfcStatementFile(file) {
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

function buildImportedHdfcEntries(parsedEntries, currency) {
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

function LoadingScreen({ title, detail }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #f8fafc)",
        color: "var(--text-color, #1e293b)",
        fontFamily,
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--card-bg, #fff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 16,
          padding: "28px 22px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 10 }}>{"\u{23F3}"}</div>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--muted, #64748b)" }}>{detail}</div>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, busy, error, configError }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #f8fafc)",
        color: "var(--text-color, #1e293b)",
        fontFamily,
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--card-bg, #fff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 18,
          padding: "34px 26px",
          textAlign: "center",
          boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u{1F33F}"}</div>
        <h1 style={{ fontFamily: serifFontFamily, fontSize: 28, margin: "0 0 8px", color: "var(--heading-color, #1a2e1a)" }}>
          Karthick Wealth Tracker
        </h1>
        <p style={{ margin: "0 0 22px", color: "var(--muted, #64748b)", fontSize: 14, lineHeight: 1.5 }}>
          Sign in with Google to securely load and save your data from anywhere.
        </p>
        {configError ? (
          <div
            style={{
              background: "var(--danger-bg, #fff5f5)",
              border: "1px solid var(--error, #ef4444)",
              borderRadius: 12,
              padding: "12px 14px",
              color: "var(--error, #ef4444)",
              fontSize: 13,
              textAlign: "left",
            }}
          >
            {configError}
          </div>
        ) : (
          <button
            onClick={onLogin}
            disabled={busy}
            style={{
              ...buttonStyles.primary,
              width: "100%",
              opacity: busy ? 0.8 : 1,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Signing in..." : "Continue with Google"}
          </button>
        )}
        {error && !configError && (
          <div style={{ marginTop: 12, color: "var(--error, #ef4444)", fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function OnboardingStep1({ onNext }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>{"\u{1F33F}"}</div>
      <h1 style={{ fontFamily: serifFontFamily, fontSize: 32, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>
        Welcome to Karthick Wealth-tracker
      </h1>
      <p style={{ color: "var(--muted, #64748b)", fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
        Your <strong>privacy-first</strong> net worth tracker. No broker connections, no third-party tracking.{" "}
        <em>Just you and your data.</em>
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 40 }}>
        {[
          "\u{1F512} Private & Secure",
          "\u{1F1EE}\u{1F1F3} INR Focused",
          "\u{1F4CA} Track Everything",
        ].map((f) => (
          <span
            key={f}
            style={{
              background: "var(--accent-bg, #f0fdf4)",
              border: "1px solid var(--accent-border, #bbf7d0)",
              color: "var(--primary, #16a34a)",
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {f}
          </span>
        ))}
      </div>
      <button onClick={onNext} style={btnStyle}>
        Get Started
      </button>
    </div>
  );
}

function OnboardingStep2({ onNext, onSkip, onAddAsset }) {
  const [showMore, setShowMore] = useState(false);
  const primaryTypes = ASSET_TYPES.slice(0, 6);
  const moreTypes = ASSET_TYPES.slice(6);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const handleSelect = (id) => {
    setSelected(id);
    setShowForm(true);
  };

  return (
    <div style={{ maxWidth: 580, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                height: 4,
                flex: 1,
                borderRadius: 2,
                background: s === 1 ? "#16a34a" : "var(--border, #e2e8f0)",
              }}
            />
          ))}
        </div>
        <h2 style={{ fontFamily: serifFontFamily, fontSize: 26, color: "var(--heading-color, #1a2e1a)", marginBottom: 6 }}>
          Add your assets
        </h2>
        <p style={{ color: "var(--muted, #64748b)", fontSize: 14 }}>
          Import from your broker or add manually. You can always do this later.
        </p>
      </div>

      <div
        style={{
          border: "1.5px dashed var(--accent-border, #bbf7d0)",
          background: "var(--accent-bg, #f0fdf4)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 32 }}>{"\u{1F4C2}"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: "var(--primary, #16a34a)", marginBottom: 2 }}>Import from Broker</div>
          <div style={{ fontSize: 13, color: "var(--muted, #64748b)" }}>Upload CSV/Excel from Zerodha, Groww, or any broker</div>
        </div>
        <button
          style={{
            background: "var(--input-bg, #fff)",
            border: "1.5px solid var(--primary, #16a34a)",
            color: "var(--primary, #16a34a)",
            padding: "8px 16px",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Upload
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: "var(--border, var(--border, #e2e8f0))" }} />
        <span style={{ color: "var(--muted-light, #94a3b8)", fontSize: 13 }}>or add manually</span>
        <div style={{ flex: 1, height: 1, background: "var(--border, var(--border, #e2e8f0))" }} />
      </div>

      {!showForm ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {primaryTypes.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t.id)}
                style={{
                  background: "var(--input-bg, #fff)",
                  border: "1.5px solid var(--border, var(--border, #e2e8f0))",
                  borderRadius: 10,
                  padding: "14px 10px",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s",
                  fontSize: 13,
                  color: "var(--heading-color, #1a2e1a)",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = t.color;
                  e.currentTarget.style.background = "var(--bg-light, #f8fafc)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border, var(--border, #e2e8f0))";
                  e.currentTarget.style.background = "var(--input-bg, #fff)";
                }}
              >
                <div style={{ fontSize: 24, marginBottom: 6 }}>{t.icon}</div>
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowMore(!showMore)}
            style={{
              background: "none",
              border: "1.5px solid var(--border, #e2e8f0)",
              borderRadius: 8,
              padding: "10px 20px",
              cursor: "pointer",
              color: "var(--muted, #64748b)",
              fontSize: 13,
              width: "100%",
              marginBottom: 16,
            }}
          >
            {showMore ? "Show less" : "More asset types..."}
          </button>
          {showMore && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {moreTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t.id)}
                  style={{
                    background: "var(--bg-light, #f8fafc)",
                    border: "1.5px solid var(--border, var(--border, #e2e8f0))",
                    borderRadius: 20,
                    padding: "6px 14px",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--heading-color, #1a2e1a)",
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <AddAssetForm
          typeId={selected}
          onSave={(asset) => {
            onAddAsset(asset);
            setShowForm(false);
            setSelected(null);
          }}
          onCancel={() => {
            setShowForm(false);
            setSelected(null);
          }}
        />
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button onClick={onSkip} style={{ ...btnStyle, background: "var(--muted-bg, var(--muted-bg, #f1f5f9))", color: "var(--muted, #64748b)", flex: 1 }}>
          Skip for now
        </button>
        <button onClick={onNext} style={{ ...btnStyle, flex: 2 }}>
          Continue
        </button>
      </div>
    </div>
  );
}

function AddAssetForm({ typeId, onSave, onCancel, editData }) {
  const type = ASSET_TYPES.find((t) => t.id === typeId) || ASSET_TYPES[0];
  const [name, setName] = useState(editData?.name || "");
  const [value, setValue] = useState(editData?.value || "");
  const [notes, setNotes] = useState(editData?.notes || "");

  const handleSave = () => {
    // Security: Validate and sanitize inputs
    const sanitizedName = sanitizeInput(name, 'text');
    const sanitizedNotes = sanitizeInput(notes, 'text');
    const sanitizedValue = sanitizeInput(value, 'number');
    
    if (!sanitizedName || sanitizedValue <= 0) {
      notifyApp("Please enter valid asset name and positive value.", "error");
      return;
    }
    
    onSave({ 
      id: Date.now(), 
      typeId, 
      name: sanitizedName, 
      value: sanitizedValue, 
      currency: "INR", 
      notes: sanitizedNotes, 
      icon: type.icon, 
      color: type.color, 
      label: type.label 
    });
  };

  return (
    <div style={{ background: "var(--bg-light, #f8fafc)", borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 28 }}>{type.icon}</span>
        <span style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", fontSize: 16 }}>{type.label}</span>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={labelStyle}>Asset Name</label>
          <input
            style={inputStyle}
            placeholder={`e.g. ${type.id === "stocks" ? "Reliance Industries" : type.id === "real_estate" ? "2BHK Apartment" : "My " + type.label}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Current Value (INR)</label>
          <input
            style={inputStyle}
            type="number"
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Notes (optional)</label>
          <input
            style={inputStyle}
            placeholder="Any additional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 16 }}>
        <button onClick={onCancel} style={{ ...btnStyle, background: "#fff", color: "var(--muted, #64748b)", border: "1.5px solid var(--border, #e2e8f0)", flex: 1 }}>Cancel</button>
        <button onClick={handleSave} style={{ ...btnStyle, flex: 2 }}>Save Asset</button>
      </div>
    </div>
  );
}

function AddLiabilityForm({ onSave, onCancel, editData }) {
  const [typeId, setTypeId] = useState(editData?.typeId || "home_loan");
  const [name, setName] = useState(editData?.name || "");
  const [value, setValue] = useState(editData?.value || "");
  const [interest, setInterest] = useState(editData?.interest || "");

  const type = LIABILITY_TYPES.find((t) => t.id === typeId) || LIABILITY_TYPES[0];

  const handleSave = () => {
    // Security: Validate and sanitize inputs
    const sanitizedName = sanitizeInput(name, 'text');
    const sanitizedValue = sanitizeInput(value, 'number');
    const sanitizedInterest = sanitizeInput(interest, 'number');
    
    if (!sanitizedName || sanitizedValue <= 0) {
      notifyApp("Please enter valid liability name and positive amount.", "error");
      return;
    }
    
    onSave({ 
      id: Date.now(), 
      typeId, 
      name: sanitizedName, 
      value: sanitizedValue, 
      currency: "INR", 
      interest: sanitizedInterest >= 0 ? sanitizedInterest : 0, 
      icon: type.icon, 
      label: type.label 
    });
  };

  return (
    <div style={{ background: "var(--bg-light, #f8fafc)", borderRadius: 14, padding: 20 }}>
      <h3 style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 16 }}>Add Liability</h3>
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={labelStyle}>Liability Type</label>
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} style={inputStyle}>
            {LIABILITY_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Name</label>
          <input style={inputStyle} placeholder="e.g. HDFC Home Loan" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Outstanding Amount (INR)</label>
          <input style={inputStyle} type="number" placeholder="0" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Interest Rate (% p.a.)</label>
          <input style={inputStyle} type="number" placeholder="e.g. 8.5" value={interest} onChange={(e) => setInterest(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 16 }}>
        <button onClick={onCancel} style={{ ...btnStyle, background: "#fff", color: "var(--muted, #64748b)", border: "1.5px solid var(--border, #e2e8f0)", flex: 1 }}>Cancel</button>
        <button onClick={handleSave} style={{ ...btnStyle, background: "#ef4444", flex: 2 }}>Save Liability</button>
      </div>
    </div>
  );
}

function OnboardingStep3({ onFinish }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 440, margin: "0 auto" }}>
      <div style={{ fontSize: 72, marginBottom: 20 }}>{"\u{1F389}"}</div>
      <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)", marginBottom: 12 }}>
        You're all set!
      </h2>
      <p style={{ color: "var(--muted, #64748b)", lineHeight: 1.7, marginBottom: 32 }}>
        Your personal wealth tracker is ready. Start tracking your net worth, set financial goals, and gain insights into your financial health - all privately, just on your device.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 32,
          textAlign: "left",
        }}
      >
        {[
          { icon: "\u{1F4CA}", title: "Dashboard", desc: "See your net worth at a glance" },
          { icon: "\u{1F3AF}", title: "Goals", desc: "Track progress to your targets" },
          { icon: "\u{1F4C8}", title: "Net Worth", desc: "Historical snapshots & trends" },
          { icon: "\u{1F4A1}", title: "Insights", desc: "Smart observations about your wealth" },
        ].map((f) => (
          <div
            key={f.title}
            style={{ background: "var(--bg-light, #f8fafc)", borderRadius: 12, padding: 16, border: "1px solid var(--border, #e2e8f0)" }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, color: "var(--text-color, #1e293b)", fontSize: 14 }}>{f.title}</div>
            <div style={{ color: "var(--muted, #64748b)", fontSize: 12, marginTop: 2 }}>{f.desc}</div>
          </div>
        ))}
      </div>
      <button onClick={onFinish} style={btnStyle}>
        Go to Dashboard
      </button>
    </div>
  );
}

function Dashboard({
  assets,
  liabilities,
  incomes,
  expenses,
  currency,
  snapshots,
  onSnapshot,
  onAddAsset,
  isMobile,
  onToast,
  onNavigate,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("all");
  const [assetSort, setAssetSort] = useState("value_desc");
  const [showQuickPopover, setShowQuickPopover] = useState(false);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState("stocks");
  const [holdingsPage, setHoldingsPage] = useState(1);
  const [cashflowPage, setCashflowPage] = useState(1);

  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const c = CURRENCIES.find((item) => item.code === currency) || CURRENCIES[0];
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const allocationData = useMemo(
    () =>
      ASSET_TYPES.filter((type) => {
        const total = assets.filter((asset) => asset.typeId === type.id).reduce((sum, asset) => sum + asset.value, 0);
        return total > 0;
      }).map((type) => ({
        name: type.label,
        value: assets.filter((asset) => asset.typeId === type.id).reduce((sum, asset) => sum + asset.value, 0),
        color: type.color,
      })),
    [assets]
  );

  const tableAssets = useMemo(() => {
    const normalizedQuery = assetSearch.trim().toLowerCase();

    let rows = assets.filter((asset) => {
      if (assetFilter !== "all" && asset.typeId !== assetFilter) return false;
      if (!normalizedQuery) return true;
      return String(asset.name || "").toLowerCase().includes(normalizedQuery);
    });

    rows = [...rows].sort((a, b) => {
      if (assetSort === "value_asc") return a.value - b.value;
      if (assetSort === "value_desc") return b.value - a.value;
      if (assetSort === "name_desc") return String(b.name || "").localeCompare(String(a.name || ""));
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    return rows;
  }, [assets, assetSearch, assetFilter, assetSort]);

  const combinedCashflow = useMemo(() => {
    const incomeRows = incomes.map((entry) => ({
      id: `inc-${entry.id}`,
      date: entry.date || "-",
      type: "Income",
      name: entry.name || "Income",
      amount: entry.amount || 0,
      currency: entry.currency || currency,
      color: "#16a34a",
    }));

    const expenseRows = expenses.map((entry) => ({
      id: `exp-${entry.id}`,
      date: entry.date || "-",
      type: "Expense",
      name: entry.name || "Expense",
      amount: entry.amount || 0,
      currency: entry.currency || currency,
      color: "#ef4444",
    }));

    return [...incomeRows, ...expenseRows].sort((a, b) => b.amount - a.amount);
  }, [incomes, expenses, currency]);

  const pagedTableAssets = useMemo(
    () => getPaginatedRows(tableAssets, holdingsPage),
    [tableAssets, holdingsPage]
  );

  const pagedCashflowRows = useMemo(
    () => getPaginatedRows(combinedCashflow, cashflowPage),
    [combinedCashflow, cashflowPage]
  );

  useEffect(() => {
    setHoldingsPage(1);
  }, [assetSearch, assetFilter, assetSort]);

  useEffect(() => {
    const totalPages = getTotalPages(tableAssets.length);
    if (holdingsPage > totalPages) {
      setHoldingsPage(totalPages);
    }
  }, [tableAssets.length, holdingsPage]);

  useEffect(() => {
    const totalPages = getTotalPages(combinedCashflow.length);
    if (cashflowPage > totalPages) {
      setCashflowPage(totalPages);
    }
  }, [combinedCashflow.length, cashflowPage]);

  useEffect(() => {
    if (!showQuickPopover) return undefined;
    const closePopover = () => setShowQuickPopover(false);
    window.addEventListener("click", closePopover);
    return () => window.removeEventListener("click", closePopover);
  }, [showQuickPopover]);

  const handleSnapshot = () => {
    onToast?.("Snapshot captured and timeline updated.", "success");
    setShowSnapshotModal(false);
    onSnapshot();
  };

  const handleNavigate = (navId) => {
    onNavigate?.(navId);
    setShowQuickPopover(false);
  };

  const openAssetFromModal = () => {
    setShowAddModal(false);
    onToast?.(`Opening ${ASSET_TYPES.find((type) => type.id === selectedType)?.label || "asset"} flow.`, "info");
    onAddAsset?.(selectedType);
  };

  return (
    <DashboardWrap $isMobile={isMobile}>
      <HeroPanel $isMobile={isMobile}>
        <div>
          <HeroLabel>Net Worth • {currency}</HeroLabel>
          <HeroValue>{c.symbol}{netWorth.toLocaleString()}</HeroValue>
          <HeroMeta>{today}</HeroMeta>
        </div>
        <ActionCluster>
          <PrimaryButton onClick={() => setShowSnapshotModal(true)}>Take Snapshot</PrimaryButton>
          <SecondaryButton onClick={() => setShowAddModal(true)}>Add Asset</SecondaryButton>
          <FloatingArea onClick={(event) => event.stopPropagation()}>
            <GhostButton onClick={() => setShowQuickPopover((prev) => !prev)}>Quick Actions</GhostButton>
            {showQuickPopover && (
              <PopoverCard>
                <PopoverAction onClick={() => { setShowSnapshotModal(true); setShowQuickPopover(false); }}>
                  Save snapshot
                </PopoverAction>
                <PopoverAction onClick={() => { setShowAddModal(true); setShowQuickPopover(false); }}>
                  Open add asset
                </PopoverAction>
                <PopoverAction onClick={() => handleNavigate("expenses")}>
                  Open expenses page
                </PopoverAction>
                <PopoverAction onClick={() => handleNavigate("insights")}>
                  Open insights page
                </PopoverAction>
              </PopoverCard>
            )}
          </FloatingArea>
        </ActionCluster>
      </HeroPanel>

      <StatGrid $isMobile={isMobile}>
        <StatCard>
          <StatLabel>Total Assets</StatLabel>
          <StatValue style={{ color: "#16a34a" }}>{formatCurrency(totalAssets, currency)}</StatValue>
          <StatSub>{assets.length} items tracked</StatSub>
        </StatCard>
        <StatCard>
          <StatLabel>Total Liabilities</StatLabel>
          <StatValue style={{ color: "#ef4444" }}>{formatCurrency(totalLiabilities, currency)}</StatValue>
          <StatSub>{liabilities.length} active entries</StatSub>
        </StatCard>
        <StatCard>
          <StatLabel>Savings Rate</StatLabel>
          <StatValue style={{ color: savingsRate >= 35 ? "#16a34a" : "#f59e0b" }}>{savingsRate.toFixed(1)}%</StatValue>
          <StatSub>Debt ratio: {debtRatio.toFixed(1)}%</StatSub>
        </StatCard>
      </StatGrid>

      <DashboardTabs>
        <TabButton $active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>Overview</TabButton>
        <TabButton $active={activeTab === "holdings"} onClick={() => setActiveTab("holdings")}>Holdings</TabButton>
        <TabButton $active={activeTab === "cashflow"} onClick={() => setActiveTab("cashflow")}>Cashflow</TabButton>
      </DashboardTabs>

      {activeTab === "overview" && (
        <PanelGrid $isMobile={isMobile}>
          <PanelCard>
            <PanelTitle>Net Worth Trend</PanelTitle>
            <PanelHint>Smooth trend chart from your snapshots.</PanelHint>
            {snapshots.length < 2 ? (
              <EmptyBlock>Take two snapshots to unlock trend visualization.</EmptyBlock>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={snapshots}>
                  <XAxis dataKey="date" tick={{ fontSize: TYPE_SCALE.micro }} />
                  <YAxis tick={{ fontSize: TYPE_SCALE.micro }} tickFormatter={(value) => formatCurrency(value, currency)} />
                  <Tooltip formatter={(value) => formatCurrency(value, currency)} />
                  <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2.4} dot={{ r: 3, fill: "#16a34a" }} isAnimationActive />
                </LineChart>
              </ResponsiveContainer>
            )}
          </PanelCard>
          <PanelCard>
            <PanelTitle>Allocation</PanelTitle>
            <PanelHint>Current spread by asset class.</PanelHint>
            {allocationData.length === 0 ? (
              <EmptyBlock>Add assets to populate allocation.</EmptyBlock>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={allocationData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      innerRadius={36}
                      isAnimationActive
                    >
                      {allocationData.map((slice, index) => (
                        <Cell key={`${slice.name}-${index}`} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value, currency)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "grid", gap: 7 }}>
                  {allocationData.map((slice) => (
                    <div key={slice.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: TYPE_SCALE.meta }}>
                      <span style={{ width: 9, height: 9, borderRadius: 99, background: slice.color }} />
                      <span style={{ flex: 1, color: "var(--muted, #64748b)" }}>{slice.name}</span>
                      <strong>{formatCurrency(slice.value, currency)}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </PanelCard>
        </PanelGrid>
      )}

      {activeTab === "holdings" && (
        <PanelCard>
          <PanelTitle>Asset Table</PanelTitle>
          <PanelHint>Search, filter and sort your holdings.</PanelHint>
          <Toolbar $isMobile={isMobile}>
            <Field
              value={assetSearch}
              onChange={(event) => setAssetSearch(event.target.value)}
              placeholder="Search by asset name"
            />
            <Select value={assetFilter} onChange={(event) => setAssetFilter(event.target.value)}>
              <option value="all">All Types</option>
              {ASSET_TYPES.map((type) => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </Select>
            <Select value={assetSort} onChange={(event) => setAssetSort(event.target.value)}>
              <option value="value_desc">Sort: Value High-Low</option>
              <option value="value_asc">Sort: Value Low-High</option>
              <option value="name_asc">Sort: Name A-Z</option>
              <option value="name_desc">Sort: Name Z-A</option>
            </Select>
          </Toolbar>

          {tableAssets.length === 0 ? (
            <EmptyBlock>No holdings match your current filters.</EmptyBlock>
          ) : (
            <>
              <TableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <TableHead style={{ width: "34%" }}>Asset</TableHead>
                      <TableHead style={{ width: "26%" }}>Category</TableHead>
                      <TableHead style={{ width: "20%" }}>Currency</TableHead>
                      <TableHead style={{ width: "20%" }}>Value</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedTableAssets.map((asset) => {
                      const type = ASSET_TYPES.find((item) => item.id === asset.typeId);
                      return (
                        <tr key={asset.id}>
                          <TableCell title={asset.name}>{asset.name}</TableCell>
                          <TableCell title={type?.label || "Other"}>{type?.label || "Other"}</TableCell>
                          <TableCell>{asset.currency || currency}</TableCell>
                          <TableCell title={formatCurrency(asset.value, asset.currency || currency)}>{formatCurrency(asset.value, asset.currency || currency)}</TableCell>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              </TableWrap>
              <DataTablePagination
                totalRows={tableAssets.length}
                currentPage={holdingsPage}
                onPageChange={setHoldingsPage}
              />
            </>
          )}
        </PanelCard>
      )}

      {activeTab === "cashflow" && (
        <PanelGrid $isMobile={isMobile}>
          <PanelCard>
            <PanelTitle>Cashflow Items</PanelTitle>
            <PanelHint>All income and expense records.</PanelHint>
            {combinedCashflow.length === 0 ? (
              <EmptyBlock>Add income and expense entries to view cashflow.</EmptyBlock>
            ) : (
              <>
                <TableWrap>
                  <DataTable>
                    <thead>
                      <tr>
                        <TableHead style={{ width: "35%" }}>Name</TableHead>
                        <TableHead style={{ width: "21%" }}>Type</TableHead>
                        <TableHead style={{ width: "19%" }}>Date</TableHead>
                        <TableHead style={{ width: "25%" }}>Amount</TableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedCashflowRows.map((entry) => (
                        <tr key={entry.id}>
                          <TableCell title={entry.name}>{entry.name}</TableCell>
                          <TableCell>
                            <span style={{ color: entry.color, fontWeight: 700, fontSize: TYPE_SCALE.meta }}>{entry.type}</span>
                          </TableCell>
                          <TableCell>{entry.date || "-"}</TableCell>
                          <TableCell>{formatCurrency(entry.amount, entry.currency)}</TableCell>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                </TableWrap>
                <DataTablePagination
                  totalRows={combinedCashflow.length}
                  currentPage={cashflowPage}
                  onPageChange={setCashflowPage}
                />
              </>
            )}
          </PanelCard>
          <PanelCard>
            <PanelTitle>Cashflow Balance</PanelTitle>
            <PanelHint>Income vs expense split.</PanelHint>
            {(totalIncome + totalExpenses) === 0 ? (
              <EmptyBlock>No data available for split chart.</EmptyBlock>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Income", value: totalIncome, color: "#16a34a" },
                      { name: "Expenses", value: totalExpenses, color: "#ef4444" },
                    ]}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    innerRadius={44}
                    isAnimationActive
                  >
                    <Cell fill="#16a34a" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value, currency)} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div style={{ marginTop: 8, fontSize: TYPE_SCALE.meta, color: "var(--muted, #64748b)", display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Income</span>
                <strong style={{ color: "#16a34a" }}>{formatCurrency(totalIncome, currency)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Expenses</span>
                <strong style={{ color: "#ef4444" }}>{formatCurrency(totalExpenses, currency)}</strong>
              </div>
            </div>
          </PanelCard>
        </PanelGrid>
      )}

      {showSnapshotModal && (
        <ModalBackdrop onClick={() => setShowSnapshotModal(false)}>
          <ModalCard onClick={(event) => event.stopPropagation()}>
            <ModalTitle>Capture Net Worth Snapshot</ModalTitle>
            <ModalText>
              This creates a point-in-time value for trend analysis. The update is applied immediately for a responsive experience.
            </ModalText>
            <ModalActions>
              <SecondaryButton onClick={() => setShowSnapshotModal(false)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={handleSnapshot}>Save Snapshot</PrimaryButton>
            </ModalActions>
          </ModalCard>
        </ModalBackdrop>
      )}

      {showAddModal && (
        <ModalBackdrop onClick={() => setShowAddModal(false)}>
          <ModalCard onClick={(event) => event.stopPropagation()}>
            <ModalTitle>Choose Asset Type</ModalTitle>
            <ModalText>
              Select a primary category, then continue to the full add-asset page.
            </ModalText>
            <Select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
              {ASSET_TYPES.map((type) => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </Select>
            <ModalActions>
              <SecondaryButton onClick={() => setShowAddModal(false)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={openAssetFromModal}>Continue</PrimaryButton>
            </ModalActions>
          </ModalCard>
        </ModalBackdrop>
      )}
    </DashboardWrap>
  );
}
function SummaryCard({ icon, label, value, sub, color, negative }) {
  return (
    <div style={{ ...cardStyle, display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: TYPE_SCALE.micro, fontWeight: 600, color: "#94a3b8", letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
        <div style={{ fontFamily: serifFontFamily, fontSize: TYPE_SCALE.h1, fontWeight: 700, color: negative ? "var(--error)" : "var(--text-color)" }}>{value}</div>
        <div style={{ fontSize: TYPE_SCALE.meta, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function AssetsPage({ assets, currency, onAdd, onDelete, openAssetComposerRequest, onConsumeAssetComposerRequest }) {
  const isMobile = useIsMobile();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedType, setSelectedType] = useState("stocks");
  const [pickingType, setPickingType] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("value_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);

  const assetRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let rows = assets.filter((asset) => {
      if (typeFilter !== "all" && asset.typeId !== typeFilter) return false;
      if (!query) return true;
      return (
        String(asset.name || "").toLowerCase().includes(query) ||
        String(asset.notes || "").toLowerCase().includes(query)
      );
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === "value_asc") return a.value - b.value;
      if (sortBy === "value_desc") return b.value - a.value;
      if (sortBy === "name_desc") return String(b.name || "").localeCompare(String(a.name || ""));
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    return rows;
  }, [assets, searchQuery, typeFilter, sortBy]);

  const pagedAssetRows = useMemo(
    () => getPaginatedRows(assetRows, currentPage),
    [assetRows, currentPage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter, sortBy]);

  useEffect(() => {
    const totalPages = getTotalPages(assetRows.length);
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [assetRows.length, currentPage]);

  useEffect(() => {
    setSelectedAssetIds((prev) => prev.filter((id) => assetRows.some((asset) => asset.id === id)));
  }, [assetRows]);

  const assetPageIds = pagedAssetRows.map((asset) => asset.id);
  const allAssetsOnPageSelected = assetPageIds.length > 0 && assetPageIds.every((id) => selectedAssetIds.includes(id));

  const toggleAssetSelection = (assetId) => {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]
    );
  };

  const toggleSelectAllAssetsOnPage = () => {
    setSelectedAssetIds((prev) => {
      if (allAssetsOnPageSelected) {
        return prev.filter((id) => !assetPageIds.includes(id));
      }

      const next = [...prev];
      assetPageIds.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
        }
      });
      return next;
    });
  };

  const deleteSelectedAssets = () => {
    selectedAssetIds.forEach((assetId) => onDelete(assetId));
    setSelectedAssetIds([]);
  };

  const closeAddModal = () => {
    setShowAdd(false);
    setPickingType(true);
  };

  useEffect(() => {
    if (!openAssetComposerRequest) return;

    const requestedType = ASSET_TYPES.some((type) => type.id === openAssetComposerRequest.typeId)
      ? openAssetComposerRequest.typeId
      : "stocks";

    setSelectedType(requestedType);
    setPickingType(false);
    setShowAdd(true);
    onConsumeAssetComposerRequest?.();
  }, [openAssetComposerRequest, onConsumeAssetComposerRequest]);

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)" }}>Assets</h2>
          <p style={{ color: "var(--muted, #64748b)", fontSize: 14 }}>Total: {formatCurrency(totalAssets, currency)}</p>
        </div>
        <PageHeaderActions $isMobile={isMobile}>
          <button
            onClick={() => {
              setShowAdd(true);
              setPickingType(true);
            }}
            style={{ ...btnStyle, width: isMobile ? "100%" : "auto" }}
          >
            + Add Asset
          </button>
        </PageHeaderActions>
      </PageHeader>

      {showAdd && (
        <ModalBackdrop onClick={closeAddModal}>
          <ModalCard $maxWidth={pickingType ? 720 : 520} onClick={(event) => event.stopPropagation()}>
            {pickingType ? (
              <>
                <ModalTitle>Select Asset Type</ModalTitle>
                <ModalText>Choose the asset category first, then enter details in the same modal.</ModalText>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: 8, marginBottom: 10 }}>
                  {ASSET_TYPES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedType(t.id);
                        setPickingType(false);
                      }}
                      style={{
                        background: "var(--bg-light, #f8fafc)",
                        border: "1.5px solid var(--border, #e2e8f0)",
                        borderRadius: 10,
                        padding: "10px 8px",
                        cursor: "pointer",
                        textAlign: "center",
                        fontSize: 12,
                        color: "var(--text-color, #334155)",
                      }}
                    >
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{t.icon}</div>
                      {t.label}
                    </button>
                  ))}
                </div>
                <ModalActions>
                  <SecondaryButton onClick={closeAddModal}>Cancel</SecondaryButton>
                </ModalActions>
              </>
            ) : (
              <AddAssetForm
                typeId={selectedType}
                onSave={(asset) => {
                  onAdd(asset);
                  closeAddModal();
                }}
                onCancel={() => setPickingType(true)}
              />
            )}
          </ModalCard>
        </ModalBackdrop>
      )}

      {assets.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u{1F3DB}\uFE0F"}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--muted, #64748b)" }}>No assets yet</div>
          <div>Add your first asset to start tracking your wealth</div>
        </div>
      ) : (
        <>
          <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(220px, 1fr) minmax(140px, 180px) minmax(160px, 190px)", gap: 8 }}>
              <Field
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search assets or notes"
              />
              <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">All types</option>
                {ASSET_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </Select>
              <Select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="value_desc">Sort: Value High-Low</option>
                <option value="value_asc">Sort: Value Low-High</option>
                <option value="name_asc">Sort: Name A-Z</option>
                <option value="name_desc">Sort: Name Z-A</option>
              </Select>
            </div>
            <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", marginTop: 8 }}>
              <button
                onClick={deleteSelectedAssets}
                disabled={selectedAssetIds.length === 0}
                style={{
                  ...btnStyle,
                  background: "#ef4444",
                  padding: "8px 12px",
                  fontSize: 12,
                  opacity: selectedAssetIds.length === 0 ? 0.55 : 1,
                  cursor: selectedAssetIds.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                Delete Selected ({selectedAssetIds.length})
              </button>
            </div>
          </div>

          {assetRows.length === 0 ? (
            <EmptyBlock>No assets match your filters.</EmptyBlock>
          ) : (
            <>
              <TableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <TableHead style={{ width: "8%" }}>
                        <input
                          type="checkbox"
                          checked={allAssetsOnPageSelected}
                          onChange={toggleSelectAllAssetsOnPage}
                          aria-label="Select all assets on this page"
                        />
                      </TableHead>
                      <TableHead style={{ width: "24%" }}>Asset</TableHead>
                      <TableHead style={{ width: "20%" }}>Type</TableHead>
                      <TableHead style={{ width: "32%" }}>Notes</TableHead>
                      <TableHead style={{ width: "16%" }}>Value</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedAssetRows.map((asset) => {
                      const type = ASSET_TYPES.find((item) => item.id === asset.typeId);
                      return (
                        <tr key={asset.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedAssetIds.includes(asset.id)}
                              onChange={() => toggleAssetSelection(asset.id)}
                              aria-label={`Select ${asset.name}`}
                            />
                          </TableCell>
                          <TableCell title={asset.name}>{asset.name}</TableCell>
                          <TableCell title={type?.label || "Other"}>{type?.icon || ""} {type?.label || "Other"}</TableCell>
                          <TableCell title={asset.notes || "-"}>{asset.notes || "-"}</TableCell>
                          <TableCell title={formatCurrency(asset.value, asset.currency || currency)}>
                            {formatCurrency(asset.value, asset.currency || currency)}
                          </TableCell>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              </TableWrap>
              <DataTablePagination
                totalRows={assetRows.length}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </>
      )}
    </PageSection>
  );
}

function LiabilitiesPage({ liabilities, currency, onAdd, onDelete }) {
  const isMobile = useIsMobile();
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("value_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLiabilityIds, setSelectedLiabilityIds] = useState([]);
  const total = liabilities.reduce((s, l) => s + l.value, 0);

  const liabilityRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let rows = liabilities.filter((liability) => {
      if (!query) return true;
      return (
        String(liability.name || "").toLowerCase().includes(query) ||
        String(liability.label || "").toLowerCase().includes(query)
      );
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === "value_asc") return a.value - b.value;
      if (sortBy === "value_desc") return b.value - a.value;
      if (sortBy === "name_desc") return String(b.name || "").localeCompare(String(a.name || ""));
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    return rows;
  }, [liabilities, searchQuery, sortBy]);

  const pagedLiabilityRows = useMemo(
    () => getPaginatedRows(liabilityRows, currentPage),
    [liabilityRows, currentPage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  useEffect(() => {
    const totalPages = getTotalPages(liabilityRows.length);
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [liabilityRows.length, currentPage]);

  useEffect(() => {
    setSelectedLiabilityIds((prev) => prev.filter((id) => liabilityRows.some((item) => item.id === id)));
  }, [liabilityRows]);

  const liabilityPageIds = pagedLiabilityRows.map((item) => item.id);
  const allLiabilitiesOnPageSelected = liabilityPageIds.length > 0 && liabilityPageIds.every((id) => selectedLiabilityIds.includes(id));

  const toggleLiabilitySelection = (liabilityId) => {
    setSelectedLiabilityIds((prev) =>
      prev.includes(liabilityId) ? prev.filter((id) => id !== liabilityId) : [...prev, liabilityId]
    );
  };

  const toggleSelectAllLiabilitiesOnPage = () => {
    setSelectedLiabilityIds((prev) => {
      if (allLiabilitiesOnPageSelected) {
        return prev.filter((id) => !liabilityPageIds.includes(id));
      }
      const next = [...prev];
      liabilityPageIds.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
        }
      });
      return next;
    });
  };

  const deleteSelectedLiabilities = () => {
    selectedLiabilityIds.forEach((liabilityId) => onDelete(liabilityId));
    setSelectedLiabilityIds([]);
  };

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)" }}>Liabilities</h2>
          <p style={{ color: "var(--muted, #64748b)", fontSize: 14 }}>Total: <span style={{ color: "#ef4444" }}>{formatCurrency(total, currency)}</span></p>
        </div>
        <PageHeaderActions $isMobile={isMobile}>
          <button onClick={() => setShowAdd(true)} style={{ ...btnStyle, background: "#ef4444", width: isMobile ? "100%" : "auto" }}>+ Add Liability</button>
        </PageHeaderActions>
      </PageHeader>

      {showAdd && (
        <ModalBackdrop onClick={() => setShowAdd(false)}>
          <ModalCard $maxWidth={520} onClick={(event) => event.stopPropagation()}>
            <AddLiabilityForm
              onSave={(liability) => {
                onAdd(liability);
                setShowAdd(false);
              }}
              onCancel={() => setShowAdd(false)}
            />
          </ModalCard>
        </ModalBackdrop>
      )}

      {liabilities.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u2705"}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--muted, #64748b)" }}>No liabilities!</div>
          <div>You're debt free or haven't added any loans yet</div>
        </div>
      ) : (
        <>
          <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(220px, 1fr) minmax(160px, 190px)", gap: 8 }}>
              <Field
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search liabilities"
              />
              <Select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="value_desc">Sort: Amount High-Low</option>
                <option value="value_asc">Sort: Amount Low-High</option>
                <option value="name_asc">Sort: Name A-Z</option>
                <option value="name_desc">Sort: Name Z-A</option>
              </Select>
            </div>
            <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", marginTop: 8 }}>
              <button
                onClick={deleteSelectedLiabilities}
                disabled={selectedLiabilityIds.length === 0}
                style={{
                  ...btnStyle,
                  background: "#ef4444",
                  padding: "8px 12px",
                  fontSize: 12,
                  opacity: selectedLiabilityIds.length === 0 ? 0.55 : 1,
                  cursor: selectedLiabilityIds.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                Delete Selected ({selectedLiabilityIds.length})
              </button>
            </div>
          </div>

          {liabilityRows.length === 0 ? (
            <EmptyBlock>No liabilities match your filters.</EmptyBlock>
          ) : (
            <>
              <TableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <TableHead style={{ width: "8%" }}>
                        <input
                          type="checkbox"
                          checked={allLiabilitiesOnPageSelected}
                          onChange={toggleSelectAllLiabilitiesOnPage}
                          aria-label="Select all liabilities on this page"
                        />
                      </TableHead>
                      <TableHead style={{ width: "28%" }}>Liability</TableHead>
                      <TableHead style={{ width: "28%" }}>Type</TableHead>
                      <TableHead style={{ width: "16%" }}>Interest</TableHead>
                      <TableHead style={{ width: "20%" }}>Amount</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedLiabilityRows.map((liability) => (
                      <tr key={liability.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedLiabilityIds.includes(liability.id)}
                            onChange={() => toggleLiabilitySelection(liability.id)}
                            aria-label={`Select ${liability.name}`}
                          />
                        </TableCell>
                        <TableCell title={liability.name}>{liability.name}</TableCell>
                        <TableCell title={liability.label || "-"}>{liability.icon || ""} {liability.label || "-"}</TableCell>
                        <TableCell>{liability.interest > 0 ? `${liability.interest}% p.a.` : "-"}</TableCell>
                        <TableCell title={formatCurrency(liability.value, liability.currency || currency)}>
                          {formatCurrency(liability.value, liability.currency || currency)}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
              <DataTablePagination
                totalRows={liabilityRows.length}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </>
      )}
    </PageSection>
  );
}

function IncomePage({ incomes, currency, onAdd, onDelete, onImportIncome, onImportExpense }) {
  const isMobile = useIsMobile();
  const total = incomes.reduce((s, i) => s + i.amount, 0);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("amount_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIncomeIds, setSelectedIncomeIds] = useState([]);
  const importInputRef = useRef(null);

  const incomeRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let rows = incomes.filter((income) => {
      if (!query) return true;
      return String(income.name || "").toLowerCase().includes(query);
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === "amount_asc") return a.amount - b.amount;
      if (sortBy === "amount_desc") return b.amount - a.amount;
      if (sortBy === "name_desc") return String(b.name || "").localeCompare(String(a.name || ""));
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    return rows;
  }, [incomes, searchQuery, sortBy]);

  const pagedIncomeRows = useMemo(
    () => getPaginatedRows(incomeRows, currentPage),
    [incomeRows, currentPage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  useEffect(() => {
    const totalPages = getTotalPages(incomeRows.length);
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [incomeRows.length, currentPage]);

  useEffect(() => {
    setSelectedIncomeIds((prev) => prev.filter((id) => incomeRows.some((item) => item.id === id)));
  }, [incomeRows]);

  const incomePageIds = pagedIncomeRows.map((item) => item.id);
  const allIncomeOnPageSelected = incomePageIds.length > 0 && incomePageIds.every((id) => selectedIncomeIds.includes(id));

  const toggleIncomeSelection = (incomeId) => {
    setSelectedIncomeIds((prev) =>
      prev.includes(incomeId) ? prev.filter((id) => id !== incomeId) : [...prev, incomeId]
    );
  };

  const toggleSelectAllIncomeOnPage = () => {
    setSelectedIncomeIds((prev) => {
      if (allIncomeOnPageSelected) {
        return prev.filter((id) => !incomePageIds.includes(id));
      }
      const next = [...prev];
      incomePageIds.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
        }
      });
      return next;
    });
  };

  const deleteSelectedIncomes = () => {
    selectedIncomeIds.forEach((incomeId) => onDelete(incomeId));
    setSelectedIncomeIds([]);
  };

  const closeAddModal = () => {
    setShowAdd(false);
    setName("");
    setAmount("");
  };

  const save = () => {
    const n = sanitizeInput(name, 'text');
    const a = sanitizeInput(amount, 'number');
    if (!n || a <= 0) {
      notifyApp("Enter valid income name and positive amount.", "error");
      return;
    }
    onAdd({ id: Date.now(), name: n, amount: a, currency });
    closeAddModal();
  };

  const handleCsvImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsedEntries = await parseHdfcStatementFile(file);
      const { incomeEntries, expenseEntries } = buildImportedHdfcEntries(parsedEntries, currency);

      if (incomeEntries.length === 0 && expenseEntries.length === 0) {
        notifyApp("No valid debit or credit transactions found in this HDFC statement file.", "warning");
        return;
      }

      if (incomeEntries.length > 0) {
        onImportIncome(incomeEntries);
      }
      if (expenseEntries.length > 0) {
        onImportExpense(expenseEntries);
      }

      notifyApp(
        `Imported ${incomeEntries.length} income entr${incomeEntries.length === 1 ? "y" : "ies"} and ${expenseEntries.length} expense entr${expenseEntries.length === 1 ? "y" : "ies"} from HDFC statement.`,
        "success"
      );
    } catch (error) {
      notifyApp("Unable to import this file. Please upload a valid HDFC statement (.csv/.xls/.xlsx).", "error");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)" }}>Income</h2>
          <p style={{ color: "var(--muted, #64748b)", fontSize: 14 }}>Total: {formatCurrency(total, currency)}</p>
        </div>
        <PageHeaderActions $isMobile={isMobile}>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleCsvImport}
            style={{ display: "none" }}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            style={{ ...buttonStyles.secondary, padding: "10px 14px", fontSize: 13, width: isMobile ? "100%" : "auto" }}
          >
            Import HDFC Statement
          </button>
          <button onClick={() => setShowAdd(true)} style={{ ...btnStyle, width: isMobile ? "100%" : "auto" }}>+ Add Income</button>
        </PageHeaderActions>
      </PageHeader>

      {showAdd && (
        <ModalBackdrop onClick={closeAddModal}>
          <ModalCard $maxWidth={520} onClick={(event) => event.stopPropagation()}>
            <ModalTitle>Add Income</ModalTitle>
            <ModalText>Record recurring or one-time income entries.</ModalText>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle}>Source</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Salary, Freelance" />
              </div>
              <div>
                <label style={labelStyle}>Amount</label>
                <input style={inputStyle} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                <button onClick={closeAddModal} style={{ ...btnStyle, background: 'var(--muted-bg, #f1f5f9)', color: 'var(--muted, #64748b)' }}>Cancel</button>
                <button onClick={save} style={btnStyle}>Save</button>
              </div>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      {incomes.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u{1F4BC}"}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--muted, #64748b)' }}>No income recorded</div>
          <div>Add recurring or one-time income to track cashflow</div>
        </div>
      ) : (
        <>
          <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(220px, 1fr) minmax(160px, 190px)", gap: 8 }}>
              <Field
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search income records"
              />
              <Select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="amount_desc">Sort: Amount High-Low</option>
                <option value="amount_asc">Sort: Amount Low-High</option>
                <option value="name_asc">Sort: Name A-Z</option>
                <option value="name_desc">Sort: Name Z-A</option>
              </Select>
            </div>
            <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", marginTop: 8 }}>
              <button
                onClick={deleteSelectedIncomes}
                disabled={selectedIncomeIds.length === 0}
                style={{
                  ...btnStyle,
                  background: "#ef4444",
                  padding: "8px 12px",
                  fontSize: 12,
                  opacity: selectedIncomeIds.length === 0 ? 0.55 : 1,
                  cursor: selectedIncomeIds.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                Delete Selected ({selectedIncomeIds.length})
              </button>
            </div>
          </div>

          {incomeRows.length === 0 ? (
            <EmptyBlock>No income records match your filters.</EmptyBlock>
          ) : (
            <>
              <TableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <TableHead style={{ width: "8%" }}>
                        <input
                          type="checkbox"
                          checked={allIncomeOnPageSelected}
                          onChange={toggleSelectAllIncomeOnPage}
                          aria-label="Select all income rows on this page"
                        />
                      </TableHead>
                      <TableHead style={{ width: "56%" }}>Source</TableHead>
                      <TableHead style={{ width: "36%" }}>Amount</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedIncomeRows.map((income) => (
                      <tr key={income.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedIncomeIds.includes(income.id)}
                            onChange={() => toggleIncomeSelection(income.id)}
                            aria-label={`Select ${income.name}`}
                          />
                        </TableCell>
                        <TableCell title={income.name}>{income.name}</TableCell>
                        <TableCell title={formatCurrency(income.amount, income.currency || currency)}>
                          {formatCurrency(income.amount, income.currency || currency)}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
              <DataTablePagination
                totalRows={incomeRows.length}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </>
      )}
    </PageSection>
  );
}

function ExpensesPage({ expenses, currency, onAdd, onDelete, onImportIncome, onImportExpense }) {
  const isMobile = useIsMobile();
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("amount_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState([]);
  const importInputRef = useRef(null);

  const expenseRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let rows = expenses.filter((expense) => {
      if (!query) return true;
      return String(expense.name || "").toLowerCase().includes(query);
    });

    rows = [...rows].sort((a, b) => {
      if (sortBy === "amount_asc") return a.amount - b.amount;
      if (sortBy === "amount_desc") return b.amount - a.amount;
      if (sortBy === "name_desc") return String(b.name || "").localeCompare(String(a.name || ""));
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    return rows;
  }, [expenses, searchQuery, sortBy]);

  const pagedExpenseRows = useMemo(
    () => getPaginatedRows(expenseRows, currentPage),
    [expenseRows, currentPage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  useEffect(() => {
    const totalPages = getTotalPages(expenseRows.length);
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [expenseRows.length, currentPage]);

  useEffect(() => {
    setSelectedExpenseIds((prev) => prev.filter((id) => expenseRows.some((item) => item.id === id)));
  }, [expenseRows]);

  const expensePageIds = pagedExpenseRows.map((item) => item.id);
  const allExpensesOnPageSelected = expensePageIds.length > 0 && expensePageIds.every((id) => selectedExpenseIds.includes(id));

  const toggleExpenseSelection = (expenseId) => {
    setSelectedExpenseIds((prev) =>
      prev.includes(expenseId) ? prev.filter((id) => id !== expenseId) : [...prev, expenseId]
    );
  };

  const toggleSelectAllExpensesOnPage = () => {
    setSelectedExpenseIds((prev) => {
      if (allExpensesOnPageSelected) {
        return prev.filter((id) => !expensePageIds.includes(id));
      }
      const next = [...prev];
      expensePageIds.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
        }
      });
      return next;
    });
  };

  const deleteSelectedExpenses = () => {
    selectedExpenseIds.forEach((expenseId) => onDelete(expenseId));
    setSelectedExpenseIds([]);
  };

  const closeAddModal = () => {
    setShowAdd(false);
    setName("");
    setAmount("");
  };

  const save = () => {
    const n = sanitizeInput(name, 'text');
    const a = sanitizeInput(amount, 'number');
    if (!n || a <= 0) {
      notifyApp("Enter valid expense name and positive amount.", "error");
      return;
    }
    onAdd({ id: Date.now(), name: n, amount: a, currency });
    closeAddModal();
  };

  const handleCsvImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsedEntries = await parseHdfcStatementFile(file);
      const { incomeEntries, expenseEntries } = buildImportedHdfcEntries(parsedEntries, currency);

      if (incomeEntries.length === 0 && expenseEntries.length === 0) {
        notifyApp("No valid debit or credit transactions found in this HDFC statement file.", "warning");
        return;
      }

      if (incomeEntries.length > 0) {
        onImportIncome(incomeEntries);
      }
      if (expenseEntries.length > 0) {
        onImportExpense(expenseEntries);
      }

      notifyApp(
        `Imported ${incomeEntries.length} income entr${incomeEntries.length === 1 ? "y" : "ies"} and ${expenseEntries.length} expense entr${expenseEntries.length === 1 ? "y" : "ies"} from HDFC statement.`,
        "success"
      );
    } catch (error) {
      notifyApp("Unable to import this file. Please upload a valid HDFC statement (.csv/.xls/.xlsx).", "error");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)" }}>Expenses</h2>
          <p style={{ color: "var(--muted, #64748b)", fontSize: 14 }}>Total: {formatCurrency(total, currency)}</p>
        </div>
        <PageHeaderActions $isMobile={isMobile}>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleCsvImport}
            style={{ display: "none" }}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            style={{ ...buttonStyles.secondary, padding: "10px 14px", fontSize: 13, width: isMobile ? "100%" : "auto" }}
          >
            Import HDFC Statement
          </button>
          <button onClick={() => setShowAdd(true)} style={{ ...btnStyle, background: '#ef4444', width: isMobile ? "100%" : "auto" }}>+ Add Expense</button>
        </PageHeaderActions>
      </PageHeader>

      {showAdd && (
        <ModalBackdrop onClick={closeAddModal}>
          <ModalCard $maxWidth={520} onClick={(event) => event.stopPropagation()}>
            <ModalTitle>Add Expense</ModalTitle>
            <ModalText>Track outgoing costs to monitor your monthly cashflow.</ModalText>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle}>Expense</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Groceries, Rent" />
              </div>
              <div>
                <label style={labelStyle}>Amount</label>
                <input style={inputStyle} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
                <button onClick={closeAddModal} style={{ ...btnStyle, background: 'var(--muted-bg, #f1f5f9)', color: 'var(--muted, #64748b)' }}>Cancel</button>
                <button onClick={save} style={{ ...btnStyle, background: "#ef4444" }}>Save</button>
              </div>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      {expenses.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u{1F6D2}"}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--muted, #64748b)' }}>No expenses recorded</div>
          <div>Add your expenses to track cashflow</div>
        </div>
      ) : (
        <>
          <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(220px, 1fr) minmax(160px, 190px)", gap: 8 }}>
              <Field
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search expense records"
              />
              <Select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="amount_desc">Sort: Amount High-Low</option>
                <option value="amount_asc">Sort: Amount Low-High</option>
                <option value="name_asc">Sort: Name A-Z</option>
                <option value="name_desc">Sort: Name Z-A</option>
              </Select>
            </div>
            <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", marginTop: 8 }}>
              <button
                onClick={deleteSelectedExpenses}
                disabled={selectedExpenseIds.length === 0}
                style={{
                  ...btnStyle,
                  background: "#ef4444",
                  padding: "8px 12px",
                  fontSize: 12,
                  opacity: selectedExpenseIds.length === 0 ? 0.55 : 1,
                  cursor: selectedExpenseIds.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                Delete Selected ({selectedExpenseIds.length})
              </button>
            </div>
          </div>

          {expenseRows.length === 0 ? (
            <EmptyBlock>No expense records match your filters.</EmptyBlock>
          ) : (
            <>
              <TableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <TableHead style={{ width: "8%" }}>
                        <input
                          type="checkbox"
                          checked={allExpensesOnPageSelected}
                          onChange={toggleSelectAllExpensesOnPage}
                          aria-label="Select all expense rows on this page"
                        />
                      </TableHead>
                      <TableHead style={{ width: "56%" }}>Expense</TableHead>
                      <TableHead style={{ width: "36%" }}>Amount</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedExpenseRows.map((expense) => (
                      <tr key={expense.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedExpenseIds.includes(expense.id)}
                            onChange={() => toggleExpenseSelection(expense.id)}
                            aria-label={`Select ${expense.name}`}
                          />
                        </TableCell>
                        <TableCell title={expense.name}>{expense.name}</TableCell>
                        <TableCell title={formatCurrency(expense.amount, expense.currency || currency)}>
                          {formatCurrency(expense.amount, expense.currency || currency)}
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
              <DataTablePagination
                totalRows={expenseRows.length}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </>
      )}
    </PageSection>
  );
}

// -- ALLOCATION PAGE ---------------------------------------------------------

function AllocationPage({ assets, currency }) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const grouped = ASSET_TYPES.map((type) => ({
    ...type,
    value: assets.filter((a) => a.typeId === type.id).reduce((s, a) => s + a.value, 0),
  })).filter((g) => g.value > 0);
  const currenciesTracked = new Set(assets.map((a) => a.currency)).size;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 980 }}>
      <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>Allocation</h2>
      <p style={{ color: "var(--muted, #64748b)", marginBottom: 24 }}>Understand diversification across asset classes and currencies.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        <SummaryCard icon={"\u{1F3DB}"} label="TOTAL ASSETS" value={formatCurrency(totalAssets, currency)} sub={`${assets.length} assets`} color="#22c55e" />
        <SummaryCard icon={"\u{1F9E9}"} label="ASSET CLASSES" value={`${grouped.length}`} sub="Diversified buckets" color="#3b82f6" />
        <SummaryCard icon={"\u{1F30D}"} label="CURRENCIES" value={`${currenciesTracked || 1}`} sub="Tracked across holdings" color="#8b5cf6" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 12 }}>Allocation Mix</div>
          {grouped.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--muted, #64748b)", padding: "36px 0" }}>Add assets to view allocation.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={grouped} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={82} innerRadius={45}>
                    {grouped.map((item, i) => (
                      <Cell key={i} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v, currency)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gap: 8 }}>
                {grouped.map((item) => {
                  const pct = totalAssets > 0 ? (item.value / totalAssets) * 100 : 0;
                  return (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color }} />
                      <span style={{ flex: 1, fontSize: 13, color: "var(--muted, #64748b)" }}>{item.label}</span>
                      <span style={{ fontSize: 12, color: "var(--text-color, #1e293b)", fontWeight: 700 }}>{pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 12 }}>By Value</div>
          {grouped.length === 0 ? (
            <div style={{ color: "var(--muted, #64748b)", fontSize: 13 }}>No allocation data available.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {grouped
                .sort((a, b) => b.value - a.value)
                .map((item) => (
                  <div key={item.id} style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "var(--text-color, #1e293b)", fontWeight: 600 }}>{item.icon} {item.label}</span>
                      <span style={{ fontSize: 13, color: "var(--text-color, #1e293b)", fontWeight: 700 }}>{formatCurrency(item.value, currency)}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: "var(--muted-bg, #f1f5f9)" }}>
                      <div style={{ height: "100%", borderRadius: 99, background: item.color, width: `${totalAssets > 0 ? (item.value / totalAssets) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NetWorthPage({ assets, liabilities, currency, snapshots, onSnapshot, isMobile }) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth = totalAssets - totalLiabilities;
  const c = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];
  const [currentPage, setCurrentPage] = useState(1);

  const snapshotRows = useMemo(() => [...snapshots].reverse(), [snapshots]);
  const pagedSnapshotRows = useMemo(
    () => getPaginatedRows(snapshotRows, currentPage),
    [snapshotRows, currentPage]
  );

  useEffect(() => {
    const totalPages = getTotalPages(snapshotRows.length);
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [snapshotRows.length, currentPage]);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>Net Worth</h2>
      <p style={{ color: "var(--muted, #64748b)", marginBottom: 24 }}>Track your wealth journey over time</p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <SummaryCard icon={"\u{1F3DB}"} label="TOTAL ASSETS" value={formatCurrency(totalAssets, currency)} sub={`${assets.length} assets`} color="#22c55e" />
        <SummaryCard icon={"\u{1F4B3}"} label="TOTAL LIABILITIES" value={formatCurrency(totalLiabilities, currency)} sub={`${liabilities.length} debts`} color="#ef4444" negative />
        <SummaryCard icon={"\u2728"} label="NET WORTH" value={formatCurrency(netWorth, currency)} sub="Assets minus Liabilities" color="#3b82f6" />
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", fontSize: 16 }}>Wealth Timeline</div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>{snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} recorded</div>
          </div>
          <button onClick={onSnapshot} style={btnStyle}>{"\u{1F4F8}"} Take Snapshot</button>
        </div>
        {snapshots.length < 2 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u{1F4CA}"}</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Take snapshots to track your progress</div>
            <div style={{ fontSize: 13 }}>Each snapshot records your net worth at that moment</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={snapshots}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} />
              <Tooltip formatter={(v) => [formatCurrency(v, currency), "Net Worth"]} />
              <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} dot={{ fill: "var(--primary)", r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {snapshots.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 16 }}>Snapshot History</div>
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <TableHead style={{ width: "45%" }}>Date</TableHead>
                  <TableHead style={{ width: "55%" }}>Net Worth</TableHead>
                </tr>
              </thead>
              <tbody>
                {pagedSnapshotRows.map((snapshot, index) => (
                  <tr key={index}>
                    <TableCell>{snapshot.date}</TableCell>
                    <TableCell style={{ color: snapshot.value >= 0 ? "#16a34a" : "#ef4444", fontWeight: 700 }}>
                      {c.symbol}{snapshot.value.toLocaleString()}
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
          <DataTablePagination
            totalRows={snapshotRows.length}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}

function GoalsPage({ assets, currency }) {
  const isMobile = useIsMobile();
  const [goals, setGoals] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [icon, setIcon] = useState("\u{1F3AF}");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("progress_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGoalIds, setSelectedGoalIds] = useState([]);
  const netWorth = assets.reduce((s, a) => s + a.value, 0);

  const closeAddModal = () => {
    setShowAdd(false);
    setName("");
    setTarget("");
  };

  const addGoal = () => {
    // Security: Validate and sanitize inputs
    const sanitizedName = sanitizeInput(name, 'text');
    const sanitizedTarget = sanitizeInput(target, 'number');
    
    if (!sanitizedName || sanitizedTarget <= 0) {
      notifyApp("Please enter valid goal name and positive target amount.", "error");
      return;
    }
    
    setGoals([...goals, { id: Date.now(), name: sanitizedName, target: sanitizedTarget, icon, current: netWorth }]);
    closeAddModal();
  };

  const goalIcons = GOAL_ICONS; // use shared constant

  const goalRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let rows = goals.filter((goal) => {
      if (!query) return true;
      return String(goal.name || "").toLowerCase().includes(query);
    });

    rows = [...rows].sort((a, b) => {
      const progressA = a.target > 0 ? (a.current / a.target) * 100 : 0;
      const progressB = b.target > 0 ? (b.current / b.target) * 100 : 0;
      if (sortBy === "progress_asc") return progressA - progressB;
      if (sortBy === "progress_desc") return progressB - progressA;
      if (sortBy === "target_asc") return a.target - b.target;
      if (sortBy === "target_desc") return b.target - a.target;
      if (sortBy === "name_desc") return String(b.name || "").localeCompare(String(a.name || ""));
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    return rows;
  }, [goals, searchQuery, sortBy]);

  const pagedGoalRows = useMemo(
    () => getPaginatedRows(goalRows, currentPage),
    [goalRows, currentPage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  useEffect(() => {
    const totalPages = getTotalPages(goalRows.length);
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [goalRows.length, currentPage]);

  useEffect(() => {
    setSelectedGoalIds((prev) => prev.filter((id) => goalRows.some((goal) => goal.id === id)));
  }, [goalRows]);

  const goalPageIds = pagedGoalRows.map((goal) => goal.id);
  const allGoalsOnPageSelected = goalPageIds.length > 0 && goalPageIds.every((id) => selectedGoalIds.includes(id));

  const toggleGoalSelection = (goalId) => {
    setSelectedGoalIds((prev) =>
      prev.includes(goalId) ? prev.filter((id) => id !== goalId) : [...prev, goalId]
    );
  };

  const toggleSelectAllGoalsOnPage = () => {
    setSelectedGoalIds((prev) => {
      if (allGoalsOnPageSelected) {
        return prev.filter((id) => !goalPageIds.includes(id));
      }
      const next = [...prev];
      goalPageIds.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
        }
      });
      return next;
    });
  };

  const deleteSelectedGoals = () => {
    setGoals((prev) => prev.filter((goal) => !selectedGoalIds.includes(goal.id)));
    setSelectedGoalIds([]);
  };

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)" }}>Financial Goals</h2>
          <p style={{ color: "var(--muted, #64748b)", fontSize: 14 }}>Set targets and track your progress</p>
        </div>
        <PageHeaderActions $isMobile={isMobile}>
          <button onClick={() => setShowAdd(true)} style={{ ...btnStyle, width: isMobile ? "100%" : "auto" }}>+ New Goal</button>
        </PageHeaderActions>
      </PageHeader>

      {showAdd && (
        <ModalBackdrop onClick={closeAddModal}>
          <ModalCard $maxWidth={560} onClick={(event) => event.stopPropagation()}>
            <ModalTitle>Create Goal</ModalTitle>
            <ModalText>Set a target and track progress against your current net worth.</ModalText>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {goalIcons.map((goalIcon) => (
                <button
                  key={goalIcon}
                  onClick={() => setIcon(goalIcon)}
                  style={{ fontSize: 24, background: icon === goalIcon ? "#f0fdf4" : "none", border: icon === goalIcon ? "2px solid #16a34a" : "2px solid transparent", borderRadius: 8, padding: 6, cursor: "pointer" }}
                >
                  {goalIcon}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={labelStyle}>Goal Name</label>
                <input style={inputStyle} placeholder="e.g. Buy a House, Emergency Fund" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Target Amount ({currency})</label>
                <input style={inputStyle} type="number" placeholder="e.g. 5000000" value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 16 }}>
              <button onClick={closeAddModal} style={{ ...btnStyle, background: "var(--muted-bg, #f1f5f9)", color: "var(--muted, #64748b)" }}>Cancel</button>
              <button onClick={addGoal} style={btnStyle}>Create Goal</button>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      {goals.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u{1F3AF}"}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--muted, #64748b)" }}>No goals yet</div>
          <div>Set financial goals to track your progress</div>
        </div>
      ) : (
        <>
          <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(220px, 1fr) minmax(170px, 210px)", gap: 8 }}>
              <Field
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search goals"
              />
              <Select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="progress_desc">Sort: Progress High-Low</option>
                <option value="progress_asc">Sort: Progress Low-High</option>
                <option value="target_desc">Sort: Target High-Low</option>
                <option value="target_asc">Sort: Target Low-High</option>
                <option value="name_asc">Sort: Name A-Z</option>
                <option value="name_desc">Sort: Name Z-A</option>
              </Select>
            </div>
            <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", marginTop: 8 }}>
              <button
                onClick={deleteSelectedGoals}
                disabled={selectedGoalIds.length === 0}
                style={{
                  ...btnStyle,
                  background: "#ef4444",
                  padding: "8px 12px",
                  fontSize: 12,
                  opacity: selectedGoalIds.length === 0 ? 0.55 : 1,
                  cursor: selectedGoalIds.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                Delete Selected ({selectedGoalIds.length})
              </button>
            </div>
          </div>

          {goalRows.length === 0 ? (
            <EmptyBlock>No goals match your filters.</EmptyBlock>
          ) : (
            <>
              <TableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <TableHead style={{ width: "8%" }}>
                        <input
                          type="checkbox"
                          checked={allGoalsOnPageSelected}
                          onChange={toggleSelectAllGoalsOnPage}
                          aria-label="Select all goals on this page"
                        />
                      </TableHead>
                      <TableHead style={{ width: "30%" }}>Goal</TableHead>
                      <TableHead style={{ width: "21%" }}>Current</TableHead>
                      <TableHead style={{ width: "21%" }}>Target</TableHead>
                      <TableHead style={{ width: "20%" }}>Progress</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedGoalRows.map((goal) => {
                      const pct = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
                      return (
                        <tr key={goal.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedGoalIds.includes(goal.id)}
                              onChange={() => toggleGoalSelection(goal.id)}
                              aria-label={`Select ${goal.name}`}
                            />
                          </TableCell>
                          <TableCell title={goal.name}>{goal.icon} {goal.name}</TableCell>
                          <TableCell>{formatCurrency(goal.current, currency)}</TableCell>
                          <TableCell>{formatCurrency(goal.target, currency)}</TableCell>
                          <TableCell>{pct.toFixed(1)}%</TableCell>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              </TableWrap>
              <DataTablePagination
                totalRows={goalRows.length}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </>
      )}
    </PageSection>
  );
}

function InsightsPage({ assets, liabilities, currency }) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  const insights = [
    ...(debtRatio > 40 ? [{ icon: "\u26A0\uFE0F", color: "#f59e0b", title: "High Debt Ratio", desc: `Your debt ratio is ${debtRatio.toFixed(1)}%. Aim to keep it below 40% for financial health.` }] : []),
    ...(assets.length === 0 ? [{ icon: "\u{1F4CA}", color: "#3b82f6", title: "Start Tracking", desc: "Add your first asset to start building your financial picture." }] : []),
    ...(assets.length > 0 ? [{ icon: "\u2705", color: "#22c55e", title: "Tracking Active", desc: `You're tracking ${assets.length} asset${assets.length > 1 ? "s" : ""} worth ${formatCurrency(totalAssets, currency)}.` }] : []),
    ...(debtRatio < 20 && assets.length > 0 ? [{ icon: "\u{1F389}", color: "#16a34a", title: "Healthy Finances", desc: "Your debt ratio is excellent. Keep building your asset base!" }] : []),
    { icon: "\u{1F4A1}", color: "#8b5cf6", title: "Diversification Tip", desc: "Consider spreading investments across stocks, real estate, and fixed income for stability." },
    { icon: "\u{1F4F8}", color: "var(--muted, #64748b)", title: "Take Regular Snapshots", desc: "Monthly net worth snapshots help you see your wealth trajectory over time." },
  ];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>Insights</h2>
      <p style={{ color: "var(--muted, #64748b)", marginBottom: 24 }}>Smart observations about your financial health</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <SummaryCard
          icon={"\u2728"}
          label="NET WORTH"
          value={formatCurrency(netWorth, currency)}
          sub="Assets minus Liabilities"
          color="#3b82f6"
        />
        <SummaryCard
          icon={"\u2696\uFE0F"}
          label="DEBT RATIO"
          value={`${debtRatio.toFixed(1)}%`}
          sub={debtRatio < 20 ? "Excellent" : debtRatio < 40 ? "Good" : debtRatio < 60 ? "Moderate" : "High"}
          color={debtRatio < 30 ? "#16a34a" : "#ef4444"}
        />
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ ...cardStyle, display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${ins.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{ins.icon}</div>
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 4 }}>{ins.title}</div>
              <div style={{ color: "var(--muted, #64748b)", fontSize: 14, lineHeight: 1.5 }}>{ins.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaceholderPage({ title, icon }) {
  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>
        {title}
      </h2>
      <div style={{ ...cardStyle, textAlign: "center", padding: "60px 32px", color: "#94a3b8" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
        <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--muted, #64748b)" }}>Coming Soon</div>
        <div style={{ fontSize: 14 }}>This feature is under development</div>
      </div>
    </div>
  );
}

const btnStyle = buttonStyles.primary;
const cardStyle = sharedCardStyle;
const inputStyle = sharedInputStyle;
const labelStyle = sharedLabelStyle;

const TYPE_SCALE = {
  h1: 20,
  h2: 16,
  body: 14,
  meta: 12,
  micro: 10,
};

const TABLE_PAGE_LENGTH = 10;

function getTotalPages(totalRows, pageLength = TABLE_PAGE_LENGTH) {
  return Math.max(1, Math.ceil(totalRows / pageLength));
}

function getPaginatedRows(rows, page, pageLength = TABLE_PAGE_LENGTH) {
  const start = (page - 1) * pageLength;
  return rows.slice(start, start + pageLength);
}

const surfaceIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const toastIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const AppShell = styled.div(({ $isMobile }) => ({
  display: "flex",
  height: "100dvh",
  overflow: "hidden",
  fontFamily,
  background: "var(--bg, #f8fafc)",
  color: "var(--text-color, #1e293b)",
  flexDirection: $isMobile ? "column" : "row",
}));

const SidebarRail = styled.aside(({ $collapsed }) => ({
  width: $collapsed ? 84 : 268,
  background: "var(--sidebar-bg, #ffffff)",
  borderRight: "1px solid var(--border, #e2e8f0)",
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  overflow: "hidden",
  transition: "width 260ms cubic-bezier(0.22, 1, 0.36, 1)",
  willChange: "width",
}));

const SidebarTop = styled.div(({ $collapsed }) => ({
  padding: $collapsed ? "16px 12px 14px" : "16px 14px 14px",
  borderBottom: "1px solid var(--border, #e2e8f0)",
  display: "grid",
  gap: 12,
}));

const ProfileCard = styled.div(({ $collapsed }) => ({
  display: "flex",
  alignItems: "center",
  gap: 10,
  justifyContent: $collapsed ? "center" : "flex-start",
  cursor: "pointer",
}));

const ProfileAvatar = styled.img({
  width: 38,
  height: 38,
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid rgba(22, 163, 74, 0.2)",
  background: "var(--bg-light, #f8fafc)",
});

const ProfileFallback = styled.div({
  width: 38,
  height: 38,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#16a34a",
  color: "#fff",
  fontWeight: 700,
  fontSize: TYPE_SCALE.meta,
});

const ProfileName = styled.div({
  fontSize: TYPE_SCALE.meta,
  fontWeight: 700,
  color: "var(--text-color, #1e293b)",
  lineHeight: 1.2,
});

const ProfileMeta = styled.div({
  fontSize: TYPE_SCALE.micro,
  color: "var(--muted, #64748b)",
  lineHeight: 1.2,
});

const SIDEBAR_ICON_MAP = {
  dashboard: "\u229E",
  assets: "\u{1F3DB}",
  liabilities: "\u{1F4B3}",
  networth: "\u{1F4C8}",
  goals: "\u{1F3AF}",
  allocation: "\u{1F550}",
  income: "\u{1F4BC}",
  expenses: "\u{1F6D2}",
  insights: "\u{1F4CA}",
  settings: "\u2699\uFE0F",
  overview: "\u{1F4CA}",
  wealth: "\u{1F48E}",
  plan: "\u{1F5D2}\uFE0F",
  money: "\u{1F4B0}",
  data: "\u{1F5C2}\uFE0F",
  logout: "\u{1F6AA}",
  theme: "\u{1F319}",
};

function SidebarGlyph({ name, size = 16 }) {
  const icon = SIDEBAR_ICON_MAP[name] || "\u25CF";
  return (
    <span
      aria-hidden="true"
      style={{
        width: size + 6,
        height: size + 6,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size,
        lineHeight: 1,
      }}
    >
      {icon}
    </span>
  );
}

const SidebarSearch = styled.input({
  width: "100%",
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 999,
  padding: "9px 12px",
  fontSize: TYPE_SCALE.meta,
  outline: "none",
  color: "var(--text-color, #1e293b)",
  background: "var(--input-bg, #fff)",
});

const SidebarNav = styled.nav({
  flex: 1,
  padding: "10px 8px",
  overflow: "hidden",
});

const SectionBlock = styled.div({
  marginBottom: 8,
});

const MenuButton = styled.button(({ $active, $collapsed }) => ({
  width: "100%",
  border: "none",
  borderRadius: 10,
  marginBottom: 4,
  padding: $collapsed ? "8px 6px" : "8px 10px",
  background: $active ? "var(--accent-bg, #f0fdf4)" : "transparent",
  color: $active ? "var(--primary, #16a34a)" : "var(--text-color, #1e293b)",
  display: "flex",
  alignItems: "center",
  justifyContent: $collapsed ? "center" : "flex-start",
  gap: 10,
  cursor: "pointer",
  fontSize: TYPE_SCALE.body,
  fontWeight: $active ? 700 : 500,
}));

const SidebarBottom = styled.div({
  borderTop: "1px solid var(--border, #e2e8f0)",
  padding: "10px 8px 12px",
  display: "grid",
  gap: 6,
});

const MainSurface = styled.main(({ $hasMobileNav }) => ({
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  paddingBottom: $hasMobileNav ? 80 : 0,
}));

const MainHeader = styled.header({
  position: "sticky",
  top: 0,
  zIndex: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 20px",
  borderBottom: "1px solid var(--border, #e2e8f0)",
  background: "var(--sidebar-bg, #ffffff)",
});

const HeaderTitle = styled.h1({
  margin: 0,
  fontSize: TYPE_SCALE.h1,
  fontWeight: 700,
  color: "var(--heading-color, #1a2e1a)",
  lineHeight: 1.2,
});

const HeaderSubtitle = styled.p({
  margin: "2px 0 0",
  fontSize: TYPE_SCALE.meta,
  color: "var(--muted, #64748b)",
});

const HeaderActions = styled.div({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
});

const HeaderButton = styled.button({
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 8,
  background: "var(--card-bg, #fff)",
  color: "var(--muted, #64748b)",
  padding: "6px 10px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  cursor: "pointer",
});

const MainScroll = styled.div({
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
});

const MainMenuTabs = styled.div(({ $isMobile }) => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: $isMobile ? "10px 12px 0" : "10px 16px 0",
  overflowX: "auto",
  flexWrap: "nowrap",
}));

const MainMenuTab = styled.button(({ $active }) => ({
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 10,
  background: $active ? "var(--accent-bg, #f0fdf4)" : "var(--card-bg, #fff)",
  color: $active ? "var(--primary, #16a34a)" : "var(--muted, #64748b)",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: $active ? 700 : 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
}));

const PageSection = styled.section(({ $isMobile }) => ({
  padding: $isMobile ? "16px 12px" : "28px 32px",
  maxWidth: 900,
  width: "100%",
  boxSizing: "border-box",
}));

const PageHeader = styled.div(({ $isMobile }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: $isMobile ? "flex-start" : "center",
  flexDirection: $isMobile ? "column" : "row",
  gap: $isMobile ? 12 : 0,
  marginBottom: 24,
}));

const PageHeaderActions = styled.div(({ $isMobile }) => ({
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  width: $isMobile ? "100%" : "auto",
}));

const DashboardWrap = styled.div(({ $isMobile }) => ({
  padding: $isMobile ? "16px" : "20px 24px 24px",
  maxWidth: 1180,
  width: "100%",
  boxSizing: "border-box",
}));

const HeroPanel = styled.section(({ $isMobile }) => ({
  borderRadius: 18,
  border: "1px solid var(--accent-border, #bbf7d0)",
  background: `var(--hero-gradient, ${heroGradient})`,
  padding: $isMobile ? "16px 14px" : "20px 22px",
  marginBottom: 16,
  display: "grid",
  gridTemplateColumns: $isMobile ? "1fr" : "1.4fr auto",
  gap: 14,
  animation: `${surfaceIn} 260ms ease`,
}));

const HeroLabel = styled.div({
  fontSize: TYPE_SCALE.micro,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: "var(--muted, #64748b)",
  textTransform: "uppercase",
  marginBottom: 4,
});

const HeroValue = styled.div({
  fontFamily: serifFontFamily,
  fontSize: 40,
  lineHeight: 1,
  color: "var(--accent-dark, #14532d)",
});

const HeroMeta = styled.div({
  fontSize: TYPE_SCALE.meta,
  color: "var(--muted, #64748b)",
});

const ActionCluster = styled.div({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
});

const PrimaryButton = styled.button({
  border: "none",
  borderRadius: 10,
  background: "#16a34a",
  color: "#fff",
  padding: "9px 12px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 700,
  cursor: "pointer",
});

const SecondaryButton = styled.button({
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 10,
  background: "var(--card-bg, #fff)",
  color: "var(--text-color, #1e293b)",
  padding: "9px 12px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  cursor: "pointer",
});

const GhostButton = styled.button({
  border: "none",
  borderRadius: 10,
  background: "transparent",
  color: "var(--muted, #64748b)",
  padding: "9px 10px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  cursor: "pointer",
});

const StatGrid = styled.div(({ $isMobile }) => ({
  display: "grid",
  gridTemplateColumns: $isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 16,
}));

const StatCard = styled.article({
  borderRadius: 14,
  border: "1px solid var(--border, #e2e8f0)",
  background: "var(--card-bg, #fff)",
  padding: "14px 14px 12px",
  display: "grid",
  gap: 4,
  animation: `${surfaceIn} 240ms ease`,
});

const StatLabel = styled.div({
  fontSize: TYPE_SCALE.micro,
  textTransform: "uppercase",
  letterSpacing: 0.7,
  fontWeight: 700,
  color: "var(--muted, #64748b)",
});

const StatValue = styled.div({
  fontSize: TYPE_SCALE.h2,
  fontWeight: 700,
  color: "var(--text-color, #1e293b)",
});

const StatSub = styled.div({
  fontSize: TYPE_SCALE.meta,
  color: "var(--muted, #64748b)",
});

const DashboardTabs = styled.div({
  display: "inline-flex",
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 10,
  background: "var(--card-bg, #fff)",
  marginBottom: 12,
  overflow: "hidden",
});

const TabButton = styled.button(({ $active }) => ({
  border: "none",
  background: $active ? "var(--accent-bg, #f0fdf4)" : "transparent",
  color: $active ? "var(--primary, #16a34a)" : "var(--muted, #64748b)",
  padding: "9px 12px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: $active ? 700 : 600,
  cursor: "pointer",
}));

const PanelGrid = styled.div(({ $isMobile }) => ({
  display: "grid",
  gridTemplateColumns: $isMobile ? "1fr" : "minmax(0, 1.7fr) minmax(260px, 1fr)",
  gap: 12,
}));

const PanelCard = styled.section({
  borderRadius: 14,
  border: "1px solid var(--border, #e2e8f0)",
  background: "var(--card-bg, #fff)",
  padding: "14px 14px 12px",
  animation: `${surfaceIn} 240ms ease`,
});

const PanelTitle = styled.h2({
  margin: "0 0 8px",
  fontSize: TYPE_SCALE.h2,
  lineHeight: 1.2,
  color: "var(--text-color, #1e293b)",
});

const PanelHint = styled.div({
  fontSize: TYPE_SCALE.meta,
  color: "var(--muted, #64748b)",
  marginBottom: 10,
});

const Toolbar = styled.div(({ $isMobile }) => ({
  display: "grid",
  gridTemplateColumns: $isMobile ? "1fr" : "1fr 180px 180px",
  gap: 8,
  marginBottom: 10,
}));

const Field = styled.input({
  width: "100%",
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 10,
  background: "var(--input-bg, #fff)",
  color: "var(--text-color, #1e293b)",
  padding: "8px 10px",
  fontSize: TYPE_SCALE.meta,
  outline: "none",
  boxSizing: "border-box",
});

const Select = styled.select({
  width: "100%",
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 10,
  background: "var(--input-bg, #fff)",
  color: "var(--text-color, #1e293b)",
  padding: "8px 10px",
  fontSize: TYPE_SCALE.meta,
  outline: "none",
});

const TableWrap = styled.div({
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 10,
  overflowX: "auto",
  overflowY: "hidden",
});

const DataTable = styled.table({
  width: "100%",
  minWidth: 640,
  borderCollapse: "collapse",
  tableLayout: "fixed",
});

const TableHead = styled.th({
  padding: "8px 10px",
  textAlign: "left",
  fontSize: TYPE_SCALE.micro,
  textTransform: "uppercase",
  letterSpacing: 0.7,
  color: "var(--muted, #64748b)",
  borderBottom: "1px solid var(--border, #e2e8f0)",
  background: "var(--bg-light, #f8fafc)",
});

const TableCell = styled.td({
  padding: "10px 10px",
  borderBottom: "1px solid var(--border, #e2e8f0)",
  fontSize: TYPE_SCALE.body,
  color: "var(--text-color, #1e293b)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const TablePager = styled.div({
  marginTop: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
});

const TablePagerInfo = styled.div({
  fontSize: TYPE_SCALE.meta,
  color: "var(--muted, #64748b)",
});

const TablePagerActions = styled.div({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
});

const TablePagerButton = styled.button(({ disabled }) => ({
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 8,
  background: "var(--card-bg, #fff)",
  color: "var(--text-color, #1e293b)",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  padding: "5px 9px",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
}));

const TablePagerBadge = styled.span({
  fontSize: TYPE_SCALE.meta,
  fontWeight: 700,
  color: "var(--muted, #64748b)",
  minWidth: 56,
  textAlign: "center",
});

const EmptyBlock = styled.div({
  border: "1px dashed var(--border, #e2e8f0)",
  borderRadius: 10,
  padding: "18px 12px",
  textAlign: "center",
  color: "var(--muted, #64748b)",
  fontSize: TYPE_SCALE.meta,
});

const FloatingArea = styled.div({
  position: "relative",
  display: "inline-flex",
});

const PopoverCard = styled.div({
  position: "absolute",
  right: 0,
  top: "calc(100% + 6px)",
  width: 220,
  borderRadius: 10,
  border: "1px solid var(--border, #e2e8f0)",
  background: "var(--card-bg, #fff)",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.15)",
  padding: 6,
  zIndex: 20,
});

const PopoverAction = styled.button({
  width: "100%",
  border: "none",
  borderRadius: 8,
  background: "transparent",
  color: "var(--text-color, #1e293b)",
  textAlign: "left",
  padding: "8px 10px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  cursor: "pointer",
});

const ModalBackdrop = styled.div({
  position: "fixed",
  inset: 0,
  zIndex: 130,
  background: "rgba(2, 6, 23, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
});

const ModalCard = styled.div(({ $maxWidth = 460 }) => ({
  width: "100%",
  maxWidth: $maxWidth,
  maxHeight: "min(92dvh, 720px)",
  borderRadius: 14,
  border: "1px solid var(--border, #e2e8f0)",
  background: "var(--card-bg, #fff)",
  padding: 16,
  overflowY: "auto",
  boxShadow: "0 24px 48px rgba(2, 6, 23, 0.24)",
  animation: `${surfaceIn} 180ms ease`,
}));

const ModalTitle = styled.h2({
  margin: "0 0 6px",
  fontSize: TYPE_SCALE.h2,
  color: "var(--text-color, #1e293b)",
});

const ModalText = styled.p({
  margin: "0 0 14px",
  fontSize: TYPE_SCALE.meta,
  color: "var(--muted, #64748b)",
  lineHeight: 1.45,
});

const ModalActions = styled.div({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 12,
});

const ToastStack = styled.div({
  position: "fixed",
  right: 12,
  bottom: 12,
  zIndex: 180,
});

const ToastChip = styled.div(({ $type }) => ({
  minWidth: 220,
  maxWidth: 320,
  borderRadius: 10,
  border: "1px solid transparent",
  background: $type === "error" ? "rgba(220, 38, 38, 0.92)" : $type === "success" ? "rgba(22, 163, 74, 0.92)" : "rgba(15, 23, 42, 0.9)",
  color: "#fff",
  padding: "10px 12px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  boxShadow: "0 10px 24px rgba(2, 6, 23, 0.28)",
  animation: `${toastIn} 140ms ease`,
}));

function DataTablePagination({ totalRows, currentPage, onPageChange, pageLength = TABLE_PAGE_LENGTH }) {
  if (totalRows <= pageLength) return null;

  const totalPages = getTotalPages(totalRows, pageLength);
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (safePage - 1) * pageLength + 1;
  const end = Math.min(totalRows, safePage * pageLength);

  return (
    <TablePager>
      <TablePagerInfo>
        Showing {start}-{end} of {totalRows}
      </TablePagerInfo>
      <TablePagerActions>
        <TablePagerButton
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(1)}
        >
          First
        </TablePagerButton>
        <TablePagerButton
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
        >
          Prev
        </TablePagerButton>
        <TablePagerBadge>
          {safePage} / {totalPages}
        </TablePagerBadge>
        <TablePagerButton
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
        >
          Next
        </TablePagerButton>
        <TablePagerButton
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          Last
        </TablePagerButton>
      </TablePagerActions>
    </TablePager>
  );
}

function getFirestoreErrorMessage(error, fallbackMessage) {
  const code = String(error?.code || "").toLowerCase();

  if (code.includes("permission-denied")) {
    return "Cloud sync blocked by Firestore rules. Allow read/write for wealthtrackerUsers/{uid} where request.auth.uid == uid.";
  }

  if (code.includes("failed-precondition")) {
    return "Firestore is not initialized. Create a Firestore database in Firebase Console.";
  }

  if (code.includes("unavailable")) {
    return "Cloud sync unavailable. Check your internet connection and retry.";
  }

  return fallbackMessage;
}

export default function App() {
  const isMobile = useIsMobile();
  const [phase, setPhase] = useState("onboarding"); // onboarding | app
  const currency = "INR";
  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [sectionSelection, setSectionSelection] = useState({});
  const [mobileProfileMenuOpen, setMobileProfileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [assetComposerRequest, setAssetComposerRequest] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudHydrated, setCloudHydrated] = useState(false);
  const [signInBusy, setSignInBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const saveTimeoutRef = useRef(null);

  const addAsset = (a) => setAssets((prev) => [...prev, a]);
  const deleteAsset = (id) => setAssets((prev) => prev.filter((a) => a.id !== id));
  const addLiability = (l) => setLiabilities((prev) => [...prev, l]);
  const deleteLiability = (id) => setLiabilities((prev) => prev.filter((l) => l.id !== id));
  const addIncome = (inc) => setIncomes((prev) => [...prev, inc]);
  const deleteIncome = (id) => setIncomes((prev) => prev.filter((i) => i.id !== id));
  const addExpense = (ex) => setExpenses((prev) => [...prev, ex]);
  const deleteExpense = (id) => setExpenses((prev) => prev.filter((e) => e.id !== id));
  const importIncomeEntries = (entries) => setIncomes((prev) => [...prev, ...entries]);
  const importExpenseEntries = (entries) => setExpenses((prev) => [...prev, ...entries]);

  const takeSnapshot = (navigateToNetWorth = false) => {
    const total = assets.reduce((s, a) => s + a.value, 0) - liabilities.reduce((s, l) => s + l.value, 0);
    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
    setSnapshots((prev) => [...prev, { date: today, value: total }]);
    if (navigateToNetWorth) {
      setActiveNav("networth");
    }
    setToast({ id: Date.now(), message: "Snapshot saved.", type: "success" });
  };

  const userName = authUser?.displayName?.trim() || authUser?.email?.split("@")[0] || "User";
  const userAvatar = authUser?.photoURL || "";

  const pushToast = (message, type = "info") => {
    setToast({ id: Date.now(), message, type });
  };

  const openAssetComposer = (typeId = "stocks") => {
    const resolvedTypeId = ASSET_TYPES.some((type) => type.id === typeId) ? typeId : "stocks";
    setAssetComposerRequest({ token: Date.now(), typeId: resolvedTypeId });
    setActiveNav("assets");
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleToastEvent = (event) => {
      const message = event?.detail?.message;
      const type = event?.detail?.type || "info";
      if (!message) return;
      setToast({ id: Date.now(), message, type });
    };

    window.addEventListener(TOAST_EVENT_NAME, handleToastEvent);
    return () => window.removeEventListener(TOAST_EVENT_NAME, handleToastEvent);
  }, []);

  const navSections = useMemo(
    () =>
      NAV_ITEMS
        .filter((section) => section.section.toLowerCase() !== "data")
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => item.id !== "settings"),
        }))
        .filter((section) => section.items.length > 0),
    []
  );

  const activeSectionData = useMemo(
    () => navSections.find((section) => section.items.some((item) => item.id === activeNav)) || null,
    [navSections, activeNav]
  );

  const activeSection = activeSectionData?.section || null;
  const activeSectionItems = activeSectionData?.items || [];
  const validNavIds = useMemo(() => navSections.flatMap((section) => section.items.map((item) => item.id)), [navSections]);

  const normalizedNavSearch = sidebarSearch.trim().toLowerCase();
  const visibleSections = navSections.filter((section) => {
    if (!normalizedNavSearch) return true;
    return (
      section.section.toLowerCase().includes(normalizedNavSearch) ||
      section.items.some(
        (item) =>
          item.label.toLowerCase().includes(normalizedNavSearch) ||
          item.id.toLowerCase().includes(normalizedNavSearch)
      )
    );
  });

  const pageNameMap = {
    dashboard: "Dashboard",
    assets: "Assets",
    liabilities: "Liabilities",
    networth: "Net Worth",
    goals: "Goals",
    allocation: "Allocation",
    income: "Income",
    expenses: "Expenses",
    insights: "Insights",
  };

  const pageSubtitleMap = {
    dashboard: "Financial command center",
    assets: "Track and organize all assets",
    liabilities: "Monitor debt and obligations",
    networth: "Timeline and trajectory",
    goals: "Target-based wealth planning",
    allocation: "Portfolio composition",
    income: "Incoming cashflow records",
    expenses: "Spending analysis",
    insights: "Signals and recommendations",
  };

  const pageTitle = activeSectionData?.section || pageNameMap[activeNav] || "Dashboard";
  const pageSubtitle = pageSubtitleMap[activeNav] || "Manage your wealth";

  const mobileNavItems = navSections.map((section) => ({
    section: section.section,
    label: section.section,
    iconKey: section.section.toLowerCase(),
  }));

  const getSectionTargetNav = (section) => {
    if (!section?.items?.length) return null;
    const rememberedNav = sectionSelection[section.section];
    if (rememberedNav && section.items.some((item) => item.id === rememberedNav)) {
      return rememberedNav;
    }
    return section.items[0]?.id || null;
  };

  const navigateToSection = (section) => {
    const nextNav = getSectionTargetNav(section);
    if (!nextNav) return;
    setActiveNav(nextNav);
  };

  const resetTrackerState = () => {
    setPhase("onboarding");
    setAssets([]);
    setLiabilities([]);
    setIncomes([]);
    setExpenses([]);
    setSnapshots([]);
    setActiveNav("dashboard");
    setDarkMode(true);
    setLastSyncedAt(null);
    setSyncInProgress(false);
    setSectionSelection({});
    setMobileProfileMenuOpen(false);
    setAssetComposerRequest(null);
  };

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      setAuthError("Firebase is not configured. Add values in .env.local (see .env.example).");
      return;
    }

    try {
      setSignInBusy(true);
      setAuthError("");
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError("Google sign-in failed. Please try again.");
    } finally {
      setSignInBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      resetTrackerState();
    } catch (error) {
      setAuthError("Unable to sign out right now. Please retry.");
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !db) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      setAuthError("");

      if (!user) {
        setCloudHydrated(false);
        setCloudLoading(false);
        resetTrackerState();
        return;
      }

      setCloudLoading(true);
      try {
        const userDocRef = doc(db, "wealthtrackerUsers", user.uid);
        const snapshot = await getDoc(userDocRef);

        if (snapshot.exists()) {
          const cloud = snapshot.data();
          setPhase(cloud.phase === "app" ? "app" : "onboarding");
          setAssets(Array.isArray(cloud.assets) ? cloud.assets : []);
          setLiabilities(Array.isArray(cloud.liabilities) ? cloud.liabilities : []);
          setIncomes(Array.isArray(cloud.incomes) ? cloud.incomes : []);
          setExpenses(Array.isArray(cloud.expenses) ? cloud.expenses : []);
          setSnapshots(Array.isArray(cloud.snapshots) ? cloud.snapshots : []);
          setActiveNav(typeof cloud.activeNav === "string" ? cloud.activeNav : "dashboard");
          setDarkMode(typeof cloud.darkMode === "boolean" ? cloud.darkMode : true);
          setLastSyncedAt(new Date().toISOString());
        } else {
          resetTrackerState();
          await setDoc(
            userDocRef,
            {
              phase: "onboarding",
              assets: [],
              liabilities: [],
              incomes: [],
              expenses: [],
              snapshots: [],
              activeNav: "dashboard",
              darkMode: true,
              profile: {
                email: user.email || null,
                displayName: user.displayName || null,
              },
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          setLastSyncedAt(new Date().toISOString());
        }
      } catch (error) {
        console.error("Firestore load failed:", error);
        setAuthError(getFirestoreErrorMessage(error, "Cloud read/write failed. Check Firestore setup and rules."));
        resetTrackerState();
      } finally {
        setCloudLoading(false);
        setCloudHydrated(true);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser || !cloudHydrated || !db) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    let active = true;

    saveTimeoutRef.current = setTimeout(() => {
      const sync = async () => {
        try {
          if (active) setSyncInProgress(true);
          const userDocRef = doc(db, "wealthtrackerUsers", authUser.uid);
          await setDoc(
            userDocRef,
            {
              phase,
              assets,
              liabilities,
              incomes,
              expenses,
              snapshots,
              activeNav,
              darkMode,
              profile: {
                email: authUser.email || null,
                displayName: authUser.displayName || null,
              },
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          if (active) {
            setAuthError("");
            setLastSyncedAt(new Date().toISOString());
          }
        } catch (error) {
          console.error("Firestore sync failed:", error);
          if (active) {
            setAuthError(getFirestoreErrorMessage(error, "Cloud sync failed. Check Firestore rules or internet connection."));
          }
        } finally {
          if (active) setSyncInProgress(false);
        }
      };

      sync();
    }, 300);

    return () => {
      active = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [authUser, cloudHydrated, phase, assets, liabilities, incomes, expenses, snapshots, activeNav, darkMode]);

  const bg = darkMode ? "#0f172a" : "#f8fafc";
  const textColor = darkMode ? "var(--text-color, #e2e8f0)" : "#1e293b";
  const onboardingBg = darkMode
    ? "linear-gradient(135deg, #020617 0%, #0b1220 48%, #111827 100%)"
    : onboardingGradient;

  // Expose theme tokens via CSS variables so inline styles adapt to dark mode
  useEffect(() => {
    applyTheme(darkMode);
    const html = document.documentElement;
    const rootEl = document.getElementById("root");

    // Lock page scroll only in the main app shell; onboarding should be scrollable.
    if (phase === "app") {
      html.style.height = "100%";
      html.style.overflow = "hidden";
      html.style.overscrollBehavior = "none";

      document.body.style.height = "100%";
      document.body.style.margin = "0";
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";

      if (rootEl) {
        rootEl.style.height = "100%";
        rootEl.style.overflow = "hidden";
        rootEl.style.overscrollBehavior = "none";
      }
    } else {
      html.style.height = "";
      html.style.overflow = "";
      html.style.overscrollBehavior = "";

      document.body.style.height = "";
      document.body.style.margin = "0";
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";

      if (rootEl) {
        rootEl.style.height = "";
        rootEl.style.overflow = "";
        rootEl.style.overscrollBehavior = "";
      }
    }

    // also apply to body for immediate background/text color
    document.body.style.background = bg;
    document.body.style.color = textColor;
  }, [darkMode, bg, textColor, phase]);

  useEffect(() => {
    if (!activeSection) return;
    setSectionSelection((prev) => {
      if (prev[activeSection] === activeNav) return prev;
      return { ...prev, [activeSection]: activeNav };
    });
  }, [activeSection, activeNav]);

  useEffect(() => {
    if (validNavIds.length === 0) return;
    if (!validNavIds.includes(activeNav)) {
      setActiveNav(validNavIds[0]);
    }
  }, [activeNav, validNavIds]);

  useEffect(() => {
    if (!isMobile && mobileProfileMenuOpen) {
      setMobileProfileMenuOpen(false);
    }
  }, [isMobile, mobileProfileMenuOpen]);

  useEffect(() => {
    if (!mobileProfileMenuOpen) return undefined;
    const closeMenu = () => setMobileProfileMenuOpen(false);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [mobileProfileMenuOpen]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timeoutId);
  }, [toast]);
  const hasSyncMessage = Boolean(authError);
  const syncStatusText = authError || "";
  const syncStatusColor = "#dc2626";
  const syncStatusBg = "rgba(220, 38, 38, 0.12)";
  const syncStatusBorder = "rgba(220, 38, 38, 0.35)";

  if (authLoading) {
    return <LoadingScreen title="Checking login..." detail="Verifying your Google session." />;
  }

  if (!isFirebaseConfigured) {
    return (
      <LoginScreen
        onLogin={handleGoogleSignIn}
        busy={signInBusy}
        error={authError}
        configError="Firebase config is missing. Create .env.local from .env.example and restart the app."
      />
    );
  }

  if (!authUser) {
    return <LoginScreen onLogin={handleGoogleSignIn} busy={signInBusy} error={authError} />;
  }

  if (cloudLoading && !cloudHydrated) {
    return <LoadingScreen title="Loading your data..." detail="Fetching your profile from cloud storage." />;
  }

  if (phase === "onboarding") {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: onboardingBg,
          display: "flex",
          position: "relative",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "center",
          fontFamily,
          padding: isMobile ? "14px 12px 24px" : 24,
          overflowY: "auto",
        }}
      >
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{
            position: "absolute",
            top: isMobile ? 10 : 16,
            right: isMobile ? 10 : 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "1px solid var(--border, #e2e8f0)",
            background: "var(--card-bg, #fff)",
            color: "var(--text-color, #1e293b)",
            borderRadius: 999,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            zIndex: 2,
          }}
        >
          <span>{darkMode ? "\u2600\uFE0F" : "\u{1F319}"}</span>
          <span>{darkMode ? "Light" : "Dark"}</span>
        </button>
        <div
          style={{
            width: "100%",
            maxWidth: 640,
            background: "var(--card-bg, #fff)",
            borderRadius: isMobile ? 16 : 24,
            padding: isMobile ? "24px 16px" : "52px 48px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.08)",
            margin: isMobile ? "8px 0 24px" : 0,
          }}
        >
          {hasSyncMessage && (
            <div
              style={{
                marginBottom: 16,
                border: `1px solid ${syncStatusBorder}`,
                borderRadius: 10,
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 600,
                background: syncStatusBg,
                color: syncStatusColor,
              }}
            >
              {syncStatusText}
            </div>
          )}
          <OnboardingStep1 onNext={() => setPhase("app")} />
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (activeNav) {
      case "dashboard":
        return (
          <Dashboard
            assets={assets}
            liabilities={liabilities}
            incomes={incomes}
            expenses={expenses}
            currency={currency}
            snapshots={snapshots}
            onSnapshot={() => takeSnapshot(false)}
            onAddAsset={openAssetComposer}
            isMobile={isMobile}
            onToast={pushToast}
            onNavigate={setActiveNav}
          />
        );
      case "assets":
        return (
          <AssetsPage
            assets={assets}
            currency={currency}
            onAdd={addAsset}
            onDelete={deleteAsset}
            openAssetComposerRequest={assetComposerRequest}
            onConsumeAssetComposerRequest={() => setAssetComposerRequest(null)}
          />
        );
      case "liabilities": return <LiabilitiesPage liabilities={liabilities} currency={currency} onAdd={addLiability} onDelete={deleteLiability} />;
      case "networth": return <NetWorthPage assets={assets} liabilities={liabilities} currency={currency} snapshots={snapshots} onSnapshot={() => takeSnapshot(true)} isMobile={isMobile} />;
      case "goals": return <GoalsPage assets={assets} currency={currency} />;
      case "allocation": return <AllocationPage assets={assets} currency={currency} />;
      case "income": return <IncomePage incomes={incomes} currency={currency} onAdd={addIncome} onDelete={deleteIncome} onImportIncome={importIncomeEntries} onImportExpense={importExpenseEntries} />;
      case "expenses": return <ExpensesPage expenses={expenses} currency={currency} onAdd={addExpense} onDelete={deleteExpense} onImportIncome={importIncomeEntries} onImportExpense={importExpenseEntries} />;
      case "insights": return <InsightsPage assets={assets} liabilities={liabilities} currency={currency} />;
      case "settings":
        return (
          <div style={{ padding: "28px 32px", maxWidth: 900 }}>
            <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>Settings</h2>
            <p style={{ color: "var(--muted, #64748b)", marginBottom: 24 }}>Manage your preferences</p>
            <div style={{ display: "grid", gap: 16, maxWidth: 500 }}>
              <div style={cardStyle}>
                <div style={{ fontWeight: 600, marginBottom: 12, color: "var(--text-color, #1e293b)" }}>Display</div>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  style={{ ...btnStyle, width: "100%", justifyContent: "space-between" }}
                >
                  <span>{darkMode ? "Dark Mode" : "Light Mode"}</span>
                  <span>{darkMode ? "\u{1F319}" : "\u2600\uFE0F"}</span>
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div style={{ padding: "28px 32px", color: "#94a3b8", textAlign: "center", paddingTop: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u{1F6A7}"}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--muted, #64748b)" }}>{activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}</div>
            <div style={{ marginTop: 8, fontSize: 14 }}>Coming soon...</div>
          </div>
        );
    }
  };

  return (
    <AppShell $isMobile={isMobile}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {!isMobile && (
        <SidebarRail $collapsed={sidebarCollapsed}>
          <SidebarTop $collapsed={sidebarCollapsed}>
            <ProfileCard
              $collapsed={sidebarCollapsed}
              style={{ minWidth: 0 }}
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {userAvatar ? (
                <ProfileAvatar src={userAvatar} alt={userName} />
              ) : (
                <ProfileFallback>{(userName || "U").charAt(0).toUpperCase()}</ProfileFallback>
              )}
              {!sidebarCollapsed && (
                <div>
                  <ProfileName>{userName}</ProfileName>
                  <ProfileMeta>Personal workspace</ProfileMeta>
                </div>
              )}
            </ProfileCard>
            {!sidebarCollapsed && (
              <SidebarSearch
                value={sidebarSearch}
                onChange={(event) => setSidebarSearch(event.target.value)}
                placeholder="Search menus"
              />
            )}
          </SidebarTop>

          <SidebarNav>
            {visibleSections.map((section) => {
              const isActiveSection = section.section === activeSection;
              const sectionIconName = section.section.toLowerCase();

              return (
                <SectionBlock key={section.section}>
                  <MenuButton
                    $active={isActiveSection}
                    $collapsed={sidebarCollapsed}
                    onClick={() => navigateToSection(section)}
                    title={section.section}
                  >
                    <SidebarGlyph name={sectionIconName} />
                    {!sidebarCollapsed && <span>{section.section}</span>}
                  </MenuButton>
                </SectionBlock>
              );
            })}
          </SidebarNav>

          <SidebarBottom>
            <MenuButton
              $active={false}
              $collapsed={sidebarCollapsed}
              onClick={() => setDarkMode((prev) => !prev)}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              <SidebarGlyph name="theme" />
              {!sidebarCollapsed && <span>{darkMode ? "Light Mode" : "Dark Mode"}</span>}
            </MenuButton>
            <MenuButton
              $active={false}
              $collapsed={sidebarCollapsed}
              onClick={handleSignOut}
              title="Sign out"
            >
              <SidebarGlyph name="logout" />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </MenuButton>
          </SidebarBottom>
        </SidebarRail>
      )}

      <MainSurface $hasMobileNav={isMobile}>
        <MainHeader>
          <div>
            <HeaderTitle>{pageTitle}</HeaderTitle>
            <HeaderSubtitle>{pageSubtitle}</HeaderSubtitle>
          </div>
          <HeaderActions>
            {isMobile && (
              <div style={{ position: "relative" }} onClick={(event) => event.stopPropagation()}>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setMobileProfileMenuOpen((prev) => !prev);
                  }}
                  title="Profile menu"
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {userAvatar ? (
                    <ProfileAvatar src={userAvatar} alt={userName} style={{ width: 32, height: 32 }} />
                  ) : (
                    <ProfileFallback style={{ width: 32, height: 32, fontSize: TYPE_SCALE.micro }}>
                      {(userName || "U").charAt(0).toUpperCase()}
                    </ProfileFallback>
                  )}
                </button>
                {mobileProfileMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 8px)",
                      border: "1px solid var(--border, #e2e8f0)",
                      borderRadius: 10,
                      background: "var(--card-bg, #fff)",
                      boxShadow: "0 12px 26px rgba(2, 6, 23, 0.2)",
                      padding: 6,
                      minWidth: 140,
                      zIndex: 80,
                    }}
                  >
                    <button
                      onClick={() => {
                        setDarkMode((prev) => !prev);
                        setMobileProfileMenuOpen(false);
                      }}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        textAlign: "left",
                        borderRadius: 8,
                        padding: "8px 10px",
                        color: "var(--text-color, #1e293b)",
                        fontSize: TYPE_SCALE.meta,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {darkMode ? "Light Mode" : "Dark Mode"}
                    </button>
                    <button
                      onClick={() => {
                        setMobileProfileMenuOpen(false);
                        handleSignOut();
                      }}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        textAlign: "left",
                        borderRadius: 8,
                        padding: "8px 10px",
                        color: "var(--text-color, #1e293b)",
                        fontSize: TYPE_SCALE.meta,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </HeaderActions>
        </MainHeader>

        {hasSyncMessage && (
          <div
            style={{
              margin: isMobile ? "8px 12px 0" : "10px 16px 0",
              border: `1px solid ${syncStatusBorder}`,
              borderRadius: 10,
              padding: "8px 10px",
              fontSize: TYPE_SCALE.meta,
              fontWeight: 600,
              background: syncStatusBg,
              color: syncStatusColor,
            }}
          >
            {syncStatusText}
          </div>
        )}

        {activeSectionItems.length > 1 && (
          <MainMenuTabs $isMobile={isMobile}>
            {activeSectionItems.map((item) => (
              <MainMenuTab
                key={item.id}
                $active={activeNav === item.id}
                onClick={() => setActiveNav(item.id)}
              >
                <SidebarGlyph name={item.id} size={14} />
                <span>{item.label}</span>
              </MainMenuTab>
            ))}
          </MainMenuTabs>
        )}

        <MainScroll>{renderPage()}</MainScroll>

        {isMobile && (
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 120,
              height: 66,
              borderTop: "1px solid var(--border, #e2e8f0)",
              background: "var(--sidebar-bg, #fff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
            }}
          >
            {mobileNavItems.map((item) => (
              <button
                key={item.section}
                onClick={() => {
                  const section = navSections.find((navSection) => navSection.section === item.section);
                  if (section) {
                    navigateToSection(section);
                  }
                }}
                style={{
                  border: "none",
                  background: "none",
                  color: activeSection === item.section ? "var(--primary, #16a34a)" : "var(--muted, #64748b)",
                  fontSize: TYPE_SCALE.micro,
                  fontWeight: activeSection === item.section ? 700 : 600,
                  display: "grid",
                  gap: 4,
                  justifyItems: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <span style={{ fontSize: TYPE_SCALE.meta, display: "inline-flex" }}>
                  <SidebarGlyph name={item.iconKey} size={14} />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </MainSurface>

      {toast && (
        <ToastStack>
          <ToastChip $type={toast.type}>{toast.message}</ToastChip>
        </ToastStack>
      )}
    </AppShell>
  );
}

