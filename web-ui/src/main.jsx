import React from "react";
import { createRoot } from "react-dom/client";
import "./base.css";
import "./react-app.css";
import "./crm-polish.css";
import "./sales-crm.css";
import "./sales-crm-enhancements.js";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
