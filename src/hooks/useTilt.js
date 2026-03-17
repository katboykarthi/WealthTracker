import { useRef, useCallback } from "react";

export function useTilt(maxTilt = 5) {
  const ref = useRef(null);

  const onMouseMove = useCallback(
    (e) => {
      const card = ref.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;

      // Dampen physics for very large cards (like data tables)
      const maxSide = Math.max(rect.width, rect.height);
      const clampFactor = Math.min(1, 400 / maxSide);
      const dynamicTilt = maxTilt * clampFactor;
      const dynamicScale = 1 + (0.025 * clampFactor);

      card.style.transition = "transform 0.08s linear";
      card.style.transform = `rotateX(${-ny * dynamicTilt}deg) rotateY(${nx * dynamicTilt}deg) scale(${dynamicScale})`;

      // Move the specular sheen
      const sheen = card.querySelector(".lg-sheen");
      if (sheen) {
        const px = ((e.clientX - rect.left) / rect.width) * 100;
        const py = ((e.clientY - rect.top) / rect.height) * 100;
        sheen.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(255,255,255,0.16) 0%, transparent 60%)`;
      }
    },
    [maxTilt]
  );

  const onMouseLeave = useCallback(() => {
    const card = ref.current;
    if (!card) return;
    card.style.transition = "transform 0.7s cubic-bezier(0.23,1,0.32,1)";
    card.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
    
    // reset sheen
    const sheen = card.querySelector(".lg-sheen");
    if (sheen) {
       sheen.style.background = `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.16) 0%, transparent 65%)`;
    }
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
