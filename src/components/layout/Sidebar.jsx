import styled from "@emotion/styled";
import SidebarGlyph from "./SidebarGlyph";

const DASHBOARD_LAYOUT = {
  sidebarWidth: 260,
  sidebarPadding: 20,
};

const SidebarRail = styled.aside(({ $collapsed }) => ({
  width: $collapsed ? 84 : DASHBOARD_LAYOUT.sidebarWidth,
  background: "rgba(10, 15, 25, 0.25)",
  backdropFilter: "blur(24px) saturate(1.2)",
  WebkitBackdropFilter: "blur(24px) saturate(1.2)",
  borderRight: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  flexShrink: 0,
  overflow: "hidden", // Essential for smooth collapse
  transition: "width 350ms cubic-bezier(0.22, 1, 0.36, 1)",
  willChange: "width",
  zIndex: 100, // keep above background
}));

const SidebarTop = styled.div(({ $collapsed }) => ({
  padding: $collapsed ? "16px 12px" : `16px ${DASHBOARD_LAYOUT.sidebarPadding}px`,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  minHeight: 74,
  transition: "padding 350ms cubic-bezier(0.22, 1, 0.36, 1)",
}));

const ToggleButton = styled.button(({ $collapsed }) => ({
  width: 40,
  height: 40,
  borderRadius: 12,
  border: "1px solid transparent",
  background: "transparent",
  color: "rgba(229,231,235,0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
  transition: "background 200ms ease, color 200ms ease, transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
  transform: $collapsed ? "translateX(10px)" : "translateX(0)",
  "&:hover": {
    background: "rgba(255,255,255,0.1)",
    color: "#f8fafc",
    transform: $collapsed ? "translateX(10px) scale(1.08)" : "scale(1.08)",
  },
  "&:active": {
    transform: $collapsed ? "translateX(10px) scale(0.93)" : "scale(0.93)",
  }
}));

const SidebarNav = styled.nav({
  flex: 1,
  minHeight: 0,
  padding: `${DASHBOARD_LAYOUT.sidebarPadding}px 12px`,
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehavior: "contain",
  "&::-webkit-scrollbar": {
    width: "4px",
  },
  "&::-webkit-scrollbar-thumb": {
    background: "rgba(255,255,255,0.1)",
    borderRadius: "4px",
  },
});

const SectionBlock = styled.div({
  marginBottom: 8,
});

const MenuButton = styled.button(({ $active, $collapsed }) => ({
  width: "100%",
  border: "1px solid transparent",
  borderRadius: 12, // softer radius
  padding: $collapsed ? "14px 22px" : "12px 16px",
  background: $active ? "rgba(255,255,255,0.12)" : "transparent",
  color: $active ? "#f8fafc" : "rgba(229,231,235,0.65)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: $active ? 600 : 500,
  position: "relative",
  transition: "background 200ms ease, color 200ms ease, padding 350ms cubic-bezier(0.22, 1, 0.36, 1)",
  textShadow: $active ? "0 1px 8px rgba(0,0,0,0.5)" : "none",
  "&:hover": {
    background: "rgba(255,255,255,0.08)",
    color: "#f8fafc",
  },
  "&::before": {
    content: '""',
    position: "absolute",
    left: 4,
    top: "50%",
    transform: "translateY(-50%)",
    height: "60%",
    width: 3,
    borderRadius: 99,
    background: "linear-gradient(180deg, rgba(125,211,252,0.95) 0%, rgba(56,189,248,0.78) 100%)",
    boxShadow: "0 0 16px rgba(56,189,248,0.5)",
    opacity: $active && !$collapsed ? 1 : 0,
    transition: "opacity 200ms ease",
  },
}));

const LabelText = styled.span(({ $collapsed }) => ({
  opacity: $collapsed ? 0 : 1,
  transform: $collapsed ? "translateX(-15px)" : "translateX(0)",
  transition: "opacity 300ms cubic-bezier(0.22, 1, 0.36, 1), transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
  whiteSpace: "nowrap",
}));

const SidebarBottom = styled.div(({ $collapsed }) => ({
  borderTop: "1px solid rgba(255,255,255,0.08)",
  padding: $collapsed ? "12px" : `12px 12px ${DASHBOARD_LAYOUT.sidebarPadding}px`,
  display: "grid",
  gap: 8,
  flexShrink: 0,
  transition: "padding 350ms cubic-bezier(0.22, 1, 0.36, 1)",
}));

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
        <ToggleButton
          className="sidebar-toggle-btn"
          $collapsed={collapsed}
          onClick={onToggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <SidebarGlyph name="menu" size={20} />
        </ToggleButton>
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
                <LabelText $collapsed={collapsed}>{section.section}</LabelText>
              </MenuButton>
            </SectionBlock>
          );
        })}
      </SidebarNav>

    </SidebarRail>
  );
}
