import React from "react";
import { createRoot } from "react-dom/client";
import "../assets/styles.css";
import "./react-app.css";
import PlatformApp from "./PlatformApp";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PlatformApp />
  </React.StrictMode>
);
