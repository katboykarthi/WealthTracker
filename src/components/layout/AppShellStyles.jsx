import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";

const TYPE_SCALE = {
  meta: 13,
};

const APP_FONT_STACK = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

const toastIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export const AppShell = styled.div(({ $isMobile }) => ({
  display: "flex",
  height: "100dvh",
  overflow: "hidden",
  position: "relative",
  fontFamily: APP_FONT_STACK,
  background: "transparent",
  color: "rgba(255, 255, 255, 0.95)",
  flexDirection: $isMobile ? "column" : "row",
}));

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
  background: $type === "error" ? "rgba(220, 38, 38, 0.92)" : $type === "success" ? "rgba(22, 163, 74, 0.92)" : "rgba(15, 23, 42, 0.9)",
  color: "#fff",
  padding: "10px 12px",
  fontSize: TYPE_SCALE.meta,
  fontWeight: 600,
  boxShadow: "0 10px 24px rgba(2, 6, 23, 0.28)",
  animation: `${toastIn} 140ms ease`,
}));
