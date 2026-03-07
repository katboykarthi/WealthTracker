// ================================================================
// LIQUID GLASS — styles/index.js
// Replace your existing src/styles/index.js with this file.
// ================================================================

// ── Shared inline styles ──────────────────────────────────────
const windowGlassSurface =
  "radial-gradient(145% 125% at 0% 0%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 52%, rgba(255,255,255,0) 68%), linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%), linear-gradient(180deg, var(--window-glass-surface-bg, rgba(128, 128, 128, 0.062745)) 0%, rgba(96,96,96,0.12) 100%)";
const windowGlassAccentSurface =
  "radial-gradient(140% 140% at 0% 0%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 44%, rgba(255,255,255,0) 70%), linear-gradient(135deg, rgba(56,189,248,0.34) 0%, rgba(14,165,233,0.24) 52%, rgba(6,182,212,0.18) 100%), linear-gradient(180deg, var(--window-glass-surface-bg, rgba(128, 128, 128, 0.062745)) 0%, rgba(96,96,96,0.12) 100%)";
const windowGlassDangerSurface =
  "radial-gradient(140% 140% at 0% 0%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 44%, rgba(255,255,255,0) 70%), linear-gradient(135deg, rgba(251,146,60,0.26) 0%, rgba(249,115,22,0.2) 100%), linear-gradient(180deg, var(--window-glass-surface-bg, rgba(128, 128, 128, 0.062745)) 0%, rgba(96,96,96,0.12) 100%)";
const windowGlassBorder = "1px solid rgba(128,128,128,0.32)";
const windowGlassRadius = "var(--window-glass-radius, 20px)";
const windowGlassButtonRadius = "calc(var(--window-glass-radius, 20px) - 4px)";
const windowGlassBlur = "blur(var(--window-glass-blur, 15px)) saturate(1.08)";
const windowGlassButtonBlur = "blur(calc(var(--window-glass-blur, 15px) - 2px)) saturate(1.12)";
const windowGlassPanelShadow = "0 18px 48px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.16)";

export const buttonStyles = {
  primary: {
    background: windowGlassAccentSurface,
    color: "#fff",
    border: windowGlassBorder,
    borderRadius: windowGlassButtonRadius,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    backdropFilter: windowGlassButtonBlur,
    WebkitBackdropFilter: windowGlassButtonBlur,
    boxShadow: "0 10px 26px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.22)",
    transition: "all 420ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  secondary: {
    background: windowGlassSurface,
    color: "rgba(230,240,255,0.92)",
    border: windowGlassBorder,
    borderRadius: windowGlassButtonRadius,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    backdropFilter: windowGlassButtonBlur,
    WebkitBackdropFilter: windowGlassButtonBlur,
    boxShadow: "0 10px 24px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.16)",
    transition: "all 360ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  danger: {
    background: windowGlassDangerSurface,
    color: "#fff",
    border: windowGlassBorder,
    borderRadius: windowGlassButtonRadius,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    backdropFilter: windowGlassButtonBlur,
    WebkitBackdropFilter: windowGlassButtonBlur,
    boxShadow: "0 10px 24px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
    transition: "all 360ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
};

export const cardStyle = {
  background: windowGlassSurface,
  border: windowGlassBorder,
  borderRadius: windowGlassRadius,
  padding: "20px",
  color: "rgba(230,240,255,0.92)",
  backdropFilter: windowGlassBlur,
  WebkitBackdropFilter: windowGlassBlur,
  boxShadow: windowGlassPanelShadow,
};

export const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(186,230,253,0.2)",
  fontSize: 14,
  color: "rgba(230,240,255,0.92)",
  background: "radial-gradient(130% 150% at 0% 0%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 54%, rgba(255,255,255,0) 72%), rgba(255,255,255,0.07)",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  backdropFilter: "blur(12px) saturate(1.2)",
  WebkitBackdropFilter: "blur(12px) saturate(1.2)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)",
  transition: "border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease",
};

export const labelStyle = {
  display: "block",
  fontWeight: 600,
  color: "rgba(180,200,230,0.65)",
  fontSize: 13,
  marginBottom: 6,
};

export const fontFamily = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
export const serifFontFamily = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

// Hero and onboarding gradients — glass edition
export const heroGradient =
  "linear-gradient(135deg, rgba(56,189,248,0.28) 0%, rgba(14,165,233,0.16) 52%, rgba(8,47,73,0.08) 100%)";
export const onboardingGradient =
  "linear-gradient(150deg, #040a17 0%, #091224 48%, #0c1730 100%)";

// ── Theme color sets ──────────────────────────────────────────

// These are kept for reference but applyTheme now sets glass values
export const darkModeColors = {
  background: "transparent",
  sidebar:    "rgba(8,12,28,0.55)",
  text:       "rgba(230,240,255,0.92)",
  border:     "rgba(255,255,255,0.13)",
};

export const lightModeColors = {
  background: "transparent",
  sidebar:    "rgba(255,255,255,0.08)",
  text:       "rgba(230,240,255,0.92)",
  border:     "rgba(255,255,255,0.13)",
};

export const colors = {
  success:   "#22c55e",
  error:     "#f97316",
  warning:   "#fbbf24",
  info:      "#60a5fa",
  primary:   "#38bdf8",
  secondary: "rgba(180,200,230,0.60)",
  light:     "rgba(255,255,255,0.08)",
  dark:      "rgba(8,12,28,0.55)",
};

// ── applyTheme — sets ALL CSS vars to glass values ────────────
export function applyTheme(/* darkMode param ignored; always glass */) {
  const root = typeof document !== "undefined" ? document.documentElement : null;
  if (!root) return;

  // Page & layout
  root.style.setProperty("--bg",          "transparent");
  root.style.setProperty("--sidebar-bg",  "rgba(10,15,25,0.55)");
  root.style.setProperty("--card-bg",     "rgba(255,255,255,0.06)");
  root.style.setProperty("--card-border", "rgba(255,255,255,0.12)");
  root.style.setProperty("--bg-light",    "rgba(255,255,255,0.04)");
  root.style.setProperty("--muted-bg",    "rgba(255,255,255,0.06)");
  root.style.setProperty("--danger-bg",   "rgba(249,115,22,0.14)");
  root.style.setProperty("--info-bg",     "rgba(96,165,250,0.10)");
  root.style.setProperty("--info-border", "rgba(96,165,250,0.25)");
  root.style.setProperty("--input-bg",    "rgba(255,255,255,0.08)");
  root.style.setProperty("--modal-bg",    "#0b1220");
  root.style.setProperty("--modal-border","rgba(148,163,184,0.34)");
  root.style.setProperty("--modal-text",  "rgba(230,240,255,0.94)");
  root.style.setProperty("--modal-muted", "rgba(180,200,230,0.72)");
  root.style.setProperty("--modal-backdrop", "rgba(2,6,23,0.72)");

  // Borders
  root.style.setProperty("--border",        "rgba(255,255,255,0.12)");
  root.style.setProperty("--input-border",  "rgba(255,255,255,0.12)");
  root.style.setProperty("--accent-border", "rgba(56,189,248,0.30)");

  // Text
  root.style.setProperty("--text-color",    "#E5E7EB");
  root.style.setProperty("--heading-color", "#E5E7EB");
  root.style.setProperty("--muted",         "#9CA3AF");
  root.style.setProperty("--muted-light",   "rgba(156,163,175,0.72)");
  root.style.setProperty("--input-text",    "rgba(230,240,255,0.92)");
  root.style.setProperty("--label-color",   "#9CA3AF");

  // Brand
  root.style.setProperty("--primary",  "#38bdf8");
  root.style.setProperty("--error",    "#f97316");
  root.style.setProperty("--warning",  "#fbbf24");
  root.style.setProperty("--info",     "#60a5fa");
  root.style.setProperty("--btn-bg",   "#38bdf8");
  root.style.setProperty("--btn-text", "#fff");

  // Accent
  root.style.setProperty("--accent-dark",   "#7dd3fc");
  root.style.setProperty("--accent-bg",     "rgba(56,189,248,0.16)");
  root.style.setProperty("--accent-border", "rgba(56,189,248,0.32)");

  // Liquid glass tokens
  root.style.setProperty("--glass-edge", "rgba(128,128,128,0.32)");
  root.style.setProperty("--glass-shadow", "0 18px 48px rgba(0,0,0,0.4)");
  root.style.setProperty("--glass-inset", "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(255,255,255,0.05)");
  root.style.setProperty("--motion-fluid", "cubic-bezier(0.22, 1, 0.36, 1)");
  root.style.setProperty("--liquid-cyan", "rgba(56,189,248,0.22)");
  root.style.setProperty("--liquid-blue", "rgba(14,165,233,0.16)");
  root.style.setProperty("--liquid-noise", "rgba(255,255,255,0.045)");

  // Gradients
  root.style.setProperty(
    "--hero-gradient",
    "linear-gradient(135deg, rgba(56,189,248,0.28) 0%, rgba(14,165,233,0.16) 52%, rgba(8,47,73,0.08) 100%)"
  );
}
