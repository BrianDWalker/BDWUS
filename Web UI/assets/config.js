window.APP_CONFIG = {
  baseUrl: "https://bdwusca.delightfulsea-ef64ed74.westus2.azurecontainerapps.io",
  user: {
    displayName: "Guest"
  },
  routes: {
    createQuote: "/quotes",
    repriceQuote: "/quotes/{quoteId}/reprice",
    quoteHistory: "/quotes/{quoteId}/history",
    opportunityLatest: "/opportunities/{opportunityId}",
    opportunities: "/opportunities",
    opportunityDetails: "/opportunities/{opportunityId}/details",
    opportunityReprice: "/opportunities/{opportunityId}/reprice",
    accountDetails: "/customers/{accountId}",
    lookupOptions: "/billing/lookup-options"
  }
};
