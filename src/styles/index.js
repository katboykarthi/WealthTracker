// ================================================================
// LIQUID GLASS — styles/index.js
// Replace your existing src/styles/index.js with this file.
// ================================================================

// ── Shared inline styles ──────────────────────────────────────

export const buttonStyles = {
  primary: {
    background: "radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.05) 46%, rgba(255,255,255,0) 68%), linear-gradient(135deg, rgba(56,189,248,0.68) 0%, rgba(14,165,233,0.52) 54%, rgba(6,182,212,0.46) 100%)",
    color: "#fff",
    border: "1px solid rgba(186,230,253,0.62)",
    borderRadius: 12,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    backdropFilter: "blur(14px) saturate(1.35)",
    WebkitBackdropFilter: "blur(14px) saturate(1.35)",
    boxShadow: "0 8px 26px rgba(14,165,233,0.32), inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -1px 0 rgba(255,255,255,0.08)",
    transition: "all 420ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  secondary: {
    background: "radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.04) 48%, rgba(255,255,255,0) 70%), rgba(15,23,42,0.46)",
    color: "rgba(230,240,255,0.92)",
    border: "1px solid rgba(186,230,253,0.24)",
    borderRadius: 12,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    backdropFilter: "blur(14px) saturate(1.25)",
    WebkitBackdropFilter: "blur(14px) saturate(1.25)",
    boxShadow: "0 8px 24px rgba(8,15,32,0.22), inset 0 1px 0 rgba(255,255,255,0.2)",
    transition: "all 360ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
  danger: {
    background: "radial-gradient(120% 140% at 0% 0%, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.03) 44%, rgba(255,255,255,0) 66%), linear-gradient(135deg, rgba(251,146,60,0.64) 0%, rgba(249,115,22,0.46) 100%)",
    color: "#fff",
    border: "1px solid rgba(251,191,36,0.58)",
    borderRadius: 12,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    backdropFilter: "blur(14px) saturate(1.3)",
    WebkitBackdropFilter: "blur(14px) saturate(1.3)",
    boxShadow: "0 8px 24px rgba(249,115,22,0.28), inset 0 1px 0 rgba(255,255,255,0.3)",
    transition: "all 360ms cubic-bezier(0.22, 1, 0.36, 1)",
  },
};

export const cardStyle = {
  background: "radial-gradient(145% 125% at 0% 0%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0) 68%), linear-gradient(145deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.04) 100%), linear-gradient(135deg, rgba(56,189,248,0.08) 0%, rgba(14,165,233,0.04) 56%, rgba(8,47,73,0.03) 100%)",
  border: "1px solid rgba(186,230,253,0.24)",
  borderRadius: 18,
  padding: "20px",
  color: "rgba(230,240,255,0.92)",
  backdropFilter: "blur(24px) saturate(1.45)",
  WebkitBackdropFilter: "blur(24px) saturate(1.45)",
  boxShadow: "0 14px 40px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -1px 0 rgba(255,255,255,0.05)",
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
  root.style.setProperty("--glass-edge", "rgba(186,230,253,0.24)");
  root.style.setProperty("--glass-shadow", "0 14px 40px rgba(0,0,0,0.34)");
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
