import { Global } from "@emotion/react";
import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";
import BottomTabbar from "./BottomTabbar";
import PageContainer from "./PageContainer";
import { AppShell, ToastStack, ToastChip } from "./AppShellStyles";

export default function AppWorkspace({
  isMobile,
  auroraStyles,
  sidebarCollapsed,
  setSidebarCollapsed,
  userAvatar,
  userName,
  visibleSections,
  activeSection,
  navigateToSection,
  handleSignOut,
  headerScrolled,
  sidebarSearch,
  setSidebarSearch,
  setActiveNav,
  mobileProfileMenuOpen,
  setMobileProfileMenuOpen,
  syncMessage,
  activeSectionItems,
  activeSectionTabIndex,
  activeNav,
  handleMainScroll,
  mobileNavTrackRef,
  mobileBubbleRef,
  mobileNavItems,
  activeMobileSection,
  setMobileNavButtonRef,
  navSections,
  moveMobileNavBubble,
  renderedPage,
  toast,
}) {
  return (
    <AppShell className="liquid-shell" $isMobile={isMobile}>
      <Global styles={auroraStyles} />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {!isMobile && (
        <Sidebar
          collapsed={sidebarCollapsed}
          userAvatar={userAvatar}
          userName={userName}
          visibleSections={visibleSections}
          activeSection={activeSection}
          onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
          onNavigateSection={navigateToSection}
          onSignOut={handleSignOut}
        />
      )}

      <PageContainer
        isMobile={isMobile}
        topBar={(
          <TopNavbar
            isMobile={isMobile}
            headerScrolled={headerScrolled}
            onDashboardClick={() => setActiveNav("dashboard")}
            userAvatar={userAvatar}
            userName={userName}
            mobileProfileMenuOpen={mobileProfileMenuOpen}
            setMobileProfileMenuOpen={setMobileProfileMenuOpen}
            onSignOut={handleSignOut}
          />
        )}
        syncMessage={syncMessage}
        activeSectionItems={activeSectionItems}
        activeSectionTabIndex={activeSectionTabIndex}
        activeNav={activeNav}
        onTabSelect={setActiveNav}
        onScroll={handleMainScroll}
        bottomBar={(
          <BottomTabbar
            isMobile={isMobile}
            mobileNavTrackRef={mobileNavTrackRef}
            mobileBubbleRef={mobileBubbleRef}
            mobileNavItems={mobileNavItems}
            activeMobileSection={activeMobileSection}
            setMobileNavButtonRef={setMobileNavButtonRef}
            onSelectSection={(sectionName) => {
              const section = navSections.find((navSection) => navSection.section === sectionName);
              if (!section) return;
              moveMobileNavBubble(sectionName);
              navigateToSection(section);
            }}
          />
        )}
      >
        {renderedPage}
      </PageContainer>

      {toast && (
        <ToastStack>
          <ToastChip $type={toast.type}>{toast.message}</ToastChip>
        </ToastStack>
      )}
    </AppShell>
  );
}
