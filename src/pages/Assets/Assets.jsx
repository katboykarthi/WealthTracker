/**
 * pages/Assets/Assets.jsx
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { ASSET_TYPES } from "../../constants";
import { formatCurrency } from "../../utils/formatCurrency";
import {
  PageSection, PageHeader, PageHeaderActions, PageTitle,
  Field, Select, EmptyBlock, TableWrap, DataTable, TableHead, TableCell,
  TableResultsText, MobileDataList, MobileDataSelection, MobileRecordCard,
  ModalBackdrop, ModalCard, ModalTitle, ModalText, ModalActions, SecondaryButton,
  DataTablePagination, getPaginatedRows, getTotalPages, notifyApp,
} from "../../components/shared/ui";
import { buttonStyles, cardStyle } from "../../styles";
import { parseAngelOneHoldingsFile, buildAngelOneAssetEntries } from "../../services/angelOneImportService";
import { AddAssetForm } from "../../components/forms/AssetForms";
import { useIsMobile } from "../../hooks/useWindowSize";

export default function AssetsPage({
  assets, currency, onAdd, onUpdate, onDelete,
  onImportHoldings, openAssetComposerRequest, onConsumeAssetComposerRequest,
}) {
  const isMobile  = useIsMobile();
  const importRef = useRef(null);
  const btnStyle  = buttonStyles.primary;

  const [showAdd,      setShowAdd]      = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [selectedType, setSelectedType] = useState("stocks");
  const [pickingType,  setPickingType]  = useState(true);
  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [sortBy,       setSortBy]       = useState("value_desc");
  const [page,         setPage]         = useState(1);
  const [selectedIds,  setSelectedIds]  = useState([]);

  const totalValue    = assets.reduce((s, a) => s + a.value, 0);
  const totalInvested = assets.reduce((s, a) => s + (a.invested ?? a.value), 0);
  const overallPnl    = totalValue - totalInvested;
  const overallPct    = totalInvested > 0 ? (overallPnl / totalInvested) * 100 : 0;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = assets.filter((a) => {
      if (typeFilter !== "all" && a.typeId !== typeFilter) return false;
      return !q || String(a.name || "").toLowerCase().includes(q) || String(a.notes || "").toLowerCase().includes(q);
    });
    return [...r].sort((a, b) => {
      if (sortBy === "value_desc")    return b.value - a.value;
      if (sortBy === "value_asc")     return a.value - b.value;
      if (sortBy === "pnl_desc")      return (b.pnl ?? 0) - (a.pnl ?? 0);
      if (sortBy === "pnl_asc")       return (a.pnl ?? 0) - (b.pnl ?? 0);
      if (sortBy === "invested_desc") return (b.invested ?? b.value) - (a.invested ?? a.value);
      if (sortBy === "name_desc")     return String(b.name || "").localeCompare(String(a.name || ""));
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [assets, search, typeFilter, sortBy]);

  const paged = useMemo(() => getPaginatedRows(rows, page), [rows, page]);

  useEffect(() => { setPage(1); }, [search, typeFilter, sortBy]);
  useEffect(() => { const tp = getTotalPages(rows.length); if (page > tp) setPage(tp); }, [rows.length, page]);
  useEffect(() => { setSelectedIds((p) => p.filter((id) => rows.some((a) => a.id === id))); }, [rows]);

  const pageIds     = paged.map((a) => a.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const toggle      = (id) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAll   = () => setSelectedIds((p) => allSelected ? p.filter((id) => !pageIds.includes(id)) : [...new Set([...p, ...pageIds])]);
  const deleteSelected = () => { selectedIds.forEach(onDelete); setSelectedIds([]); };

  const closeAdd   = () => { setShowAdd(false); setPickingType(true); setEditing(null); };
  const handleEdit = (a) => { setEditing(a); setSelectedType(a.typeId); setPickingType(false); setShowAdd(true); };
  const handleSave = (a) => { editing ? onUpdate(a) : onAdd(a); closeAdd(); };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const entries = buildAngelOneAssetEntries(await parseAngelOneHoldingsFile(file), currency);
      if (!entries?.length) { notifyApp("No valid holdings found.", "warning"); return; }
      onImportHoldings?.(entries);
      notifyApp(`Imported ${entries.length} holding${entries.length !== 1 ? "s" : ""}.`, "success");
    } catch { notifyApp("Unable to import. Please upload a valid AngelOne .xls/.xlsx file.", "error"); }
    finally { e.target.value = ""; }
  };

  useEffect(() => {
    if (!openAssetComposerRequest) return;
    const typeId = ASSET_TYPES.some((t) => t.id === openAssetComposerRequest.typeId) ? openAssetComposerRequest.typeId : "stocks";
    setSelectedType(typeId); setPickingType(false); setShowAdd(true);
    onConsumeAssetComposerRequest?.();
  }, [openAssetComposerRequest, onConsumeAssetComposerRequest]);

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <PageTitle title="Assets" subtitle={`Total: ${formatCurrency(totalValue, currency)}`} />
        <PageHeaderActions $isMobile={isMobile}>
          <input ref={importRef} type="file" accept=".xls,.xlsx" onChange={handleImport} style={{ display: "none" }} />
          <button onClick={() => importRef.current?.click()} style={{ ...buttonStyles.secondary, padding: "10px 14px", fontSize: 13, width: isMobile ? "100%" : "auto" }}>
            Import AngelOne Holdings
          </button>
          <button onClick={() => { setEditing(null); setShowAdd(true); setPickingType(true); }} style={{ ...btnStyle, width: isMobile ? "100%" : "auto" }}>
            + Add Asset
          </button>
        </PageHeaderActions>
      </PageHeader>

      {showAdd && (
        <ModalBackdrop onClick={closeAdd}>
          <ModalCard $maxWidth={pickingType ? 720 : 520} onClick={(e) => e.stopPropagation()}>
            {pickingType ? (
              <>
                <ModalTitle>Select Asset Type</ModalTitle>
                <ModalText>Choose the asset category first, then enter details.</ModalText>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
                  {ASSET_TYPES.map((t) => (
                    <button key={t.id} onClick={() => { setSelectedType(t.id); setPickingType(false); }}
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 8px", cursor: "pointer", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.95)" }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{t.icon}</div>
                      {t.label}
                    </button>
                  ))}
                </div>
                <ModalActions><SecondaryButton onClick={closeAdd}>Cancel</SecondaryButton></ModalActions>
              </>
            ) : (
              <AddAssetForm editData={editing} typeId={selectedType} onSave={handleSave} onCancel={() => editing ? closeAdd() : setPickingType(true)} />
            )}
          </ModalCard>
        </ModalBackdrop>
      )}

      {assets.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏛️</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "rgba(255,255,255,0.65)" }}>No assets yet</div>
          <div>Add your first asset to start tracking your wealth</div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[
              { label: "TOTAL INVESTED", value: formatCurrency(totalInvested, currency), color: "#38bdf8", icon: "💼" },
              { label: "CURRENT VALUE",  value: formatCurrency(totalValue,    currency), color: "#22c55e", icon: "📊" },
              { label: "OVERALL P&L",    value: `${overallPnl >= 0 ? "+" : ""}${formatCurrency(overallPnl, currency)} (${overallPct >= 0 ? "+" : ""}${overallPct.toFixed(2)}%)`, color: overallPnl >= 0 ? "#22c55e" : "#ef4444", icon: overallPnl >= 0 ? "📈" : "📉" },
            ].map((tile) => (
              <div key={tile.label} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${tile.color}30`, borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 24 }}>{tile.icon}</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>{tile.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: tile.color }}>{tile.value}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(220px,1fr) minmax(140px,180px) minmax(160px,190px)", gap: 8 }}>
              <Field value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets or notes" />
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All types</option>
                {ASSET_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
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
              <button onClick={deleteSelected} disabled={selectedIds.length === 0}
                style={{ ...btnStyle, background: "var(--error, #f97316)", padding: "8px 12px", fontSize: 12, width: isMobile ? "100%" : "auto", opacity: selectedIds.length === 0 ? 0.55 : 1, cursor: selectedIds.length === 0 ? "not-allowed" : "pointer" }}>
                Delete Selected ({selectedIds.length})
              </button>
            </div>
          </div>

          {rows.length === 0 ? <EmptyBlock>No assets match your filters.</EmptyBlock> : (
            <>
              <TableResultsText>Showing {paged.length} of {rows.length} assets</TableResultsText>
              {isMobile ? (
                <MobileDataList>
                  <div style={{ ...cardStyle, padding: 14 }}>
                    <MobileDataSelection>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all on page" />
                      <span>Select all on this page</span>
                    </MobileDataSelection>
                  </div>
                  {paged.map((asset) => {
                    const type  = ASSET_TYPES.find((t) => t.id === asset.typeId);
                    const inv   = asset.invested ?? asset.value;
                    const pnl   = asset.pnl ?? (asset.value - inv);
                    const pct   = asset.pnlPct ?? (inv > 0 ? (pnl / inv) * 100 : 0);
                    const alloc = totalValue > 0 ? ((asset.value / totalValue) * 100).toFixed(1) : "0";
                    const qty   = asset.shares ?? asset.units ?? asset.weightGrams ?? null;
                    const qLbl  = asset.typeId === "stocks" ? "shares" : asset.typeId === "gold" ? "g" : "units";
                    return (
                      <MobileRecordCard key={asset.id} title={asset.name} subtitle={type?.label || "Other"}
                        badge={asset.priceUpdatedAt ? "🟢 Live" : type?.label || "Other"}
                        selected={selectedIds.includes(asset.id)} onToggleSelect={() => toggle(asset.id)} selectLabel={`Select ${asset.name}`}
                        fields={[
                          { label: "Type",          value: `${type?.icon || ""} ${type?.label || "Other"}`.trim() },
                          qty !== null ? { label: `Qty (${qLbl})`, value: qty.toLocaleString("en-IN") } : null,
                          { label: "Invested",      value: formatCurrency(inv,        currency) },
                          { label: "Current Value", value: formatCurrency(asset.value, currency) },
                          { label: "P&L", value: <span style={{ color: pnl >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{pnl >= 0 ? "+" : ""}{formatCurrency(pnl, currency)} ({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%)</span> },
                          { label: "Allocation",    value: `${alloc}%` },
                        ].filter(Boolean)}
                        actions={<button onClick={() => handleEdit(asset)} style={{ ...buttonStyles.secondary, padding: "8px 12px", fontSize: 12, width: "100%" }}>Modify</button>}
                      />
                    );
                  })}
                </MobileDataList>
              ) : (
                <TableWrap>
                  <DataTable>
                    <thead>
                      <tr>
                        <TableHead style={{ width: "3%"  }}><input type="checkbox" checked={allSelected} onChange={toggleAll} /></TableHead>
                        <TableHead style={{ width: "18%" }}>Asset</TableHead>
                        <TableHead style={{ width: "10%" }}>Type</TableHead>
                        <TableHead style={{ width: "8%"  }}>Qty / Units</TableHead>
                        <TableHead style={{ width: "12%" }}>Invested ₹</TableHead>
                        <TableHead style={{ width: "12%" }}>Current Value</TableHead>
                        <TableHead style={{ width: "13%" }}>P&amp;L</TableHead>
                        <TableHead style={{ width: "8%"  }}>Alloc %</TableHead>
                        <TableHead style={{ width: "9%"  }}>Actions</TableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((asset) => {
                        const type  = ASSET_TYPES.find((t) => t.id === asset.typeId);
                        const inv   = asset.invested ?? asset.value;
                        const pnl   = asset.pnl ?? (asset.value - inv);
                        const pct   = asset.pnlPct ?? (inv > 0 ? (pnl / inv) * 100 : 0);
                        const alloc = totalValue > 0 ? ((asset.value / totalValue) * 100).toFixed(1) : "0";
                        const qty   = asset.shares ?? asset.units ?? asset.weightGrams ?? null;
                        return (
                          <tr key={asset.id}>
                            <TableCell><input type="checkbox" checked={selectedIds.includes(asset.id)} onChange={() => toggle(asset.id)} aria-label={`Select ${asset.name}`} /></TableCell>
                            <TableCell title={asset.name}>
                              <div style={{ fontWeight: 600 }}>{asset.name}</div>
                              {asset.priceUpdatedAt && <span style={{ fontSize: 10, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 99, padding: "1px 6px", color: "#22c55e", fontWeight: 600 }}>LIVE</span>}
                            </TableCell>
                            <TableCell>{type?.icon || ""} {type?.label || "Other"}</TableCell>
                            <TableCell style={{ color: "rgba(255,255,255,0.7)" }}>{qty !== null ? qty.toLocaleString("en-IN") : "—"}</TableCell>
                            <TableCell>{formatCurrency(inv, currency)}</TableCell>
                            <TableCell style={{ fontWeight: 600 }}>{formatCurrency(asset.value, currency)}</TableCell>
                            <TableCell>
                              <div style={{ fontWeight: 700, color: pnl >= 0 ? "#22c55e" : "#ef4444" }}>{pnl >= 0 ? "+" : ""}{formatCurrency(pnl, currency)}</div>
                              <div style={{ fontSize: 11, color: pnl >= 0 ? "#22c55e" : "#ef4444", opacity: 0.8 }}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</div>
                            </TableCell>
                            <TableCell>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <div style={{ flex: 1, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.1)", maxWidth: 40 }}>
                                  <div style={{ height: "100%", borderRadius: 99, background: "#38bdf8", width: `${Math.min(100, parseFloat(alloc))}%` }} />
                                </div>
                                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{alloc}%</span>
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
              <DataTablePagination totalRows={rows.length} currentPage={page} onPageChange={setPage} />
            </>
          )}
        </>
      )}
    </PageSection>
  );
}
