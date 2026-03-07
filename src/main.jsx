import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/variables.css";
import "./styles/globals.css";
import "./styles/glass.css";

export function mountApp(container = document.getElementById("root")) {
  if (!container) return;
  const root = createRoot(container);
  root.render(<App />);
}

export default mountApp;
