import { fontFamily } from "../../styles";
import OnboardingStep1 from "./OnboardingStep1";

export default function OnboardingScreen({
  isMobile,
  hasSyncMessage,
  syncStatusText,
  syncStatusColor,
  syncStatusBg,
  syncStatusBorder,
  onStart,
}) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(135deg, #020617 0%, #0b1220 48%, #111827 100%)",
        display: "flex",
        position: "relative",
        alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "center",
        fontFamily,
        padding: isMobile ? "14px 12px 24px" : 24,
        overflowY: "auto",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          background: "var(--card-bg, #fff)",
          borderRadius: isMobile ? 16 : 24,
          padding: isMobile ? "24px 16px" : "52px 48px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.08)",
          margin: isMobile ? "8px 0 24px" : 0,
        }}
      >
        {hasSyncMessage && (
          <div
            style={{
              marginBottom: 16,
              border: `1px solid ${syncStatusBorder}`,
              borderRadius: 10,
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 600,
              background: syncStatusBg,
              color: syncStatusColor,
            }}
          >
            {syncStatusText}
          </div>
        )}
        <OnboardingStep1 onNext={onStart} />
      </div>
    </div>
  );
}
