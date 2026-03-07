import SidebarGlyph from "./SidebarGlyph";

export default function BottomTabbar({
  isMobile,
  mobileNavTrackRef,
  mobileBubbleRef,
  mobileNavItems,
  activeMobileSection,
  setMobileNavButtonRef,
  onSelectSection,
}) {
  if (!isMobile) return null;

  return (
    <div className="mobile-fluid-nav-wrap bottom-navbar">
      <div className="mobile-fluid-nav nav-glass" ref={mobileNavTrackRef}>
        <div className="mobile-fluid-nav__bubble" ref={mobileBubbleRef} />
        {mobileNavItems.map((item) => {
          const isActive = activeMobileSection === item.section;
          return (
            <button
              key={item.section}
              type="button"
              className={`mobile-fluid-nav__item${isActive ? " is-active" : ""}`}
              ref={setMobileNavButtonRef(item.section)}
              onClick={() => onSelectSection(item.section)}
            >
              <span className="mobile-fluid-nav__icon">
                <SidebarGlyph name={item.iconKey} size={22} />
              </span>
              <span className="mobile-fluid-nav__label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
