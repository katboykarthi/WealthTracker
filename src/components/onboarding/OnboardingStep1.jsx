import { buttonStyles, serifFontFamily } from "../../styles";

const btnStyle = buttonStyles.primary;

export default function OnboardingStep1({ onNext }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>{"\u{1F33F}"}</div>
      <h1 style={{ fontFamily: serifFontFamily, fontSize: 32, color: "rgba(255, 255, 255, 0.95)", marginBottom: 8 }}>
        Welcome to Karthick Wealth-tracker
      </h1>
      <p style={{ color: "rgba(255, 255, 255, 0.65)", fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
        Your <strong>privacy-first</strong> net worth tracker. No broker connections, no third-party tracking.{" "}
        <em>Just you and your data.</em>
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 40 }}>
        {[
          "\u{1F512} Private & Secure",
          "\u{1F1EE}\u{1F1F3} INR Focused",
          "\u{1F4CA} Track Everything",
        ].map((feature) => (
          <span
            key={feature}
            style={{
              background: "var(--accent-bg, #f0fdf4)",
              border: "1px solid var(--accent-border, #bbf7d0)",
              color: "var(--primary, #16a34a)",
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {feature}
          </span>
        ))}
      </div>
      <button onClick={onNext} style={btnStyle}>
        Get Started
      </button>
    </div>
  );
}
