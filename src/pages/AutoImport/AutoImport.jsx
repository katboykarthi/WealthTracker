/**
 * pages/AutoImport/AutoImport.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Settings → Auto Import page.
 * Uses the liquid-glass design system exactly as the rest of the app.
 */

import { useState } from "react";
import styled         from "@emotion/styled";
import { keyframes }  from "@emotion/react";
import {
  PageSection, PageHeader, PageTitle,
} from "../../components/shared/ui";
import { buttonStyles, inputStyle, labelStyle, cardStyle } from "../../styles";
import LiquidGlassCard from "../../components/LiquidGlassCard";

// ─── Animations ───────────────────────────────────────────────────────────────

const spin = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;
const pulse = keyframes`0%,100% { opacity: 1; } 50% { opacity: 0.5; }`;

// ─── Local styled primitives ─────────────────────────────────────────────────

const Section = styled.div({
  marginBottom: 24,
});

const SectionLabel = styled.div({
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)",
  marginBottom: 12,
});

const Row = styled.div(({ $gap = 12 }) => ({
  display: "flex",
  alignItems: "center",
  gap: $gap,
  flexWrap: "wrap",
}));

const StatusDot = styled.span(({ $color }) => ({
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: $color || "#94a3b8",
  flexShrink: 0,
  boxShadow: `0 0 6px ${$color || "#94a3b8"}80`,
}));

const StatusText = styled.span({
  fontSize: 13,
  fontWeight: 600,
  color: "rgba(255,255,255,0.85)",
});

const MetaText = styled.div({
  fontSize: 12,
  color: "rgba(255,255,255,0.45)",
  marginTop: 2,
});

const Toggle = styled.button(({ $active }) => ({
  position: "relative",
  width: 44,
  height: 24,
  borderRadius: 999,
  border: "none",
  cursor: "pointer",
  flexShrink: 0,
  background: $active
    ? "linear-gradient(135deg, #22c55e, #16a34a)"
    : "rgba(255,255,255,0.12)",
  transition: "background 0.25s",
  "&::after": {
    content: '""',
    position: "absolute",
    top: 3,
    left: $active ? "calc(100% - 21px)" : 3,
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#fff",
    transition: "left 0.25s cubic-bezier(0.22,1,0.36,1)",
    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
  },
}));

const Spinner = styled.span({
  display: "inline-block",
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.2)",
  borderTopColor: "#38bdf8",
  animation: `${spin} 0.7s linear infinite`,
  flexShrink: 0,
});

const PulsingDot = styled.span({
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#38bdf8",
  flexShrink: 0,
  animation: `${pulse} 1.4s ease-in-out infinite`,
});

const ErrorBox = styled.div({
  background: "rgba(239,68,68,0.1)",
  border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  color: "#fca5a5",
  lineHeight: 1.5,
});

const InfoBox = styled.div({
  background: "rgba(56,189,248,0.07)",
  border: "1px solid rgba(56,189,248,0.2)",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 12,
  color: "rgba(255,255,255,0.6)",
  lineHeight: 1.6,
});

const Divider = styled.div({
  height: 1,
  background: "rgba(255,255,255,0.07)",
  margin: "16px 0",
});

const StatChip = styled.div(({ $color }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 12px",
  borderRadius: 999,
  border: `1px solid ${$color}30`,
  background: `${$color}10`,
  fontSize: 12,
  fontWeight: 700,
  color: $color,
}));

const SourceCard = styled.div(({ $active }) => ({
  border: $active ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: "14px 16px",
  background: $active ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.03)",
  transition: "all 0.2s",
}));

// ─── Status helpers ───────────────────────────────────────────────────────────

function useSyncStatusProps(syncStatus) {
  switch (syncStatus) {
    case "connecting": return { dot: "#38bdf8", label: "Connecting…",    spinner: true  };
    case "syncing":    return { dot: "#38bdf8", label: "Syncing…",       spinner: true  };
    case "success":    return { dot: "#22c55e", label: "Sync complete",  spinner: false };
    case "error":      return { dot: "#ef4444", label: "Sync failed",    spinner: false };
    default:           return { dot: "#94a3b8", label: "Idle",           spinner: false };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AutoImportPage({
  authUser,
  isMobile,
  gmailConnected,
  syncStatus,
  syncError,
  lastSyncLabel,
  lastSyncSummary,
  hdfcEnabled,
  setHdfcEnabled,
  angelEnabled,
  setAngelEnabled,
  connectGmail,
  syncNow,
}) {
  const [showInfo, setShowInfo] = useState(false);
  const statusProps = useSyncStatusProps(syncStatus);
  const isBusy      = syncStatus === "connecting" || syncStatus === "syncing";

  return (
    <PageSection $isMobile={isMobile}>
      <PageHeader $isMobile={isMobile}>
        <PageTitle
          title="Auto Import"
          subtitle="Automatically sync HDFC statements and Angel One holdings from Gmail"
        />
      </PageHeader>

      {/* ── Gmail Connection Card ──────────────────────────────────────────── */}
      <LiquidGlassCard style={{ marginBottom: 16 }}>
        <Section>
          <SectionLabel>Gmail Connection</SectionLabel>

          <Row>
            {gmailConnected
              ? <StatusDot $color="#22c55e" />
              : <StatusDot $color="#94a3b8" />
            }
            <div style={{ flex: 1 }}>
              <StatusText>
                {gmailConnected ? "✓ Gmail Connected" : "Gmail Not Connected"}
              </StatusText>
              <MetaText>
                {gmailConnected
                  ? `Using ${authUser?.email || "your Google account"}`
                  : "Connect to enable automatic financial data import"}
              </MetaText>
            </div>
            {!gmailConnected && (
              <button
                onClick={connectGmail}
                disabled={isBusy || !authUser}
                style={{
                  ...buttonStyles.primary,
                  padding: "9px 16px",
                  fontSize: 13,
                  opacity: (!authUser || isBusy) ? 0.55 : 1,
                  cursor: (!authUser || isBusy) ? "not-allowed" : "pointer",
                }}
              >
                {isBusy ? <Spinner /> : "Connect Gmail"}
              </button>
            )}
          </Row>
        </Section>

        {!authUser && (
          <ErrorBox>⚠️ Sign in with Google first to enable Gmail auto-import.</ErrorBox>
        )}

        {syncError && (
          <ErrorBox style={{ marginTop: 10 }}>⚠️ {syncError}</ErrorBox>
        )}

        <InfoBox style={{ marginTop: 12 }}>
          <strong style={{ color: "rgba(255,255,255,0.75)" }}>🔒 Privacy:</strong>{" "}
          WealthTracker only reads email metadata and text. Raw emails and PDFs are
          never stored. Only extracted transactions and holdings are saved to your account.
          <br />
          <button
            onClick={() => setShowInfo((v) => !v)}
            style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontSize: 12, padding: 0, marginTop: 4 }}
          >
            {showInfo ? "Hide details ▲" : "What access is requested? ▼"}
          </button>
          {showInfo && (
            <div style={{ marginTop: 8, color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
              Scope requested: <code style={{ color: "#7dd3fc" }}>https://www.googleapis.com/auth/gmail.readonly</code>
              <br />Read-only access. WealthTracker cannot send emails, delete emails, or access other Google services.
            </div>
          )}
        </InfoBox>
      </LiquidGlassCard>

      {/* ── Sync Status Card ───────────────────────────────────────────────── */}
      <LiquidGlassCard style={{ marginBottom: 16 }}>
        <Section>
          <SectionLabel>Sync Status</SectionLabel>

          <Row $gap={10} style={{ marginBottom: 12 }}>
            {statusProps.spinner
              ? (syncStatus === "connecting" ? <Spinner /> : <PulsingDot />)
              : <StatusDot $color={statusProps.dot} />
            }
            <StatusText>{statusProps.label}</StatusText>
          </Row>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>LAST SYNC</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{lastSyncLabel}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>NEXT AUTO-SYNC</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                {gmailConnected ? "Every 24 hours" : "—"}
              </div>
            </div>
          </div>

          {lastSyncSummary && (
            <Row $gap={8} style={{ marginBottom: 14, flexWrap: "wrap" }}>
              <StatChip $color="#22c55e">💸 {lastSyncSummary.newIncome} income</StatChip>
              <StatChip $color="#ef4444">🧾 {lastSyncSummary.newExpenses} expenses</StatChip>
              <StatChip $color="#38bdf8">📈 {lastSyncSummary.newHoldings} holdings</StatChip>
            </Row>
          )}

          <button
            onClick={syncNow}
            disabled={isBusy}
            style={{
              ...buttonStyles.primary,
              width: isMobile ? "100%" : "auto",
              padding: "10px 20px",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "center",
              opacity: isBusy ? 0.6 : 1,
              cursor: isBusy ? "not-allowed" : "pointer",
            }}
          >
            {isBusy ? <><Spinner /> Syncing…</> : "⟳ Sync Now"}
          </button>
        </Section>
      </LiquidGlassCard>

      {/* ── Data Sources Card ──────────────────────────────────────────────── */}
      <LiquidGlassCard style={{ marginBottom: 16 }}>
        <SectionLabel>Data Sources</SectionLabel>

        {/* HDFC */}
        <SourceCard $active={hdfcEnabled} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ fontSize: 28, lineHeight: 1 }}>🏦</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "rgba(255,255,255,0.95)" }}>HDFC Bank</div>
                <Toggle $active={hdfcEnabled} onClick={() => setHdfcEnabled((v) => !v)} aria-label="Toggle HDFC import" />
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                Imports account statements from{" "}
                <code style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>alerts@hdfcbank.net</code>,{" "}
                <code style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>statements@hdfcbank.com</code>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {["Transactions", "Account Balance", "Income/Expense split", "Auto-categorisation"].map((tag) => (
                  <span key={tag} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </SourceCard>

        {/* Angel One */}
        <SourceCard $active={angelEnabled}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ fontSize: 28, lineHeight: 1 }}>📈</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "rgba(255,255,255,0.95)" }}>Angel One</div>
                <Toggle $active={angelEnabled} onClick={() => setAngelEnabled((v) => !v)} aria-label="Toggle Angel One import" />
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                Imports holding reports from{" "}
                <code style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>noreply@angelone.in</code>,{" "}
                <code style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>reports@angelone.in</code>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {["Stock Holdings", "Quantity & Avg Price", "Portfolio Value", "Dedup protection"].map((tag) => (
                  <span key={tag} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </SourceCard>
      </LiquidGlassCard>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <LiquidGlassCard>
        <SectionLabel>How It Works</SectionLabel>
        <div style={{ display: "grid", gap: 12 }}>
          {[
            { step: "1", icon: "🔐", title: "One-time permission", desc: "Click "Connect Gmail" — Google shows a consent screen. You grant read-only Gmail access. No extra login required since you're already signed in with Google." },
            { step: "2", icon: "📧", title: "Automatic email scanning", desc: "WealthTracker searches your Gmail for HDFC statements and Angel One reports using Gmail API. Only matching emails are read." },
            { step: "3", icon: "⚙️", title: "Smart parsing & categorisation", desc: "Transactions are extracted, categorised (Salary, Food, Shopping, Bills, Fuel, Transfer…), and deduplicated so nothing is imported twice." },
            { step: "4", icon: "🔄", title: "Syncs every 24 hours", desc: "Once connected, your data stays current automatically. Use "Sync Now" to trigger an immediate update any time." },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.55 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </LiquidGlassCard>
    </PageSection>
  );
}
