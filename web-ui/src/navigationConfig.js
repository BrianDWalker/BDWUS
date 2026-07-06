export const navGroups = [
  {
    label: "Command",
    items: [
      { id: "dashboard", label: "Home", icon: "dashboard" },
      { id: "reports", label: "Reports", icon: "reports" }
    ]
  },
  {
    label: "Commercial",
    items: [
      { id: "sales", label: "Sales", icon: "sales" },
      { id: "orders", label: "Orders", icon: "orders" },
      { id: "product-pricing", label: "Product & Pricing", icon: "pricing" }
    ]
  },
  {
    label: "Customer",
    items: [
      { id: "customer-service", label: "Customer Service", icon: "serviceDesk" },
      { id: "customer-360", label: "Customer 360", icon: "customerSearch" },
      { id: "billing", label: "Billing", icon: "billing" }
    ]
  },
  {
    label: "Network & Service",
    items: [
      { id: "network", label: "Network", icon: "network" },
      { id: "service-management", label: "Service Mgmt", icon: "service" },
      { id: "provisioning", label: "Provisioning", icon: "provisioning" }
    ]
  },
  {
    label: "Finance",
    items: [
      { id: "carrier-settlement", label: "Carrier Settlement", icon: "finance" }
    ]
  }
];

export const topNavSections = [
  {
    id: "dashboard",
    label: "Home",
    icon: "dashboard",
    route: "dashboard",
    routes: ["dashboard"]
  },
  {
    id: "knowledge",
    label: "Knowledge",
    icon: "knowledge",
    route: "knowledge",
    routes: ["knowledge"]
  },
  {
    id: "sales",
    label: "Sales",
    icon: "sales",
    route: "sales",
    routes: ["sales", "details/lead", "details/opportunity", "details/quote", "details/contract"]
  },
  {
    id: "customer-360",
    label: "Customer 360",
    icon: "customerSearch",
    route: "customer-360",
    routes: ["customer-360", "customer-service", "details/customer", "details/account", "details/billing-account", "details/invoice", "details/service"]
  },
  {
    id: "orders",
    label: "Orders",
    icon: "orders",
    route: "orders",
    routes: ["orders", "details/order"]
  },
  {
    id: "product-pricing",
    label: "Product & Pricing",
    icon: "pricing",
    route: "product-pricing",
    routes: ["product-pricing", "details/product", "details/product-pricing"]
  },
  {
    id: "network",
    label: "Network & Service",
    icon: "network",
    route: "network",
    routes: ["network", "service-management", "provisioning", "carrier-settlement"]
  },
  {
    id: "billing",
    label: "Billing",
    icon: "billing",
    route: "billing",
    routes: ["billing", "details/invoice", "details/billing-account"]
  },
  {
    id: "reports",
    label: "Reports",
    icon: "reports",
    route: "reports",
    routes: ["reports"]
  },
  // {
  //   id: "administration",
  //   label: "Administration",
  //   icon: "settings",
  //   route: "administration",
  //   routes: ["administration"]
  // }
];
