import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/old-standard-tt/latin-400.css";
import "@fontsource/old-standard-tt/latin-400-italic.css";
import "@fontsource/old-standard-tt/latin-700.css";
import "@fontsource/pinyon-script/latin-400.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root ausente");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
