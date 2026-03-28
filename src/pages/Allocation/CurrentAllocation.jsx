import React, { useState, useMemo } from "react";
import styled from "@emotion/styled";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import LiquidGlassCard from "../../components/LiquidGlassCard";
import {
  ALLOCATION_CATEGORIES,
  mapAssetsToCategories,
  computeGaps,
  formatIndianCompact,
  groupAssetsByCategory,
} from "./allocationHelpers";
import { formatCurrency } from "../../utils/formatCurrency";

// ── Styled ───────────────────────────────────────────────────

const Title = styled.h3({
  margin: "0 0 4px",
  fontSize: 18,
  fontWeight: 700,
  color: "rgba(255,255,255,0.95)",
});

const AlertBanner = styled.div({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 16,
  background: "rgba(249,115,22,0.12)",
  border: "1px solid rgba(249,115,22,0.30)",
  color: "#fb923c",
});

const DonutSection = styled.div(({ $isMobile }) => ({
  display: "flex",
  alignItems: $isMobile ? "center" : "flex-start",
  flexDirection: $isMobile ? "column" : "row",
  gap: 16,
  marginBottom: 22,
}));

const LegendWrap = styled.div({
  display: "grid",
  gap: 6,
  flex: 1,
  alignSelf: "center",
});

const LegendRow = styled.div({
  display: "flex",
  alignItems: "center",
  gap: 8,
});

const LegendDot = styled.div(({ $c }) => ({
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: $c,
  flexShrink: 0,
}));

const LegendLabel = styled.span({
  flex: 1,
  fontSize: 12,
  color: "rgba(255,255,255,0.65)",
});

const LegendValue = styled.span({
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(255,255,255,0.9)",
  minWidth: 48,
  textAlign: "right",
});

const Separator = styled.div({
  height: 1,
  background: "rgba(255,255,255,0.08)",
  margin: "6px 0 14px",
});

const SectionLabel = styled.div({
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.45)",
  marginBottom: 10,
});

// ── Desktop Table ────────────────────────────────────────────
const TableWrap = styled.div({
  overflowX: "auto",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
});

const Table = styled.table({
  width: "100%",
  minWidth: 700,
  borderCollapse: "collapse",
});

const Th = styled.th({
  padding: "8px 10px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.5)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  whiteSpace: "nowrap",
});

const Td = styled.td(({ $right }) => ({
  padding: "9px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  fontSize: 13,
  color: "rgba(255,255,255,0.88)",
  whiteSpace: "nowrap",
  textAlign: $right ? "right" : "left",
}));

const ExpandBtn = styled.button({
  background: "none",
  border: "none",
  color: "rgba(255,255,255,0.5)",
  cursor: "pointer",
  fontSize: 14,
  padding: "0 4px",
  transition: "transform 0.2s",
});

const ActionBtn = styled.button(({ $type }) => ({
  background: "none",
  border: "none",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
  color: $type === "reduce" ? "#f97316" : $type === "add" ? "#38bdf8" : "rgba(255,255,255,0.5)",
}));

const SubRow = styled.tr({
  background: "rgba(255,255,255,0.02)",
});

// ── Mobile card layout ───────────────────────────────────────

const MobileCard = styled.div({
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: "12px 14px",
  marginBottom: 8,
});

const MobileCardHeader = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  marginBottom: 8,
});

const MobileCardName = styled.div({
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 600,
  fontSize: 13,
  color: "rgba(255,255,255,0.9)",
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const MobileGapBadge = styled.span(({ $type }) => ({
  fontSize: 11,
  fontWeight: 700,
  padding: "2px 8px",
  borderRadius: 99,
  flexShrink: 0,
  background:
    $type === "over"
      ? "rgba(249,115,22,0.15)"
      : $type === "under"
      ? "rgba(56,189,248,0.15)"
      : "rgba(255,255,255,0.06)",
  color:
    $type === "over"
      ? "#f97316"
      : $type === "under"
      ? "#38bdf8"
      : "rgba(255,255,255,0.5)",
}));

const MobileStatsGrid = styled.div({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "6px 12px",
});

const MobileStat = styled.div({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
});

const MobileStatLabel = styled.span({
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "rgba(255,255,255,0.4)",
});

const MobileStatValue = styled.span({
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(255,255,255,0.85)",
});

const MobileActionRow = styled.div({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 8,
  paddingTop: 4,
});

const MobileSubAsset = styled.div({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "4px 0 4px 18px",
  fontSize: 11,
  color: "rgba(255,255,255,0.55)",
});

// ── Component ────────────────────────────────────────────────

export default function CurrentAllocation({ assets, targets, currency, isMobile }) {
  const [expanded, setExpanded] = useState({});

  const actualValues = useMemo(() => mapAssetsToCategories(assets), [assets]);
  const assetGroups = useMemo(() => groupAssetsByCategory(assets), [assets]);
  const totalValue = useMemo(
    () => Object.values(actualValues).reduce((s, v) => s + v, 0),
    [actualValues]
  );

  const gapData = useMemo(
    () => computeGaps(targets, actualValues, totalValue),
    [targets, actualValues, totalValue]
  );

  const offCategories = gapData.filter((g) => Math.abs(g.gapPct) > 5).length;

  // Pie data — only non-zero
  const pieData = useMemo(
    () =>
      ALLOCATION_CATEGORIES.map((cat) => ({
        name: cat.label,
        value: actualValues[cat.id] || 0,
        color: cat.color,
      })).filter((d) => d.value > 0),
    [actualValues]
  );

  const toggle = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <LiquidGlassCard style={{ padding: isMobile ? "16px 14px" : "22px 24px" }}>
      <Title>Current Allocation</Title>

      {offCategories > 0 && (
        <AlertBanner>
          ⚠️ Needs rebalancing — {offCategories} categor{offCategories > 1 ? "ies" : "y"} off by &gt;5%
        </AlertBanner>
      )}

      {/* ── Donut + legend ── */}
      <DonutSection $isMobile={isMobile}>
        <div style={{ width: isMobile ? "100%" : 200, height: isMobile ? 180 : 200, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData.length > 0 ? pieData : [{ name: "Empty", value: 1, color: "rgba(255,255,255,0.1)" }]}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={isMobile ? 48 : 55}
                outerRadius={isMobile ? 75 : 85}
                strokeWidth={0}
              >
                {(pieData.length > 0 ? pieData : [{ color: "rgba(255,255,255,0.1)" }]).map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => formatCurrency(v, currency)}
                contentStyle={{
                  background: "rgba(10,15,30,0.92)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#fff",
                }}
              />
              {/* Center text */}
              <text x="50%" y="46%" style={{ fill: "rgba(255,255,255,0.92)", fontSize: isMobile ? 14 : 16, fontWeight: 700, textAnchor: "middle", dominantBaseline: "central" }}>
                {formatIndianCompact(totalValue)}
              </text>
              <text x="50%" y="58%" style={{ fill: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: 600, textAnchor: "middle", dominantBaseline: "central" }}>
                Total
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <LegendWrap>
          {ALLOCATION_CATEGORIES.filter((c) => (actualValues[c.id] || 0) > 0).map((cat) => {
            const pct = totalValue > 0 ? Math.round(((actualValues[cat.id] || 0) / totalValue) * 100) : 0;
            return (
              <LegendRow key={cat.id}>
                <LegendDot $c={cat.color} />
                <LegendLabel>{cat.label}</LegendLabel>
                <LegendValue>{pct}%</LegendValue>
                <LegendValue style={{ minWidth: 62 }}>{formatCurrency(actualValues[cat.id], currency)}</LegendValue>
              </LegendRow>
            );
          })}
        </LegendWrap>
      </DonutSection>

      <Separator />

      {/* ── Target vs Actual ── */}
      <SectionLabel>Target vs Actual</SectionLabel>

      {isMobile ? (
        /* ── Mobile: card-based layout ── */
        <div>
          {gapData.map((row) => {
            const catAssets = assetGroups[row.id] || [];
            const hasChildren = catAssets.length > 0;
            const isExpanded = expanded[row.id];
            const gapType = row.gapPct > 0 ? "over" : row.gapPct < 0 ? "under" : "on";
            return (
              <MobileCard key={row.id}>
                <MobileCardHeader>
                  <MobileCardName>
                    <span style={{
                      width: 10, height: 10, borderRadius: 3, background: row.color,
                      display: "inline-block", flexShrink: 0,
                    }} />
                    {row.label}
                  </MobileCardName>
                  <MobileGapBadge $type={gapType}>
                    {row.gapPct > 0 ? "+" : ""}{row.gapPct}%
                  </MobileGapBadge>
                </MobileCardHeader>

                <MobileStatsGrid>
                  <MobileStat>
                    <MobileStatLabel>Current</MobileStatLabel>
                    <MobileStatValue>{row.currPct}% · {formatCurrency(row.currValue, currency)}</MobileStatValue>
                  </MobileStat>
                  <MobileStat>
                    <MobileStatLabel>Target</MobileStatLabel>
                    <MobileStatValue>{row.tgtPct}% · {formatCurrency(row.tgtValue, currency)}</MobileStatValue>
                  </MobileStat>
                </MobileStatsGrid>

                <MobileActionRow>
                  <ActionBtn $type={row.actionType} style={{ fontSize: 11 }}>
                    {row.actionLabel}
                  </ActionBtn>
                  {hasChildren && (
                    <button
                      onClick={() => toggle(row.id)}
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "4px 10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span style={{
                        display: "inline-block",
                        transition: "transform 0.2s",
                        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        fontSize: 12,
                      }}>›</span>
                      {isExpanded ? "Hide" : "Details"}
                    </button>
                  )}
                </MobileActionRow>

                {isExpanded && catAssets.map((a) => (
                  <MobileSubAsset key={a.id}>
                    <span>{a.name}</span>
                    <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>
                      {formatCurrency(a.value, currency)}
                    </span>
                  </MobileSubAsset>
                ))}
              </MobileCard>
            );
          })}
        </div>
      ) : (
        /* ── Desktop: table layout ── */
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th style={{ width: 30 }}></Th>
                <Th>Category</Th>
                <Th style={{ width: 60 }}>Curr%</Th>
                <Th style={{ width: 80 }}>Value</Th>
                <Th style={{ width: 55 }}>Tgt%</Th>
                <Th style={{ width: 80 }}>Value</Th>
                <Th style={{ width: 55 }}>Gap</Th>
                <Th style={{ width: 110 }}>Action</Th>
              </tr>
            </thead>
            <tbody>
              {gapData.map((row) => {
                const catAssets = assetGroups[row.id] || [];
                const hasChildren = catAssets.length > 0;
                const isExpanded = expanded[row.id];
                return (
                  <React.Fragment key={row.id}>
                    <tr>
                      <Td>
                        {hasChildren && (
                          <ExpandBtn
                            onClick={() => toggle(row.id)}
                            style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0)" }}
                          >
                            ›
                          </ExpandBtn>
                        )}
                      </Td>
                      <Td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              width: 10, height: 10, borderRadius: 3,
                              background: row.color, display: "inline-block", flexShrink: 0,
                            }}
                          />
                          {row.label}
                        </span>
                      </Td>
                      <Td>{row.currPct}%</Td>
                      <Td>{formatCurrency(row.currValue, currency)}</Td>
                      <Td>{row.tgtPct}%</Td>
                      <Td>{formatCurrency(row.tgtValue, currency)}</Td>
                      <Td
                        style={{
                          color:
                            row.gapPct > 0 ? "#f97316" : row.gapPct < 0 ? "#38bdf8" : "rgba(255,255,255,0.5)",
                          fontWeight: 700,
                        }}
                      >
                        {row.gapPct > 0 ? "+" : ""}
                        {row.gapPct}%
                      </Td>
                      <Td>
                        <ActionBtn $type={row.actionType}>{row.actionLabel}</ActionBtn>
                      </Td>
                    </tr>
                    {isExpanded &&
                      catAssets.map((a) => (
                        <SubRow key={a.id}>
                          <Td></Td>
                          <Td style={{ paddingLeft: 32, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                            {a.name}
                          </Td>
                          <Td style={{ fontSize: 12 }}>
                            {totalValue > 0 ? Math.round((a.value / totalValue) * 100) : 0}%
                          </Td>
                          <Td style={{ fontSize: 12 }}>{formatCurrency(a.value, currency)}</Td>
                          <Td colSpan={4}></Td>
                        </SubRow>
                      ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </LiquidGlassCard>
  );
}
