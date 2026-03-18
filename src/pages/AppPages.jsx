import { useState, useEffect, useRef, useMemo } from "react";
import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend } from "recharts";
import { CURRENCIES, ASSET_TYPES, LIABILITY_TYPES, GOAL_ICONS } from "../constants";
import { formatCurrency } from "../utils/formatCurrency";
import { buildSnapshotChartData } from "../utils/formatting";
import { sanitizeInput } from "../utils/security";
import { calcOutstanding, formatClosingIn, calcPctPaid } from "../utils/liabilityCalc";
import { useIsMobile } from "../hooks/useWindowSize";
import { parseHdfcStatementFile, buildImportedHdfcEntries } from "../services/hdfcImportService";
import { parseAngelOneHoldingsFile, buildAngelOneAssetEntries } from "../services/angelOneImportService";
import { AddAssetForm, AddLiabilityForm } from "../components/forms/AssetForms";
import { buttonStyles, cardStyle as sharedCardStyle, inputStyle as sharedInputStyle, labelStyle as sharedLabelStyle, serifFontFamily, heroGradient } from "../styles";
import LiquidGlassCard from "../components/LiquidGlassCard";


const TOAST_EVENT_NAME = "wealthtracker:toast";
const btnStyle = buttonStyles.primary;
const cardStyle = sharedCardStyle;
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
export function Dashboard({
  assets,
  liabilities,
  incomes,
  expenses,
  goals,
  currency,
  snapshots,
  onSnapshot,
  onAddAsset,
  isMobile,
  onToast,
  onNavigate,
}) {
  const dashboardRef = useRef(null);
  const quickPopoverAnchorRef = useRef(null);
  const quickPopoverRef = useRef(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("all");
  const [assetSort, setAssetSort] = useState("value_desc");
  const [showQuickPopover, setShowQuickPopover] = useState(false);
  const [quickPopoverStyle, setQuickPopoverStyle] = useState(null);
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

  const snapshotChartData = useMemo(() => buildSnapshotChartData(snapshots), [snapshots]);

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
    const closePopoverOnEscape = (event) => {
      if (event.key === "Escape") {
        setShowQuickPopover(false);
      }
    };
    window.addEventListener("click", closePopover);
    window.addEventListener("keydown", closePopoverOnEscape);
    return () => {
      window.removeEventListener("click", closePopover);
      window.removeEventListener("keydown", closePopoverOnEscape);
    };
  }, [showQuickPopover]);

  useEffect(() => {
    if (!showQuickPopover) {
      setQuickPopoverStyle(null);
      return undefined;
    }

    const updateQuickPopoverPosition = () => {
      const anchor = quickPopoverAnchorRef.current;
      const popover = quickPopoverRef.current;
      if (!anchor || !popover) return;

      const anchorRect = anchor.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const width = Math.min(popoverRect.width || 220, window.innerWidth - 32);
      const height = popoverRect.height || 0;
      const inset = 16;
      const maxLeft = Math.max(inset, window.innerWidth - width - inset);
      const left = Math.min(Math.max(anchorRect.right - width, inset), maxLeft);
      const belowTop = anchorRect.bottom + 8;
      const top = belowTop + height <= window.innerHeight - inset
        ? belowTop
        : Math.max(inset, anchorRect.top - height - 8);

      setQuickPopoverStyle({ left, top, opacity: 1 });
    };

    const frame = window.requestAnimationFrame(updateQuickPopoverPosition);
    window.addEventListener("resize", updateQuickPopoverPosition);
    window.addEventListener("scroll", updateQuickPopoverPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateQuickPopoverPosition);
      window.removeEventListener("scroll", updateQuickPopoverPosition, true);
    };
  }, [showQuickPopover]);

  useEffect(() => {
    if (!dashboardRef.current) return undefined;

    // Run entrance animation only once per dashboard mount.
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".dashboard-anim",
        { autoAlpha: 0, y: 12 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.06,
          ease: "power3.out",
          clearProps: "opacity,transform",
        }
      );
    }, dashboardRef);

    return () => ctx.revert();
  }, []);

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

  const dashboardTabItems = [
    { id: "overview", label: "Overview" },
    { id: "holdings", label: "Holdings" },
    { id: "cashflow", label: "Cashflow" },
  ];
  const activeDashboardTabIndex = Math.max(
    0,
    dashboardTabItems.findIndex((tab) => tab.id === activeTab)
  );
  const quickActionsPopover = showQuickPopover && typeof document !== "undefined"
    ? createPortal(
      <PopoverCard
        ref={quickPopoverRef}
        role="menu"
        onClick={(event) => event.stopPropagation()}
        style={quickPopoverStyle || { opacity: 0, pointerEvents: "none" }}
      >
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
      </PopoverCard>,
      document.body
    )
    : null;

  return (
    <DashboardWrap ref={dashboardRef} $isMobile={isMobile}>
      <HeroPanel className="dashboard-anim" $isMobile={isMobile}>
        <div>
          <HeroLabel>Net Worth - {currency}</HeroLabel>
          <HeroValue>{c.symbol}{netWorth.toLocaleString()}</HeroValue>
          <HeroMeta>{today}</HeroMeta>
        </div>
        <ActionCluster>
          <PrimaryButton onClick={() => setShowSnapshotModal(true)}>Take Snapshot</PrimaryButton>
          <SecondaryButton onClick={() => setShowAddModal(true)}>Add Asset</SecondaryButton>
        </ActionCluster>
      </HeroPanel>

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

      <DashboardTabs
        className="dashboard-anim"
        $isMobile={isMobile}
        $count={dashboardTabItems.length}
        $activeIndex={activeDashboardTabIndex}
      >
        {dashboardTabItems.map((tab) => (
          <TabButton
            key={tab.id}
            type="button"
            className="segmented-tab-btn"
            $active={activeTab === tab.id}
            onClick={(event) => {
              event.preventDefault();
              setActiveTab(tab.id);
            }}
          >
            {tab.label}
          </TabButton>
        ))}
      </DashboardTabs>

      {activeTab === "overview" && (
        <PanelGrid className="dashboard-anim" $isMobile={isMobile}>
          <PanelCard className="dashboard-anim">
            <PanelTitle>Net Worth Trend</PanelTitle>
            <PanelHint>Smooth trend chart from your snapshots.</PanelHint>
            {snapshots.length < 2 ? (
              <EmptyBlock>Take two snapshots to unlock trend visualization.</EmptyBlock>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={snapshotChartData}>
                  <XAxis
                    dataKey="chartKey"
                    tick={{ fontSize: TYPE_SCALE.micro }}
                    tickFormatter={(value) => snapshotChartData.find((snapshot) => snapshot.chartKey === value)?.chartTick ?? value}
                  />
                  <YAxis tick={{ fontSize: TYPE_SCALE.micro }} tickFormatter={(value) => formatCurrency(value, currency)} />
                  <Tooltip
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel ?? ""}
                    formatter={(value) => formatCurrency(value, currency)}
                  />
                  <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2.4} dot={{ r: 3, fill: "#16a34a" }} isAnimationActive />
                </LineChart>
              </ResponsiveContainer>
            )}
          </PanelCard>
          <PanelCard className="dashboard-anim">
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
                      <span style={{ flex: 1, color: "rgba(255, 255, 255, 0.65)" }}>{slice.name}</span>
                      <strong>{formatCurrency(slice.value, currency)}</strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </PanelCard>
          
          <PanelCard className="dashboard-anim">
            <PanelTitle>Cashflow Insights</PanelTitle>
            <PanelHint>Income vs Expenses track record.</PanelHint>
            <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "rgba(34, 197, 94, 0.08)", borderRadius: 12, border: "1px solid rgba(34, 197, 94, 0.2)" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255, 255, 255, 0.5)", marginBottom: 4 }}>TOTAL INCOME</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#22c55e" }}>{formatCurrency(totalIncome, currency)}</div>
                </div>
                <div style={{ fontSize: 24 }}>💸</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "rgba(239, 68, 68, 0.08)", borderRadius: 12, border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255, 255, 255, 0.5)", marginBottom: 4 }}>TOTAL EXPENSES</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#ef4444" }}>{formatCurrency(totalExpenses, currency)}</div>
                </div>
                <div style={{ fontSize: 24 }}>🧾</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: totalIncome >= totalExpenses ? "rgba(56, 189, 248, 0.08)" : "rgba(249, 115, 22, 0.08)", borderRadius: 12, border: `1px solid ${totalIncome >= totalExpenses ? 'rgba(56, 189, 248, 0.2)' : 'rgba(249, 115, 22, 0.2)'}` }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255, 255, 255, 0.5)", marginBottom: 4 }}>NET CASHFLOW</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: totalIncome >= totalExpenses ? "#38bdf8" : "#f97316" }}>{formatCurrency(totalIncome - totalExpenses, currency)}</div>
                </div>
                <div style={{ fontSize: 24 }}>{totalIncome >= totalExpenses ? "📈" : "📉"}</div>
              </div>
            </div>
            <button onClick={() => handleNavigate("insights")} style={{ ...btnStyle, width: "100%", marginTop: 16, background: "rgba(255,255,255,0.05)", color: "white" }}>View Full Insights</button>
          </PanelCard>

          <PanelCard className="dashboard-anim">
            <PanelTitle>Active Goals</PanelTitle>
            <PanelHint>Track your financial targets.</PanelHint>
            {goals && goals.length > 0 ? (
              <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
                {goals.slice(0, 3).map(goal => {
                  let current = goal.manualCurrent ?? goal.current ?? 0;
                  if (goal.trackBy === "asset" && goal.linkedAssetId) {
                    const asset = assets.find(a => a.id === goal.linkedAssetId);
                    if (asset) current = asset.value;
                  }
                  const pct = goal.target > 0 ? Math.min((current / goal.target) * 100, 100) : 0;
                  return (
                    <div key={goal.id} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{goal.icon} {goal.name}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>{pct.toFixed(0)}%</div>
                      </div>
                      <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.1)" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: pct >= 100 ? "#22c55e" : pct >= 60 ? "#22c55e" : pct >= 25 ? "#f97316" : "#ef4444" }} />
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                        <span>{formatCurrency(current, currency)}</span>
                        <span>{formatCurrency(goal.target, currency)}</span>
                      </div>
                    </div>
                  );
                })}
                {goals.length > 3 && (
                  <div style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>+ {goals.length - 3} more goals</div>
                )}
              </div>
            ) : (
              <EmptyBlock>Create a goal to see progress here.</EmptyBlock>
            )}
            <button onClick={() => handleNavigate("goals")} style={{ ...btnStyle, width: "100%", marginTop: 16, background: "rgba(255,255,255,0.05)", color: "white" }}>Manage Goals</button>
          </PanelCard>
        </PanelGrid>
      )}

      {activeTab === "holdings" && (
        <PanelCard className="dashboard-anim">
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
          <TableResultsText>
            Showing {pagedTableAssets.length} of {tableAssets.length} holdings
          </TableResultsText>

          {tableAssets.length === 0 ? (
            <EmptyBlock>No holdings match your current filters.</EmptyBlock>
          ) : (
            <>
              {isMobile ? (
                <MobileDataList>
                  {pagedTableAssets.map((asset) => {
                    const type = ASSET_TYPES.find((item) => item.id === asset.typeId);
                    return (
                      <MobileRecordCard
                        key={asset.id}
                        title={asset.name}
                        subtitle={type?.label || "Other"}
                        badge={asset.currency || currency}
                        fields={[
                          { label: "Category", value: `${type?.icon || ""} ${type?.label || "Other"}`.trim() },
                          { label: "Value", value: formatCurrency(asset.value, asset.currency || currency) },
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
              )}
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
        <PanelGrid className="dashboard-anim" $isMobile={isMobile}>
          <PanelCard className="dashboard-anim">
          <PanelTitle>Cashflow Items</PanelTitle>
          <PanelHint>All income and expense records.</PanelHint>
          {combinedCashflow.length === 0 ? (
            <EmptyBlock>Add income and expense entries to view cashflow.</EmptyBlock>
          ) : (
            <>
              <TableResultsText>
                Showing {pagedCashflowRows.length} of {combinedCashflow.length} cashflow items
              </TableResultsText>
              {isMobile ? (
                <MobileDataList>
                  {pagedCashflowRows.map((entry) => (
                    <MobileRecordCard
                      key={entry.id}
                      title={entry.name}
                      subtitle={entry.date || "-"}
                      badge={entry.type}
                      fields={[
                        { label: "Type", value: entry.type, valueStyle: { color: entry.color } },
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
              )}
              <DataTablePagination
                totalRows={combinedCashflow.length}
                currentPage={cashflowPage}
                onPageChange={setCashflowPage}
              />
              </>
            )}
          </PanelCard>
          <PanelCard className="dashboard-anim" style={{ display: 'flex', flexDirection: 'column' }}>
            <div>
              <PanelTitle>Cashflow Balance</PanelTitle>
              <PanelHint>Income vs expense split.</PanelHint>
            </div>
            
            {(totalIncome + totalExpenses) === 0 ? (
              <EmptyBlock style={{ flexGrow: 1, display: 'grid', placeContent: 'center' }}>
                No data available for split chart.
              </EmptyBlock>
            ) : (
              <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                <ResponsiveContainer width="100%" height="90%">
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
              </div>
            )}

            <div style={{ marginTop: 8, fontSize: TYPE_SCALE.meta, color: "rgba(255, 255, 255, 0.65)", display: "grid", gap: 6 }}>
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
function SummaryCard({ icon, label, value, sub, color, negative, animated = false }) {
  const content = (
    <>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: TYPE_SCALE.micro, fontWeight: 600, color: "#94a3b8", letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
        <div style={{ fontFamily: serifFontFamily, fontSize: TYPE_SCALE.h1, fontWeight: 700, color: negative ? "var(--error)" : "var(--text-color)" }}>{value}</div>
        <div style={{ fontSize: TYPE_SCALE.meta, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
      </div>
    </>
  );

  return (
    <LiquidGlassCard style={{ display: "flex", gap: 16, alignItems: "flex-start", height: "100%" }}>
      {content}
    </LiquidGlassCard>
  );
}

export function AssetsPage({ assets, currency, onAdd, onUpdate, onDelete, onImportHoldings, openAssetComposerRequest, onConsumeAssetComposerRequest }) {
  const isMobile = useIsMobile();
  const [showAdd, setShowAdd] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [selectedType, setSelectedType] = useState("stocks");
  const [pickingType, setPickingType] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("value_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const importInputRef = useRef(null);
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalInvested = assets.reduce((s, a) => s + (a.invested ?? a.value), 0);
  const overallPnl = totalAssets - totalInvested;
  const overallPnlPct = totalInvested > 0 ? (overallPnl / totalInvested) * 100 : 0;

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
      if (sortBy === "pnl_desc") return ((b.pnl ?? 0)) - ((a.pnl ?? 0));
      if (sortBy === "pnl_asc") return ((a.pnl ?? 0)) - ((b.pnl ?? 0));
      if (sortBy === "invested_desc") return (b.invested ?? b.value) - (a.invested ?? a.value);
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
    setEditingAsset(null);
  };
  
  const handleEdit = (asset) => {
    setEditingAsset(asset);
    setSelectedType(asset.typeId);
    setPickingType(false);
    setShowAdd(true);
  };

  const handleSaveAsset = (asset) => {
    if (editingAsset) {
      onUpdate(asset);
    } else {
      onAdd(asset);
    }
    closeAddModal();
  };

  const handleAngelOneImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsedRows = await parseAngelOneHoldingsFile(file);
      const assetEntries = buildAngelOneAssetEntries(parsedRows, currency);

      if (!assetEntries || assetEntries.length === 0) {
        notifyApp("No valid holdings found in this AngelOne statement.", "warning");
        return;
      }

      if (typeof onImportHoldings === "function") {
        onImportHoldings(assetEntries);
      }

      notifyApp(
        `Imported ${assetEntries.length} holding${assetEntries.length === 1 ? "" : "s"} from AngelOne statement.`,
        "success"
      );
    } catch (error) {
      // Helpful for debugging in browser console
      // eslint-disable-next-line no-console
      console.error("AngelOne import failed", error);
      notifyApp("Unable to import this file. Please upload a valid AngelOne holdings statement (.xls/.xlsx).", "error");
    } finally {
      event.target.value = "";
    }
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
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "rgba(255, 255, 255, 0.95)" }}>Assets</h2>
          <p style={{ color: "rgba(255, 255, 255, 0.65)", fontSize: 14 }}>Total: {formatCurrency(totalAssets, currency)}</p>
        </div>
        <PageHeaderActions $isMobile={isMobile}>
          <input
            ref={importInputRef}
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleAngelOneImport}
            style={{ display: "none" }}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            style={{ ...buttonStyles.secondary, padding: "10px 14px", fontSize: 13, width: isMobile ? "100%" : "auto" }}
          >
            Import AngelOne Holdings
          </button>
          <button
            onClick={() => {
              setEditingAsset(null);
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
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        borderRadius: 10,
                        padding: "10px 8px",
                        cursor: "pointer",
                        textAlign: "center",
                        fontSize: 12,
                        color: "rgba(255, 255, 255, 0.95)",
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
                editData={editingAsset}
                typeId={selectedType}
                onSave={handleSaveAsset}
                onCancel={() => {
                  if (editingAsset) {
                    closeAddModal();
                  } else {
                    setPickingType(true);
                  }
                }}
              />
            )}
          </ModalCard>
        </ModalBackdrop>
      )}

      {assets.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u{1F3DB}\uFE0F"}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "rgba(255, 255, 255, 0.65)" }}>No assets yet</div>
          <div>Add your first asset to start tracking your wealth</div>
        </div>
      ) : (
        <>
          {/* 4.1 SUMMARY BAR */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "TOTAL INVESTED", value: formatCurrency(totalInvested, currency), color: "#38bdf8", icon: "💼" },
              { label: "CURRENT VALUE", value: formatCurrency(totalAssets, currency), color: "#22c55e", icon: "📊" },
              {
                label: "OVERALL P&L",
                value: `${overallPnl >= 0 ? "+" : ""}${formatCurrency(overallPnl, currency)} (${overallPnlPct >= 0 ? "+" : ""}${overallPnlPct.toFixed(2)}%)`,
                color: overallPnl >= 0 ? "#22c55e" : "#ef4444",
                icon: overallPnl >= 0 ? "📈" : "📉",
              },
            ].map((tile) => (
              <div
                key={tile.label}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${tile.color}30`,
                  borderRadius: 14,
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 24 }}>{tile.icon}</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>{tile.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: tile.color }}>{tile.value}</div>
                </div>
              </div>
            ))}
          </div>

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
                <option value="value_desc">Sort: Value High→Low</option>
                <option value="value_asc">Sort: Value Low→High</option>
                <option value="pnl_desc">Sort: P&L High→Low</option>
                <option value="pnl_asc">Sort: P&L Low→High</option>
                <option value="invested_desc">Sort: Invested High→Low</option>
                <option value="name_asc">Sort: Name A→Z</option>
                <option value="name_desc">Sort: Name Z→A</option>
              </Select>
            </div>
            <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", marginTop: 8 }}>
              <button
                onClick={deleteSelectedAssets}
                disabled={selectedAssetIds.length === 0}
                style={{
                  ...btnStyle,
                  background: "var(--error, #f97316)",
                  padding: "8px 12px",
                  fontSize: 12,
                  width: isMobile ? "100%" : "auto",
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
              <TableResultsText>
                Showing {pagedAssetRows.length} of {assetRows.length} assets
              </TableResultsText>
              {isMobile ? (
                <MobileDataList>
                  <MobileDataCard>
                    <MobileDataSelection>
                      <input
                        type="checkbox"
                        checked={allAssetsOnPageSelected}
                        onChange={toggleSelectAllAssetsOnPage}
                        aria-label="Select all assets on this page"
                      />
                      <span>Select all items on this page</span>
                    </MobileDataSelection>
                  </MobileDataCard>
                  {pagedAssetRows.map((asset) => {
                    const type = ASSET_TYPES.find((item) => item.id === asset.typeId);
                    const assetInvested = asset.invested ?? asset.value;
                    const pnl = asset.pnl ?? (asset.value - assetInvested);
                    const pnlPct = asset.pnlPct ?? (assetInvested > 0 ? (pnl / assetInvested) * 100 : 0);
                    const allocPct = totalAssets > 0 ? ((asset.value / totalAssets) * 100).toFixed(1) : "0";
                    const isLive = !!asset.priceUpdatedAt;
                    const qty = asset.shares ?? asset.units ?? asset.weightGrams ?? null;
                    const qtyLabel = asset.typeId === "stocks" ? "shares" : asset.typeId === "gold" ? "g" : "units";
                    return (
                      <MobileRecordCard
                        key={asset.id}
                        title={asset.name}
                        subtitle={type?.label || "Other"}
                        badge={isLive ? "🟢 Live" : type?.label || "Other"}
                        selected={selectedAssetIds.includes(asset.id)}
                        onToggleSelect={() => toggleAssetSelection(asset.id)}
                        selectLabel={`Select ${asset.name}`}
                        fields={[
                          { label: "Type", value: `${type?.icon || ""} ${type?.label || "Other"}`.trim() },
                          qty !== null ? { label: `Qty (${qtyLabel})`, value: qty.toLocaleString("en-IN") } : null,
                          { label: "Invested", value: formatCurrency(assetInvested, currency) },
                          { label: "Current Value", value: formatCurrency(asset.value, currency) },
                          { label: "P&L", value: <span style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{pnl >= 0 ? "+" : ""}{formatCurrency(pnl, currency)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)</span> },
                          { label: "Allocation", value: `${allocPct}%` },
                        ].filter(Boolean)}
                        actions={(
                          <button onClick={() => handleEdit(asset)} style={{ ...buttonStyles.secondary, padding: "8px 12px", fontSize: 12, width: "100%" }}>
                            Modify
                          </button>
                        )}
                      />
                    );
                  })}
                </MobileDataList>
              ) : (
                <TableWrap>
                  <DataTable>
                    <thead>
                      <tr>
                        <TableHead style={{ width: "3%" }}>
                          <input type="checkbox" checked={allAssetsOnPageSelected} onChange={toggleSelectAllAssetsOnPage} aria-label="Select all assets on this page" />
                        </TableHead>
                        <TableHead style={{ width: "18%" }}>Asset</TableHead>
                        <TableHead style={{ width: "10%" }}>Type</TableHead>
                        <TableHead style={{ width: "8%" }}>Qty / Units</TableHead>
                        <TableHead style={{ width: "12%" }}>Invested ₹</TableHead>
                        <TableHead style={{ width: "12%" }}>Current Value</TableHead>
                        <TableHead style={{ width: "13%" }}>P&amp;L</TableHead>
                        <TableHead style={{ width: "8%" }}>Alloc %</TableHead>
                        <TableHead style={{ width: "9%" }}>Actions</TableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedAssetRows.map((asset) => {
                        const type = ASSET_TYPES.find((item) => item.id === asset.typeId);
                        const assetInvested = asset.invested ?? asset.value;
                        const pnl = asset.pnl ?? (asset.value - assetInvested);
                        const pnlPct = asset.pnlPct ?? (assetInvested > 0 ? (pnl / assetInvested) * 100 : 0);
                        const allocPct = totalAssets > 0 ? ((asset.value / totalAssets) * 100).toFixed(1) : "0";
                        const isLive = !!asset.priceUpdatedAt;
                        const qty = asset.shares ?? asset.units ?? asset.weightGrams ?? null;
                        return (
                          <tr key={asset.id}>
                            <TableCell>
                              <input type="checkbox" checked={selectedAssetIds.includes(asset.id)} onChange={() => toggleAssetSelection(asset.id)} aria-label={`Select ${asset.name}`} />
                            </TableCell>
                            <TableCell title={asset.name}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div>
                                  <div style={{ fontWeight: 600 }}>{asset.name}</div>
                                  {isLive && <span style={{ fontSize: 10, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 99, padding: "1px 6px", color: "#22c55e", fontWeight: 600 }}>LIVE</span>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{type?.icon || ""} {type?.label || "Other"}</TableCell>
                            <TableCell style={{ color: "rgba(255,255,255,0.7)" }}>
                              {qty !== null ? qty.toLocaleString("en-IN") : "—"}
                            </TableCell>
                            <TableCell>{formatCurrency(assetInvested, currency)}</TableCell>
                            <TableCell style={{ fontWeight: 600 }}>{formatCurrency(asset.value, currency)}</TableCell>
                            <TableCell>
                              <div style={{ fontWeight: 700, color: pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                                {pnl >= 0 ? "+" : ""}{formatCurrency(pnl, currency)}
                              </div>
                              <div style={{ fontSize: 11, color: pnl >= 0 ? "#22c55e" : "#ef4444", opacity: 0.8 }}>
                                {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                              </div>
                            </TableCell>
                            <TableCell>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <div style={{ flex: 1, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.1)", maxWidth: 40 }}>
                                  <div style={{ height: "100%", borderRadius: 99, background: "#38bdf8", width: `${Math.min(100, parseFloat(allocPct))}%` }} />
                                </div>
                                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{allocPct}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <button onClick={() => handleEdit(asset)} style={{ ...buttonStyles.secondary, padding: "4px 8px", fontSize: 12 }}>Modify</button>
                            </TableCell>
                          </tr>
                        );
                      })}
                    </tbody>
                  </DataTable>
                </TableWrap>
              )}
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

export function LiabilitiesPage({ liabilities, currency, onAdd, onUpdate, onDelete }) {
  const isMobile = useIsMobile();
  const [showAdd, setShowAdd] = useState(false);
  const [editingLiability, setEditingLiability] = useState(null);
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

  const closeAddModal = () => {
    setShowAdd(false);
    setEditingLiability(null);
  };

  const handleEdit = (liability) => {
    setEditingLiability(liability);
    setShowAdd(true);
  };

  const handleSaveLiability = (liability) => {
    if (editingLiability) {
      onUpdate(liability);
    } else {
      onAdd(liability);
    }
    closeAddModal();
  };

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "rgba(255, 255, 255, 0.95)" }}>Liabilities</h2>
          <p style={{ color: "rgba(255, 255, 255, 0.65)", fontSize: 14 }}>Total: <span style={{ color: "#ef4444" }}>{formatCurrency(total, currency)}</span></p>
        </div>
        <PageHeaderActions $isMobile={isMobile}>
          <button onClick={() => { setEditingLiability(null); setShowAdd(true); }} style={{ ...btnStyle, width: isMobile ? "100%" : "auto" }}>+ Add Liability</button>
        </PageHeaderActions>
      </PageHeader>

      {showAdd && (
        <ModalBackdrop onClick={closeAddModal}>
          <ModalCard $maxWidth={520} onClick={(event) => event.stopPropagation()}>
            <AddLiabilityForm
              editData={editingLiability}
              onSave={handleSaveLiability}
              onCancel={closeAddModal}
            />
          </ModalCard>
        </ModalBackdrop>
      )}

      {liabilities.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u2705"}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "rgba(255, 255, 255, 0.65)" }}>No liabilities!</div>
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
                  background: "var(--error, #f97316)",
                  padding: "8px 12px",
                  fontSize: 12,
                  width: isMobile ? "100%" : "auto",
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
              <TableResultsText>
                Showing {pagedLiabilityRows.length} of {liabilityRows.length} liabilities
              </TableResultsText>
              {isMobile ? (
                <MobileDataList>
                  <MobileDataCard>
                    <MobileDataSelection>
                      <input
                        type="checkbox"
                        checked={allLiabilitiesOnPageSelected}
                        onChange={toggleSelectAllLiabilitiesOnPage}
                        aria-label="Select all liabilities on this page"
                      />
                      <span>Select all items on this page</span>
                    </MobileDataSelection>
                  </MobileDataCard>
                  {pagedLiabilityRows.map((liability) => {
                    const outstanding = calcOutstanding(liability);
                    const closingIn = formatClosingIn(liability.endDate);
                    const pct = calcPctPaid(liability);
                    return (
                    <MobileRecordCard
                      key={liability.id}
                      title={liability.name}
                      subtitle={liability.label || "Liability"}
                      badge={liability.interest > 0 ? `${liability.interest}% p.a.` : "No interest"}
                      selected={selectedLiabilityIds.includes(liability.id)}
                      onToggleSelect={() => toggleLiabilitySelection(liability.id)}
                      selectLabel={`Select ${liability.name}`}
                      fields={[
                        { label: "Type", value: `${liability.icon || ""} ${liability.label || "-"}`.trim() },
                        { label: "Principal", value: liability.principal ? formatCurrency(liability.principal, currency) : formatCurrency(liability.value, currency) },
                        { label: "EMI / mo", value: liability.emi ? formatCurrency(liability.emi, currency) : "-" },
                        { label: "Outstanding", value: formatCurrency(outstanding, currency) },
                        { label: "Closing In", value: closingIn },
                        {
                          label: "% Paid",
                          value: (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ flex: 1, height: 6, borderRadius: 99, background: "rgba(255,255,255,0.12)" }}>
                                <div style={{ height: "100%", borderRadius: 99, background: "#22c55e", width: `${pct}%`, transition: "width 0.4s" }} />
                              </div>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{pct}%</span>
                            </div>
                          ),
                        },
                      ]}
                      actions={(
                        <button onClick={() => handleEdit(liability)} style={{ ...buttonStyles.secondary, padding: "8px 12px", fontSize: 12, width: "100%" }}>
                          Modify
                        </button>
                      )}
                    />
                    );
                  })}
                </MobileDataList>
              ) : (
                <TableWrap>
                  <DataTable>
                    <thead>
                      <tr>
                        <TableHead style={{ width: "4%" }}>
                          <input
                            type="checkbox"
                            checked={allLiabilitiesOnPageSelected}
                            onChange={toggleSelectAllLiabilitiesOnPage}
                            aria-label="Select all liabilities on this page"
                          />
                        </TableHead>
                        <TableHead style={{ width: "20%" }}>Liability</TableHead>
                        <TableHead style={{ width: "14%" }}>Type</TableHead>
                        <TableHead style={{ width: "11%" }}>EMI / mo</TableHead>
                        <TableHead style={{ width: "10%" }}>Start</TableHead>
                        <TableHead style={{ width: "16%" }}>Outstanding ₹</TableHead>
                        <TableHead style={{ width: "13%" }}>Closing In</TableHead>
                        <TableHead style={{ width: "12%" }}>Actions</TableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedLiabilityRows.map((liability) => {
                        const outstanding = calcOutstanding(liability);
                        const closingIn = formatClosingIn(liability.endDate);
                        const pct = calcPctPaid(liability);
                        return (
                        <tr key={liability.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedLiabilityIds.includes(liability.id)}
                              onChange={() => toggleLiabilitySelection(liability.id)}
                              aria-label={`Select ${liability.name}`}
                            />
                          </TableCell>
                          <TableCell title={liability.name}>
                            <div style={{ fontWeight: 600 }}>{liability.name}</div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{liability.icon} {liability.label || "—"}</div>
                          </TableCell>
                          <TableCell>{liability.icon || ""} {liability.label || "—"}</TableCell>
                          <TableCell>{liability.emi ? formatCurrency(liability.emi, currency) : "—"}</TableCell>
                          <TableCell style={{ fontSize: 12 }}>{liability.startDate || "—"}</TableCell>
                          <TableCell>
                            <div style={{ fontWeight: 700, color: outstanding > 0 ? "#ef4444" : "#22c55e" }}>
                              {formatCurrency(outstanding, currency)}
                            </div>
                            <div style={{ marginTop: 4, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.1)" }}>
                              <div style={{ height: "100%", borderRadius: 99, background: "#22c55e", width: `${pct}%`, transition: "width 0.4s" }} />
                            </div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{pct}% paid</div>
                          </TableCell>
                          <TableCell>
                            <span style={{ fontWeight: closingIn === "CLOSED" ? 700 : 400, color: closingIn === "CLOSED" ? "#22c55e" : "rgba(255,255,255,0.75)" }}>
                              {closingIn}
                            </span>
                          </TableCell>
                          <TableCell>
                            <button onClick={() => handleEdit(liability)} style={{...buttonStyles.secondary, padding: "4px 8px", fontSize: 12}}>
                              Modify
                            </button>
                          </TableCell>
                        </tr>
                        );
                      })}
                    </tbody>
                  </DataTable>
                </TableWrap>
              )}
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


/* ─── INCOME TYPE CONSTANTS ────────────────────────────────────────────── */
const INCOME_TYPES = [
  { id: "salary", label: "Salary", icon: "💼" },
  { id: "freelance", label: "Freelance", icon: "🖥️" },
  { id: "rental", label: "Rental", icon: "🏠" },
  { id: "dividend", label: "Dividend", icon: "📈" },
  { id: "business", label: "Business", icon: "🏢" },
  { id: "other", label: "Other", icon: "💰" },
];

/* ─── DATE FILTER HELPERS ───────────────────────────────────────────────── */
function getDateRangeForFilter(filterKey) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (filterKey) {
    case "this_month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end: new Date(today.getFullYear(), today.getMonth() + 1, 0) };
    }
    case "last_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return { start, end: new Date(today.getFullYear(), today.getMonth(), 0) };
    }
    case "3m": return { start: new Date(today.getFullYear(), today.getMonth() - 2, 1), end: today };
    case "6m": return { start: new Date(today.getFullYear(), today.getMonth() - 5, 1), end: today };
    case "12m": return { start: new Date(today.getFullYear(), today.getMonth() - 11, 1), end: today };
    default: return null; // "all" — no filter
  }
}

function parseEntryDate(entry) {
  // entries may have a `month` field like "2026-03" or a `date` ISO string
  if (entry.month) {
    const [y, m] = entry.month.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }
  if (entry.date) return new Date(entry.date);
  return null;
}

function filterByRange(entries, range) {
  if (!range) return entries;
  return entries.filter((e) => {
    const d = parseEntryDate(e);
    if (!d) return true; // no date → include for backward compat
    return d >= range.start && d <= range.end;
  });
}

/* ─── Monthly trend chart data builder ─────────────────────────────────── */
function buildMonthlyTrendData(incomes, expenses, range) {
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

export function IncomePage({ incomes, expenses = [], currency, onAdd, onUpdate, onDelete, onImportIncome, onImportExpense }) {
  const isMobile = useIsMobile();
  const [showAdd, setShowAdd] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);

  // Form fields
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [incomeType, setIncomeType] = useState("salary");
  const [incomeMonth, setIncomeMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [incomeNotes, setIncomeNotes] = useState("");

  // Date filter
  const DATE_FILTERS = [
    { key: "this_month", label: "This Month" },
    { key: "last_month", label: "Last Month" },
    { key: "3m", label: "3M" },
    { key: "6m", label: "6M" },
    { key: "12m", label: "12M" },
    { key: "all", label: "All" },
  ];
  const [dateFilter, setDateFilter] = useState("this_month");
  const dateRange = useMemo(() => getDateRangeForFilter(dateFilter), [dateFilter]);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("amount_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIncomeIds, setSelectedIncomeIds] = useState([]);
  const importInputRef = useRef(null);

  useEffect(() => {
    if (editingIncome) {
      setName(editingIncome.name || "");
      setAmount(editingIncome.amount?.toString() || "");
      setIncomeType(editingIncome.incomeType || "salary");
      setIncomeMonth(editingIncome.month || incomeMonth);
      setIncomeNotes(editingIncome.notes || "");
    } else {
      setName(""); setAmount(""); setIncomeType("salary"); setIncomeNotes("");
    }
  }, [editingIncome]);

  // Filtered income & expenses
  const filteredIncomes = useMemo(() => filterByRange(incomes, dateRange), [incomes, dateRange]);
  const filteredExpenses = useMemo(() => filterByRange(expenses || [], dateRange), [expenses, dateRange]);
  const totalIncome = filteredIncomes.reduce((s, i) => s + (i.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netCashflow = totalIncome - totalExpenses;

  // Monthly trend chart data
  const trendData = useMemo(() => buildMonthlyTrendData(incomes, expenses || [], dateRange), [incomes, expenses, dateRange]);

  const incomeRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let rows = filteredIncomes.filter((income) => {
      if (!query) return true;
      return String(income.name || "").toLowerCase().includes(query) ||
        String(income.notes || "").toLowerCase().includes(query);
    });
    rows = [...rows].sort((a, b) => {
      if (sortBy === "amount_asc") return a.amount - b.amount;
      if (sortBy === "amount_desc") return b.amount - a.amount;
      if (sortBy === "name_desc") return String(b.name || "").localeCompare(String(a.name || ""));
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    return rows;
  }, [filteredIncomes, searchQuery, sortBy]);

  const pagedIncomeRows = useMemo(() => getPaginatedRows(incomeRows, currentPage), [incomeRows, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, sortBy, dateFilter]);
  useEffect(() => {
    const totalPages = getTotalPages(incomeRows.length);
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [incomeRows.length, currentPage]);
  useEffect(() => {
    setSelectedIncomeIds((prev) => prev.filter((id) => incomeRows.some((item) => item.id === id)));
  }, [incomeRows]);

  const incomePageIds = pagedIncomeRows.map((item) => item.id);
  const allIncomeOnPageSelected = incomePageIds.length > 0 && incomePageIds.every((id) => selectedIncomeIds.includes(id));

  const toggleIncomeSelection = (id) => setSelectedIncomeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleSelectAllIncomeOnPage = () => setSelectedIncomeIds((prev) => {
    if (allIncomeOnPageSelected) return prev.filter((id) => !incomePageIds.includes(id));
    const next = [...prev];
    incomePageIds.forEach((id) => { if (!next.includes(id)) next.push(id); });
    return next;
  });
  const deleteSelectedIncomes = () => { selectedIncomeIds.forEach((id) => onDelete(id)); setSelectedIncomeIds([]); };

  const closeAddModal = () => { setShowAdd(false); setEditingIncome(null); };
  const handleEdit = (income) => { setEditingIncome(income); setShowAdd(true); };

  const handleSave = () => {
    const n = sanitizeInput(name, "text");
    const a = sanitizeInput(amount, "number");
    if (!n || a <= 0) { notifyApp("Enter valid income source and positive amount.", "error"); return; }
    const payload = {
      id: editingIncome?.id || Date.now(),
      name: n, amount: a, currency,
      incomeType, month: incomeMonth,
      notes: sanitizeInput(incomeNotes, "text"),
      date: new Date(incomeMonth + "-01").toISOString(),
    };
    if (editingIncome) { onUpdate(payload); } else { onAdd(payload); }
    closeAddModal();
  };

  const handleCsvImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsedEntries = await parseHdfcStatementFile(file);
      const { incomeEntries, expenseEntries } = buildImportedHdfcEntries(parsedEntries, currency);
      if (incomeEntries.length === 0 && expenseEntries.length === 0) {
        notifyApp("No valid transactions found in this HDFC statement file.", "warning"); return;
      }
      if (incomeEntries.length > 0) onImportIncome(incomeEntries);
      if (expenseEntries.length > 0) onImportExpense(expenseEntries);
      notifyApp(`Imported ${incomeEntries.length} income and ${expenseEntries.length} expense entries.`, "success");
    } catch { notifyApp("Unable to import this file. Please upload a valid HDFC statement.", "error"); }
    finally { event.target.value = ""; }
  };

  const fmtK = (v) => Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(1)}L` : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`;

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "rgba(255, 255, 255, 0.95)" }}>Income & Cashflow</h2>
          <p style={{ color: "rgba(255, 255, 255, 0.65)", fontSize: 14 }}>{DATE_FILTERS.find(f => f.key === dateFilter)?.label} — Net: <span style={{ color: netCashflow >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{formatCurrency(netCashflow, currency)}</span></p>
        </div>
        <PageHeaderActions $isMobile={isMobile}>
          <input ref={importInputRef} type="file" accept=".csv,.xls,.xlsx" onChange={handleCsvImport} style={{ display: "none" }} />
          <button onClick={() => importInputRef.current?.click()} style={{ ...buttonStyles.secondary, padding: "10px 14px", fontSize: 13, width: isMobile ? "100%" : "auto" }}>Import HDFC Statement</button>
          <button onClick={() => { setEditingIncome(null); setShowAdd(true); }} style={{ ...btnStyle, width: isMobile ? "100%" : "auto" }}>+ Add Income</button>
        </PageHeaderActions>
      </PageHeader>

      {/* Add/Edit Modal */}
      {showAdd && (
        <ModalBackdrop onClick={closeAddModal}>
          <ModalCard $maxWidth={520} onClick={(e) => e.stopPropagation()}>
            <ModalTitle>{editingIncome ? "Edit Income" : "Add Income"}</ModalTitle>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={labelStyle}>Source Name</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Salary, Consulting" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select style={inputStyle} value={incomeType} onChange={(e) => setIncomeType(e.target.value)}>
                    {INCOME_TYPES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Month</label>
                  <input style={inputStyle} type="month" value={incomeMonth} onChange={(e) => setIncomeMonth(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Amount (₹)</label>
                <input style={inputStyle} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" min="0" />
              </div>
              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <input style={inputStyle} value={incomeNotes} onChange={(e) => setIncomeNotes(e.target.value)} placeholder="Any extra details" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button onClick={closeAddModal} style={{ ...buttonStyles.secondary, padding: "10px 14px" }}>Cancel</button>
                <button onClick={handleSave} style={{ ...btnStyle, padding: "10px 14px" }}>{editingIncome ? "Update" : "Save"}</button>
              </div>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      {/* Date Filter Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {DATE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setDateFilter(f.key)}
            style={{
              padding: "6px 16px", fontSize: 13, borderRadius: 99, cursor: "pointer",
              border: dateFilter === f.key ? "1px solid rgba(56,189,248,0.6)" : "1px solid rgba(255,255,255,0.15)",
              background: dateFilter === f.key ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.06)",
              color: dateFilter === f.key ? "#38bdf8" : "rgba(255,255,255,0.7)",
              fontWeight: dateFilter === f.key ? 700 : 400,
              transition: "all 0.2s",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 2.2 Stat Tiles replacing cash balance chart */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "TOTAL INCOME", value: formatCurrency(totalIncome, currency), color: "#22c55e", icon: "💸" },
          { label: "TOTAL EXPENSES", value: formatCurrency(totalExpenses, currency), color: "#ef4444", icon: "🛒" },
          {
            label: "NET CASH FLOW",
            value: `${netCashflow >= 0 ? "+" : ""}${formatCurrency(netCashflow, currency)}`,
            color: netCashflow >= 0 ? "#22c55e" : "#ef4444",
            icon: netCashflow >= 0 ? "✅" : "⚠️",
          },
        ].map((tile) => (
          <div
            key={tile.label}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${tile.color}30`,
              borderRadius: 14, padding: "14px 18px",
              display: "flex", alignItems: "center", gap: 12,
            }}
          >
            <div style={{ fontSize: 24 }}>{tile.icon}</div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>{tile.label}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: tile.color }}>{tile.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Trend Chart — grouped Income vs Expense bars + net line */}
      {trendData.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 20, padding: "16px 16px 8px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 12 }}>Monthly Income vs Expenses</div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={trendData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "rgba(15,23,42,0.97)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, fontSize: 12 }}
                formatter={(v, name) => [formatCurrency(v, currency), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }} />
              <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={32} fillOpacity={0.85} />
              <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={32} fillOpacity={0.85} />
              <Line dataKey="net" name="Net" type="monotone" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3, fill: "#38bdf8" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {incomes.length === 0 ? (
        <LiquidGlassCard style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{"💼"}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "rgba(255, 255, 255, 0.65)" }}>No income recorded</div>
          <div>Add recurring or one-time income to track cashflow</div>
        </LiquidGlassCard>
      ) : (
        <LiquidGlassCard>
          <div style={{ marginBottom: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(220px, 1fr) minmax(160px, 190px)", gap: 8 }}>
              <Field value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search income records" />
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="amount_desc">Sort: Amount High→Low</option>
                <option value="amount_asc">Sort: Amount Low→High</option>
                <option value="name_asc">Sort: Name A→Z</option>
                <option value="name_desc">Sort: Name Z→A</option>
              </Select>
            </div>
            <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", marginTop: 8 }}>
              <button
                onClick={deleteSelectedIncomes}
                disabled={selectedIncomeIds.length === 0}
                style={{ ...btnStyle, background: "var(--error, #f97316)", padding: "8px 12px", fontSize: 12, width: isMobile ? "100%" : "auto", opacity: selectedIncomeIds.length === 0 ? 0.55 : 1, cursor: selectedIncomeIds.length === 0 ? "not-allowed" : "pointer" }}
              >
                Delete Selected ({selectedIncomeIds.length})
              </button>
            </div>
          </div>

          {incomeRows.length === 0 ? (
            <EmptyBlock>No income records match your filters.</EmptyBlock>
          ) : (
            <>
              <TableResultsText>Showing {pagedIncomeRows.length} of {incomeRows.length} income records</TableResultsText>
              {isMobile ? (
                <MobileDataList>
                  <MobileDataCard>
                    <MobileDataSelection>
                      <input type="checkbox" checked={allIncomeOnPageSelected} onChange={toggleSelectAllIncomeOnPage} aria-label="Select all income rows on this page" />
                      <span>Select all items on this page</span>
                    </MobileDataSelection>
                  </MobileDataCard>
                  {pagedIncomeRows.map((income) => {
                    const itype = INCOME_TYPES.find((t) => t.id === income.incomeType);
                    return (
                      <MobileRecordCard
                        key={income.id}
                        title={income.name}
                        badge={`${itype?.icon || ""} ${itype?.label || "Income"}`}
                        selected={selectedIncomeIds.includes(income.id)}
                        onToggleSelect={() => toggleIncomeSelection(income.id)}
                        selectLabel={`Select ${income.name}`}
                        fields={[
                          { label: "Amount", value: formatCurrency(income.amount, income.currency || currency), fullWidth: true },
                          { label: "Month", value: income.month || "—" },
                          income.notes ? { label: "Notes", value: income.notes } : null,
                        ].filter(Boolean)}
                        actions={<button onClick={() => handleEdit(income)} style={{ ...buttonStyles.secondary, padding: "8px 12px", fontSize: 12, width: "100%" }}>Modify</button>}
                      />
                    );
                  })}
                </MobileDataList>
              ) : (
                <TableWrap>
                  <DataTable>
                    <thead>
                      <tr>
                        <TableHead style={{ width: "4%" }}>
                          <input type="checkbox" checked={allIncomeOnPageSelected} onChange={toggleSelectAllIncomeOnPage} aria-label="Select all income rows on this page" />
                        </TableHead>
                        <TableHead style={{ width: "28%" }}>Source</TableHead>
                        <TableHead style={{ width: "15%" }}>Type</TableHead>
                        <TableHead style={{ width: "13%" }}>Month</TableHead>
                        <TableHead style={{ width: "20%" }}>Amount</TableHead>
                        <TableHead style={{ width: "13%" }}>Notes</TableHead>
                        <TableHead style={{ width: "7%" }}>Actions</TableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedIncomeRows.map((income) => {
                        const itype = INCOME_TYPES.find((t) => t.id === income.incomeType);
                        return (
                          <tr key={income.id}>
                            <TableCell>
                              <input type="checkbox" checked={selectedIncomeIds.includes(income.id)} onChange={() => toggleIncomeSelection(income.id)} aria-label={`Select ${income.name}`} />
                            </TableCell>
                            <TableCell title={income.name}><span style={{ fontWeight: 600 }}>{income.name}</span></TableCell>
                            <TableCell>{itype?.icon || ""} {itype?.label || "Other"}</TableCell>
                            <TableCell style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{income.month || "—"}</TableCell>
                            <TableCell style={{ fontWeight: 700, color: "#22c55e" }}>{formatCurrency(income.amount, income.currency || currency)}</TableCell>
                            <TableCell style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{income.notes || "—"}</TableCell>
                            <TableCell>
                              <button onClick={() => handleEdit(income)} style={{ ...buttonStyles.secondary, padding: "4px 8px", fontSize: 12 }}>Modify</button>
                            </TableCell>
                          </tr>
                        );
                      })}
                    </tbody>
                  </DataTable>
                </TableWrap>
              )}
              <DataTablePagination totalRows={incomeRows.length} currentPage={currentPage} onPageChange={setCurrentPage} />
            </>
          )}
        </LiquidGlassCard>
      )}
    </PageSection>
  );
}


export function ExpensesPage({ expenses, currency, onAdd, onUpdate, onDelete, onImportIncome, onImportExpense }) {
  const isMobile = useIsMobile();
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const [showAdd, setShowAdd] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("amount_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState([]);
  const importInputRef = useRef(null);

  useEffect(() => {
    if (editingExpense) {
      setName(editingExpense.name || "");
      setAmount(editingExpense.amount || "");
    } else {
      setName("");
      setAmount("");
    }
  }, [editingExpense]);

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
    setEditingExpense(null);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setShowAdd(true);
  };

  const handleSave = () => {
    const n = sanitizeInput(name, 'text');
    const a = sanitizeInput(amount, 'number');
    if (!n || a <= 0) {
      notifyApp("Enter valid expense name and positive amount.", "error");
      return;
    }
    
    const payload = {
      id: editingExpense?.id || Date.now(),
      name: n,
      amount: a,
      currency
    };

    if (editingExpense) {
      onUpdate(payload);
    } else {
      onAdd(payload);
    }
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
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "rgba(255, 255, 255, 0.95)" }}>Expenses</h2>
          <p style={{ color: "rgba(255, 255, 255, 0.65)", fontSize: 14 }}>Total: {formatCurrency(total, currency)}</p>
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
          <button onClick={() => { setEditingExpense(null); setShowAdd(true); }} style={{ ...btnStyle, background: "var(--error, #f97316)", width: isMobile ? "100%" : "auto" }}>+ Add Expense</button>
        </PageHeaderActions>
      </PageHeader>

      {showAdd && (
        <ModalBackdrop onClick={closeAddModal}>
          <ModalCard $maxWidth={520} onClick={(event) => event.stopPropagation()}>
            <ModalTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</ModalTitle>
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
                <button onClick={closeAddModal} style={{ ...btnStyle, background: 'var(--muted-bg, #f1f5f9)', color: "rgba(255, 255, 255, 0.65)" }}>Cancel</button>
                <button onClick={handleSave} style={{ ...btnStyle, background: "var(--error, #f97316)" }}>{editingExpense ? "Update" : "Save"}</button>
              </div>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      {expenses.length === 0 ? (
        <LiquidGlassCard style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u{1F6D2}"}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "rgba(255, 255, 255, 0.65)" }}>No expenses recorded</div>
          <div>Add your expenses to track cashflow</div>
        </LiquidGlassCard>
      ) : (
        <LiquidGlassCard>
          <div style={{ marginBottom: 12, padding: 12 }}>
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
                  background: "var(--error, #f97316)",
                  padding: "8px 12px",
                  fontSize: 12,
                  width: isMobile ? "100%" : "auto",
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
              <TableResultsText>
                Showing {pagedExpenseRows.length} of {expenseRows.length} expense records
              </TableResultsText>
              {isMobile ? (
                <MobileDataList>
                  <MobileDataCard>
                    <MobileDataSelection>
                      <input
                        type="checkbox"
                        checked={allExpensesOnPageSelected}
                        onChange={toggleSelectAllExpensesOnPage}
                        aria-label="Select all expense rows on this page"
                      />
                      <span>Select all items on this page</span>
                    </MobileDataSelection>
                  </MobileDataCard>
                  {pagedExpenseRows.map((expense) => (
                    <MobileRecordCard
                      key={expense.id}
                      title={expense.name}
                      badge="Expense"
                      selected={selectedExpenseIds.includes(expense.id)}
                      onToggleSelect={() => toggleExpenseSelection(expense.id)}
                      selectLabel={`Select ${expense.name}`}
                      fields={[
                        { label: "Amount", value: formatCurrency(expense.amount, expense.currency || currency), fullWidth: true },
                      ]}
                      actions={(
                        <button onClick={() => handleEdit(expense)} style={{ ...buttonStyles.secondary, padding: "8px 12px", fontSize: 12, width: "100%" }}>
                          Modify
                        </button>
                      )}
                    />
                  ))}
                </MobileDataList>
              ) : (
                <TableWrap>
                  <DataTable>
                    <thead>
                      <tr>
                        <TableHead style={{ width: "5%" }}>
                          <input
                            type="checkbox"
                            checked={allExpensesOnPageSelected}
                            onChange={toggleSelectAllExpensesOnPage}
                            aria-label="Select all expense rows on this page"
                          />
                        </TableHead>
                        <TableHead style={{ width: "50%" }}>Expense</TableHead>
                        <TableHead style={{ width: "30%" }}>Amount</TableHead>
                        <TableHead style={{ width: "15%" }}>Actions</TableHead>
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
                          <TableCell>
                            <button onClick={() => handleEdit(expense)} style={{...buttonStyles.secondary, padding: '4px 8px', fontSize: 12}}>
                              Modify
                            </button>
                          </TableCell>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                </TableWrap>
              )}
              <DataTablePagination
                totalRows={expenseRows.length}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </LiquidGlassCard>
      )}
    </PageSection>
  );
}

// -- ALLOCATION PAGE ---------------------------------------------------------

export function NetWorthPage({ assets, liabilities, currency, snapshots, onSnapshot, isMobile }) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth = totalAssets - totalLiabilities;
  const c = CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];
  const [currentPage, setCurrentPage] = useState(1);

  const snapshotChartData = useMemo(() => buildSnapshotChartData(snapshots), [snapshots]);
  const snapshotRows = useMemo(() => [...snapshotChartData].reverse(), [snapshotChartData]);
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
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "rgba(255, 255, 255, 0.95)", marginBottom: 4 }}>Net Worth</h2>
          <p style={{ color: "rgba(255, 255, 255, 0.65)", fontSize: 14 }}>Track your wealth journey over time</p>
        </div>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <SummaryCard icon={"\u{1F3DB}"} label="TOTAL ASSETS" value={formatCurrency(totalAssets, currency)} sub={`${assets.length} assets`} color="#22c55e" />
        <SummaryCard icon={"\u{1F4B3}"} label="TOTAL LIABILITIES" value={formatCurrency(totalLiabilities, currency)} sub={`${liabilities.length} debts`} color="#ef4444" negative />
        <SummaryCard icon={"\u2728"} label="NET WORTH" value={formatCurrency(netWorth, currency)} sub="Assets minus Liabilities" color="#3b82f6" />
      </div>

      <LiquidGlassCard>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, color: "rgba(255, 255, 255, 0.95)", fontSize: 16 }}>Wealth Timeline</div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>{snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} recorded</div>
          </div>
          <button onClick={onSnapshot} style={{ ...btnStyle, width: isMobile ? "100%" : "auto" }}>{"\u{1F4F8}"} Take Snapshot</button>
        </div>
        {snapshots.length < 2 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u{1F4CA}"}</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Take snapshots to track your progress</div>
            <div style={{ fontSize: 13 }}>Each snapshot records your net worth at that moment</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={snapshotChartData}>
              <XAxis
                dataKey="chartKey"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => snapshotChartData.find((snapshot) => snapshot.chartKey === value)?.chartTick ?? value}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} />
              <Tooltip
                labelFormatter={(_, payload) => payload?.[0]?.payload?.tooltipLabel ?? ""}
                formatter={(v) => [formatCurrency(v, currency), "Net Worth"]}
              />
              <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} dot={{ fill: "var(--primary)", r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </LiquidGlassCard>

      {snapshots.length > 0 && (
        <LiquidGlassCard style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, color: "rgba(255, 255, 255, 0.95)", marginBottom: 16 }}>Snapshot History</div>
          <TableResultsText>
            Showing {pagedSnapshotRows.length} of {snapshotRows.length} snapshots
          </TableResultsText>
          {isMobile ? (
            <MobileDataList>
              {pagedSnapshotRows.map((snapshot, index) => (
                <MobileRecordCard
                  key={snapshot.chartKey || `${snapshot.date}-${index}`}
                  title={snapshot.historyLabel || snapshot.date}
                  fields={[
                    {
                      label: "Net Worth",
                      value: `${c.symbol}${snapshot.value.toLocaleString()}`,
                      valueStyle: { color: snapshot.value >= 0 ? "#16a34a" : "#ef4444" },
                    },
                  ]}
                />
              ))}
            </MobileDataList>
          ) : (
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
                    <tr key={snapshot.chartKey || index}>
                      <TableCell>{snapshot.historyLabel || snapshot.date}</TableCell>
                      <TableCell style={{ color: snapshot.value >= 0 ? "#16a34a" : "#ef4444", fontWeight: 700 }}>
                        {c.symbol}{snapshot.value.toLocaleString()}
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
          )}
          <DataTablePagination
            totalRows={snapshotRows.length}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </LiquidGlassCard>
      )}
    </PageSection>
  );
}

/* ─── GOAL TEMPLATES ───────────────────────────────────────────────────── */
const GOAL_TEMPLATES = [
  { id: "emergency_fund", label: "Emergency Fund", icon: "🛡️", suggestedAmount: 300000, horizonMonths: 12 },
  { id: "retirement", label: "Retirement", icon: "🏖️", suggestedAmount: 10000000, horizonMonths: 240 },
  { id: "house", label: "House Down Payment", icon: "🏠", suggestedAmount: 2000000, horizonMonths: 60 },
  { id: "car", label: "Car", icon: "🚗", suggestedAmount: 800000, horizonMonths: 24 },
  { id: "vacation", label: "Vacation", icon: "✈️", suggestedAmount: 150000, horizonMonths: 12 },
  { id: "education", label: "Education", icon: "🎓", suggestedAmount: 1000000, horizonMonths: 48 },
  { id: "wedding", label: "Wedding", icon: "💍", suggestedAmount: 1500000, horizonMonths: 24 },
  { id: "custom", label: "Custom", icon: "🎯", suggestedAmount: 0, horizonMonths: 12 },
];

/* ─── GOAL STATUS HELPERS ───────────────────────────────────────────────── */
function getGoalStatus(pct) {
  if (pct >= 100) return { label: "Achieved!", color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
  if (pct >= 60) return { label: "On Track", color: "#22c55e", bg: "rgba(34,197,94,0.08)" };
  if (pct >= 25) return { label: "In Progress", color: "#f97316", bg: "rgba(249,115,22,0.08)" };
  return { label: "Just Started", color: "#ef4444", bg: "rgba(239,68,68,0.08)" };
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDaysRemaining(days) {
  if (days == null) return "—";
  if (days <= 0) return "Overdue";
  if (days < 30) return `${days}d left`;
  if (days < 365) return `${Math.ceil(days / 30)}mo left`;
  const y = Math.floor(days / 365);
  const m = Math.ceil((days % 365) / 30);
  return m > 0 ? `${y}y ${m}mo left` : `${y}y left`;
}

export function GoalsPage({ assets, goals, setGoals, currency }) {
  const isMobile = useIsMobile();
  const [showAdd, setShowAdd] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  // Form state
  const [templateId, setTemplateId] = useState("custom");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [startingAmount, setStartingAmount] = useState("0");
  const [trackBy, setTrackBy] = useState("manual"); // "manual" | "asset" | "savings"
  const [linkedAssetId, setLinkedAssetId] = useState("");
  const [manualCurrent, setManualCurrent] = useState("0");

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("progress_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGoalIds, setSelectedGoalIds] = useState([]);

  /* Resolve current progress for a goal */
  const resolveCurrentValue = (goal) => {
    if (goal.trackBy === "asset" && goal.linkedAssetId) {
      const asset = assets.find((a) => a.id === goal.linkedAssetId);
      return asset ? asset.value : goal.manualCurrent || goal.current || 0;
    }
    return goal.manualCurrent ?? goal.current ?? 0;
  };

  /* Pre-fill when template changes */
  const handleTemplateChange = (tid) => {
    setTemplateId(tid);
    const tpl = GOAL_TEMPLATES.find((t) => t.id === tid);
    if (!tpl) return;
    if (tpl.id !== "custom") {
      setName(tpl.label);
      if (tpl.suggestedAmount > 0) setTarget(String(tpl.suggestedAmount));
      if (tpl.horizonMonths > 0) {
        const d = new Date();
        d.setMonth(d.getMonth() + tpl.horizonMonths);
        setTargetDate(d.toISOString().split("T")[0]);
      }
    }
  };

  const resetForm = () => {
    setTemplateId("custom"); setName(""); setTarget(""); setTargetDate("");
    setStartingAmount("0"); setTrackBy("manual"); setLinkedAssetId(""); setManualCurrent("0");
    setEditingGoal(null);
  };

  const closeAddModal = () => { setShowAdd(false); resetForm(); };

  const handleEdit = (goal) => {
    setEditingGoal(goal);
    setTemplateId(goal.templateId || "custom");
    setName(goal.name || "");
    setTarget(String(goal.target || ""));
    setTargetDate(goal.targetDate || "");
    setStartingAmount(String(goal.startingAmount || 0));
    setTrackBy(goal.trackBy || "manual");
    setLinkedAssetId(goal.linkedAssetId || "");
    setManualCurrent(String(goal.manualCurrent || 0));
    setShowAdd(true);
  };

  const saveGoal = () => {
    const n = sanitizeInput(name, "text");
    const t = sanitizeInput(target, "number");
    if (!n || t <= 0) {
      notifyApp("Enter a valid goal name and target amount.", "error");
      return;
    }
    const tpl = GOAL_TEMPLATES.find((tp) => tp.id === templateId);
    const payload = {
      id: editingGoal?.id || Date.now(),
      templateId, name: n, target: t,
      targetDate, icon: tpl?.icon || "🎯",
      startingAmount: sanitizeInput(startingAmount, "number") || 0,
      trackBy, linkedAssetId,
      manualCurrent: sanitizeInput(manualCurrent, "number") || 0,
      current: sanitizeInput(manualCurrent, "number") || 0,
      createdAt: editingGoal?.createdAt || new Date().toISOString(),
    };
    if (editingGoal) {
      setGoals((prev) => prev.map((g) => g.id === editingGoal.id ? payload : g));
    } else {
      setGoals((prev) => [...prev, payload]);
    }
    closeAddModal();
  };

  const goalRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let rows = goals.filter((g) => !query || String(g.name || "").toLowerCase().includes(query));
    rows = [...rows].sort((a, b) => {
      const pa = a.target > 0 ? (resolveCurrentValue(a) / a.target) * 100 : 0;
      const pb = b.target > 0 ? (resolveCurrentValue(b) / b.target) * 100 : 0;
      if (sortBy === "progress_asc") return pa - pb;
      if (sortBy === "progress_desc") return pb - pa;
      if (sortBy === "target_asc") return a.target - b.target;
      if (sortBy === "target_desc") return b.target - a.target;
      if (sortBy === "name_desc") return String(b.name || "").localeCompare(String(a.name || ""));
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    return rows;
  }, [goals, searchQuery, sortBy, assets]);

  const pagedGoalRows = useMemo(() => getPaginatedRows(goalRows, currentPage), [goalRows, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, sortBy]);
  useEffect(() => {
    const tp = getTotalPages(goalRows.length);
    if (currentPage > tp) setCurrentPage(tp);
  }, [goalRows.length, currentPage]);
  useEffect(() => {
    setSelectedGoalIds((prev) => prev.filter((id) => goalRows.some((g) => g.id === id)));
  }, [goalRows]);

  const goalPageIds = pagedGoalRows.map((g) => g.id);
  const allGoalsOnPageSelected = goalPageIds.length > 0 && goalPageIds.every((id) => selectedGoalIds.includes(id));
  const toggleGoalSelection = (id) => setSelectedGoalIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleSelectAllGoalsOnPage = () => setSelectedGoalIds((prev) => {
    if (allGoalsOnPageSelected) return prev.filter((id) => !goalPageIds.includes(id));
    const next = [...prev];
    goalPageIds.forEach((id) => { if (!next.includes(id)) next.push(id); });
    return next;
  });
  const deleteSelectedGoals = () => { setGoals((prev) => prev.filter((g) => !selectedGoalIds.includes(g.id))); setSelectedGoalIds([]); };

  const selectedTemplate = GOAL_TEMPLATES.find((t) => t.id === templateId);

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "rgba(255,255,255,0.95)" }}>Financial Goals</h2>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14 }}>{goals.length} goal{goals.length !== 1 ? "s" : ""} · Set targets and track your progress</p>
        </div>
        <PageHeaderActions $isMobile={isMobile}>
          <button onClick={() => setShowAdd(true)} style={{ ...btnStyle, width: isMobile ? "100%" : "auto" }}>+ New Goal</button>
        </PageHeaderActions>
      </PageHeader>

      {/* Add / Edit Modal */}
      {showAdd && (
        <ModalBackdrop onClick={closeAddModal}>
          <ModalCard $maxWidth={560} onClick={(e) => e.stopPropagation()}>
            <ModalTitle>{editingGoal ? "Edit Goal" : "Create Goal"}</ModalTitle>

            {/* Template selector */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Template</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {GOAL_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleTemplateChange(tpl.id)}
                    style={{
                      padding: "8px 4px",
                      borderRadius: 10,
                      cursor: "pointer",
                      border: templateId === tpl.id ? "1px solid rgba(56,189,248,0.6)" : "1px solid rgba(255,255,255,0.12)",
                      background: templateId === tpl.id ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)",
                      color: templateId === tpl.id ? "#38bdf8" : "rgba(255,255,255,0.75)",
                      fontSize: 11, textAlign: "center", fontWeight: templateId === tpl.id ? 700 : 400,
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 2 }}>{tpl.icon}</div>
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <label style={labelStyle}>Goal Name</label>
                <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emergency Fund, Buy a Car" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Target Amount (₹)</label>
                  <input style={inputStyle} type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={selectedTemplate?.suggestedAmount > 0 ? `Suggested: ${selectedTemplate.suggestedAmount.toLocaleString("en-IN")}` : "0"} />
                </div>
                <div>
                  <label style={labelStyle}>Target Date</label>
                  <input style={inputStyle} type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Starting Amount (₹)</label>
                <input style={inputStyle} type="number" value={startingAmount} onChange={(e) => setStartingAmount(e.target.value)} placeholder="0" />
              </div>

              {/* Track Progress By */}
              <div>
                <label style={labelStyle}>Track Progress By</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  {[
                    { key: "manual", label: "✍️ Manual" },
                    { key: "asset", label: "🏛️ Link to Asset" },
                    { key: "savings", label: "💸 Link to Savings" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setTrackBy(opt.key)}
                      style={{
                        padding: "6px 14px", fontSize: 12, borderRadius: 99, cursor: "pointer",
                        border: trackBy === opt.key ? "1px solid rgba(56,189,248,0.6)" : "1px solid rgba(255,255,255,0.15)",
                        background: trackBy === opt.key ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.06)",
                        color: trackBy === opt.key ? "#38bdf8" : "rgba(255,255,255,0.7)",
                        fontWeight: trackBy === opt.key ? 700 : 400,
                      }}
                    >
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
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatCurrency(a.value, currency)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {trackBy === "savings" && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(56,189,248,0.08)", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    💡 Savings tracking auto-sums your income entries for this goal's period. Enter a manual current value for now.
                    <div style={{ marginTop: 8 }}>
                      <label style={labelStyle}>Current Savings (₹)</label>
                      <input style={inputStyle} type="number" value={manualCurrent} onChange={(e) => setManualCurrent(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                <button onClick={closeAddModal} style={{ ...buttonStyles.secondary, padding: "10px 14px" }}>Cancel</button>
                <button onClick={saveGoal} style={{ ...btnStyle, padding: "10px 14px" }}>{editingGoal ? "Update Goal" : "Create Goal"}</button>
              </div>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      {goals.length === 0 ? (
        <LiquidGlassCard style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{"🎯"}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "rgba(255,255,255,0.65)" }}>No goals yet</div>
          <div>Set a financial goal to track your savings progress</div>
        </LiquidGlassCard>
      ) : (
        <>
          {/* Filter / sort bar */}
          <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(220px,1fr) minmax(180px,220px)", gap: 8 }}>
              <Field value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search goals" />
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
              <button onClick={deleteSelectedGoals} disabled={selectedGoalIds.length === 0}
                style={{ ...btnStyle, background: "var(--error, #f97316)", padding: "8px 12px", fontSize: 12, width: isMobile ? "100%" : "auto", opacity: selectedGoalIds.length === 0 ? 0.55 : 1, cursor: selectedGoalIds.length === 0 ? "not-allowed" : "pointer" }}>
                Delete Selected ({selectedGoalIds.length})
              </button>
            </div>
          </div>

          {goalRows.length === 0 ? (
            <EmptyBlock>No goals match your filters.</EmptyBlock>
          ) : (
            <>
              <TableResultsText>Showing {pagedGoalRows.length} of {goalRows.length} goals</TableResultsText>

              {/* 7.2 Goal Cards — rich card grid */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(340px,1fr))", gap: 14, marginBottom: 12 }}>
                {pagedGoalRows.map((goal) => {
                  const current = resolveCurrentValue(goal);
                  const pct = goal.target > 0 ? Math.min((current / goal.target) * 100, 100) : 0;
                  const status = getGoalStatus(pct);
                  const days = daysUntil(goal.targetDate);
                  const monthsLeft = days != null && days > 0 ? Math.max(1, Math.ceil(days / 30)) : null;
                  const remaining = Math.max(0, goal.target - current);
                  const monthlyRequired = monthsLeft ? remaining / monthsLeft : null;
                  const linkedAsset = goal.trackBy === "asset" && goal.linkedAssetId ? assets.find((a) => a.id === goal.linkedAssetId) : null;

                  return (
                    <div
                      key={goal.id}
                      style={{
                        background: status.bg,
                        border: `1px solid ${status.color}22`,
                        borderRadius: 16,
                        padding: "18px 20px",
                        position: "relative",
                      }}
                    >
                      {/* Selection checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedGoalIds.includes(goal.id)}
                        onChange={() => toggleGoalSelection(goal.id)}
                        aria-label={`Select ${goal.name}`}
                        style={{ position: "absolute", top: 14, right: 14 }}
                      />

                      {/* Title row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <span style={{ fontSize: 28 }}>{goal.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,0.95)" }}>{goal.name}</div>
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: status.color, background: `${status.color}18`, padding: "2px 8px", borderRadius: 99 }}>
                            {status.label}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                          <span style={{ color: "rgba(255,255,255,0.65)" }}>{formatCurrency(current, currency)}</span>
                          <span style={{ color: "rgba(255,255,255,0.45)" }}>{formatCurrency(goal.target, currency)}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,0.1)" }}>
                          <div style={{
                            height: "100%", borderRadius: 99,
                            background: pct >= 100 ? "#22c55e" : pct >= 60 ? "#22c55e" : pct >= 25 ? "#f97316" : "#ef4444",
                            width: `${pct}%`, transition: "width 0.4s",
                          }} />
                        </div>
                        <div style={{ textAlign: "right", fontSize: 11, color: status.color, marginTop: 4, fontWeight: 700 }}>{pct.toFixed(1)}%</div>
                      </div>

                      {/* Stats grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "8px 10px" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.7, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>REMAINING</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{formatCurrency(remaining, currency)}</div>
                        </div>
                        <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "8px 10px" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.7, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>TIME LEFT</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: days != null && days <= 0 ? "#ef4444" : "rgba(255,255,255,0.85)" }}>{formatDaysRemaining(days)}</div>
                        </div>
                        <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "8px 10px" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.7, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>NEED / MO</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8" }}>
                            {monthlyRequired != null ? formatCurrency(monthlyRequired, currency) : "—"}
                          </div>
                        </div>
                      </div>

                      {/* Linked asset */}
                      {linkedAsset && (
                        <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 4 }}>
                          🏛️ Tracking: <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>{linkedAsset.name}</span>
                        </div>
                      )}

                      {/* Target date */}
                      {goal.targetDate && (
                        <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                          Target: {new Date(goal.targetDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                      )}

                      {/* Edit button */}
                      <button onClick={() => handleEdit(goal)} style={{ ...buttonStyles.secondary, padding: "6px 12px", fontSize: 12, marginTop: 10, width: "100%" }}>
                        Edit Goal
                      </button>
                    </div>
                  );
                })}
              </div>

              <DataTablePagination totalRows={goalRows.length} currentPage={currentPage} onPageChange={setCurrentPage} />
            </>
          )}
        </>
      )}
    </PageSection>
  );
}

const TYPE_SCALE = {
  h1: 30,
  h2: 18,
  body: 14,
  meta: 13,
  micro: 11,
};

const APP_FONT_STACK = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const DASHBOARD_LAYOUT = {
  pagePadding: 28,
  cardGap: 24,
  sectionGap: 32,
  sidebarWidth: 260,
  sidebarPadding: 20,
  headerHeight: 72,
  headerSearchWidth: 300,
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
  position: "relative",
  isolation: "isolate",
  fontFamily: APP_FONT_STACK,
  background: "transparent",
  color: "rgba(255, 255, 255, 0.95)",
  flexDirection: $isMobile ? "column" : "row",
}));

export const PageSection = styled.div(({ $isMobile }) => ({
  padding: $isMobile ? "24px 16px" : "20px 24px",
  maxWidth: 1180,
  width: "100%",
  margin: "0 auto",
  boxSizing: "border-box",
}));

export const PageHeader = styled.div(({ $isMobile }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: $isMobile ? "flex-start" : "center",
  flexDirection: $isMobile ? "column" : "row",
  gap: $isMobile ? 12 : 0,
  marginBottom: $isMobile ? DASHBOARD_LAYOUT.cardGap : DASHBOARD_LAYOUT.sectionGap,
}));

const PageHeaderActions = styled.div(({ $isMobile }) => ({
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  width: $isMobile ? "100%" : "auto",
}));

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
  padding: $isMobile ? "16px 16px" : "22px 24px",
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
  fontSize: TYPE_SCALE.micro,
  fontWeight: 700,
  letterSpacing: 0.8,
  color: "rgba(255, 255, 255, 0.65)",
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
  color: "rgba(255, 255, 255, 0.65)",
});

const ActionCluster = styled.div({
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
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
  color: "rgba(255, 255, 255, 0.95)",
  padding: "9px 12px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  cursor: "pointer",
});

const GhostButton = styled.button({
  border: "none",
  borderRadius: 10,
  background: "transparent",
  color: "rgba(255, 255, 255, 0.65)",
  padding: "9px 10px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  cursor: "pointer",
});

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

const StatLabel = styled.div({
  fontSize: TYPE_SCALE.micro,
  textTransform: "uppercase",
  letterSpacing: 0.7,
  fontWeight: 700,
  color: "rgba(255, 255, 255, 0.65)",
});

const StatValue = styled.div({
  fontSize: 26,
  fontWeight: 700,
  color: "rgba(255, 255, 255, 0.95)",
});

const StatSub = styled.div({
  fontSize: TYPE_SCALE.meta,
  color: "rgba(255, 255, 255, 0.65)",
});

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
      top: 4,
      bottom: 4,
      left: 4,
      width: `calc((100% - 8px) / ${safeCount})`,
      transform: `translateX(${clampedIndex * 100}%)`,
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.22)",
      background:
        "linear-gradient(145deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.14) 48%, rgba(56,189,248,0.2) 100%)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.42), inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 20px rgba(14,165,233,0.24)",
      transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
      pointerEvents: "none",
      zIndex: 0,
    },
    "& > *": {
      position: "relative",
      zIndex: 1,
    },
  };
});

const TabButton = styled.button(({ $active }) => ({
  width: "100%",
  height: "100%",
  border: "none",
  borderRadius: 999,
  background: "transparent",
  color: $active ? "#f8fbff" : "rgba(229,231,235,0.72)",
  padding: "9px 12px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: $active ? 700 : 600,
  cursor: "pointer",
  textShadow: $active ? "0 1px 10px rgba(56,189,248,0.35)" : "none",
  transform: $active ? "scale(1.05)" : "scale(1)",
  transformOrigin: "center",
  willChange: "transform",
  transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), color 220ms ease, text-shadow 220ms ease",
}));

const PanelGrid = styled.div(({ $isMobile }) => ({
  display: "grid",
  gridTemplateColumns: $isMobile ? "1fr" : "minmax(0, 1.7fr) minmax(260px, 1fr)",
  gap: DASHBOARD_LAYOUT.cardGap,
}));

const PanelCard = ({ children, className, style }) => (
  <LiquidGlassCard className={className} style={{ height: "100%", ...style }}>
    {children}
  </LiquidGlassCard>
);

const PanelTitle = styled.h2({
  margin: "0 0 8px",
  fontSize: TYPE_SCALE.h2,
  lineHeight: 1.2,
  color: "rgba(255, 255, 255, 0.95)",
});

const PanelHint = styled.div({
  fontSize: TYPE_SCALE.meta,
  color: "rgba(255, 255, 255, 0.65)",
  marginBottom: 14,
});

const Toolbar = styled.div(({ $isMobile }) => ({
  display: "grid",
  gridTemplateColumns: $isMobile ? "1fr" : "1fr 180px 180px",
  gap: 10,
  marginBottom: 14,
}));

const Field = styled.input({
  width: "100%",
  minHeight: 44,
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: 10,
  background: "rgba(255, 255, 255, 0.05)",
  color: "rgba(255, 255, 255, 0.9)",
  padding: "10px 12px",
  fontSize: TYPE_SCALE.meta,
  outline: "none",
  boxSizing: "border-box",
  lineHeight: 1.2,
});

const Select = styled.select({
  width: "100%",
  minHeight: 44,
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: 10,
  background: "rgba(255, 255, 255, 0.05)",
  color: "rgba(255, 255, 255, 0.9)",
  padding: "10px 38px 10px 12px",
  fontSize: TYPE_SCALE.meta,
  outline: "none",
  boxSizing: "border-box",
  lineHeight: 1.2,
  appearance: "none",
  WebkitAppearance: "none",
  "& option": {
    background: "#0d0d1a",
    color: "rgba(255, 255, 255, 0.9)",
  }
});

const TableWrap = styled.div({
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  overflowX: "auto",
  overflowY: "hidden",
  background: "rgba(255,255,255,0.04)",
  padding: 2,
  WebkitOverflowScrolling: "touch",
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
  color: "rgba(255, 255, 255, 0.65)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
  background: "rgba(255, 255, 255, 0.04)",
});

const TableCell = styled.td({
  padding: "10px 10px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
  fontSize: TYPE_SCALE.body,
  color: "rgba(255, 255, 255, 0.9)",
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
  color: "rgba(255, 255, 255, 0.65)",
});

const TablePagerActions = styled.div({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
});

const TablePagerButton = styled.button(({ disabled }) => ({
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: 8,
  background: "rgba(255, 255, 255, 0.05)",
  color: "rgba(255, 255, 255, 0.9)",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  padding: "5px 9px",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
}));

const TablePagerBadge = styled.span({
  fontSize: TYPE_SCALE.meta,
  fontWeight: 700,
  color: "rgba(255, 255, 255, 0.65)",
  minWidth: 56,
  textAlign: "center",
});

const EmptyBlock = styled.div({
  border: "1px dashed rgba(255, 255, 255, 0.15)",
  borderRadius: 10,
  padding: "18px 12px",
  textAlign: "center",
  color: "rgba(255, 255, 255, 0.65)",
  fontSize: TYPE_SCALE.meta,
});

const TableResultsText = styled.div({
  fontSize: TYPE_SCALE.meta,
  color: "rgba(255, 255, 255, 0.65)",
  marginBottom: 12,
});

const MobileDataList = styled.div({
  display: "grid",
  gap: 10,
});

const MobileDataCard = styled.div({
  ...cardStyle,
  padding: 14,
  display: "grid",
  gap: 12,
});

const MobileDataHeader = styled.div({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
});

const MobileDataMain = styled.div({
  minWidth: 0,
  display: "grid",
  gap: 4,
});

const MobileDataTitle = styled.div({
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1.3,
  color: "rgba(255, 255, 255, 0.95)",
  wordBreak: "break-word",
});

const MobileDataSubtitle = styled.div({
  fontSize: TYPE_SCALE.meta,
  lineHeight: 1.4,
  color: "rgba(255, 255, 255, 0.65)",
  wordBreak: "break-word",
});

const MobileDataBadge = styled.div({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  minHeight: 28,
  padding: "4px 9px",
  borderRadius: 999,
  border: "1px solid rgba(186,230,253,0.24)",
  background: "rgba(255,255,255,0.06)",
  fontSize: TYPE_SCALE.micro,
  fontWeight: 700,
  color: "rgba(255, 255, 255, 0.95)",
  textAlign: "center",
});

const MobileDataSelection = styled.label({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  width: "fit-content",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  color: "rgba(255, 255, 255, 0.65)",
});

const MobileDataGrid = styled.div({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
});

const MobileDataItem = styled.div({
  minWidth: 0,
});

const MobileDataLabel = styled.div({
  marginBottom: 4,
  fontSize: TYPE_SCALE.micro,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "rgba(255, 255, 255, 0.5)",
});

const MobileDataValue = styled.div({
  fontSize: TYPE_SCALE.body,
  lineHeight: 1.4,
  fontWeight: 600,
  color: "rgba(255, 255, 255, 0.9)",
  wordBreak: "break-word",
});

const MobileDataFooter = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
});

const MobileDataActions = styled.div({
  display: "grid",
  width: "100%",
  gap: 8,
});

const FloatingArea = styled.div({
  position: "relative",
  display: "inline-flex",
  zIndex: 24,
});

const PopoverCard = styled.div({
  position: "fixed",
  left: 16,
  top: 16,
  width: "min(220px, calc(100vw - 32px))",
  maxWidth: "calc(100vw - 32px)",
  overflow: "hidden",
  isolation: "isolate",
  borderRadius: 18,
  border: "1px solid var(--window-glass-border-hover, rgba(255, 255, 255, 0.22))",
  background:
    "radial-gradient(130% 120% at 0% 0%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0) 72%), linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%), linear-gradient(180deg, var(--window-glass-surface-strong-bg, rgba(128, 128, 128, 0.109804)) 0%, rgba(68,68,68,0.22) 100%)",
  backdropFilter: "blur(calc(var(--window-glass-blur, 15px) + 10px)) saturate(1.22)",
  WebkitBackdropFilter: "blur(calc(var(--window-glass-blur, 15px) + 10px)) saturate(1.22)",
  boxShadow: "0 22px 48px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.18)",
  padding: 8,
  zIndex: 320,
  transition: "top 160ms ease, left 160ms ease, opacity 120ms ease",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 46%)",
    zIndex: 0,
  },
  "& > *": {
    position: "relative",
    zIndex: 1,
  },
});

const PopoverAction = styled.button({
  width: "100%",
  border: "none",
  borderRadius: 12,
  background: "transparent",
  color: "var(--text-color, #e5e7eb)",
  textAlign: "left",
  padding: "10px 12px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 160ms ease, color 160ms ease, transform 160ms ease",
  "&:hover": {
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    transform: "translateY(-1px)",
  },
});

const ModalBackdrop = styled.div({
  position: "fixed",
  inset: 0,
  zIndex: 260,
  background: "rgba(8,12,20,0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
});

const ModalCard = styled.div(({ $maxWidth = 460 }) => ({
  position: "relative",
  isolation: "isolate",
  width: "100%",
  maxWidth: $maxWidth,
  maxHeight: "min(92dvh, 720px)",
  borderRadius: 18,
  background: "rgba(15, 23, 42, 0.65)",
  backdropFilter: "blur(22px) saturate(1.2)",
  WebkitBackdropFilter: "blur(22px) saturate(1.2)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.35)",
  color: "var(--modal-text, #e2e8f0)",
  padding: 22,
  overflowY: "auto",
  animation: `${surfaceIn} 180ms ease`,

  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "1px",
    background: "rgba(255, 255, 255, 0.15)",
    boxShadow: "0 1px 2px rgba(255, 255, 255, 0.05)",
  },

  "&::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    background: "radial-gradient(ellipse 100% 80% at 50% 0%, rgba(255, 255, 255, 0.06), transparent)",
    pointerEvents: "none",
  }
}));

const ModalTitle = styled.h2({
  margin: "0 0 6px",
  fontSize: TYPE_SCALE.h2,
  color: "rgba(255, 255, 255, 0.95)",
});

const ModalText = styled.p({
  margin: "0 0 14px",
  fontSize: TYPE_SCALE.meta,
  color: "rgba(255, 255, 255, 0.7)",
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

function MobileRecordCard({
  title,
  subtitle,
  badge,
  selected,
  onToggleSelect,
  selectLabel,
  fields = [],
  footer,
  actions,
}) {
  return (
    <MobileDataCard>
      <MobileDataHeader>
        <MobileDataMain>
          <MobileDataTitle>{title}</MobileDataTitle>
          {subtitle ? <MobileDataSubtitle>{subtitle}</MobileDataSubtitle> : null}
        </MobileDataMain>
        {badge ? <MobileDataBadge>{badge}</MobileDataBadge> : null}
      </MobileDataHeader>

      {typeof selected === "boolean" && onToggleSelect ? (
        <MobileDataSelection>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={selectLabel}
          />
          <span>Select</span>
        </MobileDataSelection>
      ) : null}

      <MobileDataGrid>
        {fields.filter(Boolean).map((field, index) => (
          <MobileDataItem
            key={`${field.label}-${index}`}
            style={field.fullWidth ? { gridColumn: "1 / -1" } : undefined}
          >
            <MobileDataLabel>{field.label}</MobileDataLabel>
            <MobileDataValue style={field.valueStyle}>{field.value}</MobileDataValue>
          </MobileDataItem>
        ))}
      </MobileDataGrid>

      {(footer || actions) ? (
        <MobileDataFooter>
          {footer || <span />}
          {actions ? <MobileDataActions>{actions}</MobileDataActions> : null}
        </MobileDataFooter>
      ) : null}
    </MobileDataCard>
  );
}

function DataTablePagination({ totalRows, currentPage, onPageChange, pageLength = TABLE_PAGE_LENGTH }) {
  if (totalRows <= pageLength) return null;

  const isMobile = useIsMobile();
  const totalPages = getTotalPages(totalRows, pageLength);
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (safePage - 1) * pageLength + 1;
  const end = Math.min(totalRows, safePage * pageLength);

  return (
    <TablePager style={isMobile ? { alignItems: "stretch" } : undefined}>
      <TablePagerInfo style={isMobile ? { width: "100%" } : undefined}>
        Showing {start}-{end} of {totalRows}
      </TablePagerInfo>
      <TablePagerActions style={isMobile ? { width: "100%", justifyContent: "space-between" } : undefined}>
        {!isMobile && (
          <TablePagerButton
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(1)}
          >
            First
          </TablePagerButton>
        )}
        <TablePagerButton
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
        >
          Prev
        </TablePagerButton>
        <TablePagerBadge style={isMobile ? { flex: 1, minWidth: 0 } : undefined}>
          {safePage} / {totalPages}
        </TablePagerBadge>
        <TablePagerButton
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
        >
          Next
        </TablePagerButton>
        {!isMobile && (
          <TablePagerButton
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(totalPages)}
          >
            Last
          </TablePagerButton>
        )}
      </TablePagerActions>
    </TablePager>
  );
}
/* ══════════════════════════════════════════════════════════════
   SECTION 6 — INSIGHTS PAGE
══════════════════════════════════════════════════════════════ */
export function InsightsPage({ incomes = [], expenses = [], currency }) {
  const isMobile = useIsMobile();

  const DATE_FILTERS = [
    { key: "this_month", label: "This Month" },
    { key: "last_month", label: "Last Month" },
    { key: "3m", label: "3M" },
    { key: "6m", label: "6M" },
    { key: "12m", label: "12M" },
    { key: "all", label: "All" },
  ];
  const [dateFilter, setDateFilter] = useState("3m");
  const dateRange = useMemo(() => getDateRangeForFilter(dateFilter), [dateFilter]);

  // Apply date filter
  const filteredIncomes = useMemo(() => filterByRange(incomes, dateRange), [incomes, dateRange]);
  const filteredExpenses = useMemo(() => filterByRange(expenses, dateRange), [expenses, dateRange]);

  // Stat calculations
  const totalIncome = filteredIncomes.reduce((s, i) => s + (i.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const gap = totalIncome - totalExpenses;

  // Unique months in range for monthly averages
  const uniqueIncomeMonths = useMemo(() => {
    const months = new Set(filteredIncomes.map((i) => {
      const d = parseEntryDate(i);
      return d ? `${d.getFullYear()}-${d.getMonth()}` : null;
    }).filter(Boolean));
    return Math.max(1, months.size);
  }, [filteredIncomes]);

  const uniqueExpenseMonths = useMemo(() => {
    const months = new Set(filteredExpenses.map((e) => {
      const d = parseEntryDate(e);
      return d ? `${d.getFullYear()}-${d.getMonth()}` : null;
    }).filter(Boolean));
    return Math.max(1, months.size);
  }, [filteredExpenses]);

  const avgMonthlyIncome = totalIncome / uniqueIncomeMonths;
  const avgMonthlyExpense = totalExpenses / uniqueExpenseMonths;

  // Highest single expense
  const highestExpense = useMemo(() => {
    if (filteredExpenses.length === 0) return null;
    return filteredExpenses.reduce((max, e) => (e.amount || 0) > (max.amount || 0) ? e : max);
  }, [filteredExpenses]);

  // Last expense (most recent)
  const lastExpense = useMemo(() => {
    if (filteredExpenses.length === 0) return null;
    return [...filteredExpenses].sort((a, b) => {
      const da = parseEntryDate(a) || new Date(0);
      const db = parseEntryDate(b) || new Date(0);
      return db - da;
    })[0];
  }, [filteredExpenses]);

  // Monthly trend chart
  const trendData = useMemo(
    () => buildMonthlyTrendData(incomes, expenses, dateRange),
    [incomes, expenses, dateRange]
  );

  const fmtK = (v) =>
    Math.abs(v) >= 100000
      ? `${(v / 100000).toFixed(1)}L`
      : Math.abs(v) >= 1000
      ? `${(v / 1000).toFixed(0)}K`
      : `${v}`;

  const statTiles = [
    {
      label: "TOTAL INCOME",
      value: formatCurrency(totalIncome, currency),
      sub: `${filteredIncomes.length} entries`,
      color: "#22c55e",
      icon: "💸",
    },
    {
      label: "TOTAL EXPENSES",
      value: formatCurrency(totalExpenses, currency),
      sub: `${filteredExpenses.length} entries`,
      color: "#ef4444",
      icon: "🧾",
    },
    {
      label: "GAP (INCOME − EXP)",
      value: `${gap >= 0 ? "+" : ""}${formatCurrency(gap, currency)}`,
      sub: gap >= 0 ? "Surplus" : "Deficit",
      color: gap >= 0 ? "#22c55e" : "#ef4444",
      icon: gap >= 0 ? "✅" : "⚠️",
    },
    {
      label: "AVG MONTHLY INCOME",
      value: formatCurrency(avgMonthlyIncome, currency),
      sub: "per month",
      color: "#38bdf8",
      icon: "📅",
    },
    {
      label: "AVG MONTHLY EXPENSE",
      value: formatCurrency(avgMonthlyExpense, currency),
      sub: "per month",
      color: "#f97316",
      icon: "📆",
    },
    highestExpense
      ? {
          label: "HIGHEST EXPENSE",
          value: formatCurrency(highestExpense.amount, currency),
          sub: `${highestExpense.name || "—"}${highestExpense.month ? " · " + highestExpense.month : ""}`,
          color: "#a78bfa",
          icon: "📌",
        }
      : null,
    lastExpense
      ? {
          label: "LAST EXPENSE",
          value: formatCurrency(lastExpense.amount, currency),
          sub: `${lastExpense.name || "—"}${lastExpense.month ? " · " + lastExpense.month : ""}`,
          color: "#fb923c",
          icon: "🕐",
        }
      : null,
  ].filter(Boolean);

  return (
    <PageSection $isMobile={isMobile}>
      {/* Header */}
      <PageHeader $isMobile={isMobile}>
        <div>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "rgba(255,255,255,0.95)" }}>
            Insights
          </h2>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14 }}>
            {DATE_FILTERS.find((f) => f.key === dateFilter)?.label} · Savings rate:{" "}
            <span style={{ color: gap >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
              {totalIncome > 0 ? `${((gap / totalIncome) * 100).toFixed(1)}%` : "N/A"}
            </span>
          </p>
        </div>
      </PageHeader>

      {/* 6.2 Date Filter Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {DATE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setDateFilter(f.key)}
            style={{
              padding: "6px 18px",
              fontSize: 13,
              borderRadius: 99,
              cursor: "pointer",
              border:
                dateFilter === f.key
                  ? "1px solid rgba(56,189,248,0.6)"
                  : "1px solid rgba(255,255,255,0.15)",
              background:
                dateFilter === f.key ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.06)",
              color: dateFilter === f.key ? "#38bdf8" : "rgba(255,255,255,0.7)",
              fontWeight: dateFilter === f.key ? 700 : 400,
              transition: "all 0.2s",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 6.1 Stat Tiles grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {statTiles.map((tile) => (
          <div
            key={tile.label}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${tile.color}25`,
              borderRadius: 14,
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{tile.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
                {tile.label}
              </span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, color: tile.color, lineHeight: 1.2 }}>
              {tile.value}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
              {tile.sub}
            </div>
          </div>
        ))}
      </div>

      {/* 6.3 Monthly Trend Chart */}
      <div style={{ ...cardStyle, padding: "16px 16px 8px", marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 14 }}>
          Monthly Income vs Expenses
        </div>
        {trendData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
            No data for the selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={trendData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="month"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtK}
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(15,23,42,0.97)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
                formatter={(v, name) => [formatCurrency(v, currency), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }} />
              <Bar
                dataKey="income"
                name="Income"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
                fillOpacity={0.85}
              />
              <Bar
                dataKey="expense"
                name="Expenses"
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
                fillOpacity={0.85}
              />
              <Line
                dataKey="net"
                name="Net"
                type="monotone"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#38bdf8" }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly breakdown table */}
      {trendData.length > 0 && (
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            Monthly Breakdown
          </div>
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <TableHead>Month</TableHead>
                  <TableHead>Income</TableHead>
                  <TableHead>Expenses</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Savings %</TableHead>
                </tr>
              </thead>
              <tbody>
                {[...trendData].reverse().map((row) => {
                  const savingsPct = row.income > 0 ? ((row.net / row.income) * 100).toFixed(1) : "—";
                  return (
                    <tr key={row.month}>
                      <TableCell style={{ fontWeight: 600 }}>{row.month}</TableCell>
                      <TableCell style={{ color: "#22c55e" }}>{formatCurrency(row.income, currency)}</TableCell>
                      <TableCell style={{ color: "#ef4444" }}>{formatCurrency(row.expense, currency)}</TableCell>
                      <TableCell style={{ fontWeight: 700, color: row.net >= 0 ? "#22c55e" : "#ef4444" }}>
                        {row.net >= 0 ? "+" : ""}{formatCurrency(row.net, currency)}
                      </TableCell>
                      <TableCell style={{ color: parseFloat(savingsPct) >= 20 ? "#22c55e" : parseFloat(savingsPct) >= 0 ? "#f97316" : "#ef4444" }}>
                        {savingsPct !== "—" ? `${savingsPct}%` : "—"}
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </TableWrap>
        </div>
      )}
    </PageSection>
  );
}