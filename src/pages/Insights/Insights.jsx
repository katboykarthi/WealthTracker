/**
 * pages/Insights/Insights.jsx
 */
import { useState, useMemo, useEffect } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { formatCurrency } from "../../utils/formatCurrency";
import {
  PageSection, PageHeader, PageTitle,
  Select, TableWrap, DataTable, TableHead, TableCell,
  DateFilterBar, MONEY_DATE_FILTERS,
  cardStyle as sharedCardStyle,
} from "../../components/shared/ui";
import { cardStyle } from "../../styles";
import { useIsMobile } from "../../hooks/useWindowSize";
import {
  getDateRangeForFilter, getDateRangeForMonth,
  formatMonthLabel, buildMonthOptions, filterByRange,
  buildMonthlyTrendData, parseEntryDate,
} from "../../utils/dateFilters";

export default function InsightsPage({ incomes = [], expenses = [], currency }) {
  const isMobile = useIsMobile();

  const [dateFilter,    setDateFilter]    = useState("3m");
  const [selectedMonth, setSelectedMonth] = useState("all");

  const monthOptions = useMemo(() => buildMonthOptions([...(incomes || []), ...(expenses || [])]), [incomes, expenses]);
  const dateRange    = useMemo(() => selectedMonth !== "all" ? getDateRangeForMonth(selectedMonth) : getDateRangeForFilter(dateFilter), [dateFilter, selectedMonth]);
  const periodLabel  = selectedMonth !== "all" ? formatMonthLabel(selectedMonth) : MONEY_DATE_FILTERS.find((f) => f.key === dateFilter)?.label || "All";

  useEffect(() => {
    if (selectedMonth !== "all" && !monthOptions.some((o) => o.value === selectedMonth)) setSelectedMonth("all");
  }, [monthOptions, selectedMonth]);

  const filteredIncomes  = useMemo(() => filterByRange(incomes,  dateRange, { includeUndated: selectedMonth === "all" }), [incomes,  dateRange, selectedMonth]);
  const filteredExpenses = useMemo(() => filterByRange(expenses, dateRange, { includeUndated: selectedMonth === "all" }), [expenses, dateRange, selectedMonth]);

  const totalIncome   = filteredIncomes.reduce((s, i) => s + (i.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const gap           = totalIncome - totalExpenses;

  const uniqueMonthCount = (entries) => Math.max(1, new Set(
    entries.map((e) => { const d = parseEntryDate(e); return d ? `${d.getFullYear()}-${d.getMonth()}` : null; }).filter(Boolean)
  ).size);

  const avgMonthlyIncome  = totalIncome   / uniqueMonthCount(filteredIncomes);
  const avgMonthlyExpense = totalExpenses / uniqueMonthCount(filteredExpenses);

  const highestExpense = useMemo(() => {
    if (!filteredExpenses.length) return null;
    return filteredExpenses.reduce((max, e) => (e.amount || 0) > (max.amount || 0) ? e : max);
  }, [filteredExpenses]);

  const lastExpense = useMemo(() => {
    if (!filteredExpenses.length) return null;
    return [...filteredExpenses].sort((a, b) => {
      const da = parseEntryDate(a) || new Date(0);
      const db = parseEntryDate(b) || new Date(0);
      return db - da;
    })[0];
  }, [filteredExpenses]);

  const trendData = useMemo(() => buildMonthlyTrendData(incomes, expenses, dateRange), [incomes, expenses, dateRange]);

  const fmtK = (v) => Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(1)}L` : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`;

  const statTiles = [
    { label: "TOTAL INCOME",        value: formatCurrency(totalIncome,       currency), sub: `${filteredIncomes.length} entries`,  color: "#22c55e", icon: "💸" },
    { label: "TOTAL EXPENSES",      value: formatCurrency(totalExpenses,     currency), sub: `${filteredExpenses.length} entries`, color: "#ef4444", icon: "🧾" },
    { label: "GAP (INCOME − EXP)",  value: `${gap >= 0 ? "+" : ""}${formatCurrency(gap, currency)}`, sub: gap >= 0 ? "Surplus" : "Deficit", color: gap >= 0 ? "#22c55e" : "#ef4444", icon: gap >= 0 ? "✅" : "⚠️" },
    { label: "AVG MONTHLY INCOME",  value: formatCurrency(avgMonthlyIncome,  currency), sub: "per month", color: "#38bdf8", icon: "📅" },
    { label: "AVG MONTHLY EXPENSE", value: formatCurrency(avgMonthlyExpense, currency), sub: "per month", color: "#f97316", icon: "📆" },
    highestExpense ? { label: "HIGHEST EXPENSE", value: formatCurrency(highestExpense.amount, currency), sub: `${highestExpense.name || "—"}${highestExpense.month ? " · " + highestExpense.month : ""}`, color: "#a78bfa", icon: "📌" } : null,
    lastExpense    ? { label: "LAST EXPENSE",     value: formatCurrency(lastExpense.amount,    currency), sub: `${lastExpense.name || "—"}${lastExpense.month ? " · " + lastExpense.month : ""}`,    color: "#fb923c", icon: "🕐" } : null,
  ].filter(Boolean);

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <PageTitle title="Insights"
          subtitle={<>{periodLabel} · Savings rate: <span style={{ color: gap >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>{totalIncome > 0 ? `${((gap / totalIncome) * 100).toFixed(1)}%` : "N/A"}</span></>}
        />
      </PageHeader>

      <DateFilterBar dateFilter={dateFilter} setDateFilter={setDateFilter} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} monthOptions={monthOptions} isMobile={isMobile} />

      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {statTiles.map((tile) => (
          <div key={tile.label} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${tile.color}25`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{tile.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.9, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>{tile.label}</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 18, color: tile.color, lineHeight: 1.2 }}>{tile.value}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>{tile.sub}</div>
          </div>
        ))}
      </div>

      {/* Monthly trend chart */}
      <div style={{ ...cardStyle, padding: "16px 16px 8px", marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 14 }}>Monthly Income vs Expenses</div>
        {trendData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.35)", fontSize: 13 }}>No data for the selected period</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={trendData} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtK} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "rgba(15,23,42,0.97)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, fontSize: 12 }} formatter={(v, n) => [formatCurrency(v, currency), n]} />
              <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }} />
              <Bar dataKey="income"  name="Income"   fill="#22c55e" radius={[4,4,0,0]} maxBarSize={36} fillOpacity={0.85} />
              <Bar dataKey="expense" name="Expenses"  fill="#ef4444" radius={[4,4,0,0]} maxBarSize={36} fillOpacity={0.85} />
              <Line dataKey="net" name="Net" type="monotone" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3, fill: "#38bdf8" }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly breakdown table */}
      {trendData.length > 0 && (
        <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Monthly Breakdown</div>
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
                  const pctColor   = savingsPct !== "—" ? (parseFloat(savingsPct) >= 20 ? "#22c55e" : parseFloat(savingsPct) >= 0 ? "#f97316" : "#ef4444") : "rgba(255,255,255,0.5)";
                  return (
                    <tr key={row.month}>
                      <TableCell style={{ fontWeight: 600 }}>{row.month}</TableCell>
                      <TableCell style={{ color: "#22c55e" }}>{formatCurrency(row.income,  currency)}</TableCell>
                      <TableCell style={{ color: "#ef4444" }}>{formatCurrency(row.expense, currency)}</TableCell>
                      <TableCell style={{ fontWeight: 700, color: row.net >= 0 ? "#22c55e" : "#ef4444" }}>{row.net >= 0 ? "+" : ""}{formatCurrency(row.net, currency)}</TableCell>
                      <TableCell style={{ color: pctColor }}>{savingsPct !== "—" ? `${savingsPct}%` : "—"}</TableCell>
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
