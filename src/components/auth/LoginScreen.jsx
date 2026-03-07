import { buttonStyles, fontFamily, serifFontFamily } from "../../styles";

export default function LoginScreen({ onLogin, busy, error, configError }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #f8fafc)",
        color: "var(--text-color, #1e293b)",
        fontFamily,
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "var(--card-bg, #fff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 18,
          padding: "34px 26px",
          textAlign: "center",
          boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 12 }}>{"\u{1F33F}"}</div>
        <h1 style={{ fontFamily: serifFontFamily, fontSize: 28, margin: "0 0 8px", color: "var(--heading-color, #1a2e1a)" }}>
          Karthick Wealth Tracker
        </h1>
        <p style={{ margin: "0 0 22px", color: "var(--muted, #64748b)", fontSize: 14, lineHeight: 1.5 }}>
          Sign in with Google to securely load and save your data from anywhere.
        </p>
        {configError ? (
          <div
            style={{
              background: "var(--danger-bg, #fff5f5)",
              border: "1px solid var(--error, #ef4444)",
              borderRadius: 12,
              padding: "12px 14px",
              color: "var(--error, #ef4444)",
              fontSize: 13,
              textAlign: "left",
            }}
          >
            {configError}
          </div>
        ) : (
          <button
            onClick={onLogin}
            disabled={busy}
            style={{
              ...buttonStyles.primary,
              width: "100%",
              opacity: busy ? 0.8 : 1,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Signing in..." : "Continue with Google"}
          </button>
        )}
        {error && !configError && (
          <div style={{ marginTop: 12, color: "var(--error, #ef4444)", fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
