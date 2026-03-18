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
  left: 0,
  right: 0,
  zIndex: 140,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: MOBILE_LAYOUT.topNavHeight,
  gap: $isMobile ? 16 : 12,
  padding: $isMobile ? "0 16px" : "0 24px",
  margin: "0 auto",
  maxWidth: 1180,
  width: "100%",
  boxSizing: "border-box",
  background: "transparent",
  transition: "padding 220ms ease",
  "@media (max-width: 1180px)": {
    padding: $isMobile ? "0 16px" : "0 24px",
  },
  "&.is-scrolled": {
    background: "rgba(10, 15, 25, 0.45)",
    backdropFilter: "blur(24px) saturate(1.2)",
    WebkitBackdropFilter: "blur(24px) saturate(1.2)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
}));

const HeaderTitle = styled.h1(({ $isMobile }) => ({
  margin: 0,
  fontSize: $isMobile ? 22 : "clamp(18px, 2.2vw, 26px)",
  fontWeight: 700,
  color: "rgba(255, 255, 255, 0.95)",
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
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#e2f5ff",
  fontSize: $isMobile ? 22 : 26,
  fontWeight: 800,
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
  transition: "transform 0.2s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease",
  "&:hover": {
    background: "rgba(255,255,255,0.12)",
    color: "var(--text-color, #e5e7eb)",
    transform: "scale(1.03)",
  },
});

const SignOutButton = styled.button({
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.05)",
  color: "rgba(180,200,230,0.65)",
  padding: "8px 14px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  transition: "transform 0.2s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease",
  "&:hover": {
    background: "rgba(249,115,22,0.14)",
    color: "#fca5a5",
    borderColor: "rgba(249,115,22,0.30)",
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

// Profile avatar removed per user request

export default function TopNavbar({
  isMobile,
  headerScrolled,
  onDashboardClick,
  userAvatar,
  userName,
  mobileProfileMenuOpen,
  setMobileProfileMenuOpen,
  onSignOut,
}) {
  return (
    <MainHeader
      className={headerScrolled ? "is-scrolled" : ""}
      $isMobile={isMobile}
    >
      <BrandLockup $isMobile={isMobile}>
        <BrandLogo $isMobile={isMobile} aria-hidden="true">🌿</BrandLogo>
        <HeaderTitle $isMobile={isMobile}>WealthTracker</HeaderTitle>
      </BrandLockup>
      <HeaderActions $isMobile={isMobile}>
        {isMobile && (
          <HeaderButton className="header-action-btn" title="Dashboard" onClick={onDashboardClick}>{"\u{1F3E0}"}</HeaderButton>
        )}
        <SignOutButton
          className="header-action-btn"
          title="Sign out"
          onClick={onSignOut}
          style={isMobile ? { padding: "8px", background: "transparent", border: "none" } : {}}
        >
          <span style={{ fontSize: isMobile ? 18 : 15, lineHeight: 1 }}>⎋</span>
          {!isMobile && "Sign Out"}
        </SignOutButton>
      </HeaderActions>
    </MainHeader>
  );
}
