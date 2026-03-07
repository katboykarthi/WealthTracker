import styled from "@emotion/styled";
import SidebarGlyph from "./SidebarGlyph";

const DASHBOARD_LAYOUT = {
  sidebarWidth: 260,
  sidebarPadding: 20,
};

const SidebarRail = styled.aside(({ $collapsed }) => ({
  width: $collapsed ? 84 : DASHBOARD_LAYOUT.sidebarWidth,
  background: "var(--sidebar-bg, #ffffff)",
  borderRight: "1px solid var(--border, #e2e8f0)",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  flexShrink: 0,
  overflow: "hidden",
  transition: "width 260ms cubic-bezier(0.22, 1, 0.36, 1)",
  willChange: "width",
}));

const SidebarTop = styled.div(({ $collapsed }) => ({
  padding: $collapsed ? "16px 12px" : `${DASHBOARD_LAYOUT.sidebarPadding}px`,
  borderBottom: "1px solid var(--border, #e2e8f0)",
  display: "grid",
  gap: 14,
  flexShrink: 0,
}));

const ProfileCard = styled.div(({ $collapsed }) => ({
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 14,
  padding: $collapsed ? "10px 8px" : "10px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: $collapsed ? "center" : "flex-start",
  gap: $collapsed ? 0 : 10,
  cursor: "pointer",
}));

const ProfileAvatar = styled.img({
  width: 38,
  height: 38,
  borderRadius: "50%",
  objectFit: "cover",
  border: "1px solid rgba(255,255,255,0.22)",
  flexShrink: 0,
});

const ProfileFallback = styled.div({
  width: 38,
  height: 38,
  borderRadius: "50%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  color: "#f8fafc",
  background: "linear-gradient(145deg, rgba(56,189,248,0.95), rgba(14,165,233,0.75))",
  border: "1px solid rgba(186,230,253,0.45)",
  flexShrink: 0,
});

const ProfileName = styled.div({
  fontWeight: 700,
  color: "var(--text-color, #1e293b)",
  fontSize: 13,
  maxWidth: 150,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const ProfileMeta = styled.div({
  fontSize: 11,
  color: "var(--muted, #64748b)",
});

const SidebarNav = styled.nav({
  flex: 1,
  minHeight: 0,
  padding: `${DASHBOARD_LAYOUT.sidebarPadding}px 12px`,
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehavior: "contain",
});

const SectionBlock = styled.div({
  marginBottom: 10,
});

const MenuButton = styled.button(({ $active, $collapsed }) => ({
  width: "100%",
  border: "1px solid transparent",
  borderRadius: 10,
  marginBottom: 6,
  padding: $collapsed ? "12px 10px" : "12px 16px",
  background: $active ? "rgba(255,255,255,0.12)" : "transparent",
  color: $active ? "var(--text-color, #e5e7eb)" : "var(--muted, #9ca3af)",
  display: "flex",
  alignItems: "center",
  justifyContent: $collapsed ? "center" : "flex-start",
  gap: 10,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: $active ? 600 : 500,
  position: "relative",
  transition: "background 200ms ease, color 200ms ease, border-color 200ms ease",
  "&:hover": {
    background: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.1)",
    color: "var(--text-color, #e5e7eb)",
  },
  "&::before": {
    content: '""',
    position: "absolute",
    left: 6,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 99,
    background: "linear-gradient(180deg, rgba(125,211,252,0.95) 0%, rgba(56,189,248,0.78) 100%)",
    boxShadow: "0 0 16px rgba(56,189,248,0.5)",
    opacity: $active && !$collapsed ? 1 : 0,
    transition: "opacity 200ms ease",
  },
}));

const SidebarBottom = styled.div({
  borderTop: "1px solid var(--border, #e2e8f0)",
  padding: `12px 12px ${DASHBOARD_LAYOUT.sidebarPadding}px`,
  display: "grid",
  gap: 8,
  flexShrink: 0,
});

export default function Sidebar({
  collapsed,
  userAvatar,
  userName,
  visibleSections,
  activeSection,
  onToggleCollapsed,
  onNavigateSection,
  onSignOut,
}) {
  return (
    <SidebarRail $collapsed={collapsed}>
      <SidebarTop $collapsed={collapsed}>
        <ProfileCard
          $collapsed={collapsed}
          style={{ minWidth: 0 }}
          onClick={onToggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {userAvatar ? (
            <ProfileAvatar src={userAvatar} alt={userName} />
          ) : (
            <ProfileFallback>{(userName || "U").charAt(0).toUpperCase()}</ProfileFallback>
          )}
          {!collapsed && (
            <div>
              <ProfileName>{userName}</ProfileName>
              <ProfileMeta>Personal workspace</ProfileMeta>
            </div>
          )}
        </ProfileCard>
      </SidebarTop>

      <SidebarNav>
        {visibleSections.map((section) => {
          const isActiveSection = section.section === activeSection;
          const sectionIconName = section.section.toLowerCase();

          return (
            <SectionBlock key={section.section}>
              <MenuButton
                className="sidebar-menu-btn"
                $active={isActiveSection}
                $collapsed={collapsed}
                onClick={() => onNavigateSection(section)}
                title={section.section}
              >
                <SidebarGlyph name={sectionIconName} />
                {!collapsed && <span>{section.section}</span>}
              </MenuButton>
            </SectionBlock>
          );
        })}
      </SidebarNav>

      <SidebarBottom>
        <MenuButton
          className="sidebar-menu-btn"
          $active={false}
          $collapsed={collapsed}
          onClick={onSignOut}
          title="Sign out"
        >
          <SidebarGlyph name="logout" />
          {!collapsed && <span>Sign Out</span>}
        </MenuButton>
      </SidebarBottom>
    </SidebarRail>
  );
}
