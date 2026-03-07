import { useCallback, useEffect, useState } from "react";

export function useGlobalToast(eventName) {
  const [toast, setToast] = useState(null);

  const pushToast = useCallback((message, type = "info") => {
    const text = String(message || "").trim();
    if (!text) return;
    setToast({ id: Date.now(), message: text, type });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleToastEvent = (event) => {
      const message = event?.detail?.message;
      const type = event?.detail?.type || "info";
      pushToast(message, type);
    };

    window.addEventListener(eventName, handleToastEvent);
    return () => window.removeEventListener(eventName, handleToastEvent);
  }, [eventName, pushToast]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timeoutId);
  }, [toast]);

  return { toast, pushToast };
}
