/**
 * pages/Income/Income.jsx
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { formatCurrency } from "../../utils/formatCurrency";
import { sanitizeInput } from "../../utils/security";
import {
  PageSection, PageHeader, PageHeaderActions, PageTitle,
  Field, Select, EmptyBlock, TableWrap, DataTable, TableHead, TableCell,
  TableResultsText, MobileDataList, MobileDataSelection, MobileRecordCard,
  ModalBackdrop, ModalCard, ModalTitle, SecondaryButton, DataTablePagination,
  DateFilterBar, MONEY_DATE_FILTERS,
  getPaginatedRows, getTotalPages, notifyApp,
} from "../../components/shared/ui";
import { buttonStyles, inputStyle, labelStyle } from "../../styles";
import { parseHdfcStatementFile, buildImportedHdfcEntries } from "../../services/hdfcImportService";
import { useIsMobile } from "../../hooks/useWindowSize";
import {
  getCurrentMonthValue, getDateRangeForFilter, getDateRangeForMonth,
  formatMonthLabel, buildMonthOptions, filterByRange,
} from "../../utils/dateFilters";
import LiquidGlassCard from "../../components/LiquidGlassCard";

const INCOME_TYPES = [
  { id: "salary",    label: "Salary",    icon: "💼" },
  { id: "freelance", label: "Freelance", icon: "🖥️" },
  { id: "rental",    label: "Rental",    icon: "🏠" },
  { id: "dividend",  label: "Dividend",  icon: "📈" },
  { id: "business",  label: "Business",  icon: "🏢" },
  { id: "other",     label: "Other",     icon: "💰" },
];

export default function IncomePage({ incomes, expenses = [], currency, onAdd, onUpdate, onDelete, onImportIncome, onImportExpense }) {
  const isMobile  = useIsMobile();
  const importRef = useRef(null);
  const btnStyle  = buttonStyles.primary;

  const [showAdd,       setShowAdd]       = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [name,          setName]          = useState("");
  const [amount,        setAmount]        = useState("");
  const [incomeType,    setIncomeType]    = useState("salary");
  const [incomeMonth,   setIncomeMonth]   = useState(() => getCurrentMonthValue());
  const [notes,         setNotes]         = useState("");
  const [dateFilter,    setDateFilter]    = useState("this_month");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [search,        setSearch]        = useState("");
  const [sortBy,        setSortBy]        = useState("amount_desc");
  const [page,          setPage]          = useState(1);
  const [selectedIds,   setSelectedIds]   = useState([]);

  const monthOptions = useMemo(() => buildMonthOptions([...(incomes || []), ...(expenses || [])]), [incomes, expenses]);
  const dateRange    = useMemo(() => selectedMonth !== "all" ? getDateRangeForMonth(selectedMonth) : getDateRangeForFilter(dateFilter), [dateFilter, selectedMonth]);
  const periodLabel  = selectedMonth !== "all" ? formatMonthLabel(selectedMonth) : MONEY_DATE_FILTERS.find((f) => f.key === dateFilter)?.label || "All";

  const filteredIncomes  = useMemo(() => filterByRange(incomes,           dateRange, { includeUndated: selectedMonth === "all" }), [incomes,  dateRange, selectedMonth]);
  const filteredExpenses = useMemo(() => filterByRange(expenses || [],     dateRange, { includeUndated: selectedMonth === "all" }), [expenses, dateRange, selectedMonth]);
  const totalIncome   = filteredIncomes.reduce((s, i) => s + (i.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netCashflow   = totalIncome - totalExpenses;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = filteredIncomes.filter((i) => !q || String(i.name || "").toLowerCase().includes(q) || String(i.notes || "").toLowerCase().includes(q));
    return [...r].sort((a, b) => {
      if (sortBy === "amount_asc")  return a.amount - b.amount;
      if (sortBy === "amount_desc") return b.amount - a.amount;
      if (sortBy === "name_desc")   return String(b.name || "").localeCompare(String(a.name || ""));
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [filteredIncomes, search, sortBy]);

  const paged = useMemo(() => getPaginatedRows(rows, page), [rows, page]);
  useEffect(() => { setPage(1); }, [search, sortBy, dateFilter, selectedMonth]);
  useEffect(() => { const tp = getTotalPages(rows.length); if (page > tp) setPage(tp); }, [rows.length, page]);
  useEffect(() => { setSelectedIds((p) => p.filter((id) => rows.some((i) => i.id === id))); }, [rows]);
  useEffect(() => {
    if (selectedMonth !== "all" && !monthOptions.some((o) => o.value === selectedMonth)) setSelectedMonth("all");
  }, [monthOptions, selectedMonth]);

  useEffect(() => {
    if (editing) { setName(editing.name || ""); setAmount(editing.amount?.toString() || ""); setIncomeType(editing.incomeType || "salary"); setIncomeMonth(editing.month || incomeMonth); setNotes(editing.notes || ""); }
    else { setName(""); setAmount(""); setIncomeType("salary"); setNotes(""); }
  }, [editing]);

  const pageIds     = paged.map((i) => i.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const toggle      = (id) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAll   = () => setSelectedIds((p) => allSelected ? p.filter((id) => !pageIds.includes(id)) : [...new Set([...p, ...pageIds])]);
  const deleteSelected = () => { selectedIds.forEach(onDelete); setSelectedIds([]); };

  const closeAdd   = () => { setShowAdd(false); setEditing(null); };
  const handleEdit = (i) => { setEditing(i); setShowAdd(true); };
  const handleSave = () => {
    const n = sanitizeInput(name, "text");
    const a = sanitizeInput(amount, "number");
    if (!n || a <= 0) { notifyApp("Enter valid income source and positive amount.", "error"); return; }
    const payload = { id: editing?.id || Date.now(), name: n, amount: a, currency, incomeType, month: incomeMonth, notes: sanitizeInput(notes, "text"), date: new Date(incomeMonth + "-01").toISOString() };
    editing ? onUpdate(payload) : onAdd(payload);
    closeAdd();
  };

  const handleCsvImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseHdfcStatementFile(file);
      const { incomeEntries, expenseEntries } = buildImportedHdfcEntries(parsed, currency);
      if (!incomeEntries.length && !expenseEntries.length) { notifyApp("No valid transactions found.", "warning"); return; }
      if (incomeEntries.length)  onImportIncome(incomeEntries);
      if (expenseEntries.length) onImportExpense(expenseEntries);
      notifyApp(`Imported ${incomeEntries.length} income and ${expenseEntries.length} expense entries.`, "success");
    } catch { notifyApp("Unable to import. Please upload a valid HDFC statement.", "error"); }
    finally { e.target.value = ""; }
  };

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <PageTitle title="Income & Cashflow"
          subtitle={<>{periodLabel} — Net: <span style={{ color: netCashflow >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{formatCurrency(netCashflow, currency)}</span></>}
        />
        <PageHeaderActions $isMobile={isMobile}>
          <input ref={importRef} type="file" accept=".csv,.xls,.xlsx" onChange={handleCsvImport} style={{ display: "none" }} />
          <button onClick={() => importRef.current?.click()} style={{ ...buttonStyles.secondary, padding: "10px 14px", fontSize: 13, width: isMobile ? "100%" : "auto" }}>Import HDFC Statement</button>
          <button onClick={() => { setEditing(null); setShowAdd(true); }} style={{ ...btnStyle, width: isMobile ? "100%" : "auto" }}>+ Add Income</button>
        </PageHeaderActions>
      </PageHeader>

      {showAdd && (
        <ModalBackdrop onClick={closeAdd}>
          <ModalCard $maxWidth={520} onClick={(e) => e.stopPropagation()}>
            <ModalTitle>{editing ? "Edit Income" : "Add Income"}</ModalTitle>
            <div style={{ display: "grid", gap: 12 }}>
              <div><label style={labelStyle}>Source Name</label><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Salary, Consulting" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select style={inputStyle} value={incomeType} onChange={(e) => setIncomeType(e.target.value)}>
                    {INCOME_TYPES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div><label style={labelStyle}>Month</label><input style={inputStyle} type="month" value={incomeMonth} onChange={(e) => setIncomeMonth(e.target.value)} /></div>
              </div>
              <div><label style={labelStyle}>Amount (₹)</label><input style={inputStyle} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" min="0" /></div>
              <div><label style={labelStyle}>Notes (optional)</label><input style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any extra details" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <SecondaryButton onClick={closeAdd}>Cancel</SecondaryButton>
                <button onClick={handleSave} style={{ ...btnStyle, padding: "10px 14px" }}>{editing ? "Update" : "Save"}</button>
              </div>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      <DateFilterBar dateFilter={dateFilter} setDateFilter={setDateFilter} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} monthOptions={monthOptions} isMobile={isMobile} />

      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "TOTAL INCOME",   value: formatCurrency(totalIncome,   currency), color: "#22c55e", icon: "💸" },
          { label: "TOTAL EXPENSES", value: formatCurrency(totalExpenses,  currency), color: "#ef4444", icon: "🛒" },
          { label: "NET CASH FLOW",  value: `${netCashflow >= 0 ? "+" : ""}${formatCurrency(netCashflow, currency)}`, color: netCashflow >= 0 ? "#22c55e" : "#ef4444", icon: netCashflow >= 0 ? "✅" : "⚠️" },
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

      {incomes.length === 0 ? (
        <LiquidGlassCard style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💼</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "rgba(255,255,255,0.65)" }}>No income recorded</div>
          <div>Add recurring or one-time income to track cashflow</div>
        </LiquidGlassCard>
      ) : (
        <LiquidGlassCard disableTilt>
          <div style={{ marginBottom: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(220px,1fr) minmax(160px,190px)", gap: 8 }}>
              <Field value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search income records" />
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="amount_desc">Sort: Amount High→Low</option>
                <option value="amount_asc">Sort: Amount Low→High</option>
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

          {rows.length === 0 ? <EmptyBlock>No income records match your filters.</EmptyBlock> : (
            <>
              <TableResultsText>Showing {paged.length} of {rows.length} income records</TableResultsText>
              {isMobile ? (
                <MobileDataList>
                  <div style={{ padding: 14 }}>
                    <MobileDataSelection>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all on page" />
                      <span>Select all on this page</span>
                    </MobileDataSelection>
                  </div>
                  {paged.map((inc) => {
                    const itype = INCOME_TYPES.find((t) => t.id === inc.incomeType);
                    return (
                      <MobileRecordCard key={inc.id} title={inc.name} badge={`${itype?.icon || ""} ${itype?.label || "Income"}`}
                        selected={selectedIds.includes(inc.id)} onToggleSelect={() => toggle(inc.id)} selectLabel={`Select ${inc.name}`}
                        fields={[
                          { label: "Amount", value: formatCurrency(inc.amount, inc.currency || currency), fullWidth: true },
                          { label: "Month",  value: inc.month || "—" },
                          inc.notes ? { label: "Notes", value: inc.notes } : null,
                        ].filter(Boolean)}
                        actions={<button onClick={() => handleEdit(inc)} style={{ ...buttonStyles.secondary, padding: "8px 12px", fontSize: 12, width: "100%" }}>Modify</button>}
                      />
                    );
                  })}
                </MobileDataList>
              ) : (
                <TableWrap>
                  <DataTable>
                    <thead>
                      <tr>
                        <TableHead style={{ width: "4%"  }}><input type="checkbox" checked={allSelected} onChange={toggleAll} /></TableHead>
                        <TableHead style={{ width: "28%" }}>Source</TableHead>
                        <TableHead style={{ width: "15%" }}>Type</TableHead>
                        <TableHead style={{ width: "13%" }}>Month</TableHead>
                        <TableHead style={{ width: "20%" }}>Amount</TableHead>
                        <TableHead style={{ width: "13%" }}>Notes</TableHead>
                        <TableHead style={{ width: "7%"  }}>Actions</TableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((inc) => {
                        const itype = INCOME_TYPES.find((t) => t.id === inc.incomeType);
                        return (
                          <tr key={inc.id}>
                            <TableCell><input type="checkbox" checked={selectedIds.includes(inc.id)} onChange={() => toggle(inc.id)} aria-label={`Select ${inc.name}`} /></TableCell>
                            <TableCell title={inc.name}><span style={{ fontWeight: 600 }}>{inc.name}</span></TableCell>
                            <TableCell>{itype?.icon || ""} {itype?.label || "Other"}</TableCell>
                            <TableCell style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{inc.month || "—"}</TableCell>
                            <TableCell style={{ fontWeight: 700, color: "#22c55e" }}>{formatCurrency(inc.amount, inc.currency || currency)}</TableCell>
                            <TableCell style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{inc.notes || "—"}</TableCell>
                            <TableCell><button onClick={() => handleEdit(inc)} style={{ ...buttonStyles.secondary, padding: "4px 8px", fontSize: 12 }}>Modify</button></TableCell>
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
        </LiquidGlassCard>
      )}
    </PageSection>
  );
}
