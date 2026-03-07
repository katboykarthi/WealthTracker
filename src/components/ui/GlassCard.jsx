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
  border-radius: 18px;
  padding: 22px;
  animation: ${surfaceIn} 240ms ease;

  background: linear-gradient(135deg, rgba(30,41,59,0.65), rgba(15,23,42,0.55));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 10px 40px rgba(0,0,0,0.45), inset 0 1px rgba(255,255,255,0.05);
  position: relative;
  transition: all 0.3s ease;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(120deg, rgba(255,255,255,0.08), transparent 40%);
    pointer-events: none;
  }

  @media (hover: hover) and (pointer: fine) {
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 15px 60px rgba(0,0,0,0.5), inset 0 1px rgba(255,255,255,0.1);
    }
  }
`;

export default GlassCard;
