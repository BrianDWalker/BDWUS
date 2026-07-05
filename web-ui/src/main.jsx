import React from "react";
import { createRoot } from "react-dom/client";
import "./base.css";
import "./react-app.css";
import "./crm-polish.css";
import "./sales-crm.css";
import "./ui-consistency.css";
import "./quote-to-order.css";
import SalesAppRouter from "./SalesAppRouter";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SalesAppRouter />
  </React.StrictMode>
);
