import { serifFontFamily } from "../../styles";
import { formatCurrency } from "../../utils/formatCurrency";
import StatCard from "../../components/cards/StatCard";
import GlassCard from "../../components/ui/GlassCard";

export default function Plan({ assets, liabilities, currency, isMobile = false }) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth = totalAssets - totalLiabilities;
  const debtRatio = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;

  const insights = [
    ...(debtRatio > 40 ? [{ icon: "\u26A0\uFE0F", color: "#f59e0b", title: "High Debt Ratio", desc: `Your debt ratio is ${debtRatio.toFixed(1)}%. Aim to keep it below 40% for financial health.` }] : []),
    ...(assets.length === 0 ? [{ icon: "\u{1F4CA}", color: "#3b82f6", title: "Start Tracking", desc: "Add your first asset to start building your financial picture." }] : []),
    ...(assets.length > 0 ? [{ icon: "\u2705", color: "#22c55e", title: "Tracking Active", desc: `You're tracking ${assets.length} asset${assets.length > 1 ? "s" : ""} worth ${formatCurrency(totalAssets, currency)}.` }] : []),
    ...(debtRatio < 20 && assets.length > 0 ? [{ icon: "\u{1F389}", color: "#16a34a", title: "Healthy Finances", desc: "Your debt ratio is excellent. Keep building your asset base!" }] : []),
    { icon: "\u{1F4A1}", color: "#8b5cf6", title: "Diversification Tip", desc: "Consider spreading investments across stocks, real estate, and fixed income for stability." },
    { icon: "\u{1F4F8}", color: "var(--muted, #64748b)", title: "Take Regular Snapshots", desc: "Monthly net worth snapshots help you see your wealth trajectory over time." },
  ];

  return (
    <div style={{ padding: isMobile ? "24px 16px" : "28px 32px", maxWidth: 900, width: "100%", boxSizing: "border-box" }}>
      <h2 style={{ fontFamily: serifFontFamily, fontSize: isMobile ? 24 : 28, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>Insights</h2>
      <p style={{ color: "var(--muted, #64748b)", marginBottom: 24 }}>Smart observations about your financial health</p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <StatCard
          icon={"\u2728"}
          label="NET WORTH"
          value={formatCurrency(netWorth, currency)}
          sub="Assets minus Liabilities"
          color="#3b82f6"
          animated
        />
        <StatCard
          icon={"\u2696\uFE0F"}
          label="DEBT RATIO"
          value={`${debtRatio.toFixed(1)}%`}
          sub={debtRatio < 20 ? "Excellent" : debtRatio < 40 ? "Good" : debtRatio < 60 ? "Moderate" : "High"}
          color={debtRatio < 30 ? "#16a34a" : "#ef4444"}
          animated
        />
      </div>

      <div style={{ display: "grid", gap: isMobile ? 12 : 14 }}>
        {insights.map((ins, i) => (
          <GlassCard key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", animationDelay: `${Math.min(i, 8) * 40}ms`, animationFillMode: "both", padding: isMobile ? 18 : 22 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${ins.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{ins.icon}</div>
            <div>
              <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 4 }}>{ins.title}</div>
              <div style={{ color: "var(--muted, #64748b)", fontSize: 14, lineHeight: 1.5 }}>{ins.desc}</div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
