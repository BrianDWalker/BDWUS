import React from "react";
import { createRoot } from "react-dom/client";
import "../assets/styles.css";
import "./react-app.css";
import App from "./App";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
