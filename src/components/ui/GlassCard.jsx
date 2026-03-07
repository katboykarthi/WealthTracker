import styled from "@emotion/styled";
import { keyframes } from "@emotion/react";

const surfaceIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const GlassCard = styled.div`
  border-radius: var(--window-glass-radius, 20px);
  padding: 22px;
  animation: ${surfaceIn} 240ms ease;

  background:
    radial-gradient(145% 125% at 0% 0%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 52%, rgba(255,255,255,0) 68%),
    linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%),
    linear-gradient(180deg, var(--window-glass-surface-bg, rgba(128, 128, 128, 0.062745)) 0%, rgba(96,96,96,0.12) 100%);
  backdrop-filter: blur(calc(var(--window-glass-blur, 15px) + 3px)) saturate(1.08);
  -webkit-backdrop-filter: blur(calc(var(--window-glass-blur, 15px) + 3px)) saturate(1.08);
  border: 1px solid rgba(128,128,128,0.32);
  box-shadow: 0 18px 48px rgba(0,0,0,0.40), inset 0 1px rgba(255,255,255,0.16);
  position: relative;
  transition: all 0.3s ease;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(120deg, rgba(255,255,255,0.12), transparent 44%);
    pointer-events: none;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 24px 60px rgba(0,0,0,0.46), inset 0 1px rgba(255,255,255,0.2);
    }
  }
`;

export default GlassCard;
