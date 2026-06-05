/**
 * pages/Goals/Goals.jsx
 */
import { useState, useMemo, useEffect } from "react";
import { formatCurrency } from "../../utils/formatCurrency";
import { sanitizeInput } from "../../utils/security";
import {
  PageSection, PageHeader, PageHeaderActions, PageTitle,
  Field, Select, EmptyBlock, DataTablePagination,
  ModalBackdrop, ModalCard, ModalTitle, SecondaryButton,
  MobileDataSelection,
  getPaginatedRows, getTotalPages, notifyApp,
} from "../../components/shared/ui";
import { buttonStyles, inputStyle, labelStyle, cardStyle } from "../../styles";
import { useIsMobile } from "../../hooks/useWindowSize";
import LiquidGlassCard from "../../components/LiquidGlassCard";

// ─── Constants ────────────────────────────────────────────────────────────────

const GOAL_TEMPLATES = [
  { id: "emergency_fund", label: "Emergency Fund",   icon: "🛡️", suggestedAmount: 300000,   horizonMonths: 12  },
  { id: "retirement",     label: "Retirement",        icon: "🏖️", suggestedAmount: 10000000, horizonMonths: 240 },
  { id: "house",          label: "House Down Payment",icon: "🏠", suggestedAmount: 2000000,  horizonMonths: 60  },
  { id: "car",            label: "Car",               icon: "🚗", suggestedAmount: 800000,   horizonMonths: 24  },
  { id: "vacation",       label: "Vacation",          icon: "✈️", suggestedAmount: 150000,   horizonMonths: 12  },
  { id: "education",      label: "Education",         icon: "🎓", suggestedAmount: 1000000,  horizonMonths: 48  },
  { id: "wedding",        label: "Wedding",           icon: "💍", suggestedAmount: 1500000,  horizonMonths: 24  },
  { id: "custom",         label: "Custom",            icon: "🎯", suggestedAmount: 0,        horizonMonths: 12  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGoalStatus(pct) {
  if (pct >= 100) return { label: "Achieved!",    color: "#22c55e", bg: "rgba(34,197,94,0.12)"  };
  if (pct >= 60)  return { label: "On Track",     color: "#22c55e", bg: "rgba(34,197,94,0.08)"  };
  if (pct >= 25)  return { label: "In Progress",  color: "#f97316", bg: "rgba(249,115,22,0.08)" };
  return             { label: "Just Started", color: "#ef4444", bg: "rgba(239,68,68,0.08)"  };
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

function formatDaysRemaining(days) {
  if (days == null) return "—";
  if (days <= 0)    return "Overdue";
  if (days < 30)    return `${days}d left`;
  if (days < 365)   return `${Math.ceil(days / 30)}mo left`;
  const y = Math.floor(days / 365);
  const m = Math.ceil((days % 365) / 30);
  return m > 0 ? `${y}y ${m}mo left` : `${y}y left`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GoalsPage({ assets, goals, setGoals, currency }) {
  const isMobile = useIsMobile();
  const btnStyle = buttonStyles.primary;

  const [showAdd,        setShowAdd]        = useState(false);
  const [editing,        setEditing]        = useState(null);
  const [templateId,     setTemplateId]     = useState("custom");
  const [name,           setName]           = useState("");
  const [target,         setTarget]         = useState("");
  const [targetDate,     setTargetDate]     = useState("");
  const [startingAmount, setStartingAmount] = useState("0");
  const [trackBy,        setTrackBy]        = useState("manual");
  const [linkedAssetId,  setLinkedAssetId]  = useState("");
  const [manualCurrent,  setManualCurrent]  = useState("0");
  const [search,         setSearch]         = useState("");
  const [sortBy,         setSortBy]         = useState("progress_desc");
  const [page,           setPage]           = useState(1);
  const [selectedIds,    setSelectedIds]    = useState([]);

  const resolveCurrentValue = (goal) => {
    if (goal.trackBy === "asset" && goal.linkedAssetId) {
      const asset = assets.find((a) => a.id === goal.linkedAssetId);
      return asset ? asset.value : goal.manualCurrent || goal.current || 0;
    }
    return goal.manualCurrent ?? goal.current ?? 0;
  };

  const handleTemplateChange = (tid) => {
    setTemplateId(tid);
    const tpl = GOAL_TEMPLATES.find((t) => t.id === tid);
    if (!tpl || tpl.id === "custom") return;
    setName(tpl.label);
    if (tpl.suggestedAmount > 0) setTarget(String(tpl.suggestedAmount));
    if (tpl.horizonMonths > 0) {
      const d = new Date();
      d.setMonth(d.getMonth() + tpl.horizonMonths);
      setTargetDate(d.toISOString().split("T")[0]);
    }
  };

  const resetForm = () => {
    setTemplateId("custom"); setName(""); setTarget(""); setTargetDate("");
    setStartingAmount("0"); setTrackBy("manual"); setLinkedAssetId(""); setManualCurrent("0");
    setEditing(null);
  };

  const closeAdd   = () => { setShowAdd(false); resetForm(); };
  const handleEdit = (goal) => {
    setEditing(goal); setTemplateId(goal.templateId || "custom");
    setName(goal.name || ""); setTarget(String(goal.target || ""));
    setTargetDate(goal.targetDate || ""); setStartingAmount(String(goal.startingAmount || 0));
    setTrackBy(goal.trackBy || "manual"); setLinkedAssetId(goal.linkedAssetId || "");
    setManualCurrent(String(goal.manualCurrent || 0)); setShowAdd(true);
  };

  const saveGoal = () => {
    const n = sanitizeInput(name, "text");
    const t = sanitizeInput(target, "number");
    if (!n || t <= 0) { notifyApp("Enter a valid goal name and target amount.", "error"); return; }
    const tpl = GOAL_TEMPLATES.find((tp) => tp.id === templateId);
    const payload = {
      id: editing?.id || Date.now(), templateId, name: n, target: t, targetDate,
      icon: tpl?.icon || "🎯",
      startingAmount: sanitizeInput(startingAmount, "number") || 0,
      trackBy, linkedAssetId,
      manualCurrent: sanitizeInput(manualCurrent, "number") || 0,
      current: sanitizeInput(manualCurrent, "number") || 0,
      createdAt: editing?.createdAt || new Date().toISOString(),
    };
    setGoals((prev) => editing ? prev.map((g) => g.id === editing.id ? payload : g) : [...prev, payload]);
    closeAdd();
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = goals.filter((g) => !q || String(g.name || "").toLowerCase().includes(q));
    return [...r].sort((a, b) => {
      const pa = a.target > 0 ? (resolveCurrentValue(a) / a.target) * 100 : 0;
      const pb = b.target > 0 ? (resolveCurrentValue(b) / b.target) * 100 : 0;
      if (sortBy === "progress_asc")  return pa - pb;
      if (sortBy === "progress_desc") return pb - pa;
      if (sortBy === "target_asc")    return a.target - b.target;
      if (sortBy === "target_desc")   return b.target - a.target;
      if (sortBy === "name_desc")     return String(b.name || "").localeCompare(String(a.name || ""));
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [goals, search, sortBy, assets]);

  const paged = useMemo(() => getPaginatedRows(rows, page), [rows, page]);
  useEffect(() => { setPage(1); }, [search, sortBy]);
  useEffect(() => { const tp = getTotalPages(rows.length); if (page > tp) setPage(tp); }, [rows.length, page]);
  useEffect(() => { setSelectedIds((p) => p.filter((id) => rows.some((g) => g.id === id))); }, [rows]);

  const pageIds     = paged.map((g) => g.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const toggle      = (id) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAll   = () => setSelectedIds((p) => allSelected ? p.filter((id) => !pageIds.includes(id)) : [...new Set([...p, ...pageIds])]);
  const deleteSelected = () => { setGoals((p) => p.filter((g) => !selectedIds.includes(g.id))); setSelectedIds([]); };

  const selectedTemplate = GOAL_TEMPLATES.find((t) => t.id === templateId);

  const TRACK_OPTIONS = [
    { key: "manual",  label: "✍️ Manual"         },
    { key: "asset",   label: "🏛️ Link to Asset"  },
    { key: "savings", label: "💸 Link to Savings" },
  ];

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <PageTitle title="Financial Goals" subtitle={`${goals.length} goal${goals.length !== 1 ? "s" : ""} · Set targets and track your progress`} />
        <PageHeaderActions $isMobile={isMobile}>
          <button onClick={() => setShowAdd(true)} style={{ ...btnStyle, width: isMobile ? "100%" : "auto" }}>+ New Goal</button>
        </PageHeaderActions>
      </PageHeader>

      {showAdd && (
        <ModalBackdrop onClick={closeAdd}>
          <ModalCard $maxWidth={560} onClick={(e) => e.stopPropagation()}>
            <ModalTitle>{editing ? "Edit Goal" : "Create Goal"}</ModalTitle>

            {/* Template picker */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Template</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                {GOAL_TEMPLATES.map((tpl) => (
                  <button key={tpl.id} onClick={() => handleTemplateChange(tpl.id)}
                    style={{ padding: "8px 4px", borderRadius: 10, cursor: "pointer", fontSize: 11, textAlign: "center",
                      border:      templateId === tpl.id ? "1px solid rgba(56,189,248,0.6)"  : "1px solid rgba(255,255,255,0.12)",
                      background:  templateId === tpl.id ? "rgba(56,189,248,0.15)"            : "rgba(255,255,255,0.04)",
                      color:       templateId === tpl.id ? "#38bdf8"                          : "rgba(255,255,255,0.75)",
                      fontWeight:  templateId === tpl.id ? 700 : 400,
                    }}>
                    <div style={{ fontSize: 20, marginBottom: 2 }}>{tpl.icon}</div>
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div><label style={labelStyle}>Goal Name</label><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emergency Fund" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div><label style={labelStyle}>Target Amount (₹)</label><input style={inputStyle} type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={selectedTemplate?.suggestedAmount > 0 ? `Suggested: ${selectedTemplate.suggestedAmount.toLocaleString("en-IN")}` : "0"} /></div>
                <div><label style={labelStyle}>Target Date</label><input style={inputStyle} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>
              </div>
              <div><label style={labelStyle}>Starting Amount (₹)</label><input style={inputStyle} type="number" value={startingAmount} onChange={(e) => setStartingAmount(e.target.value)} placeholder="0" /></div>

              <div>
                <label style={labelStyle}>Track Progress By</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  {TRACK_OPTIONS.map((opt) => (
                    <button key={opt.key} onClick={() => setTrackBy(opt.key)}
                      style={{ padding: "6px 14px", fontSize: 12, borderRadius: 99, cursor: "pointer",
                        border:     trackBy === opt.key ? "1px solid rgba(56,189,248,0.6)"  : "1px solid rgba(255,255,255,0.15)",
                        background: trackBy === opt.key ? "rgba(56,189,248,0.18)"            : "rgba(255,255,255,0.06)",
                        color:      trackBy === opt.key ? "#38bdf8"                          : "rgba(255,255,255,0.7)",
                        fontWeight: trackBy === opt.key ? 700 : 400,
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {trackBy === "manual" && (
                  <div style={{ marginTop: 10 }}>
                    <label style={labelStyle}>Current Amount Saved (₹)</label>
                    <input style={inputStyle} type="number" value={manualCurrent} onChange={(e) => setManualCurrent(e.target.value)} placeholder="0" />
                  </div>
                )}
                {trackBy === "asset" && (
                  <div style={{ marginTop: 10 }}>
                    <label style={labelStyle}>Link to Asset (uses its current value as progress)</label>
                    <select style={inputStyle} value={linkedAssetId} onChange={(e) => setLinkedAssetId(e.target.value)}>
                      <option value="">— Select Asset —</option>
                      {assets.map((a) => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.value, currency)})</option>)}
                    </select>
                  </div>
                )}
                {trackBy === "savings" && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(56,189,248,0.08)", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    💡 Savings tracking auto-sums your income entries. Enter a manual current value for now.
                    <div style={{ marginTop: 8 }}>
                      <label style={labelStyle}>Current Savings (₹)</label>
                      <input style={inputStyle} type="number" value={manualCurrent} onChange={(e) => setManualCurrent(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                <SecondaryButton onClick={closeAdd}>Cancel</SecondaryButton>
                <button onClick={saveGoal} style={{ ...btnStyle, padding: "10px 14px" }}>{editing ? "Update Goal" : "Create Goal"}</button>
              </div>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      {goals.length === 0 ? (
        <LiquidGlassCard style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "rgba(255,255,255,0.65)" }}>No goals yet</div>
          <div>Set a financial goal to track your savings progress</div>
        </LiquidGlassCard>
      ) : (
        <>
          <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(220px,1fr) minmax(180px,220px)", gap: 8 }}>
              <Field value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search goals" />
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="progress_desc">Sort: Progress High→Low</option>
                <option value="progress_asc">Sort: Progress Low→High</option>
                <option value="target_desc">Sort: Target High→Low</option>
                <option value="target_asc">Sort: Target Low→High</option>
                <option value="name_asc">Sort: Name A→Z</option>
                <option value="name_desc">Sort: Name Z→A</option>
              </Select>
            </div>
            <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", marginTop: 8 }}>
              <button onClick={deleteSelected} disabled={selectedIds.length === 0}
                style={{ ...btnStyle, background: "var(--error, #f97316)", padding: "8px 12px", fontSize: 12, width: isMobile ? "100%" : "auto", opacity: selectedIds.length === 0 ? 0.55 : 1, cursor: selectedIds.length === 0 ? "not-allowed" : "pointer" }}>
                Delete Selected ({selectedIds.length})
              </button>
            </div>
          </div>

          {rows.length === 0 ? <EmptyBlock>No goals match your filters.</EmptyBlock> : (
            <>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 12 }}>Showing {paged.length} of {rows.length} goals</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(340px,1fr))", gap: 14, marginBottom: 12 }}>
                {paged.map((goal) => {
                  const current   = resolveCurrentValue(goal);
                  const pct       = goal.target > 0 ? Math.min((current / goal.target) * 100, 100) : 0;
                  const status    = getGoalStatus(pct);
                  const days      = daysUntil(goal.targetDate);
                  const months    = days != null && days > 0 ? Math.max(1, Math.ceil(days / 30)) : null;
                  const remaining = Math.max(0, goal.target - current);
                  const perMonth  = months ? remaining / months : null;
                  const linked    = goal.trackBy === "asset" && goal.linkedAssetId ? assets.find((a) => a.id === goal.linkedAssetId) : null;
                  const barColor  = pct >= 60 ? "#22c55e" : pct >= 25 ? "#f97316" : "#ef4444";

                  return (
                    <div key={goal.id} style={{ background: status.bg, border: `1px solid ${status.color}22`, borderRadius: 16, padding: "18px 20px", position: "relative" }}>
                      <input type="checkbox" checked={selectedIds.includes(goal.id)} onChange={() => toggle(goal.id)} aria-label={`Select ${goal.name}`} style={{ position: "absolute", top: 14, right: 14 }} />

                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 28 }}>{goal.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,0.95)" }}>{goal.name}</div>
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: status.color, background: `${status.color}18`, padding: "2px 8px", borderRadius: 99 }}>{status.label}</span>
                        </div>
                      </div>

                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                          <span style={{ color: "rgba(255,255,255,0.65)" }}>{formatCurrency(current, currency)}</span>
                          <span style={{ color: "rgba(255,255,255,0.45)" }}>{formatCurrency(goal.target, currency)}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,0.1)" }}>
                          <div style={{ height: "100%", borderRadius: 99, background: barColor, width: `${pct}%`, transition: "width 0.4s" }} />
                        </div>
                        <div style={{ textAlign: "right", fontSize: 11, color: status.color, marginTop: 4, fontWeight: 700 }}>{pct.toFixed(1)}%</div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {[
                          { key: "REMAINING", value: formatCurrency(remaining, currency), color: "rgba(255,255,255,0.85)" },
                          { key: "TIME LEFT",  value: formatDaysRemaining(days),           color: days != null && days <= 0 ? "#ef4444" : "rgba(255,255,255,0.85)" },
                          { key: "NEED / MO",  value: perMonth != null ? formatCurrency(perMonth, currency) : "—", color: "#38bdf8" },
                        ].map((stat) => (
                          <div key={stat.key} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "8px 10px" }}>
                            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.7, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>{stat.key}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                          </div>
                        ))}
                      </div>

                      {linked && <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>🏛️ Tracking: <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>{linked.name}</span></div>}
                      {goal.targetDate && <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Target: {new Date(goal.targetDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>}
                      <button onClick={() => handleEdit(goal)} style={{ ...buttonStyles.secondary, padding: "6px 12px", fontSize: 12, marginTop: 10, width: "100%" }}>Edit Goal</button>
                    </div>
                  );
                })}
              </div>
              <DataTablePagination totalRows={rows.length} currentPage={page} onPageChange={setPage} />
            </>
          )}
        </>
      )}
    </PageSection>
  );
}
