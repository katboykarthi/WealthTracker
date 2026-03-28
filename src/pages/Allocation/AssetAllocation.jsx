import React, { useState, useCallback } from "react";
import styled from "@emotion/styled";
import { serifFontFamily } from "../../styles";
import { PageSection, PageHeader } from "../AppPages";
import { getDefaultTargets } from "./allocationHelpers";
import TargetAllocation from "./TargetAllocation";
import CurrentAllocation from "./CurrentAllocation";
import AllocationInsights from "./AllocationInsights";

const BottomGrid = styled.div(({ $isMobile }) => ({
  display: "grid",
  gridTemplateColumns: $isMobile ? "1fr" : "minmax(0, 1.8fr) minmax(280px, 1fr)",
  gap: 20,
  marginTop: 20,
}));

// ── Main page ────────────────────────────────────────────────

export default function AssetAllocation({ assets, currency, isMobile = false }) {
  const [targets, setTargets] = useState(getDefaultTargets);

  const handleReset = useCallback(() => setTargets(getDefaultTargets()), []);
  const handleSave = useCallback(() => {
    // TODO: persist to Firebase
  }, []);

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <div>
          <h2
            style={{
              fontFamily: serifFontFamily,
              fontSize: 28,
              color: "rgba(255,255,255,0.95)",
              marginBottom: 4,
            }}
          >
            Asset Allocation
          </h2>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14 }}>
            Set targets, track actual allocation, and rebalance your portfolio.
          </p>
        </div>
      </PageHeader>

      {/* Section 1 — Target Allocation */}
      <TargetAllocation
        targets={targets}
        onChange={setTargets}
        onReset={handleReset}
        onSave={handleSave}
      />

      {/* Section 2 + 3 — Current + Insights */}
      <BottomGrid $isMobile={isMobile}>
        <CurrentAllocation
          assets={assets}
          targets={targets}
          currency={currency}
          isMobile={isMobile}
        />
        <AllocationInsights assets={assets} targets={targets} />
      </BottomGrid>
    </PageSection>
  );
}
