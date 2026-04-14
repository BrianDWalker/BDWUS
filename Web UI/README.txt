Billing Pricing UI Files

Files included:
- index.html
- history.html
- assets/config.js
- assets/styles.css
- assets/app.js
- assets/history.js

How to use:
1. Put all files into the same folder structure.
2. Open index.html in a browser.
3. Update assets/config.js if your container app URL or routes change.

Default microservice wiring:
- POST /quotes
- POST /quotes/{quoteId}/reprice
- GET /quotes/{quoteId}/history
- GET /opportunities/{opportunityId}

Current default base URL:
https://bdwusca.delightfulsea-ef64ed74.westus2.azurecontainerapps.io

Notes:
- This UI is billing-data aligned, not AdventureWorks aligned.
- It sends direct browser requests to the microservice, so CORS/network access must allow that.
- You changed your SQL schema to ms, but that does not require a frontend change unless your API routes changed.
