export default function SidebarGlyph({ name, size = 16 }) {
  const map = {
    overview: "\u{1F4CA}",
    wealth: "\u{1F3DB}",
    plan: "\u{1F3AF}",
    money: "\u{1F4B0}",
    dashboard: "\u{1F3E0}",
    assets: "\u{1F4C8}",
    liabilities: "\u{1F4B3}",
    networth: "\u{1F4C9}",
    goals: "\u{1F3AF}",
    allocation: "\u{1F9E9}",
    income: "\u{1F4E5}",
    expenses: "\u{1F4E4}",
    insights: "\u{1F4A1}",
    settings: "\u2699\uFE0F",
    logout: "\u{1F6AA}",
    menu: "\u2630",
  };

  const icon = map[String(name || "").toLowerCase()] || "\u2022";

  return (
    <span
      aria-hidden="true"
      style={{
        width: size + 8,
        height: size + 8,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size,
        lineHeight: 1,
      }}
    >
      {icon}
    </span>
  );
}
