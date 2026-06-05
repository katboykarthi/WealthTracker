/**
 * pages/Liabilities/Liabilities.jsx
 */
import { useState, useMemo, useEffect } from "react";
import { formatCurrency } from "../../utils/formatCurrency";
import { calcOutstanding, formatClosingIn, calcPctPaid } from "../../utils/liabilityCalc";
import {
  PageSection, PageHeader, PageHeaderActions, PageTitle,
  Field, Select, EmptyBlock, TableWrap, DataTable, TableHead, TableCell,
  TableResultsText, MobileDataList, MobileDataSelection, MobileRecordCard,
  ModalBackdrop, ModalCard, DataTablePagination,
  getPaginatedRows, getTotalPages,
} from "../../components/shared/ui";
import { buttonStyles, cardStyle } from "../../styles";
import { AddLiabilityForm } from "../../components/forms/AssetForms";
import { useIsMobile } from "../../hooks/useWindowSize";

export default function LiabilitiesPage({ liabilities, currency, onAdd, onUpdate, onDelete }) {
  const isMobile = useIsMobile();
  const btnStyle = buttonStyles.primary;

  const [showAdd,     setShowAdd]     = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [search,      setSearch]      = useState("");
  const [sortBy,      setSortBy]      = useState("value_desc");
  const [page,        setPage]        = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);

  const total = liabilities.reduce((s, l) => s + l.value, 0);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = liabilities.filter((l) =>
      !q || String(l.name || "").toLowerCase().includes(q) || String(l.label || "").toLowerCase().includes(q)
    );
    return [...r].sort((a, b) => {
      if (sortBy === "value_asc")  return a.value - b.value;
      if (sortBy === "value_desc") return b.value - a.value;
      if (sortBy === "name_desc")  return String(b.name || "").localeCompare(String(a.name || ""));
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [liabilities, search, sortBy]);

  const paged = useMemo(() => getPaginatedRows(rows, page), [rows, page]);
  useEffect(() => { setPage(1); }, [search, sortBy]);
  useEffect(() => { const tp = getTotalPages(rows.length); if (page > tp) setPage(tp); }, [rows.length, page]);
  useEffect(() => { setSelectedIds((p) => p.filter((id) => rows.some((l) => l.id === id))); }, [rows]);

  const pageIds     = paged.map((l) => l.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const toggle      = (id) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAll   = () => setSelectedIds((p) => allSelected ? p.filter((id) => !pageIds.includes(id)) : [...new Set([...p, ...pageIds])]);
  const deleteSelected = () => { selectedIds.forEach(onDelete); setSelectedIds([]); };

  const closeAdd   = () => { setShowAdd(false); setEditing(null); };
  const handleEdit = (l) => { setEditing(l); setShowAdd(true); };
  const handleSave = (l) => { editing ? onUpdate(l) : onAdd(l); closeAdd(); };

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <PageTitle
          title="Liabilities"
          subtitle={<>Total: <span style={{ color: "#ef4444" }}>{formatCurrency(total, currency)}</span></>}
        />
        <PageHeaderActions $isMobile={isMobile}>
          <button onClick={() => { setEditing(null); setShowAdd(true); }} style={{ ...btnStyle, width: isMobile ? "100%" : "auto" }}>
            + Add Liability
          </button>
        </PageHeaderActions>
      </PageHeader>

      {showAdd && (
        <ModalBackdrop onClick={closeAdd}>
          <ModalCard $maxWidth={520} onClick={(e) => e.stopPropagation()}>
            <AddLiabilityForm editData={editing} onSave={handleSave} onCancel={closeAdd} />
          </ModalCard>
        </ModalBackdrop>
      )}

      {liabilities.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "rgba(255,255,255,0.65)" }}>No liabilities!</div>
          <div>You're debt-free or haven't added any loans yet</div>
        </div>
      ) : (
        <>
          <div style={{ ...cardStyle, marginBottom: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(220px,1fr) minmax(160px,190px)", gap: 8 }}>
              <Field value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search liabilities" />
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="value_desc">Sort: Amount High-Low</option>
                <option value="value_asc">Sort: Amount Low-High</option>
                <option value="name_asc">Sort: Name A-Z</option>
                <option value="name_desc">Sort: Name Z-A</option>
              </Select>
            </div>
            <div style={{ display: "flex", justifyContent: isMobile ? "flex-start" : "flex-end", marginTop: 8 }}>
              <button onClick={deleteSelected} disabled={selectedIds.length === 0}
                style={{ ...btnStyle, background: "var(--error, #f97316)", padding: "8px 12px", fontSize: 12, width: isMobile ? "100%" : "auto", opacity: selectedIds.length === 0 ? 0.55 : 1, cursor: selectedIds.length === 0 ? "not-allowed" : "pointer" }}>
                Delete Selected ({selectedIds.length})
              </button>
            </div>
          </div>

          {rows.length === 0 ? <EmptyBlock>No liabilities match your filters.</EmptyBlock> : (
            <>
              <TableResultsText>Showing {paged.length} of {rows.length} liabilities</TableResultsText>
              {isMobile ? (
                <MobileDataList>
                  <div style={{ ...cardStyle, padding: 14 }}>
                    <MobileDataSelection>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all on page" />
                      <span>Select all on this page</span>
                    </MobileDataSelection>
                  </div>
                  {paged.map((l) => {
                    const outstanding = calcOutstanding(l);
                    const closingIn   = formatClosingIn(l.endDate);
                    const pct         = calcPctPaid(l);
                    return (
                      <MobileRecordCard key={l.id} title={l.name} subtitle={l.label || "Liability"}
                        badge={l.interest > 0 ? `${l.interest}% p.a.` : "No interest"}
                        selected={selectedIds.includes(l.id)} onToggleSelect={() => toggle(l.id)} selectLabel={`Select ${l.name}`}
                        fields={[
                          { label: "Type",        value: `${l.icon || ""} ${l.label || "-"}`.trim() },
                          { label: "Principal",   value: formatCurrency(l.principal ?? l.value, currency) },
                          { label: "EMI / mo",    value: l.emi ? formatCurrency(l.emi, currency) : "-" },
                          { label: "Outstanding", value: formatCurrency(outstanding, currency) },
                          { label: "Closing In",  value: closingIn },
                          { label: "% Paid", value: (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ flex: 1, height: 6, borderRadius: 99, background: "rgba(255,255,255,0.12)" }}>
                                <div style={{ height: "100%", borderRadius: 99, background: "#22c55e", width: `${pct}%`, transition: "width 0.4s" }} />
                              </div>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{pct}%</span>
                            </div>
                          )},
                        ]}
                        actions={<button onClick={() => handleEdit(l)} style={{ ...buttonStyles.secondary, padding: "8px 12px", fontSize: 12, width: "100%" }}>Modify</button>}
                      />
                    );
                  })}
                </MobileDataList>
              ) : (
                <TableWrap>
                  <DataTable>
                    <thead>
                      <tr>
                        <TableHead style={{ width: "4%"  }}><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all on page" /></TableHead>
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
                      {paged.map((l) => {
                        const outstanding = calcOutstanding(l);
                        const closingIn   = formatClosingIn(l.endDate);
                        const pct         = calcPctPaid(l);
                        return (
                          <tr key={l.id}>
                            <TableCell><input type="checkbox" checked={selectedIds.includes(l.id)} onChange={() => toggle(l.id)} aria-label={`Select ${l.name}`} /></TableCell>
                            <TableCell title={l.name}>
                              <div style={{ fontWeight: 600 }}>{l.name}</div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{l.icon} {l.label || "—"}</div>
                            </TableCell>
                            <TableCell>{l.icon || ""} {l.label || "—"}</TableCell>
                            <TableCell>{l.emi ? formatCurrency(l.emi, currency) : "—"}</TableCell>
                            <TableCell style={{ fontSize: 12 }}>{l.startDate || "—"}</TableCell>
                            <TableCell>
                              <div style={{ fontWeight: 700, color: outstanding > 0 ? "#ef4444" : "#22c55e" }}>{formatCurrency(outstanding, currency)}</div>
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
                              <button onClick={() => handleEdit(l)} style={{ ...buttonStyles.secondary, padding: "4px 8px", fontSize: 12 }}>Modify</button>
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
