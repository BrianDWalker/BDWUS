import React, { useEffect, useState } from "react";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag } from "../../components/Primitives";
import { fetchCustomerServiceTicket, updateCustomerServiceTicket } from "../../utils/platformApi";
import { normalizeTicket } from "../../utils/payloadMapping";

function tone(value) {
  if (["Urgent", "High", "Open", "In Progress"].includes(value)) return "warn";
  if (["Closed", "Resolved", "Completed"].includes(value)) return "success";
  return "blue";
}

export default function CustomerServiceTicketDetail({ id, setRoute, showToast }) {
  const [ticket, setTicket] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadTicket() {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchCustomerServiceTicket(id);
      setTicket(normalizeTicket(payload.ticket || payload.Ticket || payload));
      setNotes(payload.notes || payload.Notes || []);
    } catch (err) {
      setError(err.message || "Unable to load ticket.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTicket();
  }, [id]);

  async function updateStatus(status) {
    if (!ticket) return;
    setSaving(true);
    setError("");
    try {
      const updated = normalizeTicket(await updateCustomerServiceTicket(ticket.TicketId || id, { status, note: `Status changed to ${status}.`, noteType: "Status", createdBy: "Care Ops" }));
      setTicket(updated);
      showToast?.(`Ticket ${updated.TicketNumber || "updated"} ${status}`);
      loadTicket();
    } catch (err) {
      setError(err.message || "Unable to update ticket.");
    } finally {
      setSaving(false);
    }
  }

  const title = ticket?.TicketNumber || "Ticket Detail";

  return (
    <>
      <PageHeader
        title={title}
        description="Modern API-backed customer service ticket detail."
        actions={<div className="button-cluster"><button className="ghost-button" type="button" onClick={() => setRoute?.("customer-service")}>Back to Customer Service</button><button className="ghost-button" type="button" disabled={loading} onClick={loadTicket}>Refresh</button><button className="button" type="button" disabled={saving || !ticket} onClick={() => updateStatus("Closed")}>Close Ticket</button></div>}
      />
      {error && <div className="empty-state">{error}</div>}
      {loading ? <div className="empty-state">Loading ticket...</div> : !ticket ? <div className="empty-state">Ticket not found.</div> : (
        <>
          <section className="overview-grid">
            <MetricCard label="Customer" value={ticket.AccountName || "-"} delta={ticket.CustomerNumber || "Customer"} />
            <MetricCard label="Priority" value={ticket.Priority || "-"} delta="Ticket priority" />
            <MetricCard label="Status" value={ticket.Status || "-"} delta="Care workflow" />
            <MetricCard label="Owner" value={ticket.OwnerName || "-"} delta="Assigned care owner" />
          </section>
          <section className="record-main-layout">
            <Panel title="Ticket Summary" description={ticket.IssueType || "Customer issue"}>
              <div className="field-grid">
                <MetricCard label="Category" value={ticket.Category || "-"} delta="Issue area" />
                <MetricCard label="Age" value={`${ticket.AgeHours || 0}h`} delta="Current queue age" />
                <MetricCard label="Created" value={ticket.CreatedAtUtc || "-"} delta="Created at" />
                <MetricCard label="State" value={<StatusTag tone={tone(ticket.Status)}>{ticket.Status}</StatusTag>} delta="Current state" />
              </div>
              <div className="empty-state">{ticket.Summary || "No summary captured for this ticket."}</div>
            </Panel>
            <Panel title="Notes & History" description="Ticket notes, creation context, and status changes.">
              {notes.length ? <DataTable columns={[{ key: "NoteType", label: "Type" }, { key: "Note", label: "Note" }, { key: "CreatedBy", label: "Created By" }, { key: "CreatedAtUtc", label: "Created" }]} rows={notes} /> : <div className="empty-state">No ticket notes returned by the API.</div>}
            </Panel>
          </section>
        </>
      )}
    </>
  );
}
