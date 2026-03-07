import GlassCard from "../ui/GlassCard";
import { cardStyle, serifFontFamily } from "../../styles";

const TYPE_SCALE = {
  h1: 30,
  meta: 13,
  micro: 11,
};

export default function StatCard({ icon, label, value, sub, color, negative, animated = false }) {
  const content = (
    <>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: TYPE_SCALE.micro, fontWeight: 600, color: "#94a3b8", letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
        <div style={{ fontFamily: serifFontFamily, fontSize: TYPE_SCALE.h1, fontWeight: 700, color: negative ? "var(--error)" : "var(--text-color)" }}>{value}</div>
        <div style={{ fontSize: TYPE_SCALE.meta, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
      </div>
    </>
  );

  if (animated) {
    return <GlassCard style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>{content}</GlassCard>;
  }

  return (
    <div style={{ ...cardStyle, display: "flex", gap: 16, alignItems: "flex-start" }}>
      {content}
    </div>
  );
}
