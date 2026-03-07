import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { ASSET_TYPES } from "../../constants";
import { serifFontFamily } from "../../styles";
import { formatCurrency } from "../../utils/formatCurrency";
import StatCard from "../../components/cards/StatCard";
import GlassCard from "../../components/ui/GlassCard";

export default function Wealth({ assets, currency, isMobile = false }) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const grouped = ASSET_TYPES.map((type) => ({
    ...type,
    value: assets.filter((a) => a.typeId === type.id).reduce((s, a) => s + a.value, 0),
  })).filter((g) => g.value > 0);
  const currenciesTracked = new Set(assets.map((a) => a.currency)).size;

  return (
    <div style={{ padding: isMobile ? "24px 16px" : "28px 32px", maxWidth: 980, width: "100%", boxSizing: "border-box" }}>
      <h2 style={{ fontFamily: serifFontFamily, fontSize: isMobile ? 24 : 28, color: "var(--heading-color, #1a2e1a)", marginBottom: 8 }}>Allocation</h2>
      <p style={{ color: "var(--muted, #64748b)", marginBottom: 24 }}>Understand diversification across asset classes and currencies.</p>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        <StatCard icon={"\u{1F3DB}"} label="TOTAL ASSETS" value={formatCurrency(totalAssets, currency)} sub={`${assets.length} assets`} color="#22c55e" animated />
        <StatCard icon={"\u{1F9E9}"} label="ASSET CLASSES" value={`${grouped.length}`} sub="Diversified buckets" color="#3b82f6" animated />
        <StatCard icon={"\u{1F30D}"} label="CURRENCIES" value={`${currenciesTracked || 1}`} sub="Tracked across holdings" color="#8b5cf6" animated />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <GlassCard style={{ padding: isMobile ? 18 : 22 }}>
          <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 12 }}>Allocation Mix</div>
          {grouped.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--muted, #64748b)", padding: "36px 0" }}>Add assets to view allocation.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 220}>
                <PieChart>
                  <Pie data={grouped} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={82} innerRadius={45}>
                    {grouped.map((item, i) => (
                      <Cell key={i} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v, currency)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gap: 8 }}>
                {grouped.map((item) => {
                  const pct = totalAssets > 0 ? (item.value / totalAssets) * 100 : 0;
                  return (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color }} />
                      <span style={{ flex: 1, fontSize: 13, color: "var(--muted, #64748b)" }}>{item.label}</span>
                      <span style={{ fontSize: 12, color: "var(--text-color, #1e293b)", fontWeight: 700 }}>{pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </GlassCard>

        <GlassCard style={{ padding: isMobile ? 18 : 22 }}>
          <div style={{ fontWeight: 700, color: "var(--text-color, #1e293b)", marginBottom: 12 }}>By Value</div>
          {grouped.length === 0 ? (
            <div style={{ color: "var(--muted, #64748b)", fontSize: 13 }}>No allocation data available.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {grouped
                .sort((a, b) => b.value - a.value)
                .map((item) => (
                  <div key={item.id} style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "var(--text-color, #1e293b)", fontWeight: 600 }}>{item.icon} {item.label}</span>
                      <span style={{ fontSize: 13, color: "var(--text-color, #1e293b)", fontWeight: 700 }}>{formatCurrency(item.value, currency)}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: "var(--muted-bg, #f1f5f9)" }}>
                      <div style={{ height: "100%", borderRadius: 99, background: item.color, width: `${totalAssets > 0 ? (item.value / totalAssets) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
