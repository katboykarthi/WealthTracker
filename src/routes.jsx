import AssetAllocation from "./pages/Allocation/AssetAllocation";
import PlanPage from "./pages/Plan/Plan";
import Dashboard from "./pages/Dashboard/Dashboard";
import AssetsPage from "./pages/Assets/Assets";
import LiabilitiesPage from "./pages/Liabilities/Liabilities";
import IncomePage from "./pages/Income/Income";
import ExpensesPage from "./pages/Expenses/Expenses";
import NetWorthPage from "./pages/NetWorth/NetWorth";
import GoalsPage from "./pages/Goals/Goals";
import InsightsPage from "./pages/Insights/Insights";
import { cardStyle as sharedCardStyle, serifFontFamily } from "./styles";

const cardStyle = sharedCardStyle;

export function renderAppRoute({
  activeNav,
  assets,
  liabilities,
  incomes,
  expenses,
  goals,
  setGoals,
  currency,
  snapshots,
  isMobile,
  takeSnapshot,
  openAssetComposer,
  pushToast,
  setActiveNav,
  addAsset,
  updateAsset,
  deleteAsset,
  assetComposerRequest,
  setAssetComposerRequest,
  addLiability,
  updateLiability,
  deleteLiability,
  addIncome,
  updateIncome,
  deleteIncome,
  addExpense,
  updateExpense,
  deleteExpense,
  importIncomeEntries,
  importExpenseEntries,
  importAssetHoldings,
}) {
  switch (activeNav) {
    case "dashboard":
      return (
        <Dashboard
          assets={assets}
          liabilities={liabilities}
          incomes={incomes}
          expenses={expenses}
          goals={goals}
          currency={currency}
          snapshots={snapshots}
          onSnapshot={() => takeSnapshot(false)}
          onAddAsset={openAssetComposer}
          isMobile={isMobile}
          onToast={pushToast}
          onNavigate={setActiveNav}
        />
      );
    case "assets":
      return (
        <AssetsPage
          assets={assets}
          currency={currency}
          onAdd={addAsset}
          onUpdate={updateAsset}
          onDelete={deleteAsset}
          onImportHoldings={importAssetHoldings}
          openAssetComposerRequest={assetComposerRequest}
          onConsumeAssetComposerRequest={() => setAssetComposerRequest(null)}
        />
      );
    case "liabilities":
      return (
        <LiabilitiesPage
          liabilities={liabilities}
          currency={currency}
          onAdd={addLiability}
          onUpdate={updateLiability}
          onDelete={deleteLiability}
        />
      );
    case "networth":
      return (
        <NetWorthPage
          assets={assets}
          liabilities={liabilities}
          currency={currency}
          snapshots={snapshots}
          onSnapshot={() => takeSnapshot(true)}
          isMobile={isMobile}
        />
      );
    case "goals":
      return <GoalsPage assets={assets} goals={goals} setGoals={setGoals} currency={currency} />;
    case "allocation":
      return <AssetAllocation assets={assets} currency={currency} isMobile={isMobile} />;
    case "income":
      return (
        <IncomePage
          incomes={incomes}
          expenses={expenses}
          currency={currency}
          onAdd={addIncome}
          onUpdate={updateIncome}
          onDelete={deleteIncome}
          onImportIncome={importIncomeEntries}
          onImportExpense={importExpenseEntries}
        />

      );
    case "expenses":
      return (
        <ExpensesPage
          incomes={incomes}
          expenses={expenses}
          currency={currency}
          onAdd={addExpense}
          onUpdate={updateExpense}
          onDelete={deleteExpense}
          onImportIncome={importIncomeEntries}
          onImportExpense={importExpenseEntries}
        />
      );
    case "insights":
      return (
        <InsightsPage
          incomes={incomes}
          expenses={expenses}
          currency={currency}
        />
      );
    case "settings":
      return (
        <div style={{ padding: "28px 32px", maxWidth: 900 }}>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "rgba(255, 255, 255, 0.95)", marginBottom: 8 }}>Settings</h2>
          <p style={{ color: "rgba(255, 255, 255, 0.65)", marginBottom: 24 }}>Manage your preferences</p>
          <div style={{ display: "grid", gap: 16, maxWidth: 500 }}>
            <div style={cardStyle}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: "rgba(255, 255, 255, 0.95)" }}>Display</div>
              <div style={{ color: "rgba(255, 255, 255, 0.65)", fontSize: 13 }}>
                Liquid glass dark theme is enabled by default.
              </div>
            </div>
          </div>
        </div>
      );
    default:
      return (
        <div style={{ padding: "28px 32px", color: "#94a3b8", textAlign: "center", paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u{1F6A7}"}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "rgba(255, 255, 255, 0.65)" }}>{activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}</div>
          <div style={{ marginTop: 8, fontSize: 14 }}>Coming soon...</div>
        </div>
      );
  }
}
