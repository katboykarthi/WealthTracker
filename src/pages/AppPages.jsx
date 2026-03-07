import { useState, useEffect, useRef, useMemo } from "react";
import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";
import { gsap } from "gsap";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { CURRENCIES, ASSET_TYPES, LIABILITY_TYPES, GOAL_ICONS } from "../constants";
import { formatCurrency } from "../utils/formatCurrency";
import { sanitizeInput } from "../utils/security";
import { useIsMobile } from "../hooks/useWindowSize";
import { parseHdfcStatementFile, buildImportedHdfcEntries } from "../services/hdfcImportService";
import { AddAssetForm, AddLiabilityForm } from "../components/forms/AssetForms";
import { buttonStyles, cardStyle as sharedCardStyle, inputStyle as sharedInputStyle, labelStyle as sharedLabelStyle, serifFontFamily, heroGradient } from "../styles";

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
          <FloatingArea ref={quickPopoverAnchorRef} onClick={(event) => event.stopPropagation()}>
            <GhostButton onClick={() => setShowQuickPopover((prev) => !prev)}>Quick Actions</GhostButton>
            {showQuickPopover && (
              <PopoverCard
                ref={quickPopoverRef}
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
              </PopoverCard>
            )}
          </FloatingArea>
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
                <LineChart data={snapshots}>
                  <XAxis dataKey="date" tick={{ fontSize: TYPE_SCALE.micro }} />
                  <YAxis tick={{ fontSize: TYPE_SCALE.micro }} tickFormatter={(value) => formatCurrency(value, currency)} />
                  <Tooltip formatter={(value) => formatCurrency(value, currency)} />
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

  if (animated) {
    return <PanelCard style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>{content}</PanelCard>;
  }

  return (
    <div style={{ ...cardStyle, display: "flex", gap: 16, alignItems: "flex-start" }}>
      {content}
    </div>
  );
}

export function AssetsPage({ assets, currency, onAdd, onUpdate, onDelete, openAssetComposerRequest, onConsumeAssetComposerRequest }) {
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
                    return (
                      <MobileRecordCard
                        key={asset.id}
                        title={asset.name}
                        subtitle={asset.notes || "No notes"}
                        badge={type?.label || "Other"}
                        selected={selectedAssetIds.includes(asset.id)}
                        onToggleSelect={() => toggleAssetSelection(asset.id)}
                        selectLabel={`Select ${asset.name}`}
                        fields={[
                          { label: "Type", value: `${type?.icon || ""} ${type?.label || "Other"}`.trim() },
                          { label: "Value", value: formatCurrency(asset.value, asset.currency || currency) },
                          { label: "Currency", value: asset.currency || currency },
                          asset.notes ? { label: "Notes", value: asset.notes, fullWidth: true } : null,
                        ]}
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
                        <TableHead style={{ width: "5%" }}>
                          <input
                            type="checkbox"
                            checked={allAssetsOnPageSelected}
                            onChange={toggleSelectAllAssetsOnPage}
                            aria-label="Select all assets on this page"
                          />
                        </TableHead>
                        <TableHead style={{ width: "22%" }}>Asset</TableHead>
                        <TableHead style={{ width: "18%" }}>Type</TableHead>
                        <TableHead style={{ width: "27%" }}>Notes</TableHead>
                        <TableHead style={{ width: "16%" }}>Value</TableHead>
                        <TableHead style={{ width: "12%" }}>Actions</TableHead>
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
                            <TableCell>
                              <button onClick={() => handleEdit(asset)} style={{...buttonStyles.secondary, padding: '4px 8px', fontSize: 12}}>
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
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)" }}>Liabilities</h2>
          <p style={{ color: "var(--muted, #64748b)", fontSize: 14 }}>Total: <span style={{ color: "#ef4444" }}>{formatCurrency(total, currency)}</span></p>
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
                  {pagedLiabilityRows.map((liability) => (
                    <MobileRecordCard
                      key={liability.id}
                      title={liability.name}
                      subtitle={liability.label || "Liability"}
                      badge={liability.interest > 0 ? `${liability.interest}%` : "No interest"}
                      selected={selectedLiabilityIds.includes(liability.id)}
                      onToggleSelect={() => toggleLiabilitySelection(liability.id)}
                      selectLabel={`Select ${liability.name}`}
                      fields={[
                        { label: "Type", value: `${liability.icon || ""} ${liability.label || "-"}`.trim() },
                        { label: "Amount", value: formatCurrency(liability.value, liability.currency || currency) },
                        { label: "Interest", value: liability.interest > 0 ? `${liability.interest}% p.a.` : "-" },
                        { label: "Currency", value: liability.currency || currency },
                      ]}
                      actions={(
                        <button onClick={() => handleEdit(liability)} style={{ ...buttonStyles.secondary, padding: "8px 12px", fontSize: 12, width: "100%" }}>
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
                            checked={allLiabilitiesOnPageSelected}
                            onChange={toggleSelectAllLiabilitiesOnPage}
                            aria-label="Select all liabilities on this page"
                          />
                        </TableHead>
                        <TableHead style={{ width: "25%" }}>Liability</TableHead>
                        <TableHead style={{ width: "25%" }}>Type</TableHead>
                        <TableHead style={{ width: "15%" }}>Interest</TableHead>
                        <TableHead style={{ width: "18%" }}>Amount</TableHead>
                        <TableHead style={{ width: "12%" }}>Actions</TableHead>
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
                          <TableCell>
                            <button onClick={() => handleEdit(liability)} style={{...buttonStyles.secondary, padding: '4px 8px', fontSize: 12}}>
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

export function IncomePage({ incomes, currency, onAdd, onUpdate, onDelete, onImportIncome, onImportExpense }) {
  const isMobile = useIsMobile();
  const total = incomes.reduce((s, i) => s + i.amount, 0);
  const [showAdd, setShowAdd] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("amount_desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIncomeIds, setSelectedIncomeIds] = useState([]);
  const importInputRef = useRef(null);

  useEffect(() => {
    if (editingIncome) {
      setName(editingIncome.name || "");
      setAmount(editingIncome.amount || "");
    } else {
      setName("");
      setAmount("");
    }
  }, [editingIncome]);

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
    setEditingIncome(null);
  };

  const handleEdit = (income) => {
    setEditingIncome(income);
    setShowAdd(true);
  };

  const handleSave = () => {
    const n = sanitizeInput(name, 'text');
    const a = sanitizeInput(amount, 'number');
    if (!n || a <= 0) {
      notifyApp("Enter valid income name and positive amount.", "error");
      return;
    }
    
    const payload = { 
      id: editingIncome?.id || Date.now(), 
      name: n, 
      amount: a, 
      currency 
    };

    if (editingIncome) {
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
          <button onClick={() => { setEditingIncome(null); setShowAdd(true); }} style={{ ...btnStyle, width: isMobile ? "100%" : "auto" }}>+ Add Income</button>
        </PageHeaderActions>
      </PageHeader>

      {showAdd && (
        <ModalBackdrop onClick={closeAddModal}>
          <ModalCard $maxWidth={520} onClick={(event) => event.stopPropagation()}>
            <ModalTitle>{editingIncome ? "Edit Income" : "Add Income"}</ModalTitle>
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
                <button onClick={handleSave} style={btnStyle}>{editingIncome ? "Update" : "Save"}</button>
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
                  background: "var(--error, #f97316)",
                  padding: "8px 12px",
                  fontSize: 12,
                  width: isMobile ? "100%" : "auto",
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
              <TableResultsText>
                Showing {pagedIncomeRows.length} of {incomeRows.length} income records
              </TableResultsText>
              {isMobile ? (
                <MobileDataList>
                  <MobileDataCard>
                    <MobileDataSelection>
                      <input
                        type="checkbox"
                        checked={allIncomeOnPageSelected}
                        onChange={toggleSelectAllIncomeOnPage}
                        aria-label="Select all income rows on this page"
                      />
                      <span>Select all items on this page</span>
                    </MobileDataSelection>
                  </MobileDataCard>
                  {pagedIncomeRows.map((income) => (
                    <MobileRecordCard
                      key={income.id}
                      title={income.name}
                      badge="Income"
                      selected={selectedIncomeIds.includes(income.id)}
                      onToggleSelect={() => toggleIncomeSelection(income.id)}
                      selectLabel={`Select ${income.name}`}
                      fields={[
                        { label: "Amount", value: formatCurrency(income.amount, income.currency || currency), fullWidth: true },
                      ]}
                      actions={(
                        <button onClick={() => handleEdit(income)} style={{ ...buttonStyles.secondary, padding: "8px 12px", fontSize: 12, width: "100%" }}>
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
                            checked={allIncomeOnPageSelected}
                            onChange={toggleSelectAllIncomeOnPage}
                            aria-label="Select all income rows on this page"
                          />
                        </TableHead>
                        <TableHead style={{ width: "50%" }}>Source</TableHead>
                        <TableHead style={{ width: "30%" }}>Amount</TableHead>
                        <TableHead style={{ width: "15%" }}>Actions</TableHead>
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
                          <TableCell>
                            <button onClick={() => handleEdit(income)} style={{...buttonStyles.secondary, padding: '4px 8px', fontSize: 12}}>
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
                <button onClick={closeAddModal} style={{ ...btnStyle, background: 'var(--muted-bg, #f1f5f9)', color: 'var(--muted, #64748b)' }}>Cancel</button>
                <button onClick={handleSave} style={{ ...btnStyle, background: "var(--error, #f97316)" }}>{editingExpense ? "Update" : "Save"}</button>
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
        </>
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
    <div style={{ padding: isMobile ? "24px 16px" : "28px 32px", maxWidth: 900, width: "100%", boxSizing: "border-box" }}>
      <h2 style={{ fontFamily: serifFontFamily, fontSize: isMobile ? 24 : 28, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>Net Worth</h2>
      <p style={{ color: "var(--muted, #64748b)", marginBottom: 24 }}>Track your wealth journey over time</p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <SummaryCard icon={"\u{1F3DB}"} label="TOTAL ASSETS" value={formatCurrency(totalAssets, currency)} sub={`${assets.length} assets`} color="#22c55e" />
        <SummaryCard icon={"\u{1F4B3}"} label="TOTAL LIABILITIES" value={formatCurrency(totalLiabilities, currency)} sub={`${liabilities.length} debts`} color="#ef4444" negative />
        <SummaryCard icon={"\u2728"} label="NET WORTH" value={formatCurrency(netWorth, currency)} sub="Assets minus Liabilities" color="#3b82f6" />
      </div>

      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", fontSize: 16 }}>Wealth Timeline</div>
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
          <TableResultsText>
            Showing {pagedSnapshotRows.length} of {snapshotRows.length} snapshots
          </TableResultsText>
          {isMobile ? (
            <MobileDataList>
              {pagedSnapshotRows.map((snapshot, index) => (
                <MobileRecordCard
                  key={`${snapshot.date}-${index}`}
                  title={snapshot.date}
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
          )}
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

export function GoalsPage({ assets, currency }) {
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
                  background: "var(--error, #f97316)",
                  padding: "8px 12px",
                  fontSize: 12,
                  width: isMobile ? "100%" : "auto",
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
              <TableResultsText>
                Showing {pagedGoalRows.length} of {goalRows.length} goals
              </TableResultsText>
              {isMobile ? (
                <MobileDataList>
                  <MobileDataCard>
                    <MobileDataSelection>
                      <input
                        type="checkbox"
                        checked={allGoalsOnPageSelected}
                        onChange={toggleSelectAllGoalsOnPage}
                        aria-label="Select all goals on this page"
                      />
                      <span>Select all items on this page</span>
                    </MobileDataSelection>
                  </MobileDataCard>
                  {pagedGoalRows.map((goal) => {
                    const pct = goal.target > 0 ? Math.min((goal.current / goal.target) * 100, 100) : 0;
                    return (
                      <MobileRecordCard
                        key={goal.id}
                        title={`${goal.icon} ${goal.name}`}
                        badge={`${pct.toFixed(1)}%`}
                        selected={selectedGoalIds.includes(goal.id)}
                        onToggleSelect={() => toggleGoalSelection(goal.id)}
                        selectLabel={`Select ${goal.name}`}
                        fields={[
                          { label: "Current", value: formatCurrency(goal.current, currency) },
                          { label: "Target", value: formatCurrency(goal.target, currency) },
                          {
                            label: "Progress",
                            value: (
                              <div style={{ display: "grid", gap: 6 }}>
                                <span>{pct.toFixed(1)}%</span>
                                <div style={{ height: 6, borderRadius: 99, background: "var(--muted-bg, #f1f5f9)" }}>
                                  <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: pct >= 100 ? "#16a34a" : "var(--primary, #38bdf8)" }} />
                                </div>
                              </div>
                            ),
                            fullWidth: true,
                          },
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
              )}
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
  color: "var(--text-color, #1e293b)",
  flexDirection: $isMobile ? "column" : "row",
}));

const PageSection = styled.div(({ $isMobile }) => ({
  padding: $isMobile ? "24px 16px" : "20px 24px",
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
  gap: DASHBOARD_LAYOUT.cardGap,
  marginBottom: $isMobile ? DASHBOARD_LAYOUT.cardGap : DASHBOARD_LAYOUT.sectionGap,
}));

const StatCard = styled.article`
  border-radius: 18px;
  padding: 20px;
  display: grid;
  gap: 6px;
  animation: ${surfaceIn} 240ms ease;

  background: linear-gradient(135deg, rgba(30,41,59,0.65), rgba(15,23,42,0.55));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 10px 40px rgba(0,0,0,0.45), inset 0 1px rgba(255,255,255,0.05);
  position: relative;
  transition: all 0.3s ease;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(120deg, rgba(255,255,255,0.08), transparent 40%);
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 15px 60px rgba(0,0,0,0.5), inset 0 1px rgba(255,255,255,0.1);
  }
`;

const StatLabel = styled.div({
  fontSize: TYPE_SCALE.micro,
  textTransform: "uppercase",
  letterSpacing: 0.7,
  fontWeight: 700,
  color: "var(--muted, #64748b)",
});

const StatValue = styled.div({
  fontSize: 26,
  fontWeight: 700,
  color: "var(--text-color, #1e293b)",
});

const StatSub = styled.div({
  fontSize: TYPE_SCALE.meta,
  color: "var(--muted, #64748b)",
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

const PanelCard = styled.section`
  border-radius: 18px;
  padding: 22px;
  animation: ${surfaceIn} 240ms ease;

  background: linear-gradient(135deg, rgba(30,41,59,0.65), rgba(15,23,42,0.55));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 10px 40px rgba(0,0,0,0.45), inset 0 1px rgba(255,255,255,0.05);
  position: relative;
  transition: all 0.3s ease;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(120deg, rgba(255,255,255,0.08), transparent 40%);
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 15px 60px rgba(0,0,0,0.5), inset 0 1px rgba(255,255,255,0.1);
  }
`;

const PanelTitle = styled.h2({
  margin: "0 0 8px",
  fontSize: TYPE_SCALE.h2,
  lineHeight: 1.2,
  color: "var(--text-color, #1e293b)",
});

const PanelHint = styled.div({
  fontSize: TYPE_SCALE.meta,
  color: "var(--muted, #64748b)",
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
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 10,
  background: "var(--input-bg, #fff)",
  color: "var(--text-color, #1e293b)",
  padding: "10px 12px",
  fontSize: TYPE_SCALE.meta,
  outline: "none",
  boxSizing: "border-box",
  lineHeight: 1.2,
});

const Select = styled.select({
  width: "100%",
  minHeight: 44,
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 10,
  background: "var(--input-bg, #fff)",
  color: "var(--text-color, #1e293b)",
  padding: "10px 38px 10px 12px",
  fontSize: TYPE_SCALE.meta,
  outline: "none",
  boxSizing: "border-box",
  lineHeight: 1.2,
  appearance: "none",
  WebkitAppearance: "none",
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

const TableResultsText = styled.div({
  fontSize: TYPE_SCALE.meta,
  color: "var(--muted, #64748b)",
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
  color: "var(--text-color, #1e293b)",
  wordBreak: "break-word",
});

const MobileDataSubtitle = styled.div({
  fontSize: TYPE_SCALE.meta,
  lineHeight: 1.4,
  color: "var(--muted, #64748b)",
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
  color: "var(--text-color, #1e293b)",
  textAlign: "center",
});

const MobileDataSelection = styled.label({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  width: "fit-content",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  color: "var(--muted, #64748b)",
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
  color: "var(--muted, #64748b)",
});

const MobileDataValue = styled.div({
  fontSize: TYPE_SCALE.body,
  lineHeight: 1.4,
  fontWeight: 600,
  color: "var(--text-color, #1e293b)",
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
  borderRadius: 14,
  border: "1px solid rgba(186,230,253,0.22)",
  background:
    "radial-gradient(130% 120% at 0% 0%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 52%, rgba(255,255,255,0) 68%), linear-gradient(145deg, rgba(15,25,50,0.94) 0%, rgba(8,15,32,0.96) 100%)",
  backdropFilter: "blur(30px) saturate(1.35)",
  WebkitBackdropFilter: "blur(30px) saturate(1.35)",
  boxShadow: "0 18px 44px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.08)",
  padding: 6,
  zIndex: 220,
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
  borderRadius: 8,
  background: "transparent",
  color: "var(--text-color, #e5e7eb)",
  textAlign: "left",
  padding: "8px 10px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 160ms ease, color 160ms ease",
  "&:hover": {
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
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
  color: "var(--modal-text, var(--text-color, #1e293b))",
});

const ModalText = styled.p({
  margin: "0 0 14px",
  fontSize: TYPE_SCALE.meta,
  color: "var(--modal-muted, var(--muted, #64748b))",
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
