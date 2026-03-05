// ================================================================
// LIQUID GLASS — styles/index.js
// Replace your existing src/styles/index.js with this file.
// ================================================================

// ── Shared inline styles ──────────────────────────────────────

export const buttonStyles = {
  primary: {
    background: "linear-gradient(135deg, rgba(52,211,153,0.50) 0%, rgba(16,185,129,0.35) 100%)",
    color: "#fff",
    border: "1px solid rgba(52,211,153,0.55)",
    borderRadius: 12,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 4px 16px rgba(52,211,153,0.22), inset 0 1px 0 rgba(255,255,255,0.25)",
    transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 2.2)",
  },
  secondary: {
    background: "rgba(255,255,255,0.08)",
    color: "rgba(200,220,255,0.85)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 12,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 2.2)",
  },
  danger: {
    background: "linear-gradient(135deg, rgba(248,113,113,0.50) 0%, rgba(239,68,68,0.35) 100%)",
    color: "#fff",
    border: "1px solid rgba(248,113,113,0.50)",
    borderRadius: 12,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 4px 14px rgba(239,68,68,0.20)",
    transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 2.2)",
  },
};

export const cardStyle = {
  background: "linear-gradient(145deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.02) 100%)",
  border: "1px solid rgba(255,255,255,0.13)",
  borderRadius: 18,
  padding: "20px",
  color: "rgba(230,240,255,0.92)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: "0 8px 28px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.18)",
};

export const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  fontSize: 14,
  color: "rgba(230,240,255,0.92)",
  background: "rgba(255,255,255,0.07)",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  transition: "border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease",
};

export const labelStyle = {
  display: "block",
  fontWeight: 600,
  color: "rgba(180,200,230,0.65)",
  fontSize: 13,
  marginBottom: 6,
};

export const fontFamily = "'DM Sans', sans-serif";
export const serifFontFamily = "'Playfair Display', serif";

// Hero and onboarding gradients — glass edition
export const heroGradient =
  "linear-gradient(135deg, rgba(52,211,153,0.20) 0%, rgba(16,185,129,0.10) 50%, rgba(6,78,59,0.08) 100%)";
export const onboardingGradient =
  "linear-gradient(150deg, #050c1a 0%, #0b1428 50%, #0e1a30 100%)";

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
  success:   "#34d399",
  error:     "#f87171",
  warning:   "#fbbf24",
  info:      "#60a5fa",
  primary:   "#34d399",
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
  root.style.setProperty("--sidebar-bg",  "rgba(8,12,28,0.55)");
  root.style.setProperty("--card-bg",     "rgba(255,255,255,0.06)");
  root.style.setProperty("--card-border", "rgba(255,255,255,0.14)");
  root.style.setProperty("--bg-light",    "rgba(255,255,255,0.04)");
  root.style.setProperty("--muted-bg",    "rgba(255,255,255,0.06)");
  root.style.setProperty("--danger-bg",   "rgba(239,68,68,0.12)");
  root.style.setProperty("--info-bg",     "rgba(96,165,250,0.10)");
  root.style.setProperty("--info-border", "rgba(96,165,250,0.25)");
  root.style.setProperty("--input-bg",    "rgba(255,255,255,0.07)");

  // Borders
  root.style.setProperty("--border",        "rgba(255,255,255,0.13)");
  root.style.setProperty("--input-border",  "rgba(255,255,255,0.18)");
  root.style.setProperty("--accent-border", "rgba(52,211,153,0.30)");

  // Text
  root.style.setProperty("--text-color",    "rgba(230,240,255,0.92)");
  root.style.setProperty("--heading-color", "rgba(255,255,255,0.95)");
  root.style.setProperty("--muted",         "rgba(180,200,230,0.60)");
  root.style.setProperty("--muted-light",   "rgba(180,200,230,0.40)");
  root.style.setProperty("--input-text",    "rgba(230,240,255,0.92)");
  root.style.setProperty("--label-color",   "rgba(180,200,230,0.65)");

  // Brand
  root.style.setProperty("--primary",  "#34d399");
  root.style.setProperty("--error",    "#f87171");
  root.style.setProperty("--warning",  "#fbbf24");
  root.style.setProperty("--info",     "#60a5fa");
  root.style.setProperty("--btn-bg",   "#34d399");
  root.style.setProperty("--btn-text", "#fff");

  // Accent
  root.style.setProperty("--accent-dark",   "#6ee7b7");
  root.style.setProperty("--accent-bg",     "rgba(52,211,153,0.10)");
  root.style.setProperty("--accent-border", "rgba(52,211,153,0.28)");

  // Gradients
  root.style.setProperty(
    "--hero-gradient",
    "linear-gradient(135deg, rgba(52,211,153,0.20) 0%, rgba(16,185,129,0.10) 50%, rgba(6,78,59,0.08) 100%)"
  );
}
