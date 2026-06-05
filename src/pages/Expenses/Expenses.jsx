/**
 * pages/Expenses/Expenses.jsx
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { formatCurrency } from "../../utils/formatCurrency";
import { sanitizeInput } from "../../utils/security";
import {
  PageSection, PageHeader, PageHeaderActions, PageTitle,
  Field, Select, EmptyBlock, TableWrap, DataTable, TableHead, TableCell,
  TableResultsText, MobileDataList, MobileDataSelection, MobileRecordCard,
  ModalBackdrop, ModalCard, ModalTitle, ModalText, SecondaryButton, DataTablePagination,
  DateFilterBar, MONEY_DATE_FILTERS,
  getPaginatedRows, getTotalPages, notifyApp,
} from "../../components/shared/ui";
import { buttonStyles, inputStyle, labelStyle, cardStyle } from "../../styles";
import { parseHdfcStatementFile, buildImportedHdfcEntries } from "../../services/hdfcImportService";
import { useIsMobile } from "../../hooks/useWindowSize";
import {
  getCurrentMonthValue, getDateRangeForFilter, getDateRangeForMonth,
  formatMonthLabel, buildMonthOptions, filterByRange,
} from "../../utils/dateFilters";
import LiquidGlassCard from "../../components/LiquidGlassCard";

export default function ExpensesPage({ incomes = [], expenses, currency, onAdd, onUpdate, onDelete, onImportIncome, onImportExpense }) {
  const isMobile  = useIsMobile();
  const importRef = useRef(null);
  const btnStyle  = buttonStyles.primary;

  const [showAdd,       setShowAdd]       = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [name,          setName]          = useState("");
  const [amount,        setAmount]        = useState("");
  const [expenseMonth,  setExpenseMonth]  = useState(() => getCurrentMonthValue());
  const [dateFilter,    setDateFilter]    = useState("this_month");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [search,        setSearch]        = useState("");
  const [sortBy,        setSortBy]        = useState("amount_desc");
  const [page,          setPage]          = useState(1);
  const [selectedIds,   setSelectedIds]   = useState([]);

  const monthOptions = useMemo(() => buildMonthOptions([...(incomes || []), ...(expenses || [])]), [incomes, expenses]);
  const dateRange    = useMemo(() => selectedMonth !== "all" ? getDateRangeForMonth(selectedMonth) : getDateRangeForFilter(dateFilter), [dateFilter, selectedMonth]);
  const periodLabel  = selectedMonth !== "all" ? formatMonthLabel(selectedMonth) : MONEY_DATE_FILTERS.find((f) => f.key === dateFilter)?.label || "All";

  const filtered = useMemo(() => filterByRange(expenses, dateRange, { includeUndated: selectedMonth === "all" }), [expenses, dateRange, selectedMonth]);
  const total    = filtered.reduce((s, e) => s + (e.amount || 0), 0);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = filtered.filter((e) => !q || String(e.name || "").toLowerCase().includes(q));
    return [...r].sort((a, b) => {
      if (sortBy === "amount_asc")  return a.amount - b.amount;
      if (sortBy === "amount_desc") return b.amount - a.amount;
      if (sortBy === "name_desc")   return String(b.name || "").localeCompare(String(a.name || ""));
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [filtered, search, sortBy]);

  const paged = useMemo(() => getPaginatedRows(rows, page), [rows, page]);
  useEffect(() => { setPage(1); }, [search, sortBy, dateFilter, selectedMonth]);
  useEffect(() => { const tp = getTotalPages(rows.length); if (page > tp) setPage(tp); }, [rows.length, page]);
  useEffect(() => { setSelectedIds((p) => p.filter((id) => rows.some((e) => e.id === id))); }, [rows]);
  useEffect(() => {
    if (selectedMonth !== "all" && !monthOptions.some((o) => o.value === selectedMonth)) setSelectedMonth("all");
  }, [monthOptions, selectedMonth]);

  useEffect(() => {
    if (editing) { setName(editing.name || ""); setAmount(editing.amount || ""); setExpenseMonth(editing.month || expenseMonth); }
    else { setName(""); setAmount(""); }
  }, [editing]);

  const pageIds     = paged.map((e) => e.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const toggle      = (id) => setSelectedIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleAll   = () => setSelectedIds((p) => allSelected ? p.filter((id) => !pageIds.includes(id)) : [...new Set([...p, ...pageIds])]);
  const deleteSelected = () => { selectedIds.forEach(onDelete); setSelectedIds([]); };

  const closeAdd   = () => { setShowAdd(false); setEditing(null); };
  const handleEdit = (e) => { setEditing(e); setShowAdd(true); };
  const handleSave = () => {
    const n = sanitizeInput(name, "text");
    const a = sanitizeInput(amount, "number");
    if (!n || a <= 0) { notifyApp("Enter valid expense name and positive amount.", "error"); return; }
    const payload = { id: editing?.id || Date.now(), name: n, amount: a, currency, month: expenseMonth, date: new Date(expenseMonth + "-01").toISOString() };
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
    } catch { notifyApp("Unable to import. Please upload a valid HDFC statement (.csv/.xls/.xlsx).", "error"); }
    finally { e.target.value = ""; }
  };

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <PageTitle title="Expenses" subtitle={`${periodLabel} total: ${formatCurrency(total, currency)}`} />
        <PageHeaderActions $isMobile={isMobile}>
          <input ref={importRef} type="file" accept=".csv,.xls,.xlsx" onChange={handleCsvImport} style={{ display: "none" }} />
          <button onClick={() => importRef.current?.click()} style={{ ...buttonStyles.secondary, padding: "10px 14px", fontSize: 13, width: isMobile ? "100%" : "auto" }}>Import HDFC Statement</button>
          <button onClick={() => { setEditing(null); setShowAdd(true); }} style={{ ...btnStyle, background: "var(--error, #f97316)", width: isMobile ? "100%" : "auto" }}>+ Add Expense</button>
        </PageHeaderActions>
      </PageHeader>

      {showAdd && (
        <ModalBackdrop onClick={closeAdd}>
          <ModalCard $maxWidth={520} onClick={(e) => e.stopPropagation()}>
            <ModalTitle>{editing ? "Edit Expense" : "Add Expense"}</ModalTitle>
            <ModalText>Track outgoing costs to monitor your monthly cashflow.</ModalText>
            <div style={{ display: "grid", gap: 12 }}>
              <div><label style={labelStyle}>Expense</label><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Groceries, Rent" /></div>
              <div><label style={labelStyle}>Amount</label><input style={inputStyle} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></div>
              <div><label style={labelStyle}>Month</label><input style={inputStyle} type="month" value={expenseMonth} onChange={(e) => setExpenseMonth(e.target.value)} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <SecondaryButton onClick={closeAdd}>Cancel</SecondaryButton>
                <button onClick={handleSave} style={{ ...btnStyle, background: "var(--error, #f97316)" }}>{editing ? "Update" : "Save"}</button>
              </div>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      <DateFilterBar dateFilter={dateFilter} setDateFilter={setDateFilter} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} monthOptions={monthOptions} isMobile={isMobile} />

      {expenses.length === 0 ? (
        <LiquidGlassCard style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "rgba(255,255,255,0.65)" }}>No expenses recorded</div>
          <div>Add your expenses to track cashflow</div>
        </LiquidGlassCard>
      ) : (
        <LiquidGlassCard disableTilt>
          <div style={{ marginBottom: 12, padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(220px,1fr) minmax(160px,190px)", gap: 8 }}>
              <Field value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expense records" />
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="amount_desc">Sort: Amount High-Low</option>
                <option value="amount_asc">Sort: Amount Low-High</option>
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

          {rows.length === 0 ? <EmptyBlock>No expense records match your filters.</EmptyBlock> : (
            <>
              <TableResultsText>Showing {paged.length} of {rows.length} expense records</TableResultsText>
              {isMobile ? (
                <MobileDataList>
                  <div style={{ padding: 14 }}>
                    <MobileDataSelection>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all on page" />
                      <span>Select all on this page</span>
                    </MobileDataSelection>
                  </div>
                  {paged.map((exp) => (
                    <MobileRecordCard key={exp.id} title={exp.name} badge="Expense"
                      selected={selectedIds.includes(exp.id)} onToggleSelect={() => toggle(exp.id)} selectLabel={`Select ${exp.name}`}
                      fields={[
                        { label: "Amount", value: formatCurrency(exp.amount, exp.currency || currency), fullWidth: true },
                        { label: "Month",  value: exp.month || "—" },
                      ]}
                      actions={<button onClick={() => handleEdit(exp)} style={{ ...buttonStyles.secondary, padding: "8px 12px", fontSize: 12, width: "100%" }}>Modify</button>}
                    />
                  ))}
                </MobileDataList>
              ) : (
                <TableWrap>
                  <DataTable>
                    <thead>
                      <tr>
                        <TableHead style={{ width: "4%"  }}><input type="checkbox" checked={allSelected} onChange={toggleAll} /></TableHead>
                        <TableHead style={{ width: "40%" }}>Expense</TableHead>
                        <TableHead style={{ width: "15%" }}>Month</TableHead>
                        <TableHead style={{ width: "25%" }}>Amount</TableHead>
                        <TableHead style={{ width: "10%" }}>Actions</TableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((exp) => (
                        <tr key={exp.id}>
                          <TableCell><input type="checkbox" checked={selectedIds.includes(exp.id)} onChange={() => toggle(exp.id)} aria-label={`Select ${exp.name}`} /></TableCell>
                          <TableCell title={exp.name}>{exp.name}</TableCell>
                          <TableCell style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{exp.month || "—"}</TableCell>
                          <TableCell>{formatCurrency(exp.amount, exp.currency || currency)}</TableCell>
                          <TableCell><button onClick={() => handleEdit(exp)} style={{ ...buttonStyles.secondary, padding: "4px 8px", fontSize: 12 }}>Modify</button></TableCell>
                        </tr>
                      ))}
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
