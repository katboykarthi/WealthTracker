import styled from "@emotion/styled";

const TYPE_SCALE = {
  meta: 13,
  micro: 11,
};

const DASHBOARD_LAYOUT = {
  headerSearchWidth: 300,
};

const MOBILE_LAYOUT = {
  topNavHeight: 72,
};

const MainHeader = styled.header(({ $isMobile }) => ({
  position: $isMobile ? "fixed" : "sticky",
  top: $isMobile ? "env(safe-area-inset-top, 0px)" : 10,
  left: $isMobile ? 12 : "auto",
  right: $isMobile ? 12 : "auto",
  zIndex: 140,
  display: "flex",
  alignItems: "center",
  justifyContent: $isMobile ? "space-between" : "flex-start",
  height: MOBILE_LAYOUT.topNavHeight,
  gap: $isMobile ? 16 : 12,
  padding: $isMobile ? "0 16px" : "0 28px",
  margin: $isMobile ? 0 : "0 20px",
  borderRadius: 24,
  boxSizing: "border-box",
  overflow: $isMobile ? "visible" : "hidden",
  isolation: "isolate",
  transition: "transform 220ms ease",
  "@media (max-width: 1180px)": {
    gap: $isMobile ? 16 : 10,
    padding: $isMobile ? "0 16px" : "0 16px",
    margin: $isMobile ? 0 : "0 12px",
  },
  "@media (max-width: 980px)": {
    gap: $isMobile ? 16 : 8,
    padding: $isMobile ? "0 16px" : "0 12px",
    margin: $isMobile ? 0 : "0 8px",
  },
  "&::before": {
    content: '""',
    position: "absolute",
    left: 1,
    right: 1,
    top: 1,
    height: 1,
    borderRadius: 999,
    background: "linear-gradient(90deg, rgba(255,255,255,0.18), rgba(255,255,255,0.34), rgba(255,255,255,0.18))",
    pointerEvents: "none",
    zIndex: 1,
    opacity: 0.9,
  },
  "& > *": {
    position: "relative",
    zIndex: 2,
  },
}));

const HeaderTitle = styled.h1(({ $isMobile }) => ({
  margin: 0,
  fontSize: $isMobile ? 22 : "clamp(18px, 2.2vw, 26px)",
  fontWeight: 700,
  color: "var(--heading-color, #1a2e1a)",
  lineHeight: 1,
  letterSpacing: 0.2,
  whiteSpace: "nowrap",
  flexShrink: 0,
  textShadow: "0 1px 12px rgba(2, 6, 23, 0.45)",
}));

const BrandLockup = styled.div(({ $isMobile }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: $isMobile ? 8 : 10,
  minWidth: 0,
  flexShrink: 0,
}));

const BrandLogo = styled.div(({ $isMobile }) => ({
  width: $isMobile ? 30 : 34,
  height: $isMobile ? 30 : 34,
  borderRadius: 11,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#e2f5ff",
  fontSize: $isMobile ? 13 : 14,
  fontWeight: 800,
  letterSpacing: 0.4,
  border: "1px solid rgba(186, 230, 253, 0.45)",
  background:
    "radial-gradient(130% 120% at 18% 14%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.08) 48%, rgba(255,255,255,0) 72%), linear-gradient(145deg, rgba(56,189,248,0.95) 0%, rgba(14,165,233,0.86) 52%, rgba(2,132,199,0.8) 100%)",
  boxShadow: "0 8px 18px rgba(2,132,199,0.35), inset 0 1px 0 rgba(255,255,255,0.4)",
  flexShrink: 0,
}));

const HeaderActions = styled.div(({ $isMobile }) => ({
  display: "inline-flex",
  alignItems: "center",
  alignSelf: "center",
  gap: 10,
  height: $isMobile ? "100%" : "auto",
  minWidth: 0,
  marginLeft: $isMobile ? 0 : "auto",
  flexShrink: 0,
}));

const HeaderButton = styled.button({
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.06)",
  color: "var(--muted, #9ca3af)",
  padding: "8px 12px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  cursor: "pointer",
  transition: "transform 0.2s ease, background 0.2s ease, color 0.2s ease",
  "&:hover": {
    background: "rgba(255,255,255,0.12)",
    color: "var(--text-color, #e5e7eb)",
    transform: "scale(1.03)",
  },
});

const HeaderSearch = styled.input(({ $isMobile }) => ({
  width: $isMobile ? "100%" : "min(300px, 42vw)",
  minWidth: 0,
  maxWidth: $isMobile ? "100%" : DASHBOARD_LAYOUT.headerSearchWidth,
  flex: $isMobile ? 1 : "1 1 120px",
  height: 40,
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  padding: "0 14px",
  fontSize: TYPE_SCALE.meta,
  outline: "none",
  color: "var(--text-color, #e5e7eb)",
  background: "rgba(255,255,255,0.08)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  boxSizing: "border-box",
  "@media (max-width: 1180px)": {
    width: "min(240px, 36vw)",
  },
  "@media (max-width: 980px)": {
    width: "min(180px, 26vw)",
    padding: "0 10px",
  },
}));

function ProfileAvatar({ userAvatar, userName }) {
  if (userAvatar) {
    return <img src={userAvatar} alt={userName} style={{ width: 36, height: 36, borderRadius: "50%" }} />;
  }

  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        color: "#f8fafc",
        background: "linear-gradient(145deg, rgba(56,189,248,0.95), rgba(14,165,233,0.75))",
        border: "1px solid rgba(186,230,253,0.45)",
        fontSize: TYPE_SCALE.micro,
      }}
    >
      {(userName || "U").charAt(0).toUpperCase()}
    </div>
  );
}

export default function TopNavbar({
  isMobile,
  headerScrolled,
  sidebarSearch,
  onSidebarSearchChange,
  onDashboardClick,
  userAvatar,
  userName,
  mobileProfileMenuOpen,
  setMobileProfileMenuOpen,
  onSignOut,
}) {
  return (
    <MainHeader
      className={headerScrolled ? "top-glass-header is-scrolled" : "top-glass-header"}
      $isMobile={isMobile}
    >
      {isMobile && (
        <BrandLockup $isMobile={isMobile}>
          <BrandLogo $isMobile={isMobile} aria-hidden="true">WT</BrandLogo>
          <HeaderTitle $isMobile={isMobile}>WealthTracker</HeaderTitle>
        </BrandLockup>
      )}
      {!isMobile && (
        <HeaderSearch
          $isMobile={isMobile}
          value={sidebarSearch}
          onChange={(event) => onSidebarSearchChange(event.target.value)}
          placeholder="Search menus, sections, and pages"
        />
      )}
      <HeaderActions $isMobile={isMobile}>
        {!isMobile && (
          <BrandLockup $isMobile={isMobile}>
            <BrandLogo $isMobile={isMobile} aria-hidden="true">WT</BrandLogo>
            <HeaderTitle $isMobile={isMobile}>WealthTracker</HeaderTitle>
          </BrandLockup>
        )}
        {isMobile && (
          <>
            <HeaderButton className="header-action-btn" title="Dashboard" onClick={onDashboardClick}>{"\u{1F3E0}"}</HeaderButton>
            <div style={{ position: "relative" }} onClick={(event) => event.stopPropagation()}>
              <button
                className="header-avatar-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  setMobileProfileMenuOpen((prev) => !prev);
                }}
                title="Profile menu"
                aria-haspopup="menu"
                aria-expanded={mobileProfileMenuOpen}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  borderRadius: "50%",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ProfileAvatar userAvatar={userAvatar} userName={userName} />
              </button>
              {mobileProfileMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: 10,
                    background: "var(--card-bg, #fff)",
                    boxShadow: "0 12px 26px rgba(2, 6, 23, 0.2)",
                    padding: 6,
                    minWidth: 140,
                    zIndex: 80,
                  }}
                >
                  <button
                    onClick={() => {
                      setMobileProfileMenuOpen(false);
                      onSignOut();
                    }}
                    style={{
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      textAlign: "left",
                      borderRadius: 8,
                      padding: "8px 10px",
                      color: "var(--text-color, #1e293b)",
                      fontSize: TYPE_SCALE.meta,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </HeaderActions>
    </MainHeader>
  );
}
