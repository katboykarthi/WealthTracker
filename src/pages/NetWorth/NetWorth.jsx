/**
 * pages/NetWorth/NetWorth.jsx
 */
import { useState, useMemo, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { CURRENCIES } from "../../constants";
import { formatCurrency } from "../../utils/formatCurrency";
import { buildSnapshotChartData } from "../../utils/formatting";
import {
  PageSection, PageHeader, PageTitle,
  SummaryCard, TableWrap, DataTable, TableHead, TableCell,
  TableResultsText, MobileDataList, MobileRecordCard,
  DataTablePagination, getPaginatedRows, getTotalPages,
} from "../../components/shared/ui";
import { buttonStyles, serifFontFamily } from "../../styles";
import LiquidGlassCard from "../../components/LiquidGlassCard";

export default function NetWorthPage({ assets, liabilities, currency, snapshots, onSnapshot, isMobile }) {
  const totalAssets      = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth         = totalAssets - totalLiabilities;
  const c                = CURRENCIES.find((cur) => cur.code === currency) || CURRENCIES[0];
  const btnStyle         = buttonStyles.primary;
  const [page, setPage]  = useState(1);

  const snapshotChartData = useMemo(() => buildSnapshotChartData(snapshots), [snapshots]);
  const snapshotRows      = useMemo(() => [...snapshotChartData].reverse(), [snapshotChartData]);
  const paged             = useMemo(() => getPaginatedRows(snapshotRows, page), [snapshotRows, page]);

  useEffect(() => { const tp = getTotalPages(snapshotRows.length); if (page > tp) setPage(tp); }, [snapshotRows.length, page]);

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <PageTitle title="Net Worth" subtitle="Track your wealth journey over time" />
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <SummaryCard icon="🏛️" label="TOTAL ASSETS"      value={formatCurrency(totalAssets,      currency)} sub={`${assets.length} assets`}      color="#22c55e" />
        <SummaryCard icon="💳" label="TOTAL LIABILITIES" value={formatCurrency(totalLiabilities, currency)} sub={`${liabilities.length} debts`}   color="#ef4444" negative />
        <SummaryCard icon="✨" label="NET WORTH"          value={formatCurrency(netWorth,         currency)} sub="Assets minus Liabilities"        color="#3b82f6" />
      </div>

      <LiquidGlassCard>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.95)", fontSize: 16 }}>Wealth Timeline</div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>{snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} recorded</div>
          </div>
          <button onClick={onSnapshot} style={{ ...btnStyle, width: isMobile ? "100%" : "auto" }}>📸 Take Snapshot</button>
        </div>

        {snapshots.length < 2 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Take snapshots to track your progress</div>
            <div style={{ fontSize: 13 }}>Each snapshot records your net worth at that moment</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={snapshotChartData}>
              <XAxis dataKey="chartKey" tick={{ fontSize: 11 }} tickFormatter={(v) => snapshotChartData.find((s) => s.chartKey === v)?.chartTick ?? v} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency)} />
              <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.tooltipLabel ?? ""} formatter={(v) => [formatCurrency(v, currency), "Net Worth"]} />
              <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} dot={{ fill: "var(--primary)", r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </LiquidGlassCard>

      {snapshots.length > 0 && (
        <LiquidGlassCard disableTilt style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, color: "rgba(255,255,255,0.95)", marginBottom: 16 }}>Snapshot History</div>
          <TableResultsText>Showing {paged.length} of {snapshotRows.length} snapshots</TableResultsText>
          {isMobile ? (
            <MobileDataList>
              {paged.map((snap, i) => (
                <MobileRecordCard key={snap.chartKey || i} title={snap.historyLabel || snap.date}
                  fields={[{ label: "Net Worth", value: `${c.symbol}${snap.value.toLocaleString()}`, valueStyle: { color: snap.value >= 0 ? "#16a34a" : "#ef4444" } }]}
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
                  {paged.map((snap, i) => (
                    <tr key={snap.chartKey || i}>
                      <TableCell>{snap.historyLabel || snap.date}</TableCell>
                      <TableCell style={{ color: snap.value >= 0 ? "#16a34a" : "#ef4444", fontWeight: 700 }}>
                        {c.symbol}{snap.value.toLocaleString()}
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
          )}
          <DataTablePagination totalRows={snapshotRows.length} currentPage={page} onPageChange={setPage} />
        </LiquidGlassCard>
      )}
    </PageSection>
  );
}
