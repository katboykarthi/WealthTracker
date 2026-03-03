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

// -----------------------------------------------------------------------------
// Legacy theme & styles used by the root WealthTracker component (moved from
// project root index.js). Exporting them here ensures everything lives inside
// `src` so CRA build no longer complains about importing files outside of src.
// -----------------------------------------------------------------------------

export const theme = {
  colors: {
    primary: '#16a34a', // Green
    primaryLight: '#dcfce7',
    secondary: '#64748b', // Slate
    background: '#f8fafc', // Light slate
    surface: '#ffffff',
    error: '#ef4444',
    success: '#16a34a',
    warning: '#f59e0b',
    info: '#3b82f6',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
  },
  shadows: {
    card: '0px 1px 3px rgba(0,0,0,0.1), 0px 1px 2px rgba(0,0,0,0.06)',
    hover: '0px 4px 6px -1px rgba(0,0,0,0.1), 0px 2px 4px -1px rgba(0,0,0,0.06)',
  },
  borderRadius: '12px',
  spacing: (factor) => `${8 * factor}px`,
  typography: {
    fontFamily: '"DM Sans", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.25rem', fontWeight: 600 },
    h3: { fontSize: '1rem', fontWeight: 600 },
    body: { fontSize: '0.9375rem', lineHeight: 1.5 },
    caption: { fontSize: '0.8125rem', color: '#64748b' },
  }
};

export const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: 'env(safe-area-inset-left) env(safe-area-inset-right) calc(64px + env(safe-area-inset-bottom)) env(safe-area-inset-left)',
    backgroundColor: theme.colors.background,
    minHeight: '100vh',
    fontFamily: theme.typography.fontFamily,
    color: theme.colors.textPrimary,
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: `${theme.colors.border} transparent`,
    '@media (max-width: 768px)': {
      padding: '12px 12px calc(64px + env(safe-area-inset-bottom)) 12px',
    },
    '@media (max-width: 480px)': {
      padding: '8px 8px calc(60px + env(safe-area-inset-bottom)) 8px',
    }
  },
  header: {
    marginBottom: theme.spacing(2),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.primary,
    margin: 0,
    fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
  },
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
      gap: theme.spacing(1.5),
    }
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius,
    boxShadow: theme.shadows.card,
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    transition: 'box-shadow 0.3s ease',
    '@media (max-width: 600px)': {
      padding: theme.spacing(1.5),
    }
  },
  cardTitle: {
    ...theme.typography.caption,
    textTransform: 'uppercase',
    fontWeight: 600,
    marginBottom: theme.spacing(1),
    fontSize: '0.75rem',
  },
  cardValue: {
    fontSize: 'clamp(1.25rem, 5vw, 1.75rem)',
    fontWeight: 600,
    color: theme.colors.textPrimary,
  },
  tabContainer: {
    display: 'flex',
    borderBottom: `1px solid ${theme.colors.border}`,
    marginBottom: theme.spacing(2),
    overflowX: 'auto',
    gap: theme.spacing(1),
  },
  tab: (isActive) => ({
    padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: isActive ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
    color: isActive ? theme.colors.primary : theme.colors.textSecondary,
    fontWeight: 600,
    fontSize: '0.9rem',
    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    whiteSpace: 'nowrap',
    '@media (max-width: 600px)': {
      padding: `${theme.spacing(0.75)} ${theme.spacing(1.5)}`,
      fontSize: '0.8125rem',
    }
  }),
  containerContent: {
    animation: 'fadeInUp 0.4s ease-out',
    '@keyframes fadeInUp': {
      from: { opacity: 0, transform: 'translateY(10px)' },
      to: { opacity: 1, transform: 'translateY(0)' },
    },
  },
  form: {
    display: 'grid',
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius,
    boxShadow: theme.shadows.card,
  },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    fontSize: '0.9rem',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  button: {
    backgroundColor: theme.colors.primary,
    color: theme.colors.surface,
    padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.875rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    transition: 'all 0.2s ease',
    '@media (max-width: 600px)': {
      padding: `${theme.spacing(0.875)} ${theme.spacing(1.5)}`,
      fontSize: '0.8125rem',
    }
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    color: theme.colors.error,
    cursor: 'pointer',
    fontSize: '1.125rem',
    padding: theme.spacing(0.75),
    transition: 'opacity 0.2s ease',
  },
  formRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1.5),
    alignItems: 'flex-end',
    '@media (max-width: 600px)': {
      gap: theme.spacing(1),
      flexDirection: 'column',
      alignItems: 'stretch',
    }
  },
  formGroup: {
    flex: '1 1 180px',
    '@media (max-width: 600px)': {
      flex: '1 1 100%',
    }
  },
  mobileNav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 'min(64px, 10vh)',
    background: theme.colors.surface,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 100,
    paddingBottom: 'env(safe-area-inset-bottom)',
    boxShadow: theme.shadows.card,
  },
  navButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    flex: 1,
    padding: theme.spacing(1),
    color: theme.colors.textSecondary,
    fontSize: '0.75rem',
    fontFamily: 'inherit',
    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },
  navButtonActive: {
    color: theme.colors.primary,
    fontWeight: 600,
    transform: 'scale(1.1)',
  },
  quickAddWidget: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
    '@media (max-width: 600px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: theme.spacing(1),
    }
  },
  quickAddButton: {
    padding: theme.spacing(1.5),
    borderRadius: '12px',
    border: `2px solid ${theme.colors.border}`,
    background: theme.colors.surface,
    cursor: 'pointer',
    fontSize: '0.8125rem',
    fontWeight: 600,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    transition: 'all 0.2s ease',
    color: theme.colors.textPrimary,
  },
  categoryCard: {
    padding: theme.spacing(1.5),
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    marginBottom: theme.spacing(1),
  },
  categoryName: {
    fontSize: '0.9rem',
    fontWeight: 500,
    color: theme.colors.textPrimary,
  },
  categoryValue: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: theme.colors.primary,
  },
  categoryBar: {
    height: '6px',
    background: theme.colors.border,
    borderRadius: '3px',
    overflow: 'hidden',
    marginTop: theme.spacing(0.5),
  },
  categoryBarFill: {
    height: '100%',
    background: theme.colors.primary,
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  alertContainer: {
    marginBottom: theme.spacing(2),
  },
  alert: {
    padding: theme.spacing(1.5),
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
    fontSize: '0.875rem',
    border: `1px solid`,
  },
  alertSuccess: {
    background: '#f0fdf4',
    borderColor: '#bbf7d0',
    color: '#166534',
  },
  alertWarning: {
    background: '#fffbeb',
    borderColor: '#fde68a',
    color: '#92400e',
  },
  alertError: {
    background: '#fef2f2',
    borderColor: '#fecaca',
    color: '#991b1b',
  },
  exportButton: {
    display: 'flex',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
    flexWrap: 'wrap',
  },
  exportBtn: {
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
    borderRadius: '8px',
    border: 'none',
    background: theme.colors.primary,
    color: theme.colors.surface,
    cursor: 'pointer',
    fontSize: '0.8125rem',
    fontWeight: 600,
    transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    fontFamily: 'inherit',
  },
  keyframes: `
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes slideInRight {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    @keyframes slideInLeft {
      from {
        opacity: 0;
        transform: translateX(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `
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

