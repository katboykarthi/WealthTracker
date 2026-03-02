// Shared styles for components

export const buttonStyles = {
  primary: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  secondary: {
    background: "var(--muted-bg, #f1f5f9)",
    color: "var(--muted, #64748b)",
    border: "none",
    borderRadius: 10,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  danger: {
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 24px",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};

export const cardStyle = {
  background: "var(--card-bg, #fff)",
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 16,
  padding: "20px",
  color: "var(--text-color, #1e293b)",
};

export const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1.5px solid var(--border, #e2e8f0)",
  fontSize: 14,
  color: "var(--input-text, #1e293b)",
  background: "var(--input-bg, #fff)",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

export const labelStyle = {
  display: "block",
  fontWeight: 600,
  color: "var(--label-color, #475569)",
  fontSize: 13,
  marginBottom: 6,
};

export const fontFamily = "'DM Sans', sans-serif";
export const serifFontFamily = "'Playfair Display', serif";

// useful background gradients
export const heroGradient = "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)";
export const onboardingGradient = "linear-gradient(135deg, #f0fdf4 0%, #fff 60%, #f0f9ff 100%)";

// Dark mode colors
export const darkModeColors = {
  background: "#0f172a",
  sidebar: "#1e293b",
  text: "#e2e8f0",
  border: "#334155",
};

// Light mode colors
export const lightModeColors = {
  background: "#f8fafc",
  sidebar: "#fff",
  text: "#1e293b",
  border: "#e2e8f0",
};

// Color palette
export const colors = {
  success: "#16a34a",
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  primary: "#16a34a",
  secondary: "#64748b",
  light: "#f8fafc",
  dark: "#1e293b",
};

// Apply theme tokens as CSS variables on :root
export function applyTheme(darkMode) {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  if (!root) return;
  const dark = darkMode;
  const dm = dark ? darkModeColors : lightModeColors;

  root.style.setProperty('--bg', dm.background);
  root.style.setProperty('--sidebar-bg', dm.sidebar);
  root.style.setProperty('--text-color', dm.text);
  root.style.setProperty('--card-bg', dark ? '#071025' : '#fff');
  root.style.setProperty('--card-border', dark ? '#243244' : '#e2e8f0');
  root.style.setProperty('--btn-bg', colors.primary);
  root.style.setProperty('--btn-text', '#fff');
  // Additional tokens
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--info', colors.info);
  root.style.setProperty('--error', colors.error);
  root.style.setProperty('--warning', colors.warning);
  root.style.setProperty('--heading-color', dark ? '#c7e3c9' : '#1a2e1a');
  root.style.setProperty('--muted', dark ? '#94a3b8' : '#64748b');
  root.style.setProperty('--muted-light', dark ? '#6b7280' : '#94a3b8');
  root.style.setProperty('--border', dark ? '#243244' : '#e2e8f0');
  root.style.setProperty('--accent-dark', dark ? '#14532d' : '#14532d');
  root.style.setProperty('--accent-bg', dark ? '#063f1a' : '#f0fdf4');
  root.style.setProperty('--accent-border', dark ? '#083219' : '#bbf7d0');
  root.style.setProperty('--bg-light', dark ? '#071025' : '#f8fafc');
  root.style.setProperty('--muted-bg', dark ? '#0b1220' : '#f1f5f9');
  root.style.setProperty('--danger-bg', dark ? '#3b1a1a' : '#fff5f5');
  root.style.setProperty('--input-bg', dark ? '#071025' : '#fff');
  root.style.setProperty('--input-border', dark ? '#243244' : '#e2e8f0');
  root.style.setProperty('--input-text', dark ? '#e2e8f0' : '#1e293b');
  root.style.setProperty('--label-color', dark ? '#94a3b8' : '#475569');
  root.style.setProperty('--info-bg', dark ? '#0c1f3c' : '#eff6ff');
  root.style.setProperty('--info-border', dark ? '#1e3a5f' : '#bfdbfe');
  root.style.setProperty('--hero-gradient', dark ? 'linear-gradient(135deg, #0d2728 0%, #1a4d4f 50%, #22676a 100%)' : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)');
}

