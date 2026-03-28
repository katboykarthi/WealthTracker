import React, { useState, useMemo } from "react";
import styled from "@emotion/styled";
import LiquidGlassCard from "../../components/LiquidGlassCard";
import { ALLOCATION_CATEGORIES } from "./allocationHelpers";

// ── Styled primitives ────────────────────────────────────────

const Header = styled.div({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 4,
});

const Title = styled.h3({
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
  color: "rgba(255,255,255,0.95)",
  display: "flex",
  alignItems: "center",
  gap: 10,
});

const Pill = styled.span({
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 10px",
  borderRadius: 99,
  background: "rgba(56,189,248,0.18)",
  color: "#38bdf8",
  letterSpacing: 0.4,
});

const ChevronBtn = styled.button(({ $expanded }) => ({
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 10,
  color: "rgba(255,255,255,0.7)",
  padding: "6px 14px",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
  transition: "background 0.2s, transform 0.3s cubic-bezier(0.22,1,0.36,1)",
  transform: $expanded ? "rotate(0deg)" : "rotate(-90deg)",
  "&:hover": { background: "rgba(255,255,255,0.14)" },
}));

const TotalBadge = styled.span(({ $valid }) => ({
  fontSize: 12,
  fontWeight: 700,
  padding: "4px 12px",
  borderRadius: 99,
  flexShrink: 0,
  background: $valid ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
  color: $valid ? "#22c55e" : "#ef4444",
  border: `1px solid ${$valid ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
}));

// ── Segmented bar ────────────────────────────────────────────

const BarWrap = styled.div({
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 14,
  marginBottom: 4,
});

const SegmentedBar = styled.div({
  flex: 1,
  height: 32,
  borderRadius: 8,
  overflow: "hidden",
  display: "flex",
  background: "rgba(255,255,255,0.06)",
});

const Segment = styled.div(({ $color, $pct }) => ({
  width: `${$pct}%`,
  minWidth: $pct > 0 ? 2 : 0,
  background: $color,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "width 0.35s cubic-bezier(0.22,1,0.36,1)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  fontSize: 10,
  fontWeight: 700,
  color: "#fff",
  textShadow: "0 1px 3px rgba(0,0,0,0.5)",
  padding: "0 4px",
}));

// ── Collapsible body ─────────────────────────────────────────

const CollapsibleBody = styled.div(({ $expanded }) => ({
  maxHeight: $expanded ? 800 : 0,
  overflow: "hidden",
  transition: "max-height 0.4s cubic-bezier(0.22,1,0.36,1)",
  marginTop: $expanded ? 14 : 0,
}));

// ── Category row ─────────────────────────────────────────────

const Row = styled.div({
  display: "grid",
  gridTemplateColumns: "18px 140px minmax(0,2.2fr) 64px",
  gap: 12,
  alignItems: "center",
  padding: "7px 0",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  "&:last-of-type": { borderBottom: "none" },
});

const ColorSwatch = styled.div(({ $color }) => ({
  width: 16,
  height: 16,
  borderRadius: 4,
  background: $color,
  flexShrink: 0,
}));

const CatLabel = styled.span({
  fontSize: 13,
  color: "rgba(255,255,255,0.85)",
  fontWeight: 500,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const SliderTrack = styled.div({
  position: "relative",
  height: 6,
  borderRadius: 99,
  background: "rgba(255,255,255,0.1)",
  cursor: "pointer",
});

const SliderFill = styled.div(({ $color, $pct }) => ({
  position: "absolute",
  left: 0,
  top: 0,
  height: "100%",
  borderRadius: 99,
  width: `${$pct}%`,
  background: $color,
  transition: "width 0.15s ease",
  pointerEvents: "none",
}));

const RangeInput = styled.input({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  opacity: 0,
  cursor: "pointer",
  margin: 0,
  padding: 0,
});

const PctInput = styled.input({
  width: "100%",
  padding: "5px 6px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.92)",
  fontSize: 13,
  fontWeight: 700,
  textAlign: "center",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  "&:focus": { borderColor: "rgba(56,189,248,0.5)" },
});

const Actions = styled.div({
  display: "flex",
  gap: 10,
  marginTop: 18,
  justifyContent: "flex-end",
});

const SaveBtn = styled.button({
  padding: "10px 22px",
  borderRadius: 12,
  border: "1px solid rgba(56,189,248,0.35)",
  background:
    "linear-gradient(135deg, rgba(56,189,248,0.28) 0%, rgba(14,165,233,0.18) 100%)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  backdropFilter: "blur(12px)",
  transition: "all 0.25s",
  "&:hover": { background: "rgba(56,189,248,0.35)" },
});

const ResetBtn = styled.button({
  padding: "10px 22px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.75)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  transition: "all 0.25s",
  "&:hover": { background: "rgba(255,255,255,0.12)" },
});

// ── 100%-locked redistribution logic ─────────────────────────

function redistribute(targets, catId, newVal) {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(newVal) || 0)));
  const oldVal = targets[catId];
  if (clamped === oldVal) return targets;

  const otherIds = ALLOCATION_CATEGORIES.map((c) => c.id).filter((id) => id !== catId);
  const othersTotal = otherIds.reduce((s, id) => s + targets[id], 0);
  const remaining = 100 - clamped;

  // If we can't fit this value (all others at 0 and clamped > 100), clamp
  if (remaining < 0) return targets;

  const next = { ...targets, [catId]: clamped };

  if (othersTotal === 0) {
    // All others are 0 — we can only set this to remaining = 100 - sum_of_others(=0)
    // which means clamped must equal 100. If it doesn't, we can't redistribute.
    // In practice: if all others are 0, this slider can only be 100, OR we spread
    // the remaining across others evenly. Let's cap this slider at 100 in that case.
    if (clamped > 100) {
      next[catId] = 100;
    } else {
      // Put the leftover into the first category that isn't this one
      const deficit = 100 - clamped;
      if (deficit > 0 && otherIds.length > 0) {
        next[otherIds[0]] = deficit;
      }
    }
  } else {
    // Redistribute proportionally
    let distributed = 0;
    otherIds.forEach((id, i) => {
      if (i === otherIds.length - 1) {
        // Last one absorbs rounding remainder
        next[id] = Math.max(0, remaining - distributed);
      } else {
        const share = Math.round((targets[id] / othersTotal) * remaining);
        next[id] = Math.max(0, share);
        distributed += next[id];
      }
    });
  }

  // Safety: ensure they all sum to 100
  const sum = Object.values(next).reduce((s, v) => s + v, 0);
  if (sum !== 100) {
    // Fix rounding by adjusting the largest non-target category
    const diff = 100 - sum;
    const adjustId = otherIds
      .filter((id) => next[id] + diff >= 0)
      .sort((a, b) => next[b] - next[a])[0];
    if (adjustId) next[adjustId] += diff;
  }

  return next;
}

// ── Component ────────────────────────────────────────────────

export default function TargetAllocation({ targets, onChange, onReset, onSave }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const total = useMemo(
    () => Object.values(targets).reduce((s, v) => s + v, 0),
    [targets]
  );

  const handleSlider = (catId, rawVal) => {
    onChange(redistribute(targets, catId, rawVal));
  };

  const handleInput = (catId, rawVal) => {
    const val = rawVal === "" ? 0 : parseInt(rawVal, 10);
    if (isNaN(val)) return;
    onChange(redistribute(targets, catId, val));
  };

  return (
    <LiquidGlassCard style={{ padding: "22px 24px" }}>
      <Header>
        <Title>
          Target Allocation <Pill>Default</Pill>
        </Title>
        <ChevronBtn
          $expanded={isExpanded}
          onClick={() => setIsExpanded((p) => !p)}
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          ▼
        </ChevronBtn>
      </Header>

      {/* ── Segmented bar — always visible ── */}
      <BarWrap>
        <SegmentedBar>
          {ALLOCATION_CATEGORIES.map((cat) => {
            const pct = targets[cat.id] || 0;
            return (
              <Segment key={cat.id} $color={cat.color} $pct={pct}>
                {pct >= 6 ? `${cat.label.split(" ")[0]} ${pct}%` : pct > 0 ? `${pct}%` : ""}
              </Segment>
            );
          })}
        </SegmentedBar>
        <TotalBadge $valid={total === 100}>
          {total}% {total === 100 ? "✓" : "✗"}
        </TotalBadge>
      </BarWrap>

      {/* ── Collapsible slider section ── */}
      <CollapsibleBody $expanded={isExpanded}>
        {ALLOCATION_CATEGORIES.map((cat) => (
          <Row key={cat.id}>
            <ColorSwatch $color={cat.color} />
            <CatLabel>{cat.label}</CatLabel>
            <SliderTrack>
              <SliderFill $color={cat.color} $pct={targets[cat.id] || 0} />
              <RangeInput
                type="range"
                min={0}
                max={100}
                value={targets[cat.id] || 0}
                onChange={(e) => handleSlider(cat.id, e.target.value)}
              />
            </SliderTrack>
            <PctInput
              type="number"
              min={0}
              max={100}
              value={targets[cat.id] || 0}
              onChange={(e) => handleInput(cat.id, e.target.value)}
            />
          </Row>
        ))}

        <Actions>
          <ResetBtn onClick={onReset}>Reset to Default</ResetBtn>
          <SaveBtn onClick={onSave}>Save</SaveBtn>
        </Actions>
      </CollapsibleBody>
    </LiquidGlassCard>
  );
}
