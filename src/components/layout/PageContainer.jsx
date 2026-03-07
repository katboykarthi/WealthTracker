import styled from "@emotion/styled";

const TYPE_SCALE = {
  meta: 13,
};

const DASHBOARD_LAYOUT = {
  headerHeight: 72,
};

const MOBILE_LAYOUT = {
  topNavHeight: 72,
  bottomTabBarHeight: 88,
  bottomTabBarOffset: 20,
};

const MainSurface = styled.main(({ $hasMobileNav, $isMobile }) => ({
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  position: "relative",
  isolation: "isolate",
  paddingTop: $isMobile ? `calc(${MOBILE_LAYOUT.topNavHeight}px + env(safe-area-inset-top, 0px))` : 0,
  paddingBottom: 0,
}));

const MainScroll = styled.div(({ $hasMobileNav, $isMobile }) => ({
  flex: 1,
  minHeight: 0,
  position: "relative",
  zIndex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  boxSizing: "border-box",
  WebkitOverflowScrolling: "touch",
  paddingBottom: $hasMobileNav
    ? `calc(${MOBILE_LAYOUT.bottomTabBarHeight + MOBILE_LAYOUT.bottomTabBarOffset}px + env(safe-area-inset-bottom, 0px))`
    : 0,
  scrollPaddingTop: $isMobile
    ? `calc(${MOBILE_LAYOUT.topNavHeight}px + env(safe-area-inset-top, 0px) + 12px)`
    : DASHBOARD_LAYOUT.headerHeight,
  scrollPaddingBottom: $hasMobileNav
    ? `calc(${MOBILE_LAYOUT.bottomTabBarHeight + MOBILE_LAYOUT.bottomTabBarOffset}px + env(safe-area-inset-bottom, 0px))`
    : 24,
}));

const MainMenuTabs = styled.div(({ $isMobile, $count = 1, $activeIndex = 0 }) => {
  const safeCount = Math.max(1, Number($count) || 1);
  const clampedIndex = Math.min(Math.max(0, Number($activeIndex) || 0), safeCount - 1);
  return {
    position: "relative",
    height: "44px",
    padding: "4px",
    borderRadius: 999,
    display: "grid",
    gridTemplateColumns: `repeat(${safeCount}, minmax(0, 1fr))`,
    alignItems: "stretch",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(25px)",
    WebkitBackdropFilter: "blur(25px)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 28px rgba(2,6,23,0.3)",
    margin: $isMobile ? "16px 12px 0" : "20px 28px 0",
    overflow: "hidden",
    width: $isMobile ? "calc(100% - 24px)" : "min(620px, calc(100% - 56px))",
    maxWidth: "100%",
    isolation: "isolate",
    "&::before": {
      content: '""',
      position: "absolute",
      top: 4,
      bottom: 4,
      left: 4,
      width: `calc((100% - 8px) / ${safeCount})`,
      transform: `translateX(${clampedIndex * 100}%)`,
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.22)",
      background:
        "linear-gradient(145deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.14) 48%, rgba(56,189,248,0.2) 100%)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.42), inset 0 0 0 1px rgba(255,255,255,0.06), 0 8px 20px rgba(14,165,233,0.24)",
      transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
      pointerEvents: "none",
      zIndex: 0,
    },
    "& > *": {
      position: "relative",
      zIndex: 1,
    },
  };
});

const MainMenuTab = styled.button(({ $active }) => ({
  width: "100%",
  height: "100%",
  border: "none",
  borderRadius: 999,
  background: "transparent",
  color: $active ? "#f8fbff" : "rgba(229,231,235,0.72)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 14px",
  fontSize: 14,
  fontWeight: $active ? 700 : 600,
  cursor: "pointer",
  textAlign: "center",
  minWidth: 0,
  whiteSpace: "nowrap",
  textShadow: $active ? "0 1px 10px rgba(56,189,248,0.35)" : "none",
  transform: $active ? "scale(1.05)" : "scale(1)",
  transformOrigin: "center",
  willChange: "transform",
  transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), color 220ms ease, text-shadow 220ms ease",
}));

export default function PageContainer({
  isMobile,
  topBar,
  syncMessage,
  activeSectionItems,
  activeSectionTabIndex,
  activeNav,
  onTabSelect,
  onScroll,
  bottomBar,
  children,
}) {
  return (
    <MainSurface $hasMobileNav={isMobile} $isMobile={isMobile}>
      {topBar}

      {syncMessage ? (
        <div
          style={{
            margin: isMobile ? "8px 12px 0" : "10px 16px 0",
            border: `1px solid ${syncMessage.border}`,
            borderRadius: 10,
            padding: "8px 10px",
            fontSize: TYPE_SCALE.meta,
            fontWeight: 600,
            background: syncMessage.background,
            color: syncMessage.color,
          }}
        >
          {syncMessage.text}
        </div>
      ) : null}

      {activeSectionItems.length > 1 && (
        <MainMenuTabs
          $isMobile={isMobile}
          $count={activeSectionItems.length}
          $activeIndex={activeSectionTabIndex}
        >
          {activeSectionItems.map((item) => (
            <MainMenuTab
              key={item.id}
              type="button"
              className="segmented-tab-btn"
              $active={activeNav === item.id}
              onClick={(event) => {
                event.preventDefault();
                onTabSelect(item.id);
              }}
            >
              <span>{item.label}</span>
            </MainMenuTab>
          ))}
        </MainMenuTabs>
      )}

      <MainScroll $hasMobileNav={isMobile} $isMobile={isMobile} onScroll={onScroll}>
        {children}
      </MainScroll>

      {bottomBar}
    </MainSurface>
  );
}
