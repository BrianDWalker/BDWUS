import React, { useEffect, useState } from "react";
import { DataTable, Panel } from "../../components/Primitives";
import { fetchBillingFacts } from "../../utils/platformApi";

const columns = {
  Subscriptions: ["CustomerNumber", "CustomerName", "ServiceName", "PlanName", "Quantity", "Status"],
  Payments: ["CustomerNumber", "CustomerName", "InvoiceNumber", "Amount", "Currency", "Status", "PaidAtUtc"],
  Usage: ["CustomerNumber", "CustomerName", "ServiceName", "Quantity", "Unit", "OccurredAtUtc"]
};

export default function BillingFacts({ resource }) {
  const [state, setState] = useState({ loading: true, error: "", rows: [] });
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  useEffect(() => { setPage(0); }, [resource]);
  useEffect(() => {
    let active = true;
    setState({ loading: true, error: "", rows: [] });
    fetchBillingFacts(resource, page)
      .then(body => {
        if (active) setState({ loading: false, error: "", rows: body });
      })
      .catch(error => { if (active) setState({ loading: false, error: error.message, rows: [] }); });
    return () => { active = false; };
  }, [resource, page, retry]);
  return <Panel title={resource}>
    {state.loading ? <p role="status">Loading {resource.toLowerCase()}...</p> : state.error ?
      <div role="alert"><p>{state.error}</p><button onClick={() => setRetry(value => value + 1)}>Retry</button></div> :
      state.rows.length ? <DataTable columns={columns[resource].map(key => ({ key, label: key }))} rows={state.rows} /> :
        <p>No {resource.toLowerCase()} records.</p>}
    <button disabled={state.loading || page === 0} onClick={() => setPage(value => value - 1)}>Previous</button>
    <button disabled={state.loading || state.rows.length < 100} onClick={() => setPage(value => value + 1)}>Next</button>
  </Panel>;
}
