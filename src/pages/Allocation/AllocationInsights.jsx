import React, { useMemo } from "react";
import styled from "@emotion/styled";
import LiquidGlassCard from "../../components/LiquidGlassCard";
import {
  mapAssetsToCategories,
  generateInsights,
} from "./allocationHelpers";

// ── Styled ───────────────────────────────────────────────────

const Header = styled.div({
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 16,
});

const Title = styled.h3({
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
  color: "rgba(255,255,255,0.95)",
});

const Icon = styled.span({
  fontSize: 20,
});

const CardStack = styled.div({
  display: "grid",
  gap: 12,
});

const InsightCard = styled.div(({ $type }) => ({
  display: "flex",
  gap: 12,
  padding: "14px 16px",
  borderRadius: 12,
  background:
    $type === "warning"
      ? "rgba(249,115,22,0.10)"
      : "rgba(56,189,248,0.08)",
  border: `1px solid ${
    $type === "warning"
      ? "rgba(249,115,22,0.22)"
      : "rgba(56,189,248,0.18)"
  }`,
}));

const InsightIcon = styled.span({
  fontSize: 20,
  flexShrink: 0,
  lineHeight: 1.3,
});

const InsightBody = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: 2,
});

const InsightTitle = styled.div({
  fontSize: 14,
  fontWeight: 700,
  color: "rgba(255,255,255,0.92)",
});

const InsightDesc = styled.div({
  fontSize: 12,
  color: "rgba(255,255,255,0.58)",
  lineHeight: 1.45,
});

// ── Component ────────────────────────────────────────────────

export default function AllocationInsights({ assets, targets }) {
  const actualValues = useMemo(() => mapAssetsToCategories(assets), [assets]);
  const totalValue = useMemo(
    () => Object.values(actualValues).reduce((s, v) => s + v, 0),
    [actualValues]
  );

  const insights = useMemo(
    () => generateInsights(targets, actualValues, totalValue),
    [targets, actualValues, totalValue]
  );

  return (
    <LiquidGlassCard style={{ padding: "22px 24px" }}>
      <Header>
        <Icon>💡</Icon>
        <Title>Insights</Title>
      </Header>

      <CardStack>
        {insights.map((ins, idx) => (
          <InsightCard key={idx} $type={ins.type}>
            <InsightIcon>{ins.icon}</InsightIcon>
            <InsightBody>
              <InsightTitle>{ins.title}</InsightTitle>
              <InsightDesc>{ins.description}</InsightDesc>
            </InsightBody>
          </InsightCard>
        ))}
      </CardStack>
    </LiquidGlassCard>
  );
}
