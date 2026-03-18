import { fontFamily } from "../../styles";

export default function LoadingScreen({ title, detail }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #f8fafc)",
        color: "rgba(255, 255, 255, 0.95)",
        fontFamily,
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--card-bg, #fff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: 16,
          padding: "28px 22px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 10 }}>{"\u{23F3}"}</div>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13, color: "rgba(255, 255, 255, 0.65)" }}>{detail}</div>
      </div>
    </div>
  );
}
