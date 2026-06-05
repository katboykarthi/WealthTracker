/**
 * pages/Dashboard/Dashboard.jsx
 * ~300 lines (was mixed into the 4 112-line AppPages.jsx)
 */

import { useState, useEffect, useRef, useMemo } from "react";
import styled from "@emotion/styled";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { CURRENCIES, ASSET_TYPES } from "../../constants";
import { formatCurrency } from "../../utils/formatCurrency";
import { buildSnapshotChartData } from "../../utils/formatting";
import {
  TYPE_SCALE, DASHBOARD_LAYOUT, surfaceIn,
  PageSection, Select, EmptyBlock,
  TableWrap, DataTable, TableHead, TableCell, TableResultsText,
  MobileDataList, MobileRecordCard,
  ModalBackdrop, ModalCard, ModalTitle, ModalText, ModalActions,
  PrimaryButton, SecondaryButton,
  DataTablePagination, Toolbar, Field,
  getPaginatedRows, getTotalPages,
  notifyApp,
} from "../../components/shared/ui";
import { heroGradient, buttonStyles, serifFontFamily } from "../../styles";
import LiquidGlassCard from "../../components/LiquidGlassCard";

// ─── Dashboard-local styled components ───────────────────────────────────────

const DashboardWrap = styled.div(({ $isMobile }) => ({
  padding: $isMobile ? "24px 16px" : "20px 24px",
  maxWidth: 1180,
  width: "100%",
  margin: "0 auto",
  boxSizing: "border-box",
}));

const HeroPanel = styled.section(({ $isMobile }) => ({
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.12)",
  background: `var(--hero-gradient, ${heroGradient})`,
  padding: $isMobile ? "16px" : "22px 24px",
  marginBottom: DASHBOARD_LAYOUT.cardGap,
  display: "grid",
  gridTemplateColumns: $isMobile ? "1fr" : "1.4fr auto",
  gap: 18,
  position: "relative",
  overflow: "visible !important",
  zIndex: 2,
  animation: `${surfaceIn} 260ms ease`,
}));

const HeroLabel = styled.div({
  fontSize: TYPE_SCALE.micro, fontWeight: 700, letterSpacing: 0.8,
  color: "rgba(255,255,255,0.65)", textTransform: "uppercase", marginBottom: 4,
});
const HeroValue = styled.div({
  fontFamily: serifFontFamily, fontSize: 40, lineHeight: 1, color: "var(--accent-dark, #14532d)",
});
const HeroMeta = styled.div({ fontSize: TYPE_SCALE.meta, color: "rgba(255,255,255,0.65)" });
const ActionCluster = styled.div({ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" });

const StatGrid = styled.div(({ $isMobile }) => ({
  display: "grid",
  gridTemplateColumns: $isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
  gap: DASHBOARD_LAYOUT.cardGap,
  marginBottom: $isMobile ? DASHBOARD_LAYOUT.cardGap : DASHBOARD_LAYOUT.sectionGap,
}));

const StatCard = ({ children, className }) => (
  <LiquidGlassCard className={className} style={{ display: "grid", gap: 6, height: "100%" }}>
    {children}
  </LiquidGlassCard>
);

const StatLabel = styled.div({ fontSize: TYPE_SCALE.micro, textTransform: "uppercase", letterSpacing: 0.7, fontWeight: 700, color: "rgba(255,255,255,0.65)" });
const StatValue = styled.div({ fontSize: 26, fontWeight: 700, color: "rgba(255,255,255,0.95)" });
const StatSub   = styled.div({ fontSize: TYPE_SCALE.meta, color: "rgba(255,255,255,0.65)" });

const DashboardTabs = styled.div(({ $isMobile, $count = 1, $activeIndex = 0 }) => {
  const safeCount = Math.max(1, Number($count) || 1);
  const clampedIndex = Math.min(Math.max(0, Number($activeIndex) || 0), safeCount - 1);
  return {
    position: "relative",
    display: "grid",
    gridTemplateColumns: `repeat(${safeCount}, minmax(0, 1fr))`,
    alignItems: "stretch",
    height: 46,
    padding: "4px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 28px rgba(2,6,23,0.3)",
    marginBottom: DASHBOARD_LAYOUT.cardGap,
    width: $isMobile ? "100%" : "min(460px, 100%)",
    maxWidth: "100%",
    overflow: "hidden",
    isolation: "isolate",
    "&::before": {
      content: '""',
      position: "absolute",
      top: 4, bottom: 4, left: 4,
      width: `calc((100% - 8px) / ${safeCount})`,
      transform: `translateX(${clampedIndex * 100}%)`,
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.22)",
      background: "linear-gradient(145deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.14) 48%, rgba(56,189,248,0.2) 100%)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.42), inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 20px rgba(14,165,233,0.24)",
      transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
      pointerEvents: "none",
      zIndex: 0,
    },
    "& > *": { position: "relative", zIndex: 1 },
  };
});

const TabButton = styled.button(({ $active }) => ({
  width: "100%", height: "100%",
  border: "none", borderRadius: 999, background: "transparent",
  color: $active ? "#f8fbff" : "rgba(229,231,235,0.72)",
  padding: "9px 12px", fontSize: TYPE_SCALE.meta,
  fontWeight: $active ? 700 : 600, cursor: "pointer",
  textShadow: $active ? "0 1px 10px rgba(56,189,248,0.35)" : "none",
  transform: $active ? "scale(1.05)" : "scale(1)",
  transition: "transform 220ms cubic-bezier(0.22,1,0.36,1), color 220ms ease",
}));

const PanelGrid = styled.div(({ $isMobile }) => ({
  display: "grid",
  gridTemplateColumns: $isMobile ? "1fr" : "minmax(0, 1.7fr) minmax(260px, 1fr)",
  gap: DASHBOARD_LAYOUT.cardGap,
}));

const PanelCard = ({ children, className, style }) => (
  <LiquidGlassCard className={className} style={{ height: "100%", ...style }}>{children}</LiquidGlassCard>
);

const PanelTitle = styled.h2({ margin: "0 0 8px", fontSize: TYPE_SCALE.h2, lineHeight: 1.2, color: "rgba(255,255,255,0.95)" });
const PanelHint  = styled.div({ fontSize: TYPE_SCALE.meta, color: "rgba(255,255,255,0.65)", marginBottom: 14 });

const PopoverCard = styled.div({
  position: "fixed", left: 16, top: 16,
  width: "min(220px, calc(100vw - 32px))",
  maxWidth: "calc(100vw - 32px)",
  overflow: "hidden", isolation: "isolate",
  borderRadius: 18,
  border: "1px solid var(--window-glass-border-hover, rgba(255,255,255,0.22))",
  background: "radial-gradient(130% 120% at 0% 0%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0) 72%), linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%), linear-gradient(180deg, var(--window-glass-surface-strong-bg, rgba(128,128,128,0.11)) 0%, rgba(68,68,68,0.22) 100%)",
  backdropFilter: "blur(25px) saturate(1.22)",
  WebkitBackdropFilter: "blur(25px) saturate(1.22)",
  boxShadow: "0 22px 48px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.18)",
  padding: 8, zIndex: 320,
  transition: "top 160ms ease, left 160ms ease, opacity 120ms ease",
});

const PopoverAction = styled.button({
  width: "100%", border: "none", borderRadius: 12, background: "transparent",
  color: "var(--text-color, #e5e7eb)", textAlign: "left",
  padding: "10px 12px", fontSize: TYPE_SCALE.meta, fontWeight: 600, cursor: "pointer",
  transition: "background 160ms ease, color 160ms ease, transform 160ms ease",
  "&:hover": { background: "rgba(255,255,255,0.08)", color: "#ffffff", transform: "translateY(-1px)" },
});

// ─── Component ────────────────────────────────────────────────────────────────

const TAB_ITEMS = [
  { id: "overview",  label: "Overview"  },
  { id: "holdings",  label: "Holdings"  },
  { id: "cashflow",  label: "Cashflow"  },
];

export default function Dashboard({
  assets, liabilities, incomes, expenses, goals,
  currency, snapshots, onSnapshot, onAddAsset,
  isMobile, onToast, onNavigate,
}) {
  const dashboardRef = useRef(null);
  const quickPopoverAnchorRef = useRef(null);
  const quickPopoverRef = useRef(null);

  const [activeTab,         setActiveTab]         = useState("overview");
  const [assetSearch,       setAssetSearch]       = useState("");
  const [assetFilter,       setAssetFilter]       = useState("all");
  const [assetSort,         setAssetSort]         = useState("value_desc");
  const [showQuickPopover,  setShowQuickPopover]  = useState(false);
  const [quickPopoverStyle, setQuickPopoverStyle] = useState(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [showAddModal,      setShowAddModal]      = useState(false);
  const [selectedType,      setSelectedType]      = useState("stocks");
  const [holdingsPage,      setHoldingsPage]      = useState(1);
  const [cashflowPage,      setCashflowPage]      = useState(1);

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalAssets      = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth         = totalAssets - totalLiabilities;
  const debtRatio        = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
  const totalIncome      = incomes.reduce((s, i) => s + i.amount, 0);
  const totalExpenses    = expenses.reduce((s, e) => s + e.amount, 0);
  const savingsRate      = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const c                = CURRENCIES.find((item) => item.code === currency) || CURRENCIES[0];
  const today            = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const allocationData = useMemo(() =>
    ASSET_TYPES
      .filter((type) => assets.filter((a) => a.typeId === type.id).reduce((s, a) => s + a.value, 0) > 0)
      .map((type) => ({
        name: type.label,
        value: assets.filter((a) => a.typeId === type.id).reduce((s, a) => s + a.value, 0),
        color: type.color,
      })),
    [assets]
  );

  const tableAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase();
    let rows = assets.filter((a) => {
      if (assetFilter !== "all" && a.typeId !== assetFilter) return false;
      return !q || String(a.name || "").toLowerCase().includes(q);
    });
    return [...rows].sort((a, b) => {
      if (assetSort === "value_asc")  return a.value - b.value;
      if (assetSort === "value_desc") return b.value - a.value;
      if (assetSort === "name_desc")  return String(b.name || "").localeCompare(String(a.name || ""));
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [assets, assetSearch, assetFilter, assetSort]);

  const combinedCashflow = useMemo(() => {
    const rows = [
      ...incomes.map((e) => ({ id: `inc-${e.id}`, date: e.date || "-", type: "Income",  name: e.name || "Income",  amount: e.amount || 0, currency: e.currency || currency, color: "#16a34a" })),
      ...expenses.map((e) => ({ id: `exp-${e.id}`, date: e.date || "-", type: "Expense", name: e.name || "Expense", amount: e.amount || 0, currency: e.currency || currency, color: "#ef4444" })),
    ];
    return rows.sort((a, b) => b.amount - a.amount);
  }, [incomes, expenses, currency]);

  const snapshotChartData = useMemo(() => buildSnapshotChartData(snapshots), [snapshots]);
  const pagedTableAssets  = useMemo(() => getPaginatedRows(tableAssets,     holdingsPage), [tableAssets,     holdingsPage]);
  const pagedCashflowRows = useMemo(() => getPaginatedRows(combinedCashflow, cashflowPage), [combinedCashflow, cashflowPage]);

  // ── Page-guard effects ─────────────────────────────────────────────────────
  useEffect(() => { setHoldingsPage(1); }, [assetSearch, assetFilter, assetSort]);
  useEffect(() => {
    const total = getTotalPages(tableAssets.length);
    if (holdingsPage > total) setHoldingsPage(total);
  }, [tableAssets.length, holdingsPage]);
  useEffect(() => {
    const total = getTotalPages(combinedCashflow.length);
    if (cashflowPage > total) setCashflowPage(total);
  }, [combinedCashflow.length, cashflowPage]);

  // ── Popover positioning ────────────────────────────────────────────────────
  useEffect(() => {
    if (!showQuickPopover) return;
    const close = () => setShowQuickPopover(false);
    const closeEsc = (e) => { if (e.key === "Escape") setShowQuickPopover(false); };
    window.addEventListener("click", close);
    window.addEventListener("keydown", closeEsc);
    return () => { window.removeEventListener("click", close); window.removeEventListener("keydown", closeEsc); };
  }, [showQuickPopover]);

  useEffect(() => {
    if (!showQuickPopover) { setQuickPopoverStyle(null); return; }
    const update = () => {
      const anchor = quickPopoverAnchorRef.current;
      const popover = quickPopoverRef.current;
      if (!anchor || !popover) return;
      const ar = anchor.getBoundingClientRect();
      const pr = popover.getBoundingClientRect();
      const w = Math.min(pr.width || 220, window.innerWidth - 32);
      const h = pr.height || 0;
      const inset = 16;
      const left = Math.min(Math.max(ar.right - w, inset), Math.max(inset, window.innerWidth - w - inset));
      const belowTop = ar.bottom + 8;
      const top = belowTop + h <= window.innerHeight - inset ? belowTop : Math.max(inset, ar.top - h - 8);
      setQuickPopoverStyle({ left, top, opacity: 1 });
    };
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [showQuickPopover]);

  // ── GSAP entrance animation ────────────────────────────────────────────────
  useEffect(() => {
    if (!dashboardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".dashboard-anim",
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power3.out", clearProps: "opacity,transform" }
      );
    }, dashboardRef);
    return () => ctx.revert();
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSnapshot = () => {
    onToast?.("Snapshot captured and timeline updated.", "success");
    setShowSnapshotModal(false);
    onSnapshot();
  };
  const handleNavigate = (navId) => { onNavigate?.(navId); setShowQuickPopover(false); };
  const openAssetFromModal = () => {
    setShowAddModal(false);
    onToast?.(`Opening ${ASSET_TYPES.find((t) => t.id === selectedType)?.label || "asset"} flow.`, "info");
    onAddAsset?.(selectedType);
  };

  const activeDashboardTabIndex = Math.max(0, TAB_ITEMS.findIndex((t) => t.id === activeTab));

  const quickActionsPopover = showQuickPopover && typeof document !== "undefined"
    ? createPortal(
        <PopoverCard ref={quickPopoverRef} role="menu" onClick={(e) => e.stopPropagation()} style={quickPopoverStyle || { opacity: 0, pointerEvents: "none" }}>
          <PopoverAction onClick={() => { setShowSnapshotModal(true); setShowQuickPopover(false); }}>Save snapshot</PopoverAction>
          <PopoverAction onClick={() => { setShowAddModal(true);      setShowQuickPopover(false); }}>Open add asset</PopoverAction>
          <PopoverAction onClick={() => handleNavigate("expenses")}>Open expenses page</PopoverAction>
          <PopoverAction onClick={() => handleNavigate("insights")}>Open insights page</PopoverAction>
        </PopoverCard>,
        document.body
      )
    : null;

  const btnStyle = buttonStyles.primary;

  return (
    <DashboardWrap ref={dashboardRef} $isMobile={isMobile}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <HeroPanel className="dashboard-anim" $isMobile={isMobile}>
        <div>
          <HeroLabel>Net Worth — {currency}</HeroLabel>
          <HeroValue>{c.symbol}{netWorth.toLocaleString()}</HeroValue>
          <HeroMeta>{today}</HeroMeta>
        </div>
        <ActionCluster>
          <PrimaryButton onClick={() => setShowSnapshotModal(true)}>Take Snapshot</PrimaryButton>
          <SecondaryButton onClick={() => setShowAddModal(true)}>Add Asset</SecondaryButton>
        </ActionCluster>
      </HeroPanel>

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <StatGrid className="dashboard-anim" $isMobile={isMobile}>
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

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <DashboardTabs className="dashboard-anim" $isMobile={isMobile} $count={TAB_ITEMS.length} $activeIndex={activeDashboardTabIndex}>
        {TAB_ITEMS.map((tab) => (
          <TabButton key={tab.id} type="button" $active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </TabButton>
        ))}
      </DashboardTabs>

      {/* ── Overview tab ─────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <PanelGrid className="dashboard-anim" $isMobile={isMobile}>
          {/* Net Worth Trend */}
          <PanelCard className="dashboard-anim">
            <PanelTitle>Net Worth Trend</PanelTitle>
            <PanelHint>Smooth trend chart from your snapshots.</PanelHint>
            {snapshots.length < 2 ? (
              <EmptyBlock>Take two snapshots to unlock trend visualization.</EmptyBlock>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={snapshotChartData}>
                  <XAxis dataKey="chartKey" tick={{ fontSize: TYPE_SCALE.micro }} tickFormatter={(v) => snapshotChartData.find((s) => s.chartKey === v)?.chartTick ?? v} />
                  <YAxis tick={{ fontSize: TYPE_SCALE.micro }} tickFormatter={(v) => formatCurrency(v, currency)} />
                  <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.tooltipLabel ?? ""} formatter={(v) => formatCurrency(v, currency)} />
                  <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2.4} dot={{ r: 3, fill: "#16a34a" }} isAnimationActive />
                </LineChart>
              </ResponsiveContainer>
            )}
          </PanelCard>

          {/* Allocation */}
          <PanelCard className="dashboard-anim">
            <PanelTitle>Allocation</PanelTitle>
            <PanelHint>Current spread by asset class.</PanelHint>
            {allocationData.length === 0 ? (
              <EmptyBlock>Add assets to populate allocation.</EmptyBlock>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={allocationData} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={36} isAnimationActive>
                      {allocationData.map((slice, i) => <Cell key={`${slice.name}-${i}`} fill={slice.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(v, currency)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "grid", gap: 7 }}>
                  {allocationData.map((slice) => (
                    <div key={slice.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: TYPE_SCALE.meta }}>
                      <span style={{ width: 9, height: 9, borderRadius: 99, background: slice.color }} />
                      <span style={{ flex: 1, color: "rgba(255,255,255,0.65)" }}>{slice.name}</span>
                      <strong>{formatCurrency(slice.value, currency)}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </PanelCard>

          {/* Cashflow Insights */}
          <PanelCard className="dashboard-anim">
            <PanelTitle>Cashflow Insights</PanelTitle>
            <PanelHint>Income vs Expenses track record.</PanelHint>
            <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
              {[
                { label: "TOTAL INCOME",   value: totalIncome,              color: "#22c55e", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.2)",  emoji: "💸" },
                { label: "TOTAL EXPENSES", value: totalExpenses,            color: "#ef4444", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.2)",  emoji: "🧾" },
                { label: "NET CASHFLOW",   value: totalIncome - totalExpenses,
                  color: totalIncome >= totalExpenses ? "#38bdf8" : "#f97316",
                  bg: totalIncome >= totalExpenses ? "rgba(56,189,248,0.08)" : "rgba(249,115,22,0.08)",
                  border: totalIncome >= totalExpenses ? "rgba(56,189,248,0.2)" : "rgba(249,115,22,0.2)",
                  emoji: totalIncome >= totalExpenses ? "📈" : "📉",
                },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: row.bg, borderRadius: 12, border: `1px solid ${row.border}` }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{row.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: row.color }}>{formatCurrency(row.value, currency)}</div>
                  </div>
                  <div style={{ fontSize: 24 }}>{row.emoji}</div>
                </div>
              ))}
            </div>
            <button onClick={() => handleNavigate("insights")} style={{ ...btnStyle, width: "100%", marginTop: 16, background: "rgba(255,255,255,0.05)", color: "white" }}>
              View Full Insights
            </button>
          </PanelCard>

          {/* Active Goals */}
          <PanelCard className="dashboard-anim">
            <PanelTitle>Active Goals</PanelTitle>
            <PanelHint>Track your financial targets.</PanelHint>
            {goals && goals.length > 0 ? (
              <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
                {goals.slice(0, 3).map((goal) => {
                  let current = goal.manualCurrent ?? goal.current ?? 0;
                  if (goal.trackBy === "asset" && goal.linkedAssetId) {
                    const asset = assets.find((a) => a.id === goal.linkedAssetId);
                    if (asset) current = asset.value;
                  }
                  const pct = goal.target > 0 ? Math.min((current / goal.target) * 100, 100) : 0;
                  const barColor = pct >= 60 ? "#22c55e" : pct >= 25 ? "#f97316" : "#ef4444";
                  return (
                    <div key={goal.id} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{goal.icon} {goal.name}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>{pct.toFixed(0)}%</div>
                      </div>
                      <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.1)" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: barColor }} />
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                        <span>{formatCurrency(current, currency)}</span>
                        <span>{formatCurrency(goal.target, currency)}</span>
                      </div>
                    </div>
                  );
                })}
                {goals.length > 3 && (
                  <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
                    + {goals.length - 3} more goals
                  </div>
                )}
              </div>
            ) : (
              <EmptyBlock>Create a goal to see progress here.</EmptyBlock>
            )}
            <button onClick={() => handleNavigate("goals")} style={{ ...btnStyle, width: "100%", marginTop: 16, background: "rgba(255,255,255,0.05)", color: "white" }}>
              Manage Goals
            </button>
          </PanelCard>
        </PanelGrid>
      )}

      {/* ── Holdings tab ─────────────────────────────────────────────────── */}
      {activeTab === "holdings" && (
        <PanelCard className="dashboard-anim">
          <PanelTitle>Asset Table</PanelTitle>
          <PanelHint>Search, filter and sort your holdings.</PanelHint>
          <Toolbar $isMobile={isMobile}>
            <Field value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)} placeholder="Search by asset name" />
            <Select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)}>
              <option value="all">All Types</option>
              {ASSET_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
            <Select value={assetSort} onChange={(e) => setAssetSort(e.target.value)}>
              <option value="value_desc">Sort: Value High-Low</option>
              <option value="value_asc">Sort: Value Low-High</option>
              <option value="name_asc">Sort: Name A-Z</option>
              <option value="name_desc">Sort: Name Z-A</option>
            </Select>
          </Toolbar>
          <TableResultsText>Showing {pagedTableAssets.length} of {tableAssets.length} holdings</TableResultsText>
          {tableAssets.length === 0 ? (
            <EmptyBlock>No holdings match your current filters.</EmptyBlock>
          ) : (
            <>
              {isMobile ? (
                <MobileDataList>
                  {pagedTableAssets.map((asset) => {
                    const type = ASSET_TYPES.find((t) => t.id === asset.typeId);
                    return (
                      <MobileRecordCard
                        key={asset.id}
                        title={asset.name}
                        subtitle={type?.label || "Other"}
                        badge={asset.currency || currency}
                        fields={[
                          { label: "Category", value: `${type?.icon || ""} ${type?.label || "Other"}`.trim() },
                          { label: "Value",    value: formatCurrency(asset.value, asset.currency || currency) },
                        ]}
                      />
                    );
                  })}
                </MobileDataList>
              ) : (
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
                        const type = ASSET_TYPES.find((t) => t.id === asset.typeId);
                        return (
                          <tr key={asset.id}>
                            <TableCell title={asset.name}>{asset.name}</TableCell>
                            <TableCell>{type?.label || "Other"}</TableCell>
                            <TableCell>{asset.currency || currency}</TableCell>
                            <TableCell>{formatCurrency(asset.value, asset.currency || currency)}</TableCell>
                          </tr>
                        );
                      })}
                    </tbody>
                  </DataTable>
                </TableWrap>
              )}
              <DataTablePagination totalRows={tableAssets.length} currentPage={holdingsPage} onPageChange={setHoldingsPage} />
            </>
          )}
        </PanelCard>
      )}

      {/* ── Cashflow tab ─────────────────────────────────────────────────── */}
      {activeTab === "cashflow" && (
        <PanelGrid className="dashboard-anim" $isMobile={isMobile}>
          <PanelCard className="dashboard-anim">
            <PanelTitle>Cashflow Items</PanelTitle>
            <PanelHint>All income and expense records.</PanelHint>
            {combinedCashflow.length === 0 ? (
              <EmptyBlock>Add income and expense entries to view cashflow.</EmptyBlock>
            ) : (
              <>
                <TableResultsText>Showing {pagedCashflowRows.length} of {combinedCashflow.length} cashflow items</TableResultsText>
                {isMobile ? (
                  <MobileDataList>
                    {pagedCashflowRows.map((entry) => (
                      <MobileRecordCard
                        key={entry.id} title={entry.name} subtitle={entry.date || "-"} badge={entry.type}
                        fields={[
                          { label: "Type",   value: entry.type, valueStyle: { color: entry.color } },
                          { label: "Amount", value: formatCurrency(entry.amount, entry.currency) },
                        ]}
                      />
                    ))}
                  </MobileDataList>
                ) : (
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
                            <TableCell><span style={{ color: entry.color, fontWeight: 700, fontSize: TYPE_SCALE.meta }}>{entry.type}</span></TableCell>
                            <TableCell>{entry.date || "-"}</TableCell>
                            <TableCell>{formatCurrency(entry.amount, entry.currency)}</TableCell>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  </TableWrap>
                )}
                <DataTablePagination totalRows={combinedCashflow.length} currentPage={cashflowPage} onPageChange={setCashflowPage} />
              </>
            )}
          </PanelCard>
        </PanelGrid>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {showSnapshotModal && (
        <ModalBackdrop onClick={() => setShowSnapshotModal(false)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTitle>Capture Net Worth Snapshot</ModalTitle>
            <ModalText>This creates a point-in-time value for trend analysis.</ModalText>
            <ModalActions>
              <SecondaryButton onClick={() => setShowSnapshotModal(false)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={handleSnapshot}>Save Snapshot</PrimaryButton>
            </ModalActions>
          </ModalCard>
        </ModalBackdrop>
      )}

      {showAddModal && (
        <ModalBackdrop onClick={() => setShowAddModal(false)}>
          <ModalCard onClick={(e) => e.stopPropagation()}>
            <ModalTitle>Choose Asset Type</ModalTitle>
            <ModalText>Select a primary category, then continue to the full add-asset page.</ModalText>
            <Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
              {ASSET_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
            <ModalActions>
              <SecondaryButton onClick={() => setShowAddModal(false)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={openAssetFromModal}>Continue</PrimaryButton>
            </ModalActions>
          </ModalCard>
        </ModalBackdrop>
      )}

      {quickActionsPopover}
    </DashboardWrap>
  );
}
