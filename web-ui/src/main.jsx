import React from "react";
import { createRoot } from "react-dom/client";
import "./base.css";
import "./react-app.css";
import "./crm-polish.css";
import "./sales-crm.css";
import "./quote-to-order.css";
import "./role-permissions.css";
import "./shell.css";
import "./layouts.css";
import "./surfaces.css";
import "./product-pricing.css";
import SalesAppRouter from "./SalesAppRouter";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SalesAppRouter />
  </React.StrictMode>
);

document.documentElement.classList.add("react-hydrated");
