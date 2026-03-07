import { useEffect } from "react";

export function useWindowClickClose(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleWindowClick = () => onClose();
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [isOpen, onClose]);
}
