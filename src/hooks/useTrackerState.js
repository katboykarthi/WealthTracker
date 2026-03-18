import { useCallback, useState } from "react";

export function useTrackerState() {
  const [phase, setPhase] = useState("onboarding"); // onboarding | app
  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [goals, setGoals] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [sectionSelection, setSectionSelection] = useState({});
  const [mobileProfileMenuOpen, setMobileProfileMenuOpen] = useState(false);
  const [assetComposerRequest, setAssetComposerRequest] = useState(null);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  const resetTrackerState = useCallback(() => {
    setPhase("onboarding");
    setAssets([]);
    setLiabilities([]);
    setIncomes([]);
    setExpenses([]);
    setGoals([]);
    setSnapshots([]);
    setActiveNav("dashboard");
    setSectionSelection({});
    setMobileProfileMenuOpen(false);
    setAssetComposerRequest(null);
  }, []);

  return {
    phase,
    setPhase,
    assets,
    setAssets,
    liabilities,
    setLiabilities,
    incomes,
    setIncomes,
    expenses,
    setExpenses,
    goals,
    setGoals,
    snapshots,
    setSnapshots,
    activeNav,
    setActiveNav,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarSearch,
    setSidebarSearch,
    sectionSelection,
    setSectionSelection,
    mobileProfileMenuOpen,
    setMobileProfileMenuOpen,
    assetComposerRequest,
    setAssetComposerRequest,
    headerScrolled,
    setHeaderScrolled,
    resetTrackerState,
  };
}
