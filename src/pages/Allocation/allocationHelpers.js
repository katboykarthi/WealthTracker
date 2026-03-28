// ── Allocation categories, defaults & utility functions ──

export const ALLOCATION_CATEGORIES = [
  { id: "stocks",      label: "Stocks & ETFs",     color: "#3b82f6", defaultPct: 45, assetIds: ["stocks"] },
  { id: "fixed_income",label: "Fixed Income",       color: "#14b8a6", defaultPct: 20, assetIds: ["fd", "bonds", "epf"] },
  { id: "mutual_funds",label: "Mutual Funds",       color: "#22c55e", defaultPct: 10, assetIds: ["mutual_funds"] },
  { id: "gold",        label: "Gold & Silver",      color: "#eab308", defaultPct: 10, assetIds: ["gold"] },
  { id: "real_estate", label: "Real Estate",        color: "#84cc16", defaultPct: 10, assetIds: ["real_estate"] },
  { id: "cash",        label: "Cash & Savings",     color: "#94a3b8", defaultPct: 5,  assetIds: ["cash"] },
  { id: "crypto",      label: "Crypto",             color: "#a855f7", defaultPct: 0,  assetIds: ["crypto"] },
  { id: "insurance",   label: "Insurance",          color: "#f97316", defaultPct: 0,  assetIds: [] },
  { id: "commodities", label: "Other Commodities",  color: "#d97706", defaultPct: 0,  assetIds: [] },
  { id: "other",       label: "Other",              color: "#ec4899", defaultPct: 0,  assetIds: ["other"] },
];

/** Build default targets map { id → pct } */
export function getDefaultTargets() {
  return Object.fromEntries(ALLOCATION_CATEGORIES.map((c) => [c.id, c.defaultPct]));
}

/** Map the app's assets array into category‐level actuals { id → value } */
export function mapAssetsToCategories(assets = []) {
  const totals = {};
  ALLOCATION_CATEGORIES.forEach((cat) => { totals[cat.id] = 0; });

  assets.forEach((asset) => {
    const cat = ALLOCATION_CATEGORIES.find((c) => c.assetIds.includes(asset.typeId));
    if (cat) totals[cat.id] += asset.value;
    else totals["other"] += asset.value;
  });
  return totals;
}

/** Return grouped sub-assets per category */
export function groupAssetsByCategory(assets = []) {
  const groups = {};
  ALLOCATION_CATEGORIES.forEach((cat) => { groups[cat.id] = []; });
  assets.forEach((asset) => {
    const cat = ALLOCATION_CATEGORIES.find((c) => c.assetIds.includes(asset.typeId));
    if (cat) groups[cat.id].push(asset);
    else groups["other"].push(asset);
  });
  return groups;
}

/**
 * Compute gap data for every category
 * Returns array of { id, label, color, currPct, currValue, tgtPct, tgtValue, gapPct, actionLabel, actionAmount }
 */
export function computeGaps(targets, actualValues, totalValue) {
  return ALLOCATION_CATEGORIES.map((cat) => {
    const currValue = actualValues[cat.id] || 0;
    const currPct = totalValue > 0 ? (currValue / totalValue) * 100 : 0;
    const tgtPct = targets[cat.id] || 0;
    const tgtValue = totalValue * (tgtPct / 100);
    const gapPct = currPct - tgtPct;
    const diff = currValue - tgtValue;

    let actionLabel = "On target";
    let actionAmount = 0;
    let actionType = "neutral"; // "add" | "reduce" | "neutral"
    if (Math.abs(gapPct) > 0.5) {
      if (diff > 0) {
        actionLabel = `Reduce ${formatIndianCompact(Math.abs(diff))}`;
        actionAmount = Math.abs(diff);
        actionType = "reduce";
      } else {
        actionLabel = `Add ${formatIndianCompact(Math.abs(diff))}`;
        actionAmount = Math.abs(diff);
        actionType = "add";
      }
    }

    return {
      id: cat.id,
      label: cat.label,
      color: cat.color,
      currPct: Math.round(currPct),
      currValue,
      tgtPct: Math.round(tgtPct),
      tgtValue,
      gapPct: Math.round(gapPct),
      actionLabel,
      actionAmount,
      actionType,
    };
  });
}

/** Generate insight objects from allocation data */
export function generateInsights(targets, actualValues, totalValue) {
  const insights = [];
  const totalActual = Object.values(actualValues).reduce((s, v) => s + v, 0);

  // 1 — Heavy tilt: any category > 40%
  ALLOCATION_CATEGORIES.forEach((cat) => {
    const pct = totalActual > 0 ? ((actualValues[cat.id] || 0) / totalActual) * 100 : 0;
    if (pct > 40) {
      insights.push({
        type: "warning",
        icon: "⚠️",
        title: `Heavy ${cat.label} tilt`,
        description: `${Math.round(pct)}% in one category. High concentration increases risk during downturns.`,
      });
    }
  });

  // 2 — Missing allocations: target > 0 but actual = 0
  const missing = ALLOCATION_CATEGORIES.filter(
    (cat) => (targets[cat.id] || 0) > 0 && (actualValues[cat.id] || 0) === 0
  );
  if (missing.length > 0) {
    insights.push({
      type: "warning",
      icon: "⚠️",
      title: "Missing allocations",
      description: `You have targets for ${missing.map((c) => c.label).join(", ")} but no holdings yet.`,
    });
  }

  // 3 — Next investment tip: biggest under-allocation
  const gaps = computeGaps(targets, actualValues, totalValue);
  const underAllocated = gaps.filter((g) => g.gapPct < -2).sort((a, b) => a.gapPct - b.gapPct);
  if (underAllocated.length > 0) {
    const top = underAllocated[0];
    insights.push({
      type: "info",
      icon: "ℹ️",
      title: "Next Investment",
      description: `Consider adding to ${top.label} (${Math.abs(top.gapPct)}% below target) for the best rebalancing impact.`,
    });
  }

  // Fallback if portfolio is well-balanced
  if (insights.length === 0) {
    insights.push({
      type: "info",
      icon: "✅",
      title: "Well balanced",
      description: "Your portfolio is closely aligned with your target allocation.",
    });
  }

  return insights;
}

/** Compact Indian ₹ formatter: ₹1.2K, ₹4.5L, ₹1.3Cr */
export function formatIndianCompact(amount) {
  const n = Math.abs(Number(amount) || 0);
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}
