import React from "react";
import { useTilt } from "../hooks/useTilt";

export default function LiquidGlassCard({ children, style, className = "", maxTilt = 5, disableTilt = false }) {
  const { ref, onMouseMove, onMouseLeave } = useTilt(maxTilt);
  const tiltEnabled = !disableTilt && maxTilt > 0;

  return (
    <>
      <style>{`
        .tilt-scene { 
          perspective: 800px; 
          width: 100%;
          height: 100%;
        }
        .lg-card {
          box-sizing: border-box;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 0.7s cubic-bezier(0.23,1,0.32,1);
          border-radius: 24px;
          /* backdrop-filter: brightness(1.12) blur(2px); */
          -webkit-/* backdrop-filter: brightness(1.12) blur(2px); */
          filter: drop-shadow(-8px -10px 46px rgba(0,0,0,0.37));
          background: rgba(255,255,255,0.07);
        }
        .lg-card::before {
          content: ''; position: absolute; inset: 0;
          border-radius: 24px; pointer-events: none; z-index: 0;
          box-shadow:
            inset 6px 6px 0px -6px rgba(255,255,255,0.70),
            inset 0 0 8px 1px rgba(255,255,255,0.70);
        }
        .lg-sheen {
          position: absolute; inset: 0; border-radius: 24px;
          z-index: 0; pointer-events: none;
          background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.16) 0%, transparent 65%);
          opacity: 0; transition: opacity 0.25s ease;
        }
        .lg-card:hover .lg-sheen { opacity: 1; }
        .lg-btn { 
          transform: translateZ(8px); /* floats above card in 3D */
          position: relative; 
          z-index: 10;
        }
      `}</style>

      <div className="tilt-scene">
        <div
          className={`lg-card ${className}`}
          ref={tiltEnabled ? ref : null}
          onMouseMove={tiltEnabled ? onMouseMove : undefined}
          onMouseLeave={tiltEnabled ? onMouseLeave : undefined}
          style={{ padding: "26px 22px 22px", ...style }}
        >
          <div className="lg-sheen" />
          {children}
        </div>
      </div>
    </>
  );
}
