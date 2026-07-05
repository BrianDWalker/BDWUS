import React, { useEffect, useState } from "react";
import { GatedButton } from "../../components/PermissionGate";
import { PageHeader } from "../../components/Shell";
import { DataTable, MetricCard, Panel, StatusTag, formatDateTime } from "../../components/Primitives";
import { createCustomerServiceTicketNote, fetchCustomerServiceTicket, updateCustomerServiceTicket } from "../../utils/platformApi";
import { normalizeTicket } from "../../utils/payloadMapping";

function tone(value) {
  if (["Urgent", "High", "Open", "In Progress", "Escalated"].includes(value)) return "warn";
  if (["Closed", "Resolved", "Completed"].includes(value)) return "success";
  return "blue";
}

export default function CustomerServiceTicketDetail({ id, setRoute, showToast }) {
  const [ticket, setTicket] = useState(null);
  const [notes, setNotes] = useState([]);
  const [comment, setComment] = useState("");
  const [closureReason, setClosureReason] = useState("Resolved with customer confirmation");
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

  async function updateTicket(payload, successMessage) {
    if (!ticket) return;
    setSaving(true);
    setError("");
    try {
      const updated = normalizeTicket(await updateCustomerServiceTicket(ticket.TicketId || id, payload));
      setTicket(updated);
      showToast?.(successMessage || `Ticket ${updated.TicketNumber || "updated"} updated`);
      await loadTicket();
    } catch (err) {
      setError(err.message || "Unable to update ticket.");
    } finally {
      setSaving(false);
    }
  }

  async function addComment() {
    if (!ticket || !comment.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createCustomerServiceTicketNote(ticket.TicketId || id, { note: comment.trim(), noteType: "Comment", createdBy: "Care Ops" });
      setComment("");
      showToast?.("Ticket comment added");
      await loadTicket();
    } catch (err) {
      setError(err.message || "Unable to add ticket comment.");
    } finally {
      setSaving(false);
    }
  }

  function escalateTicket() {
    updateTicket({ status: "Escalated", priority: "Urgent", escalationLevel: "Tier 2", slaTargetHours: 4, note: "Ticket escalated to Tier 2 for expedited handling.", noteType: "Escalation", createdBy: "Care Ops" }, `Ticket ${ticket?.TicketNumber || ""} escalated`);
  }

  function closeTicket() {
    updateTicket({ status: "Closed", closureReason, note: `Ticket closed: ${closureReason}`, noteType: "Closure", createdBy: "Care Ops" }, `Ticket ${ticket?.TicketNumber || ""} Closed`);
  }

  const title = ticket?.TicketNumber || "Ticket Detail";

  return (
    <>
      <PageHeader
        title={title}
        description="Modern API-backed customer service ticket detail."
        actions={<div className="button-cluster"><button className="ghost-button" type="button" onClick={() => setRoute?.("customer-service")}>Back to Customer Service</button><GatedButton action="escalate:ticket" className="ghost-button" disabled={saving || !ticket} onClick={escalateTicket}>Escalate</GatedButton><GatedButton action="close:ticket" disabled={saving || !ticket} onClick={closeTicket}>Close Ticket</GatedButton></div>}
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
                <MetricCard label="Escalation" value={ticket.EscalationLevel || "Tier 1"} delta={`${ticket.SlaTargetHours || 24}h SLA target`} />
                <MetricCard label="State" value={<StatusTag tone={tone(ticket.Status)}>{ticket.Status}</StatusTag>} delta={ticket.ClosureReason || "Current state"} />
              </div>
              <div className="empty-state">{ticket.Summary || "No summary captured for this ticket."}</div>
            </Panel>
            <Panel title="Care Actions" description="Add comments, capture closure reason, or escalate the ticket.">
              <div className="modal-form">
                <label>Comment<textarea value={comment} onChange={event => setComment(event.target.value)} placeholder="Add a ticket comment or customer update" /></label>
                <label>Closure reason<input value={closureReason} onChange={event => setClosureReason(event.target.value)} placeholder="Closure reason" /></label>
              </div>
              <div className="modal-actions"><GatedButton action="comment:ticket" className="ghost-button" disabled={saving || !comment.trim()} onClick={addComment}>Add Comment</GatedButton><GatedButton action="close:ticket" disabled={saving} onClick={closeTicket}>Close With Reason</GatedButton></div>
            </Panel>
            <Panel title="Notes & History" description="Ticket notes, creation context, comments, escalations, and closure history.">
              {notes.length ? <DataTable columns={[{ key: "NoteType", label: "Type" }, { key: "Note", label: "Note" }, { key: "CreatedBy", label: "Created By" }, { key: "CreatedAtUtc", label: "Created", render: row => formatDateTime(row.CreatedAtUtc) }]} rows={notes} /> : <div className="empty-state">No ticket notes returned by the API.</div>}
            </Panel>
          </section>
        </>
      )}
    </>
  );
}
