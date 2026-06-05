/**
 * shared/ui.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * All reusable styled primitives and small components that were previously
 * scattered throughout AppPages.jsx.  Import from here instead of redefining
 * them in every page file.
 */

import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";
import { cardStyle as sharedCardStyle, serifFontFamily, heroGradient } from "../../styles";
import { useIsMobile } from "../../hooks/useWindowSize";
import LiquidGlassCard from "../LiquidGlassCard";

// ─── Design tokens ────────────────────────────────────────────────────────────

export const TYPE_SCALE = {
  h1: 30,
  h2: 18,
  body: 14,
  meta: 13,
  micro: 11,
};

export const DASHBOARD_LAYOUT = {
  pagePadding: 28,
  cardGap: 24,
  sectionGap: 32,
  sidebarWidth: 260,
  sidebarPadding: 20,
  headerHeight: 72,
  headerSearchWidth: 300,
};

export const TABLE_PAGE_LENGTH = 10;

// ─── Pagination helpers ───────────────────────────────────────────────────────

export function getTotalPages(totalRows, pageLength = TABLE_PAGE_LENGTH) {
  return Math.max(1, Math.ceil(totalRows / pageLength));
}

export function getPaginatedRows(rows, page, pageLength = TABLE_PAGE_LENGTH) {
  const start = (page - 1) * pageLength;
  return rows.slice(start, start + pageLength);
}

// ─── Animations ───────────────────────────────────────────────────────────────

export const surfaceIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0);    }
`;

export const toastIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0);   }
`;

// ─── Toast helper ─────────────────────────────────────────────────────────────

const TOAST_EVENT_NAME = "wealthtracker:toast";

export function notifyApp(message, type = "info") {
  const text = String(message || "").trim();
  if (!text) return;
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT_NAME, { detail: { message: text, type } }));
  }
}

// ─── Layout wrappers ──────────────────────────────────────────────────────────

export const PageSection = styled.div(({ $isMobile }) => ({
  padding: $isMobile ? "24px 16px" : "20px 24px",
  maxWidth: 1180,
  width: "100%",
  margin: "0 auto",
  boxSizing: "border-box",
}));

export const PageHeader = styled.div(({ $isMobile }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: $isMobile ? "flex-start" : "center",
  flexDirection: $isMobile ? "column" : "row",
  gap: $isMobile ? 12 : 0,
  marginBottom: $isMobile ? DASHBOARD_LAYOUT.cardGap : DASHBOARD_LAYOUT.sectionGap,
}));

export const PageHeaderActions = styled.div(({ $isMobile }) => ({
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  width: $isMobile ? "100%" : "auto",
}));

// Page heading + subtitle — consistent across all pages
export function PageTitle({ title, subtitle }) {
  return (
    <div>
      <h2 style={{ fontFamily: serifFontFamily, fontSize: 28, color: "rgba(255,255,255,0.95)", margin: 0 }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, margin: "4px 0 0" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

export const PrimaryButton = styled.button({
  border: "none",
  borderRadius: 10,
  background: "#16a34a",
  color: "#fff",
  padding: "9px 12px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 700,
  cursor: "pointer",
});

export const SecondaryButton = styled.button({
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 10,
  background: "var(--card-bg, #fff)",
  color: "rgba(255,255,255,0.95)",
  padding: "9px 12px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  cursor: "pointer",
});

// ─── Form controls ────────────────────────────────────────────────────────────

export const Field = styled.input({
  width: "100%",
  minHeight: 44,
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.9)",
  padding: "10px 12px",
  fontSize: TYPE_SCALE.meta,
  outline: "none",
  boxSizing: "border-box",
  lineHeight: 1.2,
});

export const Select = styled.select({
  width: "100%",
  minHeight: 44,
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 10,
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.9)",
  padding: "10px 38px 10px 12px",
  fontSize: TYPE_SCALE.meta,
  outline: "none",
  boxSizing: "border-box",
  lineHeight: 1.2,
  appearance: "none",
  WebkitAppearance: "none",
  "& option": {
    background: "#0d0d1a",
    color: "rgba(255,255,255,0.9)",
  },
});

export const Toolbar = styled.div(({ $isMobile }) => ({
  display: "grid",
  gridTemplateColumns: $isMobile ? "1fr" : "1fr 180px 180px",
  gap: 10,
  marginBottom: 14,
}));

// ─── Table ────────────────────────────────────────────────────────────────────

export const TableWrap = styled.div({
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  overflowX: "auto",
  overflowY: "hidden",
  background: "rgba(255,255,255,0.04)",
  padding: 2,
  WebkitOverflowScrolling: "touch",
});

export const DataTable = styled.table({
  width: "100%",
  minWidth: 640,
  borderCollapse: "collapse",
  tableLayout: "fixed",
});

export const TableHead = styled.th({
  padding: "8px 10px",
  textAlign: "left",
  fontSize: TYPE_SCALE.micro,
  textTransform: "uppercase",
  letterSpacing: 0.7,
  color: "rgba(255,255,255,0.65)",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
});

export const TableCell = styled.td({
  padding: "10px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  fontSize: TYPE_SCALE.body,
  color: "rgba(255,255,255,0.9)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

export const TableResultsText = styled.div({
  fontSize: TYPE_SCALE.meta,
  color: "rgba(255,255,255,0.65)",
  marginBottom: 12,
});

// ─── Pagination ───────────────────────────────────────────────────────────────

const TablePager = styled.div({
  marginTop: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
});

const TablePagerInfo = styled.div({
  fontSize: TYPE_SCALE.meta,
  color: "rgba(255,255,255,0.65)",
});

const TablePagerActions = styled.div({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
});

const TablePagerButton = styled.button(({ disabled }) => ({
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.9)",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  padding: "5px 9px",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.45 : 1,
}));

const TablePagerBadge = styled.span({
  fontSize: TYPE_SCALE.meta,
  fontWeight: 700,
  color: "rgba(255,255,255,0.65)",
  minWidth: 56,
  textAlign: "center",
});

export function DataTablePagination({ totalRows, currentPage, onPageChange, pageLength = TABLE_PAGE_LENGTH }) {
  if (totalRows <= pageLength) return null;

  const isMobile = useIsMobile();
  const totalPages = getTotalPages(totalRows, pageLength);
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (safePage - 1) * pageLength + 1;
  const end = Math.min(totalRows, safePage * pageLength);

  return (
    <TablePager style={isMobile ? { alignItems: "stretch" } : undefined}>
      <TablePagerInfo style={isMobile ? { width: "100%" } : undefined}>
        Showing {start}–{end} of {totalRows}
      </TablePagerInfo>
      <TablePagerActions style={isMobile ? { width: "100%", justifyContent: "space-between" } : undefined}>
        {!isMobile && (
          <TablePagerButton type="button" disabled={safePage <= 1} onClick={() => onPageChange(1)}>
            First
          </TablePagerButton>
        )}
        <TablePagerButton type="button" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>
          Prev
        </TablePagerButton>
        <TablePagerBadge style={isMobile ? { flex: 1, minWidth: 0 } : undefined}>
          {safePage} / {totalPages}
        </TablePagerBadge>
        <TablePagerButton type="button" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>
          Next
        </TablePagerButton>
        {!isMobile && (
          <TablePagerButton type="button" disabled={safePage >= totalPages} onClick={() => onPageChange(totalPages)}>
            Last
          </TablePagerButton>
        )}
      </TablePagerActions>
    </TablePager>
  );
}

// ─── Mobile cards ─────────────────────────────────────────────────────────────

export const MobileDataList = styled.div({ display: "grid", gap: 10 });

const MobileDataCard = styled.div({
  ...sharedCardStyle,
  padding: 14,
  display: "grid",
  gap: 12,
});

const MobileDataHeader = styled.div({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
});

const MobileDataMain = styled.div({
  minWidth: 0,
  display: "grid",
  gap: 4,
});

const MobileDataTitle = styled.div({
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1.3,
  color: "rgba(255,255,255,0.95)",
  wordBreak: "break-word",
});

const MobileDataSubtitle = styled.div({
  fontSize: TYPE_SCALE.meta,
  lineHeight: 1.4,
  color: "rgba(255,255,255,0.65)",
  wordBreak: "break-word",
});

const MobileDataBadge = styled.div({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  minHeight: 28,
  padding: "4px 9px",
  borderRadius: 999,
  border: "1px solid rgba(186,230,253,0.24)",
  background: "rgba(255,255,255,0.06)",
  fontSize: TYPE_SCALE.micro,
  fontWeight: 700,
  color: "rgba(255,255,255,0.95)",
  textAlign: "center",
});

export const MobileDataSelection = styled.label({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  width: "fit-content",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  color: "rgba(255,255,255,0.65)",
});

const MobileDataGrid = styled.div({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
});

const MobileDataItem = styled.div({ minWidth: 0 });

const MobileDataLabel = styled.div({
  marginBottom: 4,
  fontSize: TYPE_SCALE.micro,
  fontWeight: 700,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.5)",
});

const MobileDataValue = styled.div({
  fontSize: TYPE_SCALE.body,
  lineHeight: 1.4,
  fontWeight: 600,
  color: "rgba(255,255,255,0.9)",
  wordBreak: "break-word",
});

const MobileDataFooter = styled.div({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
});

const MobileDataActions = styled.div({
  display: "grid",
  width: "100%",
  gap: 8,
});

export function MobileRecordCard({ title, subtitle, badge, selected, onToggleSelect, selectLabel, fields = [], footer, actions }) {
  return (
    <MobileDataCard>
      <MobileDataHeader>
        <MobileDataMain>
          <MobileDataTitle>{title}</MobileDataTitle>
          {subtitle && <MobileDataSubtitle>{subtitle}</MobileDataSubtitle>}
        </MobileDataMain>
        {badge && <MobileDataBadge>{badge}</MobileDataBadge>}
      </MobileDataHeader>

      {typeof selected === "boolean" && onToggleSelect && (
        <MobileDataSelection>
          <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label={selectLabel} />
          <span>Select</span>
        </MobileDataSelection>
      )}

      <MobileDataGrid>
        {fields.filter(Boolean).map((field, index) => (
          <MobileDataItem
            key={`${field.label}-${index}`}
            style={field.fullWidth ? { gridColumn: "1 / -1" } : undefined}
          >
            <MobileDataLabel>{field.label}</MobileDataLabel>
            <MobileDataValue style={field.valueStyle}>{field.value}</MobileDataValue>
          </MobileDataItem>
        ))}
      </MobileDataGrid>

      {(footer || actions) && (
        <MobileDataFooter>
          {footer || <span />}
          {actions && <MobileDataActions>{actions}</MobileDataActions>}
        </MobileDataFooter>
      )}
    </MobileDataCard>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export const ModalBackdrop = styled.div({
  position: "fixed",
  inset: 0,
  zIndex: 260,
  background: "rgba(8,12,20,0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
});

export const ModalCard = styled.div(({ $maxWidth = 460 }) => ({
  position: "relative",
  isolation: "isolate",
  width: "100%",
  maxWidth: $maxWidth,
  maxHeight: "min(92dvh, 720px)",
  borderRadius: 18,
  background: "rgba(15,23,42,0.65)",
  backdropFilter: "blur(22px) saturate(1.2)",
  WebkitBackdropFilter: "blur(22px) saturate(1.2)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  color: "var(--modal-text, #e2e8f0)",
  padding: 22,
  overflowY: "auto",
  animation: `${surfaceIn} 180ms ease`,
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: "1px",
    background: "rgba(255,255,255,0.15)",
    boxShadow: "0 1px 2px rgba(255,255,255,0.05)",
  },
  "&::after": {
    content: '""',
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    background: "radial-gradient(ellipse 100% 80% at 50% 0%, rgba(255,255,255,0.06), transparent)",
    pointerEvents: "none",
  },
}));

export const ModalTitle = styled.h2({
  margin: "0 0 6px",
  fontSize: TYPE_SCALE.h2,
  color: "rgba(255,255,255,0.95)",
});

export const ModalText = styled.p({
  margin: "0 0 14px",
  fontSize: TYPE_SCALE.meta,
  color: "rgba(255,255,255,0.7)",
  lineHeight: 1.45,
});

export const ModalActions = styled.div({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 12,
});

// ─── Misc ─────────────────────────────────────────────────────────────────────

export const EmptyBlock = styled.div({
  border: "1px dashed rgba(255,255,255,0.15)",
  borderRadius: 10,
  padding: "18px 12px",
  textAlign: "center",
  color: "rgba(255,255,255,0.65)",
  fontSize: TYPE_SCALE.meta,
});

export const ToastStack = styled.div({
  position: "fixed",
  right: 12,
  bottom: 12,
  zIndex: 180,
});

export const ToastChip = styled.div(({ $type }) => ({
  minWidth: 220,
  maxWidth: 320,
  borderRadius: 10,
  border: "1px solid transparent",
  background:
    $type === "error"
      ? "rgba(220,38,38,0.92)"
      : $type === "success"
      ? "rgba(22,163,74,0.92)"
      : "rgba(15,23,42,0.9)",
  color: "#fff",
  padding: "10px 12px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  boxShadow: "0 10px 24px rgba(2,6,23,0.28)",
  animation: `${toastIn} 140ms ease`,
}));

// ─── Summary card (used on NetWorth page) ─────────────────────────────────────

export function SummaryCard({ icon, label, value, sub, color, negative }) {
  return (
    <LiquidGlassCard style={{ display: "flex", gap: 16, alignItems: "flex-start", height: "100%" }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: `${color}15`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: TYPE_SCALE.micro, fontWeight: 600, color: "#94a3b8", letterSpacing: 0.8, marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: TYPE_SCALE.h1, fontWeight: 700, color: negative ? "var(--error)" : "var(--text-color)" }}>
          {value}
        </div>
        <div style={{ fontSize: TYPE_SCALE.meta, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
      </div>
    </LiquidGlassCard>
  );
}

// ─── Delete-selected button ───────────────────────────────────────────────────
// Reused on Assets, Liabilities, Income, Expenses, Goals pages.

export function DeleteSelectedButton({ count, onDelete, isMobile, buttonStyles: btnStyle }) {
  return (
    <button
      onClick={onDelete}
      disabled={count === 0}
      style={{
        ...btnStyle,
        background: "var(--error, #f97316)",
        padding: "8px 12px",
        fontSize: 12,
        width: isMobile ? "100%" : "auto",
        opacity: count === 0 ? 0.55 : 1,
        cursor: count === 0 ? "not-allowed" : "pointer",
      }}
    >
      Delete Selected ({count})
    </button>
  );
}

// ─── Date filter pill row (Income / Expenses / Insights pages) ────────────────

export const MONEY_DATE_FILTERS = [
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "3m",         label: "3M"         },
  { key: "6m",         label: "6M"         },
  { key: "12m",        label: "12M"        },
  { key: "all",        label: "All"        },
];

export function DateFilterBar({ dateFilter, setDateFilter, selectedMonth, setSelectedMonth, monthOptions, isMobile }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1fr) minmax(220px,240px)",
      gap: 12, marginBottom: 16, alignItems: "start",
    }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {MONEY_DATE_FILTERS.map((f) => {
          const active = selectedMonth === "all" && dateFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => { setDateFilter(f.key); setSelectedMonth("all"); }}
              style={{
                padding: "6px 16px", fontSize: 13, borderRadius: 99, cursor: "pointer",
                border: active ? "1px solid rgba(56,189,248,0.6)" : "1px solid rgba(255,255,255,0.15)",
                background: active ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.06)",
                color: active ? "#38bdf8" : "rgba(255,255,255,0.7)",
                fontWeight: active ? 700 : 400,
                transition: "all 0.2s",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>
          View Month
        </div>
        <Select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </div>
    </div>
  );
}

// ─── Stat tile (used on Assets / Income / Insights) ──────────────────────────

export function StatTile({ label, value, color, icon }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.05)",
      border: `1px solid ${color}30`,
      borderRadius: 14, padding: "14px 18px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "rgba(255,255,255,0.45)", marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, color }}>{value}</div>
      </div>
    </div>
  );
}
