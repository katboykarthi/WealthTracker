import { useState, useEffect, useRef } from "react";
import { applyTheme, cardStyle as sharedCardStyle, inputStyle as sharedInputStyle, labelStyle as sharedLabelStyle, buttonStyles, fontFamily, serifFontFamily, heroGradient, onboardingGradient } from "./styles";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import * as XLSX from "xlsx";
import { CURRENCIES, ASSET_TYPES, LIABILITY_TYPES, NAV_ITEMS, GOAL_ICONS } from "./constants";
import { formatCurrency } from "./utils/formatting";
import { sanitizeInput } from "./utils/security";

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

    const narration = sanitizeInput(narrationRaw || "Imported HDFC transaction", "text");
    const date = sanitizeInput(dateRaw || "", "text");

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

function OnboardingStep1({ onNext, currency, setCurrency }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🌿</div>
      <h1 style={{ fontFamily: serifFontFamily, fontSize: 32, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>
        Welcome to Karthick Wealth-tracker
      </h1>
      <p style={{ color: "var(--muted, #64748b)", fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
        Your <strong>privacy-first</strong> net worth tracker. No broker connections, no third-party tracking.{" "}
        <em>Just you and your data.</em>
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 40 }}>
        {["🔒 Private & Secure", "🌍 Multi-Currency", "📊 Track Everything"].map((f) => (
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
      <div style={{ background: "var(--bg-light, #f8fafc)", borderRadius: 16, padding: 24, marginBottom: 32, textAlign: "left" }}>
        <label style={{ display: "block", fontWeight: 600, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>
          Choose your base currency
        </label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "1.5px solid var(--border, var(--border, #e2e8f0))",
            fontSize: 15,
            color: "var(--input-text, #1e293b)",
            background: "var(--input-bg, #fff)",
            outline: "none",
          }}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.symbol} {c.name} ({c.code})
            </option>
          ))}
        </select>
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
        <div style={{ fontSize: 32 }}>📂</div>
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
  const [currency, setCurrency] = useState(editData?.currency || "INR");
  const [notes, setNotes] = useState(editData?.notes || "");

  const handleSave = () => {
    // Security: Validate and sanitize inputs
    const sanitizedName = sanitizeInput(name, 'text');
    const sanitizedNotes = sanitizeInput(notes, 'text');
    const sanitizedValue = sanitizeInput(value, 'number');
    
    if (!sanitizedName || sanitizedValue <= 0) {
      alert('Please enter valid asset name and positive value');
      return;
    }
    
    onSave({ 
      id: Date.now(), 
      typeId, 
      name: sanitizedName, 
      value: sanitizedValue, 
      currency, 
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Current Value</label>
            <input
              style={inputStyle}
              type="number"
              placeholder="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
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
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
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
  const [currency, setCurrency] = useState(editData?.currency || "INR");
  const [interest, setInterest] = useState(editData?.interest || "");

  const type = LIABILITY_TYPES.find((t) => t.id === typeId) || LIABILITY_TYPES[0];

  const handleSave = () => {
    // Security: Validate and sanitize inputs
    const sanitizedName = sanitizeInput(name, 'text');
    const sanitizedValue = sanitizeInput(value, 'number');
    const sanitizedInterest = sanitizeInput(interest, 'number');
    
    if (!sanitizedName || sanitizedValue <= 0) {
      alert('Please enter valid liability name and positive amount');
      return;
    }
    
    onSave({ 
      id: Date.now(), 
      typeId, 
      name: sanitizedName, 
      value: sanitizedValue, 
      currency, 
      interest: sanitizedInterest >= 0 ? sanitizedInterest : 0, 
      icon: type.icon, 
      label: type.label 
    });
  };

  return (
    <div style={{ background: "#fff5f5", borderRadius: 14, padding: 20 }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle}>
              {CURRENCIES.map((c) => (<option key={c.code} value={c.code}>{c.symbol} {c.code}</option>))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Outstanding Amount</label>
            <input style={inputStyle} type="number" placeholder="0" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Interest Rate (% p.a.)</label>
          <input style={inputStyle} type="number" placeholder="e.g. 8.5" value={interest} onChange={(e) => setInterest(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={onCancel} style={{ ...btnStyle, background: "#fff", color: "var(--muted, #64748b)", border: "1.5px solid var(--border, #e2e8f0)", flex: 1 }}>Cancel</button>
        <button onClick={handleSave} style={{ ...btnStyle, background: "#ef4444", flex: 2 }}>Save Liability</button>
      </div>
    </div>
  );
}

function OnboardingStep3({ onFinish }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 440, margin: "0 auto" }}>
      <div style={{ fontSize: 72, marginBottom: 20 }}>🎉</div>
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
          { icon: "📊", title: "Dashboard", desc: "See your net worth at a glance" },
          { icon: "🎯", title: "Goals", desc: "Track progress to your targets" },
          { icon: "📈", title: "Net Worth", desc: "Historical snapshots & trends" },
          { icon: "💡", title: "Insights", desc: "Smart observations about your wealth" },
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

function Dashboard({ assets, liabilities, incomes, expenses, currency, snapshots, onSnapshot, onAddAsset, isMobile }) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const c = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const allocationData = ASSET_TYPES.filter((t) => {
    const total = assets.filter((a) => a.typeId === t.id).reduce((s, a) => s + a.value, 0);
    return total > 0;
  }).map((t) => ({
    name: t.label,
    value: assets.filter((a) => a.typeId === t.id).reduce((s, a) => s + a.value, 0),
    color: t.color,
    icon: t.icon,
  }));

  const topHoldings = [...assets].sort((a, b) => b.value - a.value).slice(0, 5);
  const topExpenses = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 4);
  const topExpensesTotal = topExpenses.reduce((s, e) => s + e.amount, 0);
  const trackedCurrencies = new Set(assets.map((a) => a.currency)).size;

  return (
    <div style={{ padding: isMobile ? "16px 16px" : "28px 32px", maxWidth: 1100, paddingBottom: isMobile ? 80 : 0 }}>
      {/* Net Worth Hero */}
      <div
        style={{
          background: "var(--hero-gradient, " + heroGradient + ")",
          borderRadius: 20,
          padding: isMobile ? "20px 16px" : "28px 32px",
          marginBottom: 20,
          border: "1px solid var(--accent-border, #bbf7d0)",
          position: "relative",
        }}
      >
        <div style={{ color: "var(--muted, #64748b)", fontSize: isMobile ? 10 : 12, fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>
          NET WORTH - {c.symbol} {currency}
        </div>
        <div style={{ fontFamily: serifFontFamily, fontSize: isMobile ? 36 : 52, color: "var(--accent-dark, #14532d)", fontWeight: 700 }}>
          {c.symbol}{netWorth.toLocaleString()}
        </div>
        <div style={{ position: isMobile ? "static" : "absolute", top: 28, right: 32, textAlign: isMobile ? "left" : "right", marginTop: isMobile ? 12 : 0 }}>
          <div style={{ color: "var(--muted, #94a3b8)", fontSize: 13 }}>{today}</div>
          <button
            onClick={onSnapshot}
            style={{
              background: "none",
              border: "none",
              color: "#16a34a",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              marginTop: 8,
              padding: 0,
            }}
          >
            Take a snapshot
          </button>
        </div>
      </div>

      {/* Add Asset Banner */}
      {assets.length === 0 && (
        <div
          style={{
            background: "var(--info-bg, #eff6ff)",
            border: "1px solid var(--info-border, #bfdbfe)",
            borderRadius: 12,
            padding: isMobile ? "12px 14px" : "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 10 : 14,
            marginBottom: 20,
            flexDirection: isMobile ? "column" : "row",
          }}
        >
          <span style={{ fontSize: 24 }}>📊</span>
          <div style={{ flex: 1, textAlign: isMobile ? "center" : "left" }}>
            <strong style={{ color: "#1e40af" }}>Add your first asset</strong>{" "}
            <span style={{ color: "#3b82f6" }}>Start tracking your net worth by adding an asset.</span>
          </div>
          <button onClick={onAddAsset} style={{ ...btnStyle, padding: "8px 20px", fontSize: 13, whiteSpace: "nowrap" }}>
            Add Asset
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        <SummaryCard icon="🏛" label="TOTAL ASSETS" value={formatCurrency(totalAssets, currency)} sub={`${assets.length} assets`} color="#22c55e" />
        <SummaryCard icon="💳" label="TOTAL LIABILITIES" value={formatCurrency(totalLiabilities, currency)} sub={`${liabilities.length} active loans`} color="var(--error)" negative />
        <SummaryCard
          icon="⚖️"
          label="DEBT RATIO"
          value={`${debtRatio.toFixed(1)}%`}
          sub={debtRatio < 30 ? "Healthy" : debtRatio < 60 ? "Moderate" : "High"}
          color={debtRatio < 30 ? "var(--primary)" : debtRatio < 60 ? "var(--warning, #f59e0b)" : "var(--error)"}
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 4 }}>Net Worth Over Time</div>
          {snapshots.length < 2 ? (
            <div style={{ textAlign: "center", paddingTop: 60, color: "#94a3b8" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
              <div>No snapshots yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Take your first snapshot to see the trend</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={isMobile ? 150 : 180}>
              <LineChart data={snapshots}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} />
                <Tooltip formatter={(v) => formatCurrency(v, currency)} />
                <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2.5} dot={{ fill: "var(--primary)", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 4 }}>Asset Allocation</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>By category</div>
          {allocationData.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 40, color: "#94a3b8", fontSize: 13 }}>Add assets to see allocation</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={isMobile ? 100 : 130}>
                <PieChart>
                  <Pie data={allocationData} dataKey="value" cx="50%" cy="50%" outerRadius={isMobile ? 40 : 55} innerRadius={isMobile ? 20 : 30}>
                    {allocationData.map((d, i) => (<Cell key={i} fill={d.color} />))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v, currency)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {allocationData.map((d) => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: "var(--muted, #64748b)" }}>{d.name}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-color, #1e293b)" }}>{formatCurrency(d.value, currency)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 12 }}>Top Holdings</div>
          {topHoldings.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", paddingTop: 24 }}>Add assets to see top holdings</div>
          ) : (
            topHoldings.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{a.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "var(--text-color, #1e293b)", fontSize: 13 }}>{a.name}</div>
                  <div style={{ color: "#94a3b8", fontSize: 11 }}>{a.label}</div>
                </div>
                <span style={{ fontWeight: 700, color: "#16a34a", fontSize: 13 }}>{formatCurrency(a.value, a.currency)}</span>
              </div>
            ))
          )}
        </div>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 12 }}>Cashflow</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            <div style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "var(--muted, #64748b)", textTransform: "uppercase", letterSpacing: 0.5 }}>Income</div>
              <div style={{ fontWeight: 700, color: "var(--primary, #16a34a)", fontSize: 13 }}>{formatCurrency(totalIncome, currency)}</div>
            </div>
            <div style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "var(--muted, #64748b)", textTransform: "uppercase", letterSpacing: 0.5 }}>Expenses</div>
              <div style={{ fontWeight: 700, color: "var(--error, #ef4444)", fontSize: 13 }}>{formatCurrency(totalExpenses, currency)}</div>
            </div>
            <div style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "var(--muted, #64748b)", textTransform: "uppercase", letterSpacing: 0.5 }}>Savings Rate</div>
              <div style={{ fontWeight: 700, color: savingsRate >= 40 ? "var(--primary, #16a34a)" : "var(--warning, #f59e0b)", fontSize: 13 }}>{savingsRate.toFixed(0)}%</div>
            </div>
          </div>
          <div style={{ fontWeight: 600, color: "var(--text-color, #1e293b)", fontSize: 12, marginBottom: 8 }}>Top Expenses</div>
          {topExpenses.length === 0 ? (
            <div style={{ color: "var(--muted, #94a3b8)", fontSize: 12 }}>Add expense entries to see spending split.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {topExpenses.map((ex) => {
                const widthPct = topExpensesTotal > 0 ? Math.max(8, (ex.amount / topExpensesTotal) * 100) : 0;
                return (
                  <div key={ex.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: "var(--text-color, #1e293b)" }}>{ex.name}</span>
                      <span style={{ fontSize: 12, color: "var(--muted, #64748b)" }}>{formatCurrency(ex.amount, ex.currency)}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: "var(--muted-bg, #f1f5f9)" }}>
                      <div style={{ height: "100%", width: `${widthPct}%`, borderRadius: 99, background: "var(--error, #ef4444)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 12 }}>Portfolio Health</div>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--muted, #64748b)" }}>Asset Classes</span>
              <span style={{ color: "var(--text-color, #1e293b)", fontWeight: 700 }}>{allocationData.length}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--muted, #64748b)" }}>Currencies</span>
              <span style={{ color: "var(--text-color, #1e293b)", fontWeight: 700 }}>{trackedCurrencies || 1}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--muted, #64748b)" }}>Snapshots</span>
              <span style={{ color: "var(--text-color, #1e293b)", fontWeight: 700 }}>{snapshots.length}</span>
            </div>
            <div style={{ paddingTop: 4, borderTop: "1px solid var(--border, #e2e8f0)" }}>
              <div style={{ fontSize: 11, color: "var(--muted, #64748b)", marginBottom: 6 }}>Essentials Check</div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span>Term Insurance</span>
                  <span style={{ color: "var(--primary, #16a34a)", fontWeight: 700 }}>Covered</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span>Health Cover</span>
                  <span style={{ color: "var(--primary, #16a34a)", fontWeight: 700 }}>Covered</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span>Emergency Fund</span>
                  <span style={{ color: totalExpenses > 0 ? "var(--warning, #f59e0b)" : "var(--muted, #64748b)", fontWeight: 700 }}>
                    {totalExpenses > 0 ? "Needs attention" : "Not set"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Snapshot Reminder */}
      {snapshots.length === 0 && (
        <div
          style={{
            background: "var(--info-bg, #eff6ff)",
            borderRadius: 14,
            padding: "16px 20px",
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ fontSize: 24 }}>📸</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "var(--info, #1e40af)", fontSize: 14 }}>You haven't taken a snapshot yet.</div>
            <div style={{ color: "var(--info, #3b82f6)", fontSize: 13 }}>Take one to record your current net worth.</div>
          </div>
          <button onClick={onSnapshot} style={{ ...btnStyle, padding: "8px 16px", fontSize: 13 }}>
            Go to Net Worth
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, sub, color, negative }) {
  return (
    <div style={{ ...cardStyle, display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
        <div style={{ fontFamily: serifFontFamily, fontSize: 26, fontWeight: 700, color: negative ? "var(--error)" : "var(--text-color)" }}>{value}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function AssetsPage({ assets, currency, onAdd, onDelete }) {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedType, setSelectedType] = useState("stocks");
  const [pickingType, setPickingType] = useState(true);
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)" }}>Assets</h2>
          <p style={{ color: "var(--muted, #64748b)", fontSize: 14 }}>Total: {formatCurrency(totalAssets, currency)}</p>
        </div>
        <button onClick={() => { setShowAdd(true); setPickingType(true); }} style={btnStyle}>+ Add Asset</button>
      </div>

      {showAdd && (
        <div style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
          {pickingType ? (
            <>
              <h3 style={{ fontWeight: 700, marginBottom: 16, color: "var(--text-color, #1e293b)" }}>Select asset type</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
                {ASSET_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedType(t.id); setPickingType(false); }}
                    style={{ background: "var(--bg-light, #f8fafc)", border: "1.5px solid var(--border, #e2e8f0)", borderRadius: 10, padding: "12px 8px", cursor: "pointer", textAlign: "center", fontSize: 12, color: "var(--text-color, #334155)" }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{t.icon}</div>
                    {t.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAdd(false)} style={{ ...btnStyle, background: "var(--muted-bg, #f1f5f9)", color: "var(--muted, #64748b)" }}>Cancel</button>
            </>
          ) : (
            <AddAssetForm
              typeId={selectedType}
              onSave={(a) => { onAdd(a); setShowAdd(false); }}
              onCancel={() => setPickingType(true)}
            />
          )}
        </div>
      )}

      {assets.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏛️</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--muted, #64748b)" }}>No assets yet</div>
          <div>Add your first asset to start tracking your wealth</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {ASSET_TYPES.filter((t) => assets.some((a) => a.typeId === t.id)).map((type) => {
            const grouped = assets.filter((a) => a.typeId === type.id);
            const total = grouped.reduce((s, a) => s + a.value, 0);
            return (
              <div key={type.id} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 22 }}>{type.icon}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, color: "var(--text-color, #1e293b)" }}>{type.label}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: "#16a34a" }}>{formatCurrency(total, currency)}</span>
                </div>
                {grouped.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--muted-bg, #f1f5f9)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: "var(--text-color, #334155)", fontSize: 14 }}>{a.name}</div>
                      {a.notes && <div style={{ fontSize: 12, color: "#94a3b8" }}>{a.notes}</div>}
                    </div>
                    <span style={{ fontWeight: 600, color: "var(--text-color, #1e293b)" }}>{formatCurrency(a.value, a.currency)}</span>
                    <button onClick={() => onDelete(a.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>✕</button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LiabilitiesPage({ liabilities, currency, onAdd, onDelete }) {
  const [showAdd, setShowAdd] = useState(false);
  const total = liabilities.reduce((s, l) => s + l.value, 0);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)" }}>Liabilities</h2>
          <p style={{ color: "var(--muted, #64748b)", fontSize: 14 }}>Total: <span style={{ color: "#ef4444" }}>{formatCurrency(total, currency)}</span></p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ ...btnStyle, background: "#ef4444" }}>+ Add Liability</button>
      </div>

      {showAdd && (
        <div style={{ marginBottom: 24 }}>
          <AddLiabilityForm
            onSave={(l) => { onAdd(l); setShowAdd(false); }}
            onCancel={() => setShowAdd(false)}
          />
        </div>
      )}

      {liabilities.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--muted, #64748b)" }}>No liabilities!</div>
          <div>You're debt free or haven't added any loans yet</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {liabilities.map((l) => (
            <div key={l.id} style={{ ...cardStyle, display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fff5f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{l.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)" }}>{l.name}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{l.label} {l.interest > 0 ? ` - ${l.interest}% p.a.` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: "#ef4444", fontSize: 18 }}>{formatCurrency(l.value, l.currency)}</div>
              </div>
              <button onClick={() => onDelete(l.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, padding: "0 4px" }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IncomePage({ incomes, currency, onAdd, onDelete, onImport }) {
  const total = incomes.reduce((s, i) => s + i.amount, 0);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const importInputRef = useRef(null);

  const save = () => {
    const n = sanitizeInput(name, 'text');
    const a = sanitizeInput(amount, 'number');
    if (!n || a <= 0) return alert('Enter valid income name and positive amount');
    onAdd({ id: Date.now(), name: n, amount: a, currency });
    setName(''); setAmount(''); setShowAdd(false);
  };

  const handleCsvImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsedEntries = await parseHdfcStatementFile(file);
      const creditEntries = parsedEntries.filter((entry) => entry.type === "credit" && entry.amount > 0);

      if (creditEntries.length === 0) {
        alert("No credit transactions found in this HDFC statement file.");
        return;
      }

      const importedEntries = creditEntries.map((entry, index) => ({
        id: Date.now() + index + Math.floor(Math.random() * 10000),
        name: sanitizeInput(entry.name, "text") || "Imported income",
        amount: sanitizeInput(entry.amount, "number"),
        currency,
      })).filter((entry) => entry.amount > 0);

      if (importedEntries.length === 0) {
        alert("No valid income rows could be imported from this file.");
        return;
      }

      onImport(importedEntries);
      alert(`Imported ${importedEntries.length} income entr${importedEntries.length === 1 ? "y" : "ies"} from HDFC statement.`);
    } catch (error) {
      alert("Unable to import this file. Please upload a valid HDFC statement (.csv/.xls/.xlsx).");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)" }}>Income</h2>
          <p style={{ color: "var(--muted, #64748b)", fontSize: 14 }}>Total: {formatCurrency(total, currency)}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleCsvImport}
            style={{ display: "none" }}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            style={{ ...buttonStyles.secondary, padding: "10px 14px", fontSize: 13 }}
          >
            Import HDFC Statement
          </button>
          <button onClick={() => setShowAdd(true)} style={btnStyle}>+ Add Income</button>
        </div>
      </div>

      {showAdd && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={labelStyle}>Source</label>
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Salary, Freelance" />
            </div>
            <div>
              <label style={labelStyle}>Amount</label>
              <input style={inputStyle} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAdd(false)} style={{ ...btnStyle, background: 'var(--muted-bg, #f1f5f9)', color: 'var(--muted, #64748b)', flex: 1 }}>Cancel</button>
              <button onClick={save} style={{ ...btnStyle, flex: 2 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {incomes.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💼</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--muted, #64748b)' }}>No income recorded</div>
          <div>Add recurring or one-time income to track cashflow</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {incomes.map((i) => (
            <div key={i.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-color, #1e293b)' }}>{i.name}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{i.currency}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontWeight: 700 }}>{formatCurrency(i.amount, i.currency)}</div>
                <button onClick={() => onDelete(i.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpensesPage({ expenses, currency, onAdd, onDelete, onImport }) {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const importInputRef = useRef(null);

  const save = () => {
    const n = sanitizeInput(name, 'text');
    const a = sanitizeInput(amount, 'number');
    if (!n || a <= 0) return alert('Enter valid expense name and positive amount');
    onAdd({ id: Date.now(), name: n, amount: a, currency });
    setName(''); setAmount(''); setShowAdd(false);
  };

  const handleCsvImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsedEntries = await parseHdfcStatementFile(file);
      const debitEntries = parsedEntries.filter((entry) => entry.type === "debit" && entry.amount > 0);

      if (debitEntries.length === 0) {
        alert("No debit transactions found in this HDFC statement file.");
        return;
      }

      const importedEntries = debitEntries.map((entry, index) => ({
        id: Date.now() + index + Math.floor(Math.random() * 10000),
        name: sanitizeInput(entry.name, "text") || "Imported expense",
        amount: sanitizeInput(entry.amount, "number"),
        currency,
      })).filter((entry) => entry.amount > 0);

      if (importedEntries.length === 0) {
        alert("No valid expense rows could be imported from this file.");
        return;
      }

      onImport(importedEntries);
      alert(`Imported ${importedEntries.length} expense entr${importedEntries.length === 1 ? "y" : "ies"} from HDFC statement.`);
    } catch (error) {
      alert("Unable to import this file. Please upload a valid HDFC statement (.csv/.xls/.xlsx).");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)" }}>Expenses</h2>
          <p style={{ color: "var(--muted, #64748b)", fontSize: 14 }}>Total: {formatCurrency(total, currency)}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleCsvImport}
            style={{ display: "none" }}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            style={{ ...buttonStyles.secondary, padding: "10px 14px", fontSize: 13 }}
          >
            Import HDFC Statement
          </button>
          <button onClick={() => setShowAdd(true)} style={{ ...btnStyle, background: '#ef4444' }}>+ Add Expense</button>
        </div>
      </div>

      {showAdd && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={labelStyle}>Expense</label>
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Groceries, Rent" />
            </div>
            <div>
              <label style={labelStyle}>Amount</label>
              <input style={inputStyle} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAdd(false)} style={{ ...btnStyle, background: 'var(--muted-bg, #f1f5f9)', color: 'var(--muted, #64748b)', flex: 1 }}>Cancel</button>
              <button onClick={save} style={{ ...btnStyle, flex: 2 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--muted, #64748b)' }}>No expenses recorded</div>
          <div>Add your expenses to track cashflow</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {expenses.map((e) => (
            <div key={e.id} style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-color, #1e293b)' }}>{e.name}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{e.currency}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontWeight: 700 }}>{formatCurrency(e.amount, e.currency)}</div>
                <button onClick={() => onDelete(e.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- ESSENTIALS PAGE ---------------------------------------------------------

function EssentialsPage({ assets, liabilities, expenses, currency }) {
  const monthlyBurn = expenses.reduce((s, e) => s + e.amount, 0);
  const emergencyTarget = monthlyBurn > 0 ? monthlyBurn * 6 : 500000;
  const emergencyCurrent = assets
    .filter((a) => a.typeId === "cash" || a.typeId === "fd")
    .reduce((s, a) => s + a.value, 0);
  const emergencyProgress = emergencyTarget > 0 ? Math.min((emergencyCurrent / emergencyTarget) * 100, 100) : 0;

  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const estimatedTermCover = assets.reduce((s, a) => s + a.value, 0) * 0.45;
  const termCoverTarget = Math.max(totalLiabilities * 3, 10000000); // 1Cr minimum guideline
  const termCovered = estimatedTermCover >= termCoverTarget;

  const healthCover = 1000000;
  const healthCoverTarget = 1000000;
  const healthCovered = healthCover >= healthCoverTarget;

  const essentials = [
    {
      title: "Term Insurance",
      status: termCovered ? "Covered" : "Needs attention",
      statusColor: termCovered ? "var(--primary, #16a34a)" : "var(--warning, #f59e0b)",
      detail: `${formatCurrency(estimatedTermCover, currency)} / ${formatCurrency(termCoverTarget, currency)} target`,
      icon: "🛡️",
    },
    {
      title: "Health Cover",
      status: healthCovered ? "Covered" : "Needs attention",
      statusColor: healthCovered ? "var(--primary, #16a34a)" : "var(--warning, #f59e0b)",
      detail: `${formatCurrency(healthCover, currency)} family cover`,
      icon: "❤️",
    },
    {
      title: "Emergency Fund",
      status: emergencyProgress >= 100 ? "Covered" : "Needs attention",
      statusColor: emergencyProgress >= 100 ? "var(--primary, #16a34a)" : "var(--warning, #f59e0b)",
      detail: `${formatCurrency(emergencyCurrent, currency)} / ${formatCurrency(emergencyTarget, currency)} needed`,
      icon: "💧",
    },
  ];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 980 }}>
      <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>Essentials</h2>
      <p style={{ color: "var(--muted, #64748b)", marginBottom: 24 }}>Check if your financial safety net is complete.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        {essentials.map((item) => (
          <div key={item.title} style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", fontSize: 14 }}>{item.title}</div>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: item.statusColor, marginBottom: 6 }}>{item.status}</div>
            <div style={{ fontSize: 12, color: "var(--muted, #64748b)" }}>{item.detail}</div>
          </div>
        ))}
      </div>

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 12 }}>Emergency Fund Progress</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: "var(--muted, #64748b)" }}>Current</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-color, #1e293b)" }}>{formatCurrency(emergencyCurrent, currency)}</span>
        </div>
        <div style={{ background: "var(--muted-bg, #f1f5f9)", borderRadius: 100, height: 10 }}>
          <div style={{ width: `${emergencyProgress}%`, height: "100%", borderRadius: 100, background: emergencyProgress >= 100 ? "var(--primary, #16a34a)" : "var(--warning, #f59e0b)" }} />
        </div>
        <div style={{ fontSize: 12, color: "var(--muted, #64748b)", marginTop: 8 }}>
          {emergencyProgress.toFixed(1)}% of six-month buffer ({formatCurrency(emergencyTarget, currency)} target)
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 10 }}>Suggested next step</div>
        <div style={{ fontSize: 13, color: "var(--muted, #64748b)", lineHeight: 1.6 }}>
          {emergencyProgress < 100
            ? "Increase liquid reserves (cash/FD) first, then optimize long-term investments."
            : termCovered
            ? "Safety basics look good. Continue tracking monthly and review insurance once a year."
            : "Review term insurance coverage to keep family liabilities protected."}
        </div>
      </div>
    </div>
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
        <SummaryCard icon="🏛" label="TOTAL ASSETS" value={formatCurrency(totalAssets, currency)} sub={`${assets.length} assets`} color="#22c55e" />
        <SummaryCard icon="🧩" label="ASSET CLASSES" value={`${grouped.length}`} sub="Diversified buckets" color="#3b82f6" />
        <SummaryCard icon="🌍" label="CURRENCIES" value={`${currenciesTracked || 1}`} sub="Tracked across holdings" color="#8b5cf6" />
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

// -- IMPORT PAGE -------------------------------------------------------------

function ImportPage() {
  return (
    <div style={{ padding: "28px 32px", maxWidth: 980 }}>
      <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>Import Data</h2>
      <p style={{ color: "var(--muted, #64748b)", marginBottom: 24 }}>Bring your financial data from broker exports or CSV files.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 8 }}>Broker CSV Import</div>
          <div style={{ fontSize: 13, color: "var(--muted, #64748b)", lineHeight: 1.6, marginBottom: 14 }}>
            Upload holdings from brokers like Zerodha/Groww in CSV format. Data stays on your device.
          </div>
          <button style={{ ...btnStyle, width: "100%" }}>Upload CSV</button>
        </div>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 8 }}>Manual Template</div>
          <div style={{ fontSize: 13, color: "var(--muted, #64748b)", lineHeight: 1.6, marginBottom: 14 }}>
            Download the sample template, fill asset/liability rows, and import in one shot.
          </div>
          <button style={{ ...btnStyle, width: "100%", background: "var(--muted-bg, #f1f5f9)", color: "var(--muted, #64748b)" }}>Download Template</button>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 10 }}>Import Checklist</div>
        <div style={{ display: "grid", gap: 8, fontSize: 13, color: "var(--muted, #64748b)" }}>
          <div>1. Keep columns as: type, name, value, currency, notes.</div>
          <div>2. Use numeric values only (no commas inside amounts).</div>
          <div>3. Validate totals after import in the Assets/Liabilities pages.</div>
        </div>
      </div>
    </div>
  );
}

function NetWorthPage({ assets, liabilities, currency, snapshots, onSnapshot }) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth = totalAssets - totalLiabilities;
  const c = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>Net Worth</h2>
      <p style={{ color: "var(--muted, #64748b)", marginBottom: 24 }}>Track your wealth journey over time</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <SummaryCard icon="🏛" label="TOTAL ASSETS" value={formatCurrency(totalAssets, currency)} sub={`${assets.length} assets`} color="#22c55e" />
        <SummaryCard icon="💳" label="TOTAL LIABILITIES" value={formatCurrency(totalLiabilities, currency)} sub={`${liabilities.length} debts`} color="#ef4444" negative />
        <SummaryCard icon="✨" label="NET WORTH" value={formatCurrency(netWorth, currency)} sub="Assets minus Liabilities" color="#3b82f6" />
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", fontSize: 16 }}>Wealth Timeline</div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>{snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} recorded</div>
          </div>
          <button onClick={onSnapshot} style={btnStyle}>📸 Take Snapshot</button>
        </div>
        {snapshots.length < 2 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
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
          {[...snapshots].reverse().map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: i > 0 ? "1px solid var(--muted-bg, #f1f5f9)" : "none" }}>
              <span style={{ color: "var(--muted, #64748b)", fontSize: 14 }}>{s.date}</span>
              <span style={{ fontWeight: 700, color: s.value >= 0 ? "#16a34a" : "#ef4444", fontSize: 16 }}>{c.symbol}{s.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalsPage({ assets, currency }) {
  const [goals, setGoals] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [icon, setIcon] = useState("🎯");
  const netWorth = assets.reduce((s, a) => s + a.value, 0);

  const addGoal = () => {
    // Security: Validate and sanitize inputs
    const sanitizedName = sanitizeInput(name, 'text');
    const sanitizedTarget = sanitizeInput(target, 'number');
    
    if (!sanitizedName || sanitizedTarget <= 0) {
      alert('Please enter valid goal name and positive target amount');
      return;
    }
    
    setGoals([...goals, { id: Date.now(), name: sanitizedName, target: sanitizedTarget, icon, current: netWorth }]);
    setName(""); setTarget(""); setShowAdd(false);
  };

  const goalIcons = GOAL_ICONS; // use shared constant

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)" }}>Financial Goals</h2>
          <p style={{ color: "var(--muted, #64748b)", fontSize: 14 }}>Set targets and track your progress</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={btnStyle}>+ New Goal</button>
      </div>

      {showAdd && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 16 }}>Create Goal</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {goalIcons.map((ic) => (
              <button key={ic} onClick={() => setIcon(ic)} style={{ fontSize: 24, background: icon === ic ? "#f0fdf4" : "none", border: icon === ic ? "2px solid #16a34a" : "2px solid transparent", borderRadius: 8, padding: 6, cursor: "pointer" }}>{ic}</button>
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
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={() => setShowAdd(false)} style={{ ...btnStyle, background: "var(--muted-bg, #f1f5f9)", color: "var(--muted, #64748b)", flex: 1 }}>Cancel</button>
            <button onClick={addGoal} style={{ ...btnStyle, flex: 2 }}>Create Goal</button>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--muted, #64748b)" }}>No goals yet</div>
          <div>Set financial goals to track your progress</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {goals.map((g) => {
            const pct = Math.min((g.current / g.target) * 100, 100);
            return (
              <div key={g.id} style={cardStyle}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 36 }}>{g.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", fontSize: 16, marginBottom: 4 }}>{g.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: "var(--muted, #64748b)" }}>{formatCurrency(g.current, currency)} saved</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-color, #1e293b)" }}>{formatCurrency(g.target, currency)}</span>
                    </div>
                    <div style={{ background: "var(--muted-bg, #f1f5f9)", borderRadius: 100, height: 8 }}>
                      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 100, background: pct >= 100 ? "#22c55e" : "#16a34a", transition: "width 0.5s" }} />
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>{pct.toFixed(1)}% achieved</div>
                  </div>
                  <button onClick={() => setGoals(goals.filter((gg) => gg.id !== g.id))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InsightsPage({ assets, liabilities, currency }) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  const insights = [
    ...(debtRatio > 40 ? [{ icon: "⚠️", color: "#f59e0b", title: "High Debt Ratio", desc: `Your debt ratio is ${debtRatio.toFixed(1)}%. Aim to keep it below 40% for financial health.` }] : []),
    ...(assets.length === 0 ? [{ icon: "📊", color: "#3b82f6", title: "Start Tracking", desc: "Add your first asset to start building your financial picture." }] : []),
    ...(assets.length > 0 ? [{ icon: "✅", color: "#22c55e", title: "Tracking Active", desc: `You're tracking ${assets.length} asset${assets.length > 1 ? "s" : ""} worth ${formatCurrency(totalAssets, currency)}.` }] : []),
    ...(debtRatio < 20 && assets.length > 0 ? [{ icon: "🎉", color: "#16a34a", title: "Healthy Finances", desc: "Your debt ratio is excellent. Keep building your asset base!" }] : []),
    { icon: "💡", color: "#8b5cf6", title: "Diversification Tip", desc: "Consider spreading investments across stocks, real estate, and fixed income for stability." },
    { icon: "📸", color: "var(--muted, #64748b)", title: "Take Regular Snapshots", desc: "Monthly net worth snapshots help you see your wealth trajectory over time." },
  ];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>Insights</h2>
      <p style={{ color: "var(--muted, #64748b)", marginBottom: 24 }}>Smart observations about your financial health</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <SummaryCard
          icon="✨"
          label="NET WORTH"
          value={formatCurrency(netWorth, currency)}
          sub="Assets minus Liabilities"
          color="#3b82f6"
        />
        <SummaryCard
          icon="⚖️"
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

export default function App() {
  const isMobile = useIsMobile();
  const [phase, setPhase] = useState("onboarding"); // onboarding | app
  const [onboardStep, setOnboardStep] = useState(1);
  const [currency, setCurrency] = useState("INR");
  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [darkMode, setDarkMode] = useState(false);
  const [userName] = useState("Karthick");
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [mobileMenuSection, setMobileMenuSection] = useState(null);

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

  const takeSnapshot = () => {
    const total = assets.reduce((s, a) => s + a.value, 0) - liabilities.reduce((s, l) => s + l.value, 0);
    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
    setSnapshots((prev) => [...prev, { date: today, value: total }]);
    setActiveNav("networth");
  };

  const bg = darkMode ? "#0f172a" : "#f8fafc";
  const sidebarBg = darkMode ? "#1e293b" : "#fff";
  const textColor = darkMode ? "var(--text-color, #e2e8f0)" : "#1e293b";

  // Expose theme tokens via CSS variables so inline styles adapt to dark mode
  useEffect(() => {
    applyTheme(darkMode);
    const html = document.documentElement;
    const rootEl = document.getElementById("root");

    // Lock page-level scrolling; only the main app pane should scroll.
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

    // also apply to body for immediate background/text color
    document.body.style.background = bg;
    document.body.style.color = textColor;
  }, [darkMode, bg, textColor]);

  useEffect(() => {
    if (!isMobile) setMobileMenuSection(null);
  }, [isMobile]);

  // Section-based mobile nav
  const mobileSectionKeys = ["wealth", "plan", "money", "data"];
  const mobileNavSections = NAV_ITEMS.filter((section) =>
    mobileSectionKeys.includes(section.section.toLowerCase())
  );
  const mobileOtherItems = NAV_ITEMS.filter(
    (section) => !mobileSectionKeys.includes(section.section.toLowerCase())
  ).flatMap((section) => section.items);
  const mobileMenuItems =
    mobileMenuSection === "Other"
      ? mobileOtherItems
      : mobileNavSections.find((section) => section.section === mobileMenuSection)?.items || [];

  if (phase === "onboarding") {
    return (
      <div style={{ minHeight: "100dvh", background: onboardingGradient, display: "flex", alignItems: "center", justifyContent: "center", fontFamily, padding: 24 }}>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ width: "100%", maxWidth: 640, background: "var(--card-bg, #fff)", borderRadius: 24, padding: "52px 48px", boxShadow: "0 24px 80px rgba(0,0,0,0.08)" }}>
          {onboardStep === 1 && (
            <OnboardingStep1 onNext={() => setOnboardStep(2)} currency={currency} setCurrency={setCurrency} />
          )}
          {onboardStep === 2 && (
            <OnboardingStep2
              onNext={() => setOnboardStep(3)}
              onSkip={() => setOnboardStep(3)}
              onAddAsset={addAsset}
            />
          )}
          {onboardStep === 3 && (
            <OnboardingStep3 onFinish={() => setPhase("app")} />
          )}
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (activeNav) {
      case "dashboard": return <Dashboard assets={assets} liabilities={liabilities} incomes={incomes} expenses={expenses} currency={currency} snapshots={snapshots} onSnapshot={takeSnapshot} onAddAsset={() => setActiveNav("assets")} isMobile={isMobile} />;
      case "assets": return <AssetsPage assets={assets} currency={currency} onAdd={addAsset} onDelete={deleteAsset} />;
      case "liabilities": return <LiabilitiesPage liabilities={liabilities} currency={currency} onAdd={addLiability} onDelete={deleteLiability} />;
      case "networth": return <NetWorthPage assets={assets} liabilities={liabilities} currency={currency} snapshots={snapshots} onSnapshot={takeSnapshot} />;
      case "essentials": return <EssentialsPage assets={assets} liabilities={liabilities} expenses={expenses} currency={currency} />;
      case "goals": return <GoalsPage assets={assets} currency={currency} />;
      case "allocation": return <AllocationPage assets={assets} currency={currency} />;
      case "income": return <IncomePage incomes={incomes} currency={currency} onAdd={addIncome} onDelete={deleteIncome} onImport={importIncomeEntries} />;
      case "expenses": return <ExpensesPage expenses={expenses} currency={currency} onAdd={addExpense} onDelete={deleteExpense} onImport={importExpenseEntries} />;
      case "insights": return <InsightsPage assets={assets} liabilities={liabilities} currency={currency} />;
      case "import": return <ImportPage />;
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
                  <span>{darkMode ? "🌙" : "☀️"}</span>
                </button>
              </div>
              <div style={cardStyle}>
                <div style={{ fontWeight: 600, marginBottom: 12, color: "var(--text-color, #1e293b)" }}>Currency</div>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  style={{ ...inputStyle, width: "100%" }}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div style={{ padding: "28px 32px", color: "#94a3b8", textAlign: "center", paddingTop: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--muted, #64748b)" }}>{activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}</div>
            <div style={{ marginTop: 8, fontSize: 14 }}>Coming soon...</div>
          </div>
        );
    }
  };

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", fontFamily, background: bg, color: textColor, flexDirection: isMobile ? "column" : "row" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Sidebar - Hidden on mobile, show as bottom nav */}
      <div style={{ 
        width: isMobile ? "100%" : 220, 
        background: sidebarBg, 
        borderRight: isMobile ? "none" : "1px solid var(--border, #e2e8f0)",
        borderTop: isMobile ? "1px solid var(--border, #e2e8f0)" : "none",
        display: "flex", 
        flexDirection: isMobile ? "row" : "column", 
        flexShrink: 0, 
        overflowY: isMobile ? "hidden" : "auto",
        overflowX: "hidden",
        position: isMobile ? "fixed" : "static",
        top: isMobile ? "auto" : 0,
        bottom: isMobile ? 0 : "auto",
        left: 0,
        right: 0,
        zIndex: isMobile ? 100 : 1,
        height: isMobile ? 64 : "100%",
      }}>
        {/* Logo - Hide on mobile */}
        {!isMobile && (
          <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid var(--muted-bg, #f1f5f9)" }}>
            <div style={{ fontFamily: serifFontFamily, fontSize: 20, fontWeight: 700, color: "#16a34a" }}>
              Karthick Wealth
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: isMobile ? "0 6px" : "12px 0", display: "flex", flexDirection: isMobile ? "row" : "column", overflowX: "hidden", overflowY: isMobile ? "hidden" : "auto", alignItems: isMobile ? "center" : "stretch", justifyContent: isMobile ? "space-between" : "flex-start", gap: isMobile ? 4 : 0 }}>
          {isMobile
            ? (
              <>
                {mobileNavSections.map((section) => {
                  const isOpen = mobileMenuSection === section.section;
                  const isActive = section.items.some((item) => item.id === activeNav);
                  return (
                    <button
                      key={section.section}
                      onClick={() => setMobileMenuSection(isOpen ? null : section.section)}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "10px 6px",
                        background: "none",
                        border: "none",
                        borderBottom: isOpen || isActive ? "3px solid #16a34a" : "3px solid transparent",
                        color: isOpen || isActive ? "#16a34a" : "var(--muted, #64748b)",
                        fontWeight: isOpen || isActive ? 700 : 600,
                        cursor: "pointer",
                        fontSize: 11,
                        fontFamily: "inherit",
                        transition: "all 0.15s",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {section.section}
                    </button>
                  );
                })}
                <button
                  onClick={() => setMobileMenuSection(mobileMenuSection === "Other" ? null : "Other")}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px 6px",
                    background: "none",
                    border: "none",
                    borderBottom:
                      mobileMenuSection === "Other" || mobileOtherItems.some((item) => item.id === activeNav)
                        ? "3px solid #16a34a"
                        : "3px solid transparent",
                    color:
                      mobileMenuSection === "Other" || mobileOtherItems.some((item) => item.id === activeNav)
                        ? "#16a34a"
                        : "var(--muted, #64748b)",
                    fontWeight:
                      mobileMenuSection === "Other" || mobileOtherItems.some((item) => item.id === activeNav)
                        ? 700
                        : 600,
                    cursor: "pointer",
                    fontSize: 11,
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  Other
                </button>
              </>
            )
            : NAV_ITEMS.map((section) => (
                <div key={section.section} style={{ paddingTop: section === NAV_ITEMS[0] ? 0 : 8 }}>
                  <div
                    style={{
                      padding: "12px 20px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {section.section}
                  </div>
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveNav(item.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "9px 20px",
                        background: activeNav === item.id ? "#f0fdf4" : "none",
                        border: "none",
                        borderRight: activeNav === item.id ? "3px solid #16a34a" : "3px solid transparent",
                        color: activeNav === item.id ? "#16a34a" : "var(--muted, #64748b)",
                        fontWeight: activeNav === item.id ? 600 : 500,
                        cursor: "pointer",
                        textAlign: "left",
                        fontSize: 14,
                        fontFamily: "inherit",
                        transition: "all 0.15s",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
        </nav>

        {/* Bottom - Hide on mobile */}
        {!isMobile && (
          <div style={{ borderTop: "1px solid var(--muted-bg, #f1f5f9)", padding: "12px 0" }}>
            <button onClick={() => setDarkMode(!darkMode)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 20px", background: "none", border: "none", color: "var(--muted, #64748b)", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
              <span>{darkMode ? "☀️" : "🌙"}</span>
              Dark mode
            </button>
          </div>
        )}
      </div>

      {isMobile && mobileMenuSection && (
        <>
          <div
            onClick={() => setMobileMenuSection(null)}
            style={{ position: "fixed", inset: 0, zIndex: 95 }}
          />
          <div
            style={{
              position: "fixed",
              left: 12,
              right: 12,
              bottom: 72,
              zIndex: 101,
              borderRadius: 14,
              border: "1px solid var(--border, #e2e8f0)",
              background: "var(--card-bg, #fff)",
              boxShadow: "0 12px 28px rgba(0,0,0,0.2)",
              padding: 12,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted, #64748b)", letterSpacing: 0.4, marginBottom: 10, textTransform: "uppercase" }}>
              {mobileMenuSection === "Other" ? "Other Menus" : `${mobileMenuSection} Menus`}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {mobileMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveNav(item.id);
                    setMobileMenuSection(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 10px",
                    borderRadius: 10,
                    border: "1px solid var(--border, #e2e8f0)",
                    background: activeNav === item.id ? "var(--accent-bg, #f0fdf4)" : "var(--bg-light, #f8fafc)",
                    color: activeNav === item.id ? "var(--primary, #16a34a)" : "var(--text-color, #1e293b)",
                    fontSize: 13,
                    fontWeight: activeNav === item.id ? 700 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Main */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", paddingBottom: isMobile ? 80 : 0 }}>
        {/* Header */}
        <div style={{ position: "sticky", top: 0, background: sidebarBg, borderBottom: "1px solid var(--border, #e2e8f0)", padding: isMobile ? "0 16px" : "0 32px", display: "flex", alignItems: "center", justifyContent: isMobile ? "space-between" : "flex-end", height: 56, flexShrink: 0, zIndex: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>
              {userName[0]}
            </div>
            {!isMobile && <span style={{ fontWeight: 600, color: textColor }}>{userName}</span>}
          </div>

          {/* Mobile dark mode toggle */}
          {isMobile && (
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{
                background: "none",
                border: "none",
                color: "var(--muted, #64748b)",
                fontSize: 18,
                cursor: "pointer",
              }}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
          )}
        </div>

        {/* Page Content */}
        <div style={{ flex: 1, minHeight: 0 }}>{renderPage()}</div>
      </div>
    </div>
  );
}
