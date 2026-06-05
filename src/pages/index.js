/**
 * pages/index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single barrel export for all page components.
 * Import from here instead of from individual files:
 *
 *   import { Dashboard, AssetsPage, GoalsPage } from "./pages";
 */

export { default as Dashboard        } from "./Dashboard/Dashboard";
export { default as AssetsPage       } from "./Assets/Assets";
export { default as LiabilitiesPage  } from "./Liabilities/Liabilities";
export { default as IncomePage       } from "./Income/Income";
export { default as ExpensesPage     } from "./Expenses/Expenses";
export { default as NetWorthPage     } from "./NetWorth/NetWorth";
export { default as GoalsPage        } from "./Goals/Goals";
export { default as InsightsPage     } from "./Insights/Insights";
