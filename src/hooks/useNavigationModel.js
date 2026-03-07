import { useMemo, useRef, useEffect, useCallback } from "react";
import { gsap } from "gsap";
import { NAV_ITEMS } from "../constants/navigation";

const MOBILE_NAV_COLORS = ["#38bdf8", "#22d3ee", "#0ea5e9", "#7dd3fc", "#0284c7", "#14b8a6"];

export function useNavigationModel({
  activeNav,
  setActiveNav,
  sidebarSearch,
  sectionSelection,
  setSectionSelection,
  isMobile,
}) {
  const mobileNavTrackRef = useRef(null);
  const mobileBubbleRef = useRef(null);
  const mobileNavButtonRefs = useRef({});
  const mobileBubbleReadyRef = useRef(false);

  const navSections = useMemo(
    () =>
      NAV_ITEMS
        .filter((section) => section.section.toLowerCase() !== "data")
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => item.id !== "settings"),
        }))
        .filter((section) => section.items.length > 0),
    []
  );

  const activeSectionData = useMemo(
    () => navSections.find((section) => section.items.some((item) => item.id === activeNav)) || null,
    [navSections, activeNav]
  );

  const activeSection = activeSectionData?.section || null;
  const activeSectionItems = activeSectionData?.items || [];
  const activeSectionTabIndex = Math.max(
    0,
    activeSectionItems.findIndex((item) => item.id === activeNav)
  );
  const validNavIds = useMemo(() => navSections.flatMap((section) => section.items.map((item) => item.id)), [navSections]);

  const normalizedNavSearch = sidebarSearch.trim().toLowerCase();
  const visibleSections = navSections.filter((section) => {
    if (!normalizedNavSearch) return true;
    return (
      section.section.toLowerCase().includes(normalizedNavSearch) ||
      section.items.some(
        (item) =>
          item.label.toLowerCase().includes(normalizedNavSearch) ||
          item.id.toLowerCase().includes(normalizedNavSearch)
      )
    );
  });

  const mobileNavItems = useMemo(
    () =>
      navSections.map((section) => ({
        section: section.section,
        label: section.section,
        iconKey: section.section.toLowerCase(),
      })),
    [navSections]
  );

  const activeMobileSection = activeSection || mobileNavItems[0]?.section || null;
  const mobileNavColorBySection = useMemo(
    () =>
      mobileNavItems.reduce((acc, item, index) => {
        acc[item.section] = MOBILE_NAV_COLORS[index % MOBILE_NAV_COLORS.length];
        return acc;
      }, {}),
    [mobileNavItems]
  );

  const setMobileNavButtonRef = useCallback(
    (section) => (node) => {
      if (node) {
        mobileNavButtonRefs.current[section] = node;
        return;
      }
      delete mobileNavButtonRefs.current[section];
    },
    []
  );

  const moveMobileNavBubble = useCallback(
    (section, immediate = false) => {
      const navTrack = mobileNavTrackRef.current;
      const bubble = mobileBubbleRef.current;
      const targetButton = section ? mobileNavButtonRefs.current[section] : null;
      if (!isMobile || !navTrack || !bubble || !targetButton) return;

      const trackRect = navTrack.getBoundingClientRect();
      const buttonRect = targetButton.getBoundingClientRect();
      const x = buttonRect.left - trackRect.left;
      const targetWidth = buttonRect.width;

      gsap.to(bubble, {
        duration: immediate ? 0 : 0.38,
        x,
        width: targetWidth,
        backgroundColor: mobileNavColorBySection[section] || "var(--primary, #16a34a)",
        ease: immediate ? "none" : "power3.out",
        overwrite: "auto",
      });

      if (!immediate) {
        gsap.fromTo(
          targetButton,
          { y: 3, scale: 0.96 },
          { duration: 0.28, y: 0, scale: 1, ease: "power2.out", clearProps: "transform" }
        );
      }
    },
    [isMobile, mobileNavColorBySection]
  );

  const getSectionTargetNav = useCallback(
    (section) => {
      if (!section?.items?.length) return null;
      const rememberedNav = sectionSelection[section.section];
      if (rememberedNav && section.items.some((item) => item.id === rememberedNav)) {
        return rememberedNav;
      }
      return section.items[0]?.id || null;
    },
    [sectionSelection]
  );

  const navigateToSection = useCallback(
    (section) => {
      const nextNav = getSectionTargetNav(section);
      if (!nextNav) return;
      setActiveNav(nextNav);
    },
    [getSectionTargetNav, setActiveNav]
  );

  useEffect(() => {
    if (!activeSection) return;
    setSectionSelection((prev) => {
      if (prev[activeSection] === activeNav) return prev;
      return { ...prev, [activeSection]: activeNav };
    });
  }, [activeSection, activeNav, setSectionSelection]);

  useEffect(() => {
    if (validNavIds.length === 0) return;
    if (!validNavIds.includes(activeNav)) {
      setActiveNav(validNavIds[0]);
    }
  }, [activeNav, validNavIds, setActiveNav]);

  useEffect(() => {
    if (!isMobile || !activeMobileSection) {
      mobileBubbleReadyRef.current = false;
      return undefined;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      moveMobileNavBubble(activeMobileSection, !mobileBubbleReadyRef.current);
      mobileBubbleReadyRef.current = true;
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isMobile, activeMobileSection, moveMobileNavBubble]);

  useEffect(() => {
    if (!isMobile || !activeMobileSection) return undefined;

    const handleResize = () => {
      moveMobileNavBubble(activeMobileSection, true);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobile, activeMobileSection, moveMobileNavBubble]);

  return {
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
  };
}
