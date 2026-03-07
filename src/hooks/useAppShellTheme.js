import { useEffect } from "react";
import { css } from "@emotion/react";
import { applyTheme } from "../styles";

const BG_COLOR = "#020617";
const TEXT_COLOR = "var(--text-color, #e2e8f0)";

export const auroraStyles = css`
  body::after {
    content: "";
    position: fixed;
    width: 800px;
    height: 800px;
    background: radial-gradient(circle, rgba(16,185,129,0.25), transparent 60%);
    top: -200px;
    left: -200px;
    filter: blur(120px);
    animation: auroraMove 18s infinite alternate ease-in-out;
    pointer-events: none;
    z-index: -1;
  }
  @keyframes auroraMove {
    0% { transform: translate(0px,0px); }
    100% { transform: translate(300px,200px); }
  }
`;

export function useAppShellTheme(phase) {
  useEffect(() => {
    applyTheme(true);
    const html = document.documentElement;
    const rootEl = document.getElementById("root");

    if (phase === "app") {
      html.style.height = "100%";
      html.style.overflow = "hidden";
      html.style.overscrollBehavior = "none";

      document.body.style.height = "100%";
      document.body.style.margin = "0";
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";

      if (rootEl) {
        rootEl.style.height = "100%";
        rootEl.style.overflow = "hidden";
        rootEl.style.overscrollBehavior = "none";
      }
    } else {
      html.style.height = "";
      html.style.overflow = "";
      html.style.overscrollBehavior = "";

      document.body.style.height = "";
      document.body.style.margin = "0";
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";

      if (rootEl) {
        rootEl.style.height = "";
        rootEl.style.overflow = "";
        rootEl.style.overscrollBehavior = "";
      }
    }

    document.body.style.background = BG_COLOR;
    document.body.style.color = TEXT_COLOR;
  }, [phase]);
}
