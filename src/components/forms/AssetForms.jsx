import { useState, useMemo, useRef, useEffect } from "react";
import { ASSET_TYPES, CURRENCIES, LIABILITY_TYPES } from "../../constants";
import { buttonStyles, inputStyle as sharedInputStyle, labelStyle as sharedLabelStyle } from "../../styles";
import { sanitizeInput } from "../../utils/security";
import { calcOutstanding, calcEndDate } from "../../utils/liabilityCalc";
import { openGoogleFinance, getCachedPrice, setCachedPrice, formatUpdatedAt } from "../../services/priceService";
import { NSE_STOCKS } from "../../data/nseStocks";


const TOAST_EVENT_NAME = "wealthtracker:toast";
const btnStyle = buttonStyles.primary;
const inputStyle = sharedInputStyle;
const labelStyle = sharedLabelStyle;

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

/* ─── Small reusable P&L preview panel ──────────────────────────────────── */
function PnlPreview({ label, invested, currentValue, currency = "INR" }) {
  if (invested <= 0 && currentValue <= 0) return null;
  const pnl = currentValue - invested;
  const pct = invested > 0 ? ((pnl / invested) * 100).toFixed(2) : null;
  const isPositive = pnl >= 0;
  const fmtINR = (v) => `₹${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 10,
        padding: "10px 14px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 8,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>Total Invested</div>
        <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{fmtINR(invested)}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>Current Value</div>
        <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{fmtINR(currentValue)}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>P&L</div>
        <div style={{ fontWeight: 700, color: isPositive ? "#22c55e" : "#ef4444" }}>
          {isPositive ? "+" : "-"}{fmtINR(pnl)}
          {pct !== null && <span style={{ fontSize: 11, marginLeft: 4 }}>({isPositive ? "+" : ""}{pct}%)</span>}
        </div>
      </div>
    </div>
  );
}

/* ─── Google Finance fetch button ──────────────────────────────────────── */
function FetchPriceButton({ symbol, exchange, onPriceSet }) {
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => {
    if (!symbol) return null;
    const c = getCachedPrice(symbol, exchange);
    return c ? c.updatedAt : null;
  });

  const handleFetch = () => {
    if (!symbol) {
      notifyApp("Enter a stock symbol first.", "error");
      return;
    }
    setLoading(true);
    const result = openGoogleFinance(symbol, exchange);
    if (result.cached && result.price > 0) {
      onPriceSet(result.price);
      setLastUpdated(result.updatedAt);
      notifyApp(`Loaded cached price ₹${result.price} for ${symbol}`, "success");
    } else {
      notifyApp(`Opened Google Finance for ${symbol}:${exchange} — enter the price manually.`, "info");
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={handleFetch}
        style={{
          ...buttonStyles.secondary,
          padding: "6px 12px",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>🔗</span>
        {loading ? "Opening…" : "Google Finance"}
      </button>
      {lastUpdated && (
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
          cached {formatUpdatedAt(lastUpdated)}
        </span>
      )}
    </div>
  );
}

/* ─── StocksForm (typeId = "stocks") ───────────────────────────────────── */
function StocksForm({ onSave, onCancel, editData }) {
  const [stockName, setStockName] = useState(editData?.stockName || "");
  const [symbol, setSymbol] = useState(editData?.symbol || "");
  const [exchange, setExchange] = useState(editData?.exchange || "NSE");
  const [shares, setShares] = useState(editData?.shares?.toString() || "");
  const [avgPrice, setAvgPrice] = useState(editData?.avgPrice?.toString() || "");
  const [cmp, setCmp] = useState(editData?.cmp?.toString() || "");
  const [notes, setNotes] = useState(editData?.notes || "");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef(null);

  // Autocomplete filtering
  useEffect(() => {
    const q = stockName.trim().toLowerCase();
    if (!q || q.length < 2) { setSuggestions([]); return; }
    const matches = NSE_STOCKS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.symbol.toLowerCase().includes(q)
    ).slice(0, 8);
    setSuggestions(matches);
    setShowSuggestions(true);
  }, [stockName]);

  const selectStock = (stock) => {
    setStockName(stock.name);
    setSymbol(stock.symbol);
    setExchange(stock.exchange);
    setShowSuggestions(false);
  };

  const sharesNum = parseFloat(shares) || 0;
  const avgNum = parseFloat(avgPrice) || 0;
  const cmpNum = parseFloat(cmp) || 0;
  const invested = sharesNum * avgNum;
  const currentValue = sharesNum * cmpNum;

  const save = () => {
    const sanitizedName = sanitizeInput(stockName, "text");
    if (!sanitizedName || sharesNum <= 0 || cmpNum <= 0) {
      notifyApp("Please enter stock name, shares, and current price.", "error");
      return;
    }
    if (cmpNum > 0 && symbol) {
      setCachedPrice(symbol, exchange, cmpNum);
    }
    onSave({
      id: editData?.id || Date.now(),
      typeId: "stocks",
      name: sanitizedName,
      symbol,
      exchange,
      shares: sharesNum,
      avgPrice: avgNum,
      cmp: cmpNum,
      invested,
      value: currentValue,
      pnl: currentValue - invested,
      pnlPct: invested > 0 ? ((currentValue - invested) / invested) * 100 : 0,
      currency: "INR",
      notes: sanitizeInput(notes, "text"),
      priceUpdatedAt: new Date().toISOString(),
    });
  };

  const fieldRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", gap: 6 }}>
        📈 Stocks & Equity
      </div>

      {/* Stock Name autocomplete */}
      <div style={{ position: "relative" }}>
        <label style={labelStyle}>Stock Name</label>
        <input
          value={stockName}
          onChange={(e) => setStockName(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          style={inputStyle}
          placeholder="e.g. Reliance, HDFC Bank…"
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 200,
              background: "rgba(15,23,42,0.97)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              marginTop: 4,
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            {suggestions.map((s) => (
              <button
                key={s.symbol}
                type="button"
                onMouseDown={() => selectStock(s)}
                style={{
                  width: "100%",
                  padding: "9px 14px",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: 13,
                  textAlign: "left",
                }}
              >
                <span>{s.name}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{s.symbol}:{s.exchange}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Symbol + Exchange */}
      <div style={fieldRow}>
        <div>
          <label style={labelStyle}>Symbol</label>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            style={inputStyle}
            placeholder="e.g. RELIANCE"
          />
        </div>
        <div>
          <label style={labelStyle}>Exchange</label>
          <select value={exchange} onChange={(e) => setExchange(e.target.value)} style={inputStyle}>
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
          </select>
        </div>
      </div>

      {/* Shares + Avg Purchase Price */}
      <div style={fieldRow}>
        <div>
          <label style={labelStyle}>No. of Shares</label>
          <input
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            style={inputStyle}
            type="number"
            min="0"
            step="1"
            placeholder="e.g. 100"
          />
        </div>
        <div>
          <label style={labelStyle}>Avg Purchase Price (₹)</label>
          <input
            value={avgPrice}
            onChange={(e) => setAvgPrice(e.target.value)}
            style={inputStyle}
            type="number"
            min="0"
            placeholder="per share"
          />
        </div>
      </div>

      {/* CMP + Fetch button */}
      <div>
        <label style={labelStyle}>Current Market Price (₹)</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
          <input
            value={cmp}
            onChange={(e) => { const v = e.target.value; setCmp(v); if (symbol && parseFloat(v) > 0) setCachedPrice(symbol, exchange, parseFloat(v)); }}
            style={inputStyle}
            type="number"
            min="0"
            placeholder="Enter or fetch from Google Finance"
          />
          <FetchPriceButton
            symbol={symbol}
            exchange={exchange}
            onPriceSet={(p) => setCmp(p.toString())}
          />
        </div>
      </div>

      {/* P&L preview */}
      <PnlPreview invested={invested} currentValue={currentValue} currency="INR" />

      {/* Notes */}
      <div>
        <label style={labelStyle}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} placeholder="Any extra details" />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={{ ...buttonStyles.secondary, padding: "10px 14px" }}>Cancel</button>
        <button onClick={save} style={{ ...btnStyle, padding: "10px 14px" }}>{editData ? "Update" : "Save Stock"}</button>
      </div>
    </div>
  );
}

/* ─── MutualFundForm (typeId = "mutual_funds") ──────────────────────────── */
function MutualFundForm({ onSave, onCancel, editData }) {
  const [fundName, setFundName] = useState(editData?.name || "");
  const [schemeCode, setSchemeCode] = useState(editData?.schemeCode || editData?.symbol || "");
  const [units, setUnits] = useState(editData?.units?.toString() || "");
  const [avgNav, setAvgNav] = useState(editData?.avgNav?.toString() || "");
  const [currentNav, setCurrentNav] = useState(editData?.cmp?.toString() || "");
  const [notes, setNotes] = useState(editData?.notes || "");
  const [showDetails, setShowDetails] = useState(false);

  // Live search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [navLoading, setNavLoading] = useState(false);
  const searchTimerRef = useRef(null);

  // FIX 5: Re-fetch live NAV on edit when schemeCode exists
  useEffect(() => {
    if (editData?.schemeCode && editData.schemeCode) {
      setNavLoading(true);
      fetch(`https://api.mfapi.in/mf/${editData.schemeCode}/latest`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.data?.[0]?.nav) {
            setCurrentNav(data.data[0].nav);
          }
        })
        .catch(() => {})
        .finally(() => setNavLoading(false));
    }
  }, [editData?.schemeCode]);

  // Debounced search
  const handleSearchInput = (query) => {
    setSearchQuery(query);
    setFundName(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query || query.trim().length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearchLoading(true);
    setShowDropdown(true);
    searchTimerRef.current = setTimeout(() => {
      fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((results) => {
          if (Array.isArray(results)) {
            setSearchResults(results.slice(0, 15));
          } else {
            setSearchResults([]);
          }
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 400);
  };

  // On select a fund from dropdown
  const selectFund = (fund) => {
    setFundName(fund.schemeName || fund.name || "");
    setSchemeCode(String(fund.schemeCode || ""));
    setSearchQuery("");
    setShowDropdown(false);
    setSearchResults([]);

    // Fetch latest NAV
    if (fund.schemeCode) {
      setNavLoading(true);
      fetch(`https://api.mfapi.in/mf/${fund.schemeCode}/latest`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.data?.[0]?.nav) {
            setCurrentNav(data.data[0].nav);
          }
        })
        .catch(() => notifyApp("Could not fetch NAV. Enter manually.", "error"))
        .finally(() => setNavLoading(false));
    }
  };

  const unitsNum = parseFloat(units) || 0;
  const avgNavNum = parseFloat(avgNav) || 0;
  const currentNavNum = parseFloat(currentNav) || 0;
  const invested = unitsNum * avgNavNum;
  const currentValue = unitsNum * currentNavNum;

  const buildPayload = () => {
    const sanitizedName = sanitizeInput(fundName, "text");
    if (!sanitizedName || unitsNum <= 0 || currentNavNum <= 0) {
      notifyApp("Please enter fund name, units held, and current NAV.", "error");
      return null;
    }
    if (currentNavNum > 0 && schemeCode) {
      setCachedPrice(schemeCode, "MUTUALFUND", currentNavNum);
    }
    return {
      id: editData?.id || Date.now(),
      typeId: "mutual_funds",
      name: sanitizedName,
      symbol: schemeCode,
      schemeCode,
      exchange: "MUTUALFUND",
      units: unitsNum,
      avgNav: avgNavNum,
      cmp: currentNavNum,
      invested,
      value: currentValue,
      pnl: currentValue - invested,
      pnlPct: invested > 0 ? ((currentValue - invested) / invested) * 100 : 0,
      currency: "INR",
      notes: sanitizeInput(notes, "text"),
      priceUpdatedAt: new Date().toISOString(),
    };
  };

  const save = () => { const p = buildPayload(); if (p) onSave(p); };
  const saveAndAdd = () => {
    const p = buildPayload();
    if (p) {
      onSave(p);
      // Reset form for next entry
      setFundName(""); setSchemeCode(""); setUnits(""); setAvgNav(""); setCurrentNav(""); setNotes("");
    }
  };

  const fieldRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };

  // Detect plan tags from fund name
  const getTags = (name) => {
    const tags = [];
    const n = (name || "").toLowerCase();
    if (n.includes("direct")) tags.push({ label: "Direct", color: "#14b8a6" });
    else if (n.includes("regular")) tags.push({ label: "Regular", color: "#94a3b8" });
    if (n.includes("growth")) tags.push({ label: "Growth", color: "#22c55e" });
    else if (n.includes("idcw") || n.includes("dividend")) tags.push({ label: "IDCW", color: "#f59e0b" });
    return tags;
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", gap: 6 }}>
        🏦 Mutual Fund
      </div>

      {/* Live search typeahead */}
      <div style={{ position: "relative" }}>
        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8 }}>
          Link to Live Price
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
            background: "rgba(245,158,11,0.18)", color: "#f59e0b", letterSpacing: 0.4,
          }}>BETA</span>
        </label>
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            fontSize: 14, color: "rgba(255,255,255,0.4)", pointerEvents: "none", zIndex: 1,
          }}>🔍</span>
          <input
            value={fundName}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            style={{ ...inputStyle, paddingLeft: 36 }}
            placeholder="Search fund or stock name..."
            autoComplete="off"
          />
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
            background: "rgba(15,23,42,0.97)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
            marginTop: 4, maxHeight: 280, overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}>
            {searchLoading ? (
              <div style={{ padding: "14px 16px", display: "flex", gap: 8, alignItems: "center" }}>
                {[0,1,2].map((i) => (
                  <div key={i} style={{
                    height: 12, borderRadius: 4, flex: 1,
                    background: "rgba(255,255,255,0.08)",
                    animation: "pulse 1.2s ease-in-out infinite",
                    animationDelay: `${i * 0.15}s`,
                  }} />
                ))}
                <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
              </div>
            ) : searchResults.length === 0 ? (
              <div style={{ padding: "14px 16px", fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
                No results found
              </div>
            ) : (
              searchResults.map((fund) => {
                const tags = getTags(fund.schemeName);
                return (
                  <button
                    key={fund.schemeCode}
                    type="button"
                    onMouseDown={() => selectFund(fund)}
                    style={{
                      width: "100%", padding: "10px 14px", background: "transparent",
                      border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer", color: "rgba(255,255,255,0.9)",
                      fontSize: 13, textAlign: "left", display: "block",
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 3, lineHeight: 1.35, whiteSpace: "normal" }}>
                      {fund.schemeName}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                        #{fund.schemeCode}
                      </span>
                      {tags.map((t) => (
                        <span key={t.label} style={{
                          fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99,
                          background: `${t.color}22`, color: t.color, letterSpacing: 0.3,
                        }}>{t.label}</span>
                      ))}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Scheme code display */}
      {schemeCode && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
          <span style={{
            padding: "2px 8px", borderRadius: 6, fontSize: 11,
            background: "rgba(56,189,248,0.12)", color: "#38bdf8", fontWeight: 600,
          }}>Scheme #{schemeCode}</span>
          {navLoading && <span style={{ color: "#f59e0b" }}>Fetching NAV…</span>}
        </div>
      )}

      {/* Units + Avg NAV */}
      <div style={fieldRow}>
        <div>
          <label style={labelStyle}>Units Held</label>
          <input
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            style={inputStyle}
            type="number" min="0" step="0.001"
            placeholder="e.g. 1250.456"
          />
        </div>
        <div>
          <label style={labelStyle}>Avg Purchase NAV (₹)</label>
          <input
            value={avgNav}
            onChange={(e) => setAvgNav(e.target.value)}
            style={inputStyle}
            type="number" min="0"
            placeholder="per unit"
          />
        </div>
      </div>

      {/* Current NAV (auto-filled or manual) */}
      <div>
        <label style={labelStyle}>
          Current NAV (₹) {navLoading && <span style={{ color: "#f59e0b", fontWeight: 400 }}>— fetching…</span>}
        </label>
        <input
          value={currentNav}
          onChange={(e) => setCurrentNav(e.target.value)}
          style={{
            ...inputStyle,
            ...(schemeCode && currentNavNum > 0 ? { borderColor: "rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.06)" } : {}),
          }}
          type="number" min="0"
          placeholder={schemeCode ? "Auto-fetched from mfapi.in" : "Enter manually"}
        />
      </div>

      {/* Total Invested auto-calculated */}
      {unitsNum > 0 && currentNavNum > 0 && (
        <div style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, padding: "10px 14px",
        }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>
            Total Value = {unitsNum.toFixed(3)} units × ₹{currentNavNum.toFixed(2)} NAV
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#22c55e" }}>
            ₹{currentValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
            Auto-calculated from units × NAV
          </div>
        </div>
      )}

      {/* P&L preview */}
      <PnlPreview invested={invested} currentValue={currentValue} currency="INR" />

      {/* Collapsible details */}
      <div>
        <button
          type="button"
          onClick={() => setShowDetails((p) => !p)}
          style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.55)",
            cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{
            display: "inline-block", transition: "transform 0.2s",
            transform: showDetails ? "rotate(90deg)" : "rotate(0deg)",
          }}>›</span>
          Add details (geography, tags, notes)
        </button>
        {showDetails && (
          <div style={{ marginTop: 10 }}>
            <label style={labelStyle}>Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} placeholder="Folio number, plan type, etc." />
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={{ ...buttonStyles.secondary, padding: "10px 14px" }}>Cancel</button>
        <button onClick={save} style={{ ...btnStyle, padding: "10px 14px" }}>{editData ? "Update" : "Save"}</button>
        {!editData && (
          <button onClick={saveAndAdd} style={{ ...btnStyle, padding: "10px 14px", background: "rgba(34,197,94,0.25)", border: "1px solid rgba(34,197,94,0.4)" }}>
            Save & Add
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── GoldForm (typeId = "gold") ────────────────────────────────────────── */
function GoldForm({ onSave, onCancel, editData }) {
  const METAL_TYPES = ["Gold", "Silver", "Platinum", "Other"];
  const [metalType, setMetalType] = useState(editData?.metalType || "Gold");
  const [holdingType, setHoldingType] = useState(editData?.holdingType || "physical");
  // Physical fields
  const [weightGrams, setWeightGrams] = useState(editData?.weightGrams?.toString() || "");
  const [pricePerGram, setPricePerGram] = useState(editData?.pricePerGram?.toString() || "");
  const [physicalInvested, setPhysicalInvested] = useState(editData?.invested?.toString() || "");
  // Digital fields
  const [units, setUnits] = useState(editData?.units?.toString() || "");
  const [avgBuyPrice, setAvgBuyPrice] = useState(editData?.avgPrice?.toString() || "");
  const [livePrice, setLivePrice] = useState(editData?.cmp?.toString() || "");
  const [notes, setNotes] = useState(editData?.notes || "");

  const GOOGLE_SYMBOLS = { Gold: "GOLD", Silver: "SILVER", Platinum: "PLAT" };
  const gfSymbol = GOOGLE_SYMBOLS[metalType] || metalType.toUpperCase();

  // Derived
  const isPhysical = holdingType === "physical";
  const currentValue = isPhysical
    ? (parseFloat(weightGrams) || 0) * (parseFloat(pricePerGram) || 0)
    : (parseFloat(units) || 0) * (parseFloat(livePrice) || 0);
  const invested = isPhysical
    ? parseFloat(physicalInvested) || 0
    : (parseFloat(units) || 0) * (parseFloat(avgBuyPrice) || 0);

  const save = () => {
    if (currentValue <= 0) { notifyApp("Please fill all required fields.", "error"); return; }
    if (livePrice && gfSymbol) setCachedPrice(gfSymbol, "COMMODITY", parseFloat(livePrice));
    onSave({
      id: editData?.id || Date.now(),
      typeId: "gold",
      name: `${metalType} (${holdingType === "physical" ? "Physical" : "Digital"})`,
      metalType, holdingType,
      weightGrams: parseFloat(weightGrams) || null,
      pricePerGram: parseFloat(pricePerGram) || null,
      units: parseFloat(units) || null,
      avgPrice: parseFloat(avgBuyPrice) || null,
      cmp: parseFloat(livePrice) || null,
      invested, value: currentValue,
      pnl: currentValue - invested,
      pnlPct: invested > 0 ? ((currentValue - invested) / invested) * 100 : 0,
      currency: "INR", notes: sanitizeInput(notes, "text"),
      priceUpdatedAt: new Date().toISOString(),
    });
  };

  const fieldRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>🥇 Gold &amp; Precious Metals</div>

      <div style={fieldRow}>
        <div>
          <label style={labelStyle}>Metal Type</label>
          <select value={metalType} onChange={(e) => setMetalType(e.target.value)} style={inputStyle}>
            {METAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Holding Type</label>
          <select value={holdingType} onChange={(e) => setHoldingType(e.target.value)} style={inputStyle}>
            <option value="physical">Physical</option>
            <option value="digital">Digital (SGB / ETF)</option>
          </select>
        </div>
      </div>

      {isPhysical ? (
        <>
          <div style={fieldRow}>
            <div>
              <label style={labelStyle}>Weight (grams)</label>
              <input value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} style={inputStyle} type="number" min="0" step="0.001" placeholder="e.g. 50" />
            </div>
            <div>
              <label style={labelStyle}>Price / gram (₹)</label>
              <div style={{ display: "grid", gap: 4 }}>
                <input value={pricePerGram} onChange={(e) => { setPricePerGram(e.target.value); }} style={inputStyle} type="number" min="0" placeholder="e.g. 7200" />
                <FetchPriceButton symbol={gfSymbol} exchange="COMMODITY" onPriceSet={(p) => setPricePerGram(p.toString())} />
              </div>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Total Invested (₹)</label>
            <input value={physicalInvested} onChange={(e) => setPhysicalInvested(e.target.value)} style={inputStyle} type="number" min="0" placeholder="Amount you paid" />
          </div>
        </>
      ) : (
        <>
          <div style={fieldRow}>
            <div>
              <label style={labelStyle}>Units Held</label>
              <input value={units} onChange={(e) => setUnits(e.target.value)} style={inputStyle} type="number" min="0" step="0.001" placeholder="e.g. 10" />
            </div>
            <div>
              <label style={labelStyle}>Avg Purchase Price (₹)</label>
              <input value={avgBuyPrice} onChange={(e) => setAvgBuyPrice(e.target.value)} style={inputStyle} type="number" min="0" placeholder="per unit" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Live Price (₹)</label>
            <div style={{ display: "grid", gap: 4 }}>
              <input value={livePrice} onChange={(e) => setLivePrice(e.target.value)} style={inputStyle} type="number" min="0" placeholder="Current market price" />
              <FetchPriceButton symbol={gfSymbol} exchange="COMMODITY" onPriceSet={(p) => setLivePrice(p.toString())} />
            </div>
          </div>
        </>
      )}

      <PnlPreview invested={invested} currentValue={currentValue} currency="INR" />

      <div>
        <label style={labelStyle}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} placeholder="Jewellery, coins, SGB series..." />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={{ ...buttonStyles.secondary, padding: "10px 14px" }}>Cancel</button>
        <button onClick={save} style={{ ...btnStyle, padding: "10px 14px" }}>{editData ? "Update" : "Save"}</button>
      </div>
    </div>
  );
}

/* ─── FixedDepositForm (typeId = "fd") ──────────────────────────────────── */
function FixedDepositForm({ onSave, onCancel, editData }) {
  const [bankName, setBankName] = useState(editData?.bankName || "");
  const [principal, setPrincipal] = useState(editData?.principal?.toString() || editData?.value?.toString() || "");
  const [rate, setRate] = useState(editData?.rate?.toString() || "");
  const [tenureMonths, setTenureMonths] = useState(editData?.tenureMonths?.toString() || "");
  const [startDate, setStartDate] = useState(editData?.startDate || "");
  const [notes, setNotes] = useState(editData?.notes || "");

  // Auto-calculate maturity date
  const maturityDate = (() => {
    if (!startDate || !tenureMonths) return "";
    const d = new Date(startDate);
    if (isNaN(d)) return "";
    d.setMonth(d.getMonth() + parseInt(tenureMonths, 10));
    return d.toISOString().slice(0, 10);
  })();

  // Accrued value today (compound interest, quarterly compounding)
  const currentValue = (() => {
    const p = parseFloat(principal) || 0;
    const r = parseFloat(rate) || 0;
    if (!p || !r || !startDate) return p;
    const start = new Date(startDate);
    const today = new Date();
    const yearsElapsed = Math.max(0, (today - start) / (1000 * 60 * 60 * 24 * 365.25));
    return p * Math.pow(1 + (r / 100) / 4, 4 * yearsElapsed);
  })();

  // Full maturity amount
  const maturityAmount = (() => {
    const p = parseFloat(principal) || 0;
    const r = parseFloat(rate) || 0;
    const t = (parseFloat(tenureMonths) || 0) / 12;
    if (!p || !r || !t) return p;
    return p * Math.pow(1 + (r / 100) / 4, 4 * t);
  })();

  const save = () => {
    const sanitizedBank = sanitizeInput(bankName, "text");
    const p = parseFloat(principal) || 0;
    if (!sanitizedBank || p <= 0) { notifyApp("Enter bank name and principal amount.", "error"); return; }
    onSave({
      id: editData?.id || Date.now(),
      typeId: "fd",
      name: `${sanitizedBank} FD`,
      bankName: sanitizedBank,
      principal: p, rate: parseFloat(rate) || 0,
      tenureMonths: parseInt(tenureMonths, 10) || 0,
      startDate, maturityDate,
      maturityAmount: Math.round(maturityAmount),
      value: Math.round(currentValue),
      invested: p,
      pnl: Math.round(currentValue - p),
      currency: "INR",
      notes: sanitizeInput(notes, "text"),
    });
  };

  const fieldRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
  const fmtINR = (v) => v > 0 ? `₹${Math.round(v).toLocaleString("en-IN")}` : "—";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>🏛️ Fixed Deposit</div>

      <div>
        <label style={labelStyle}>Bank / Institution Name</label>
        <input value={bankName} onChange={(e) => setBankName(e.target.value)} style={inputStyle} placeholder="e.g. HDFC Bank, SBI" />
      </div>

      <div style={fieldRow}>
        <div>
          <label style={labelStyle}>Principal Amount (₹)</label>
          <input value={principal} onChange={(e) => setPrincipal(e.target.value)} style={inputStyle} type="number" min="0" placeholder="e.g. 100000" />
        </div>
        <div>
          <label style={labelStyle}>Interest Rate % p.a.</label>
          <input value={rate} onChange={(e) => setRate(e.target.value)} style={inputStyle} type="number" min="0" step="0.01" placeholder="e.g. 7.5" />
        </div>
      </div>

      <div style={fieldRow}>
        <div>
          <label style={labelStyle}>Tenure (months)</label>
          <input value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} style={inputStyle} type="number" min="1" step="1" placeholder="e.g. 24" />
        </div>
        <div>
          <label style={labelStyle}>Start Date</label>
          <input value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} type="date" />
        </div>
      </div>

      {/* Auto-calculated read-only info */}
      {(parseFloat(principal) > 0) && (
        <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>Maturity Date</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{maturityDate || "—"}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>Current Value</div>
            <div style={{ fontWeight: 700, color: "#22c55e" }}>{fmtINR(currentValue)}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>Maturity Amount</div>
            <div style={{ fontWeight: 700, color: "#38bdf8" }}>{fmtINR(maturityAmount)}</div>
          </div>
        </div>
      )}

      <div>
        <label style={labelStyle}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} placeholder="Account number, type, etc." />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={{ ...buttonStyles.secondary, padding: "10px 14px" }}>Cancel</button>
        <button onClick={save} style={{ ...btnStyle, padding: "10px 14px" }}>{editData ? "Update" : "Save FD"}</button>
      </div>
    </div>
  );
}

/* ─── CryptoForm (typeId = "crypto") ────────────────────────────────────── */
function CryptoForm({ onSave, onCancel, editData }) {
  const POPULAR_COINS = [
    { symbol: "BTC", name: "Bitcoin" },
    { symbol: "ETH", name: "Ethereum" },
    { symbol: "BNB", name: "BNB" },
    { symbol: "SOL", name: "Solana" },
    { symbol: "XRP", name: "XRP" },
    { symbol: "ADA", name: "Cardano" },
    { symbol: "DOGE", name: "Dogecoin" },
    { symbol: "MATIC", name: "Polygon" },
    { symbol: "DOT", name: "Polkadot" },
    { symbol: "AVAX", name: "Avalanche" },
  ];

  const [coinName, setCoinName] = useState(editData?.name || "");
  const [symbol, setSymbol] = useState(editData?.symbol || "");
  const [quantity, setQuantity] = useState(editData?.units?.toString() || "");
  const [avgBuyPrice, setAvgBuyPrice] = useState(editData?.avgPrice?.toString() || "");
  const [livePrice, setLivePrice] = useState(editData?.cmp?.toString() || "");
  const [notes, setNotes] = useState(editData?.notes || "");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const qty = parseFloat(quantity) || 0;
  const avg = parseFloat(avgBuyPrice) || 0;
  const live = parseFloat(livePrice) || 0;
  const invested = qty * avg;
  const currentValue = qty * live;

  const selectCoin = (coin) => {
    setCoinName(coin.name);
    setSymbol(coin.symbol);
    setShowSuggestions(false);
    if (symbol) {
      const cached = getCachedPrice(coin.symbol, "CRYPTO");
      if (cached) setLivePrice(cached.price.toString());
    }
  };

  const save = () => {
    const sanitizedName = sanitizeInput(coinName, "text");
    if (!sanitizedName || qty <= 0 || live <= 0) { notifyApp("Enter coin name, quantity, and live price.", "error"); return; }
    if (live > 0 && symbol) setCachedPrice(symbol, "CRYPTO", live);
    onSave({
      id: editData?.id || Date.now(),
      typeId: "crypto",
      name: sanitizedName,
      symbol, exchange: "CRYPTO",
      units: qty, avgPrice: avg,
      cmp: live, invested, value: currentValue,
      pnl: currentValue - invested,
      pnlPct: invested > 0 ? ((currentValue - invested) / invested) * 100 : 0,
      currency: "INR",
      notes: sanitizeInput(notes, "text"),
      priceUpdatedAt: new Date().toISOString(),
    });
  };

  const fieldRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>₿ Crypto</div>

      {/* Quick-pick coins */}
      <div>
        <label style={labelStyle}>Select Coin</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {POPULAR_COINS.map((c) => (
            <button
              key={c.symbol}
              type="button"
              onClick={() => selectCoin(c)}
              style={{
                padding: "4px 10px", fontSize: 12, borderRadius: 99,
                background: symbol === c.symbol ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.07)",
                border: symbol === c.symbol ? "1px solid rgba(56,189,248,0.5)" : "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.85)", cursor: "pointer",
              }}
            >
              {c.symbol}
            </button>
          ))}
        </div>
      </div>

      <div style={fieldRow}>
        <div>
          <label style={labelStyle}>Coin Name</label>
          <input value={coinName} onChange={(e) => setCoinName(e.target.value)} style={inputStyle} placeholder="e.g. Bitcoin" />
        </div>
        <div>
          <label style={labelStyle}>Symbol</label>
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} style={inputStyle} placeholder="e.g. BTC" />
        </div>
      </div>

      <div style={fieldRow}>
        <div>
          <label style={labelStyle}>Quantity</label>
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} style={inputStyle} type="number" min="0" step="any" placeholder="e.g. 0.5" />
        </div>
        <div>
          <label style={labelStyle}>Avg Buy Price (₹)</label>
          <input value={avgBuyPrice} onChange={(e) => setAvgBuyPrice(e.target.value)} style={inputStyle} type="number" min="0" placeholder="per coin" />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Live Price (₹)</label>
        <div style={{ display: "grid", gap: 6 }}>
          <input
            value={livePrice}
            onChange={(e) => { const v = e.target.value; setLivePrice(v); if (symbol && parseFloat(v) > 0) setCachedPrice(symbol, "CRYPTO", parseFloat(v)); }}
            style={inputStyle} type="number" min="0" placeholder="Current price per coin"
          />
          <FetchPriceButton symbol={symbol} exchange="CRYPTO" onPriceSet={(p) => setLivePrice(p.toString())} />
        </div>
      </div>

      <PnlPreview invested={invested} currentValue={currentValue} currency="INR" />

      <div>
        <label style={labelStyle}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} placeholder="Exchange, wallet address, etc." />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={{ ...buttonStyles.secondary, padding: "10px 14px" }}>Cancel</button>
        <button onClick={save} style={{ ...btnStyle, padding: "10px 14px" }}>{editData ? "Update" : "Save Crypto"}</button>
      </div>
    </div>
  );
}

/* ─── AddAssetForm — dispatcher ─────────────────────────────────────────── */
export function AddAssetForm({ typeId, onSave, onCancel, editData }) {
  // Route to a specialized sub-form if available
  if (typeId === "stocks") return <StocksForm onSave={onSave} onCancel={onCancel} editData={editData} />;
  if (typeId === "mutual_funds") return <MutualFundForm onSave={onSave} onCancel={onCancel} editData={editData} />;
  if (typeId === "gold") return <GoldForm onSave={onSave} onCancel={onCancel} editData={editData} />;
  if (typeId === "fd") return <FixedDepositForm onSave={onSave} onCancel={onCancel} editData={editData} />;
  if (typeId === "crypto") return <CryptoForm onSave={onSave} onCancel={onCancel} editData={editData} />;

  // Generic form for all other asset types
  const t = ASSET_TYPES.find((x) => x.id === typeId) || ASSET_TYPES[0];
  const [name, setName] = useState(editData?.name || "");
  const [value, setValue] = useState(editData?.value?.toString() || "");
  const [currency, setCurrency] = useState(editData?.currency || CURRENCIES[0].code);
  const [notes, setNotes] = useState(editData?.notes || "");

  const save = () => {
    const sanitizedName = sanitizeInput(name, "text");
    const sanitizedNotes = sanitizeInput(notes, "text");
    const sanitizedValue = sanitizeInput(value, "number");

    if (!sanitizedName || sanitizedValue <= 0) {
      notifyApp("Please enter valid asset name and positive value.", "error");
      return;
    }

    const payload = {
      id: editData?.id || Date.now(),
      typeId: t.id,
      name: sanitizedName,
      value: sanitizedValue,
      currency,
      notes: sanitizedNotes,
    };
    onSave(payload);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 700, color: "rgba(255, 255, 255, 0.95)" }}>{t.icon} {t.label}</div>
      <div>
        <label style={labelStyle}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. HDFC Bank, Gold ETF, Flat" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 8 }}>
        <div>
          <label style={labelStyle}>Value</label>
          <input value={value} onChange={(e) => setValue(e.target.value)} style={inputStyle} type="number" min="0" />
        </div>
        <div>
          <label style={labelStyle}>Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle}>Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} placeholder="Any extra details" />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={{ ...buttonStyles.secondary, padding: "10px 14px" }}>Cancel</button>
        <button onClick={save} style={{ ...btnStyle, padding: "10px 14px" }}>{editData ? "Update" : "Save Asset"}</button>
      </div>
    </div>
  );
}


export function AddLiabilityForm({ onSave, onCancel, editData }) {
  const [name, setName] = useState(editData?.name || "");
  const [type, setType] = useState(editData?.type || LIABILITY_TYPES[0].id);
  const [principal, setPrincipal] = useState(
    (editData?.principal ?? editData?.value ?? "").toString()
  );
  const [emi, setEmi] = useState((editData?.emi ?? "").toString());
  const [startDate, setStartDate] = useState(editData?.startDate || "");
  const [endDate, setEndDate] = useState(editData?.endDate || "");
  const [interest, setInterest] = useState((editData?.interest ?? "").toString());

  const selectedType = LIABILITY_TYPES.find((t) => t.id === type) || LIABILITY_TYPES[0];

  // Auto-calculate end-date whenever principal or emi changes (only when endDate is empty)
  const autoEndDate =
    !endDate && principal && emi
      ? calcEndDate(Number(principal), Number(emi), startDate)
      : null;
  const resolvedEndDate = endDate || autoEndDate || "";

  // Live outstanding preview
  const outstanding = calcOutstanding({
    principal: Number(principal) || 0,
    emi: Number(emi) || 0,
    startDate,
    endDate: resolvedEndDate,
    value: Number(principal) || 0,
  });

  const save = () => {
    const sanitizedName = sanitizeInput(name, "text");
    const sanitizedPrincipal = sanitizeInput(principal, "number");

    if (!sanitizedName || sanitizedPrincipal <= 0) {
      notifyApp("Please enter a valid liability name and principal amount.", "error");
      return;
    }

    onSave({
      id: editData?.id || Date.now(),
      name: sanitizedName,
      type,
      icon: selectedType.icon,
      label: selectedType.label,
      // legacy field — set to outstanding so net-worth stays correct
      value: outstanding,
      principal: sanitizedPrincipal,
      emi: sanitizeInput(emi, "number") || 0,
      startDate,
      endDate: resolvedEndDate,
      interest: sanitizeInput(interest, "number") || 0,
      currency: "INR",
    });
  };

  const fieldRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Name */}
      <div>
        <label style={labelStyle}>Loan / Liability Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          placeholder="e.g. Home Loan, Car Loan"
        />
      </div>

      {/* Type + Interest */}
      <div style={fieldRow}>
        <div>
          <label style={labelStyle}>Loan Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
            {LIABILITY_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Interest Rate % p.a.</label>
          <input
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            style={inputStyle}
            type="number"
            min="0"
            step="0.01"
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Principal + EMI */}
      <div style={fieldRow}>
        <div>
          <label style={labelStyle}>Principal Amount (₹)</label>
          <input
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            style={inputStyle}
            type="number"
            min="0"
            placeholder="Total loan amount"
          />
        </div>
        <div>
          <label style={labelStyle}>Monthly EMI (₹)</label>
          <input
            value={emi}
            onChange={(e) => setEmi(e.target.value)}
            style={inputStyle}
            type="number"
            min="0"
            placeholder="e.g. 15000"
          />
        </div>
      </div>

      {/* Dates */}
      <div style={fieldRow}>
        <div>
          <label style={labelStyle}>Start Date</label>
          <input
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={inputStyle}
            type="date"
          />
        </div>
        <div>
          <label style={labelStyle}>End Date {autoEndDate ? "(auto)" : ""}</label>
          <input
            value={endDate || autoEndDate || ""}
            onChange={(e) => setEndDate(e.target.value)}
            style={inputStyle}
            type="date"
            placeholder="Auto from EMI"
          />
        </div>
      </div>

      {/* Live Outstanding preview */}
      {(Number(principal) > 0) && (
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
            Outstanding Today
          </span>
          <span
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: outstanding > 0 ? "#ef4444" : "#22c55e",
            }}
          >
            ₹{outstanding.toLocaleString("en-IN")}
          </span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
        <button onClick={onCancel} style={{ ...buttonStyles.secondary, padding: "10px 14px" }}>
          Cancel
        </button>
        <button onClick={save} style={{ ...btnStyle, padding: "10px 14px" }}>
          {editData ? "Update Liability" : "Save Liability"}
        </button>
      </div>
    </div>
  );
}

export default AddAssetForm;
