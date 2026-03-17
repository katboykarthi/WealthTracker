import { isFirebaseConfigured } from "./firebase";
import { useTrackerRuntime } from "./hooks/useTrackerRuntime";
import { renderEntryGate } from "./components/app/renderEntryGate";
import AppWorkspace from "./components/layout/AppWorkspace";
import { renderAppRoute } from "./routes";

export default function App() {
  const {
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
    importAssetHoldings,
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
  } = useTrackerRuntime();

  const entryScreen = renderEntryGate({
    authLoading,
    isFirebaseConfigured,
    handleGoogleSignIn,
    signInBusy,
    authError,
    authUser,
    cloudLoading,
    cloudHydrated,
    phase,
    isMobile,
    syncMessage,
    onStart: () => setPhase("app"),
  });

  if (entryScreen) {
    return entryScreen;
  }

  const renderedPage = renderAppRoute({
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
  });

  return (
    <AppWorkspace
      isMobile={isMobile}
      auroraStyles={auroraStyles}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      userAvatar={userAvatar}
      userName={userName}
      visibleSections={visibleSections}
      activeSection={activeSection}
      navigateToSection={navigateToSection}
      handleSignOut={handleSignOut}
      headerScrolled={headerScrolled}
      sidebarSearch={sidebarSearch}
      setSidebarSearch={setSidebarSearch}
      setActiveNav={setActiveNav}
      mobileProfileMenuOpen={mobileProfileMenuOpen}
      setMobileProfileMenuOpen={setMobileProfileMenuOpen}
      syncMessage={syncMessage}
      activeSectionItems={activeSectionItems}
      activeSectionTabIndex={activeSectionTabIndex}
      activeNav={activeNav}
      handleMainScroll={handleMainScroll}
      mobileNavTrackRef={mobileNavTrackRef}
      mobileBubbleRef={mobileBubbleRef}
      mobileNavItems={mobileNavItems}
      activeMobileSection={activeMobileSection}
      setMobileNavButtonRef={setMobileNavButtonRef}
      navSections={navSections}
      moveMobileNavBubble={moveMobileNavBubble}
      renderedPage={renderedPage}
      toast={toast}
    />
  );
}
