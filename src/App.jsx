import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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

const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
];

const ASSET_TYPES = [
  { id: "stocks", label: "Stocks & Equity", icon: "📈", color: "#22c55e" },
  { id: "mutual_funds", label: "Mutual Funds", icon: "🏦", color: "#3b82f6" },
  { id: "real_estate", label: "Real Estate", icon: "🏠", color: "#f97316" },
  { id: "gold", label: "Gold & Silver", icon: "🥇", color: "#eab308" },
  { id: "fd", label: "FD & RD", icon: "🏛️", color: "#8b5cf6" },
  { id: "bonds", label: "Bonds", icon: "📋", color: "#06b6d4" },
  { id: "crypto", label: "Crypto", icon: "₿", color: "#f59e0b" },
  { id: "epf", label: "EPF / PPF / NPS", icon: "🛡️", color: "#10b981" },
  { id: "cash", label: "Cash & Savings", icon: "💰", color: "#64748b" },
  { id: "other", label: "Other", icon: "📦", color: "#94a3b8" },
];

const LIABILITY_TYPES = [
  { id: "home_loan", label: "Home Loan", icon: "🏠" },
  { id: "car_loan", label: "Car Loan", icon: "🚗" },
  { id: "personal_loan", label: "Personal Loan", icon: "💳" },
  { id: "credit_card", label: "Credit Card", icon: "💳" },
  { id: "education_loan", label: "Education Loan", icon: "🎓" },
  { id: "other", label: "Other Debt", icon: "📋" },
];

const NAV_ITEMS = [
  { section: "OVERVIEW", items: [{ id: "dashboard", label: "Dashboard", icon: "⊞" }] },
  {
    section: "WEALTH",
    items: [
      { id: "assets", label: "Assets", icon: "🏛" },
      { id: "liabilities", label: "Liabilities", icon: "💳" },
      { id: "networth", label: "Net Worth", icon: "📈" },
    ],
  },
  {
    section: "PLAN",
    items: [
      { id: "goals", label: "Goals", icon: "🎯" },
      { id: "allocation", label: "Allocation", icon: "🕐" },
    ],
  },
  {
    section: "MONEY",
    items: [
      { id: "income", label: "Income", icon: "💼" },
      { id: "expenses", label: "Expenses", icon: "🛒" },
      { id: "insights", label: "Insights", icon: "📊" },
    ],
  },
];

// Security: Input validation and formatting utility
function formatCurrency(amount, currency) {
  // Validate amount is a number
  const numAmount = Number(amount);
  if (isNaN(numAmount)) return "₹0";
  
  const c = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];
  if (Math.abs(numAmount) >= 10000000) return `${c.symbol}${(numAmount / 10000000).toFixed(2)}Cr`;
  if (Math.abs(numAmount) >= 100000) return `${c.symbol}${(numAmount / 100000).toFixed(2)}L`;
  if (Math.abs(numAmount) >= 1000) return `${c.symbol}${(numAmount / 1000).toFixed(1)}K`;
  return `${c.symbol}${numAmount.toFixed(0)}`;
}

// Security: Input validation utility
function sanitizeInput(input, type = 'text') {
  if (!input) return '';
  const str = String(input).trim();
  
  if (type === 'number') {
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }
  
  if (type === 'text') {
    // Remove potentially harmful characters
    return str
      .replace(/[<>"']/g, '') // Remove HTML special chars
      .substring(0, 255); // Max length
  }
  
  return str;
}

// ── ONBOARDING ──────────────────────────────────────────────────────────────

function OnboardingStep1({ onNext, currency, setCurrency }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🌿</div>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: "#1a2e1a", marginBottom: 8 }}>
        Welcome to Karthick Wealth-tracker
      </h1>
      <p style={{ color: "#64748b", fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
        Your <strong>privacy-first</strong> net worth tracker. No broker connections, no third-party tracking.{" "}
        <em>Just you and your data.</em>
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 40 }}>
        {["🔒 Private & Secure", "🌍 Multi-Currency", "📊 Track Everything"].map((f) => (
          <span
            key={f}
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
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
      <div style={{ background: "#f8fafc", borderRadius: 16, padding: 24, marginBottom: 32, textAlign: "left" }}>
        <label style={{ display: "block", fontWeight: 600, color: "#334155", marginBottom: 8 }}>
          Choose your base currency
        </label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            border: "1.5px solid #e2e8f0",
            fontSize: 15,
            color: "#1e293b",
            background: "#fff",
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
        Get Started →
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
                background: s === 1 ? "#16a34a" : "#e2e8f0",
              }}
            />
          ))}
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: "#1a2e1a", marginBottom: 6 }}>
          Add your assets
        </h2>
        <p style={{ color: "#64748b", fontSize: 14 }}>
          Import from your broker or add manually. You can always do this later.
        </p>
      </div>

      <div
        style={{
          border: "1.5px dashed #bbf7d0",
          background: "#f0fdf4",
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
          <div style={{ fontWeight: 600, color: "#166534", marginBottom: 2 }}>Import from Broker</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Upload CSV/Excel from Zerodha, Groww, or any broker</div>
        </div>
        <button
          style={{
            background: "#fff",
            border: "1.5px solid #16a34a",
            color: "#16a34a",
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
        <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
        <span style={{ color: "#94a3b8", fontSize: 13 }}>or add manually</span>
        <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
      </div>

      {!showForm ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {primaryTypes.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t.id)}
                style={{
                  background: "#fff",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "14px 10px",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s",
                  fontSize: 13,
                  color: "#334155",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = t.color;
                  e.currentTarget.style.background = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.background = "#fff";
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
              border: "1.5px solid #e2e8f0",
              borderRadius: 8,
              padding: "10px 20px",
              cursor: "pointer",
              color: "#64748b",
              fontSize: 13,
              width: "100%",
              marginBottom: 16,
            }}
          >
            {showMore ? "Show less ↑" : "More asset types... ↓"}
          </button>
          {showMore && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {moreTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t.id)}
                  style={{
                    background: "#f8fafc",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: 20,
                    padding: "6px 14px",
                    cursor: "pointer",
                    fontSize: 13,
                    color: "#334155",
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
        <button onClick={onSkip} style={{ ...btnStyle, background: "#f1f5f9", color: "#64748b", flex: 1 }}>
          Skip for now
        </button>
        <button onClick={onNext} style={{ ...btnStyle, flex: 2 }}>
          Continue →
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
    <div style={{ background: "#f8fafc", borderRadius: 14, padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 28 }}>{type.icon}</span>
        <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 16 }}>{type.label}</span>
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
        <button onClick={onCancel} style={{ ...btnStyle, background: "#fff", color: "#64748b", border: "1.5px solid #e2e8f0", flex: 1 }}>Cancel</button>
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
      <h3 style={{ fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Add Liability</h3>
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
        <button onClick={onCancel} style={{ ...btnStyle, background: "#fff", color: "#64748b", border: "1.5px solid #e2e8f0", flex: 1 }}>Cancel</button>
        <button onClick={handleSave} style={{ ...btnStyle, background: "#ef4444", flex: 2 }}>Save Liability</button>
      </div>
    </div>
  );
}

function OnboardingStep3({ onFinish }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 440, margin: "0 auto" }}>
      <div style={{ fontSize: 72, marginBottom: 20 }}>🎉</div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1a2e1a", marginBottom: 12 }}>
        You're all set!
      </h2>
      <p style={{ color: "#64748b", lineHeight: 1.7, marginBottom: 32 }}>
        Your personal wealth tracker is ready. Start tracking your net worth, set financial goals, and gain insights into your financial health — all privately, just on your device.
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
            style={{ background: "#f8fafc", borderRadius: 12, padding: 16, border: "1px solid #e2e8f0" }}
          >
            <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
            <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 14 }}>{f.title}</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{f.desc}</div>
          </div>
        ))}
      </div>
      <button onClick={onFinish} style={btnStyle}>
        Go to Dashboard →
      </button>
    </div>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────

function Dashboard({ assets, liabilities, currency, snapshots, onSnapshot, onAddAsset, isMobile }) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
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

  return (
    <div style={{ padding: isMobile ? "16px 16px" : "28px 32px", maxWidth: 1100, paddingBottom: isMobile ? 80 : 0 }}>
      {/* Net Worth Hero */}
      <div
        style={{
          background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)",
          borderRadius: 20,
          padding: isMobile ? "20px 16px" : "28px 32px",
          marginBottom: 20,
          border: "1px solid #bbf7d0",
          position: "relative",
        }}
      >
        <div style={{ color: "#64748b", fontSize: isMobile ? 10 : 12, fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>
          NET WORTH · {c.symbol} {currency}
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: isMobile ? 36 : 52, color: "#14532d", fontWeight: 700 }}>
          {c.symbol}{netWorth.toLocaleString()}
        </div>
        <div style={{ position: isMobile ? "static" : "absolute", top: 28, right: 32, textAlign: isMobile ? "left" : "right", marginTop: isMobile ? 12 : 0 }}>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>{today}</div>
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
            Take a snapshot →
          </button>
        </div>
      </div>

      {/* Add Asset Banner */}
      {assets.length === 0 && (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
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
        <SummaryCard icon="💳" label="TOTAL LIABILITIES" value={formatCurrency(totalLiabilities, currency)} sub={`${liabilities.length} active loans`} color="#ef4444" negative />
        <SummaryCard
          icon="⚖️"
          label="DEBT RATIO"
          value={`${debtRatio.toFixed(1)}%`}
          sub={debtRatio < 30 ? "Healthy" : debtRatio < 60 ? "Moderate" : "High"}
          color={debtRatio < 30 ? "#22c55e" : debtRatio < 60 ? "#f59e0b" : "#ef4444"}
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Net Worth Over Time</div>
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
                <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2.5} dot={{ fill: "#16a34a", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Asset Allocation</div>
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
                    <span style={{ flex: 1, color: "#64748b" }}>{d.name}</span>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>{formatCurrency(d.value, currency)}</span>
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
          <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>Top Holdings</div>
          {topHoldings.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", paddingTop: 24 }}>Add assets to see top holdings</div>
          ) : (
            topHoldings.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{a.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>{a.name}</div>
                  <div style={{ color: "#94a3b8", fontSize: 11 }}>{a.label}</div>
                </div>
                <span style={{ fontWeight: 700, color: "#16a34a", fontSize: 13 }}>{formatCurrency(a.value, a.currency)}</span>
              </div>
            ))
          )}
        </div>
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: "#1e293b" }}>
              {new Date().toLocaleString("en-IN", { month: "long" })} Cashflow
            </div>
            <span style={{ color: "#16a34a", fontSize: 13, cursor: "pointer" }}>Details →</span>
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", paddingTop: 24 }}>No transactions recorded this month</div>
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <span style={{ color: "#16a34a", fontSize: 13, cursor: "pointer" }}>Add income & expenses →</span>
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: "#1e293b" }}>Goals</div>
            <span style={{ color: "#16a34a", fontSize: 13, cursor: "pointer" }}>Manage →</span>
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", paddingTop: 24 }}>Set goals to track your progress</div>
        </div>
      </div>

      {/* Snapshot Reminder */}
      {snapshots.length === 0 && (
        <div
          style={{
            background: "#eff6ff",
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
            <div style={{ fontWeight: 700, color: "#1e40af", fontSize: 14 }}>You haven't taken a snapshot yet.</div>
            <div style={{ color: "#3b82f6", fontSize: 13 }}>Take one to record your current net worth.</div>
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
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: negative ? "#ef4444" : "#1e293b" }}>{value}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

// ── ASSETS PAGE ──────────────────────────────────────────────────────────────

function AssetsPage({ assets, currency, onAdd, onDelete }) {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedType, setSelectedType] = useState("stocks");
  const [pickingType, setPickingType] = useState(true);
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1a2e1a" }}>Assets</h2>
          <p style={{ color: "#64748b", fontSize: 14 }}>Total: {formatCurrency(totalAssets, currency)}</p>
        </div>
        <button onClick={() => { setShowAdd(true); setPickingType(true); }} style={btnStyle}>+ Add Asset</button>
      </div>

      {showAdd && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, marginBottom: 24 }}>
          {pickingType ? (
            <>
              <h3 style={{ fontWeight: 700, marginBottom: 16, color: "#1e293b" }}>Select asset type</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
                {ASSET_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedType(t.id); setPickingType(false); }}
                    style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "12px 8px", cursor: "pointer", textAlign: "center", fontSize: 12, color: "#334155" }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{t.icon}</div>
                    {t.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowAdd(false)} style={{ ...btnStyle, background: "#f1f5f9", color: "#64748b" }}>Cancel</button>
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
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#64748b" }}>No assets yet</div>
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
                    <span style={{ fontWeight: 700, color: "#1e293b" }}>{type.label}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: "#16a34a" }}>{formatCurrency(total, currency)}</span>
                </div>
                {grouped.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: "#334155", fontSize: 14 }}>{a.name}</div>
                      {a.notes && <div style={{ fontSize: 12, color: "#94a3b8" }}>{a.notes}</div>}
                    </div>
                    <span style={{ fontWeight: 600, color: "#1e293b" }}>{formatCurrency(a.value, a.currency)}</span>
                    <button onClick={() => onDelete(a.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>×</button>
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

// ── LIABILITIES PAGE ─────────────────────────────────────────────────────────

function LiabilitiesPage({ liabilities, currency, onAdd, onDelete }) {
  const [showAdd, setShowAdd] = useState(false);
  const total = liabilities.reduce((s, l) => s + l.value, 0);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1a2e1a" }}>Liabilities</h2>
          <p style={{ color: "#64748b", fontSize: 14 }}>Total: <span style={{ color: "#ef4444" }}>{formatCurrency(total, currency)}</span></p>
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
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#64748b" }}>No liabilities!</div>
          <div>You're debt free or haven't added any loans yet</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {liabilities.map((l) => (
            <div key={l.id} style={{ ...cardStyle, display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fff5f5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{l.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#1e293b" }}>{l.name}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{l.label} {l.interest > 0 ? `· ${l.interest}% p.a.` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: "#ef4444", fontSize: 18 }}>{formatCurrency(l.value, l.currency)}</div>
              </div>
              <button onClick={() => onDelete(l.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, padding: "0 4px" }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── NET WORTH PAGE ───────────────────────────────────────────────────────────

function NetWorthPage({ assets, liabilities, currency, snapshots, onSnapshot }) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth = totalAssets - totalLiabilities;
  const c = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1a2e1a", marginBottom: 8 }}>Net Worth</h2>
      <p style={{ color: "#64748b", marginBottom: 24 }}>Track your wealth journey over time</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <SummaryCard icon="🏛" label="TOTAL ASSETS" value={formatCurrency(totalAssets, currency)} sub={`${assets.length} assets`} color="#22c55e" />
        <SummaryCard icon="💳" label="TOTAL LIABILITIES" value={formatCurrency(totalLiabilities, currency)} sub={`${liabilities.length} debts`} color="#ef4444" negative />
        <SummaryCard icon="✨" label="NET WORTH" value={formatCurrency(netWorth, currency)} sub="Assets minus Liabilities" color="#3b82f6" />
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 16 }}>Wealth Timeline</div>
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
              <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={3} dot={{ fill: "#16a34a", r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {snapshots.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Snapshot History</div>
          {[...snapshots].reverse().map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: i > 0 ? "1px solid #f1f5f9" : "none" }}>
              <span style={{ color: "#64748b", fontSize: 14 }}>{s.date}</span>
              <span style={{ fontWeight: 700, color: s.value >= 0 ? "#16a34a" : "#ef4444", fontSize: 16 }}>{c.symbol}{s.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── GOALS PAGE ───────────────────────────────────────────────────────────────

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

  const goalIcons = ["🎯", "🏠", "🚗", "✈️", "🎓", "💍", "🌏", "💼", "🏖️"];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1a2e1a" }}>Financial Goals</h2>
          <p style={{ color: "#64748b", fontSize: 14 }}>Set targets and track your progress</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={btnStyle}>+ New Goal</button>
      </div>

      {showAdd && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, color: "#1e293b", marginBottom: 16 }}>Create Goal</h3>
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
            <button onClick={() => setShowAdd(false)} style={{ ...btnStyle, background: "#f1f5f9", color: "#64748b", flex: 1 }}>Cancel</button>
            <button onClick={addGoal} style={{ ...btnStyle, flex: 2 }}>Create Goal</button>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#64748b" }}>No goals yet</div>
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
                    <div style={{ fontWeight: 700, color: "#1e293b", fontSize: 16, marginBottom: 4 }}>{g.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: "#64748b" }}>{formatCurrency(g.current, currency)} saved</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{formatCurrency(g.target, currency)}</span>
                    </div>
                    <div style={{ background: "#f1f5f9", borderRadius: 100, height: 8 }}>
                      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 100, background: pct >= 100 ? "#22c55e" : "#16a34a", transition: "width 0.5s" }} />
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>{pct.toFixed(1)}% achieved</div>
                  </div>
                  <button onClick={() => setGoals(goals.filter((gg) => gg.id !== g.id))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── INSIGHTS PAGE ─────────────────────────────────────────────────────────────

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
    { icon: "📸", color: "#64748b", title: "Take Regular Snapshots", desc: "Monthly net worth snapshots help you see your wealth trajectory over time." },
  ];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "#1a2e1a", marginBottom: 8 }}>Insights</h2>
      <p style={{ color: "#64748b", marginBottom: 24 }}>Smart observations about your financial health</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ ...cardStyle, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>Net Worth</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: "#14532d", fontWeight: 700 }}>{formatCurrency(netWorth, currency)}</div>
        </div>
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>Debt Ratio</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, color: debtRatio < 30 ? "#16a34a" : "#ef4444", fontWeight: 700 }}>{debtRatio.toFixed(1)}%</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{debtRatio < 20 ? "Excellent" : debtRatio < 40 ? "Good" : debtRatio < 60 ? "Moderate" : "High"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ ...cardStyle, display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${ins.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{ins.icon}</div>
            <div>
              <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{ins.title}</div>
              <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>{ins.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SHARED STYLES ────────────────────────────────────────────────────────────

const btnStyle = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px 24px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "inherit",
};

const cardStyle = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: "20px",
};

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1.5px solid #e2e8f0",
  fontSize: 14,
  color: "#1e293b",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const labelStyle = {
  display: "block",
  fontWeight: 600,
  color: "#475569",
  fontSize: 13,
  marginBottom: 6,
};

// ── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const isMobile = useIsMobile();
  const [phase, setPhase] = useState("onboarding"); // onboarding | app
  const [onboardStep, setOnboardStep] = useState(1);
  const [currency, setCurrency] = useState("INR");
  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [darkMode, setDarkMode] = useState(false);
  const [userName] = useState("Karthick");
  const [showAddAsset, setShowAddAsset] = useState(false);

  const addAsset = (a) => setAssets((prev) => [...prev, a]);
  const deleteAsset = (id) => setAssets((prev) => prev.filter((a) => a.id !== id));
  const addLiability = (l) => setLiabilities((prev) => [...prev, l]);
  const deleteLiability = (id) => setLiabilities((prev) => prev.filter((l) => l.id !== id));

  const takeSnapshot = () => {
    const total = assets.reduce((s, a) => s + a.value, 0) - liabilities.reduce((s, l) => s + l.value, 0);
    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
    setSnapshots((prev) => [...prev, { date: today, value: total }]);
    setActiveNav("networth");
  };

  const bg = darkMode ? "#0f172a" : "#f8fafc";
  const sidebarBg = darkMode ? "#1e293b" : "#fff";
  const textColor = darkMode ? "#e2e8f0" : "#1e293b";

  if (phase === "onboarding") {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0fdf4 0%, #fff 60%, #f0f9ff 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 24 }}>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <div style={{ width: "100%", maxWidth: 640, background: "#fff", borderRadius: 24, padding: "52px 48px", boxShadow: "0 24px 80px rgba(0,0,0,0.08)" }}>
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
      case "dashboard": return <Dashboard assets={assets} liabilities={liabilities} currency={currency} snapshots={snapshots} onSnapshot={takeSnapshot} onAddAsset={() => setActiveNav("assets")} isMobile={isMobile} />;
      case "assets": return <AssetsPage assets={assets} currency={currency} onAdd={addAsset} onDelete={deleteAsset} />;
      case "liabilities": return <LiabilitiesPage liabilities={liabilities} currency={currency} onAdd={addLiability} onDelete={deleteLiability} />;
      case "networth": return <NetWorthPage assets={assets} liabilities={liabilities} currency={currency} snapshots={snapshots} onSnapshot={takeSnapshot} />;
      case "goals": return <GoalsPage assets={assets} currency={currency} />;
      case "insights": return <InsightsPage assets={assets} liabilities={liabilities} currency={currency} />;
      default:
        return (
          <div style={{ padding: "28px 32px", color: "#94a3b8", textAlign: "center", paddingTop: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#64748b" }}>{activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}</div>
            <div style={{ marginTop: 8, fontSize: 14 }}>Coming soon...</div>
          </div>
        );
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", background: bg, color: textColor, flexDirection: isMobile ? "column" : "row" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Sidebar - Hidden on mobile, show as bottom nav */}
      <div style={{ 
        width: isMobile ? "100%" : 220, 
        background: sidebarBg, 
        borderRight: isMobile ? "none" : "1px solid #e2e8f0",
        borderTop: isMobile ? "1px solid #e2e8f0" : "none",
        display: "flex", 
        flexDirection: isMobile ? "row" : "column", 
        flexShrink: 0, 
        overflowY: isMobile ? "hidden" : "auto",
        overflowX: isMobile ? "auto" : "hidden",
        position: isMobile ? "fixed" : "static",
        bottom: isMobile ? 0 : "auto",
        left: 0,
        right: 0,
        zIndex: isMobile ? 100 : "auto",
        height: isMobile ? "auto" : "100vh",
      }}>
        {/* Logo - Hide on mobile */}
        {!isMobile && (
          <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#16a34a" }}>
              Karthick Wealth
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: isMobile ? "0" : "12px 0", display: "flex", flexDirection: isMobile ? "row" : "column", overflowX: isMobile ? "auto" : "visible" }}>
          {NAV_ITEMS.reduce((acc, section) => [...acc, ...section.items], []).slice(0, 6).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: isMobile ? "center" : "flex-start",
                gap: isMobile ? 0 : 10,
                width: isMobile ? "auto" : "100%",
                padding: isMobile ? "12px 16px" : "9px 20px",
                background: activeNav === item.id ? (isMobile ? "none" : "#f0fdf4") : "none",
                border: "none",
                borderRight: isMobile ? "none" : activeNav === item.id ? "3px solid #16a34a" : "3px solid transparent",
                borderBottom: isMobile ? activeNav === item.id ? "3px solid #16a34a" : "3px solid transparent" : "none",
                color: activeNav === item.id ? "#16a34a" : "#64748b",
                fontWeight: activeNav === item.id ? 700 : 500,
                cursor: "pointer",
                textAlign: "center",
                fontSize: 14,
                fontFamily: "inherit",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {!isMobile && item.label}
            </button>
          ))}
        </nav>

        {/* Bottom - Hide on mobile */}
        {!isMobile && (
          <div style={{ borderTop: "1px solid #f1f5f9", padding: "12px 0" }}>
            <button onClick={() => setDarkMode(!darkMode)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 20px", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
              <span>{darkMode ? "☀️" : "🌙"}</span>
              Dark mode
            </button>
          </div>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", paddingBottom: isMobile ? 60 : 0 }}>
        {/* Header */}
        <div style={{ background: sidebarBg, borderBottom: "1px solid #e2e8f0", padding: isMobile ? "0 16px" : "0 32px", display: "flex", alignItems: "center", justifyContent: isMobile ? "space-between" : "flex-end", height: 56, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>
              {userName[0]}
            </div>
            {!isMobile && <span style={{ fontWeight: 600, color: textColor }}>{userName}</span>}
          </div>
        </div>

        {/* Page Content */}
        <div style={{ flex: 1 }}>{renderPage()}</div>
      </div>
    </div>
  );
}
