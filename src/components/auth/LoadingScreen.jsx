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
        color: "var(--text-color, #1e293b)",
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
        <div style={{ fontSize: 13, color: "var(--muted, #64748b)" }}>{detail}</div>
      </div>
    </div>
  );
}
