import WealthPage from "./pages/Wealth/Wealth";
import PlanPage from "./pages/Plan/Plan";
import Dashboard from "./pages/Dashboard/Dashboard";
import AssetsPage from "./pages/Assets/Assets";
import LiabilitiesPage from "./pages/Liabilities/Liabilities";
import IncomePage from "./pages/Income/Income";
import ExpensesPage from "./pages/Expenses/Expenses";
import NetWorthPage from "./pages/NetWorth/NetWorth";
import GoalsPage from "./pages/Goals/Goals";
import { cardStyle as sharedCardStyle, serifFontFamily } from "./styles";

const cardStyle = sharedCardStyle;

export function renderAppRoute({
  activeNav,
  assets,
  liabilities,
  incomes,
  expenses,
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
      return <GoalsPage assets={assets} currency={currency} />;
    case "allocation":
      return <WealthPage assets={assets} currency={currency} isMobile={isMobile} />;
    case "income":
      return (
        <IncomePage
          incomes={incomes}
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
      return <PlanPage assets={assets} liabilities={liabilities} currency={currency} isMobile={isMobile} />;
    case "settings":
      return (
        <div style={{ padding: "28px 32px", maxWidth: 900 }}>
          <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>Settings</h2>
          <p style={{ color: "var(--muted, #64748b)", marginBottom: 24 }}>Manage your preferences</p>
          <div style={{ display: "grid", gap: 16, maxWidth: 500 }}>
            <div style={cardStyle}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--text-color, #1e293b)" }}>Display</div>
              <div style={{ color: "var(--muted, #64748b)", fontSize: 13 }}>
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
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--muted, #64748b)" }}>{activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}</div>
          <div style={{ marginTop: 8, fontSize: 14 }}>Coming soon...</div>
        </div>
      );
  }
}
