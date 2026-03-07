import { useCallback } from "react";
import { useIsMobile } from "./useWindowSize";
import { useAppShellTheme, auroraStyles } from "./useAppShellTheme";
import { useNavigationModel } from "./useNavigationModel";
import { useTrackerCloudSync } from "./useTrackerCloudSync";
import { useGlobalToast } from "./useGlobalToast";
import { useTrackerActions } from "./useTrackerActions";
import { useTrackerState } from "./useTrackerState";
import { useWindowClickClose } from "./useWindowClickClose";

const TOAST_EVENT_NAME = "wealthtracker:toast";

export function useTrackerRuntime() {
  const isMobile = useIsMobile();
  const currency = "INR";
  const { toast, pushToast } = useGlobalToast(TOAST_EVENT_NAME);

  const {
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
  } = useTrackerState();

  const {
    addAsset,
    updateAsset,
    deleteAsset,
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
    takeSnapshot,
    openAssetComposer,
  } = useTrackerActions({
    assets,
    liabilities,
    setAssets,
    setLiabilities,
    setIncomes,
    setExpenses,
    setSnapshots,
    setActiveNav,
    setAssetComposerRequest,
    pushToast,
  });

  const {
    authUser,
    authLoading,
    cloudLoading,
    cloudHydrated,
    signInBusy,
    authError,
    handleGoogleSignIn,
    handleSignOut,
  } = useTrackerCloudSync({
    phase,
    assets,
    liabilities,
    incomes,
    expenses,
    snapshots,
    activeNav,
    setPhase,
    setAssets,
    setLiabilities,
    setIncomes,
    setExpenses,
    setSnapshots,
    setActiveNav,
    resetTrackerState,
  });

  const userName = authUser?.displayName?.trim() || authUser?.email?.split("@")[0] || "User";
  const userAvatar = authUser?.photoURL || "";

  const {
    navSections,
    activeSection,
    activeSectionItems,
    activeSectionTabIndex,
    visibleSections,
    mobileNavItems,
    activeMobileSection,
    mobileNavTrackRef,
    mobileBubbleRef,
    setMobileNavButtonRef,
    moveMobileNavBubble,
    navigateToSection,
  } = useNavigationModel({
    activeNav,
    setActiveNav,
    sidebarSearch,
    sectionSelection,
    setSectionSelection,
    isMobile,
  });

  const handleMainScroll = useCallback((event) => {
    const nextScrolled = event.currentTarget.scrollTop > 8;
    setHeaderScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
  }, [setHeaderScrolled]);

  useAppShellTheme(phase);
  useWindowClickClose(mobileProfileMenuOpen, () => setMobileProfileMenuOpen(false));

  const syncMessage = authError
    ? {
        text: authError,
        color: "#dc2626",
        background: "rgba(220, 38, 38, 0.12)",
        border: "rgba(220, 38, 38, 0.35)",
      }
    : null;

  return {
    isMobile,
    currency,
    toast,
    pushToast,
    phase,
    setPhase,
    assets,
    liabilities,
    incomes,
    expenses,
    snapshots,
    activeNav,
    setActiveNav,
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarSearch,
    setSidebarSearch,
    mobileProfileMenuOpen,
    setMobileProfileMenuOpen,
    assetComposerRequest,
    setAssetComposerRequest,
    headerScrolled,
    addAsset,
    updateAsset,
    deleteAsset,
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
    takeSnapshot,
    openAssetComposer,
    authUser,
    authLoading,
    cloudLoading,
    cloudHydrated,
    signInBusy,
    authError,
    handleGoogleSignIn,
    handleSignOut,
    userName,
    userAvatar,
    navSections,
    activeSection,
    activeSectionItems,
    activeSectionTabIndex,
    visibleSections,
    mobileNavItems,
    activeMobileSection,
    mobileNavTrackRef,
    mobileBubbleRef,
    setMobileNavButtonRef,
    moveMobileNavBubble,
    navigateToSection,
    handleMainScroll,
    syncMessage,
    auroraStyles,
  };
}
