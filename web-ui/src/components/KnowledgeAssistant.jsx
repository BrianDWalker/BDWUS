import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icons";
import { approveAssistantChange, chatAssistant, fetchAssistantUiOverrides, rejectAssistantChange, mergeKnowledgeUi } from "../utils/assistantApi";

function randomConversationId() {
  return window.crypto?.randomUUID?.() || `conv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function MessageBubble({ message }) {
  return (
    <article className={message.role === "user" ? "assistant-message user" : "assistant-message"}>
      <div className="assistant-message-meta">
        <strong>{message.role === "user" ? "You" : "BDWUS AI"}</strong>
        <span>{message.timestamp}</span>
      </div>
      <p>{message.content}</p>
    </article>
  );
}

function ProposalCard({ proposal, onApprove, onReject, status = "pending" }) {
  return (
    <section className="assistant-proposal-card">
      <div className="assistant-proposal-header">
        <div>
          <strong>{proposal.title}</strong>
          <span>{proposal.target}</span>
        </div>
        <span className={`assistant-proposal-badge ${proposal.kind}`}>{proposal.kind}</span>
      </div>
      <p>{proposal.summary}</p>
      {proposal.patch?.overrides?.length ? (
        <div className="assistant-proposal-patch">
          {proposal.patch.overrides.map((item, index) => (
            <div key={`${proposal.title}-${index}`}>
              <strong>{item.targetKey}</strong>
              <span>{typeof item.value === "string" ? item.value : JSON.stringify(item.value)}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="assistant-proposal-actions">
        <button className="button" type="button" onClick={onApprove} disabled={status !== "pending"}>Approve</button>
        <button className="ghost-button" type="button" onClick={onReject} disabled={status !== "pending"}>Reject</button>
      </div>
    </section>
  );
}

export function KnowledgeAssistant({ open, onClose, showToast, context, uiOverrides, onUiOverridesChange }) {
  const [mode, setMode] = useState("knowledge");
  const [conversationId, setConversationId] = useState(randomConversationId);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Ask me a question or describe a UI change you want. In dev mode I will propose edits and wait for your approval.",
      timestamp: "Ready"
    }
  ]);
  const [proposals, setProposals] = useState([]);
  const [proposalStatus, setProposalStatus] = useState({});

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    async function loadOverrides() {
      try {
        const items = await fetchAssistantUiOverrides("knowledge");
        if (mounted && items.length && onUiOverridesChange) onUiOverridesChange(items);
      } catch (err) {
        if (mounted) setError(err.message || "Unable to load AI overrides.");
      }
    }
    loadOverrides();
    return () => { mounted = false; };
  }, [open, onUiOverridesChange]);

  useEffect(() => {
    if (!open) return;
    const savedId = window.sessionStorage.getItem("bdwus-ai-conversation-id");
    if (savedId) setConversationId(savedId);
  }, [open]);

  const mergedContext = useMemo(() => ({
    ...context,
    uiOverrides: uiOverrides || [],
    mode,
  }), [context, mode, uiOverrides]);

  async function handleSubmit(event) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    setError("");
    setLoading(true);
    const userMessage = { role: "user", content: message, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setMessages(current => [...current, userMessage]);
    setInput("");
    try {
      const response = await chatAssistant({
        conversationId,
        mode,
        message,
        context: mergedContext,
        userName: "admin"
      });
      window.sessionStorage.setItem("bdwus-ai-conversation-id", response.conversationId);
      setConversationId(response.conversationId);
      setMessages(current => [
        ...current,
        { role: "assistant", content: response.assistantMessage, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
      ]);
      const enrichedProposals = (response.proposals || []).map((proposal, index) => ({
        ...proposal,
        changeRequestId: response.changeRequestIds?.[index] || proposal.changeRequestId || proposal.id
      }));
      setProposals(enrichedProposals);
      setProposalStatus(Object.fromEntries(enrichedProposals.map(item => [item.changeRequestId, "pending"])));
      if ((response.proposals || []).length) showToast("AI proposals ready for review");
    } catch (err) {
      setError(err.message || "Assistant request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function approveProposal(changeRequestId) {
    try {
      const approved = await approveAssistantChange(changeRequestId, "admin");
      setProposalStatus(current => ({ ...current, [changeRequestId]: "approved" }));
      const overrides = await fetchAssistantUiOverrides("knowledge");
      onUiOverridesChange?.(overrides);
      showToast(`Approved ${approved.title || "change request"}`);
    } catch (err) {
      setError(err.message || "Approval failed.");
    }
  }

  async function rejectProposal(changeRequestId) {
    try {
      await rejectAssistantChange(changeRequestId, "admin");
      setProposalStatus(current => ({ ...current, [changeRequestId]: "rejected" }));
      showToast("Change request rejected");
    } catch (err) {
      setError(err.message || "Rejection failed.");
    }
  }

  if (!open) return null;

  return (
    <div className="assistant-backdrop">
      <section className="assistant-modal" role="dialog" aria-modal="true" aria-label="Knowledge assistant">
        <header className="assistant-modal-header">
          <div>
            <strong>Ask AI</strong>
            <span>Knowledge chat and admin/dev proposals</span>
          </div>
          <button type="button" className="assistant-close" onClick={onClose}>×</button>
        </header>
        <div className="assistant-mode-switch">
          <button type="button" className={mode === "knowledge" ? "active" : ""} onClick={() => setMode("knowledge")}>Knowledge</button>
          <button type="button" className={mode === "dev" ? "active" : ""} onClick={() => setMode("dev")}>Admin / Dev</button>
        </div>
        <div className="assistant-body">
          <div className="assistant-thread">
            {messages.map((message, index) => <MessageBubble key={`${message.role}-${index}-${message.timestamp}`} message={message} />)}
            {loading && <div className="assistant-loading"><Icon name="workflow" className="button-icon" />Thinking...</div>}
          </div>
          <aside className="assistant-sidebar">
            <section className="assistant-panel">
              <strong>Context</strong>
              <span>{mergedContext.pageTitle || mergedContext.route || "Knowledge"}</span>
              {mergedContext.pageSummary && <p>{mergedContext.pageSummary}</p>}
            </section>
            <section className="assistant-panel">
              <strong>Proposals</strong>
              {proposals.length ? proposals.map((proposal, index) => (
                <ProposalCard
                  key={`${proposal.title}-${index}`}
                  proposal={proposal}
                  status={proposalStatus[proposal.changeRequestId] || "pending"}
                  onApprove={() => approveProposal(proposal.changeRequestId)}
                  onReject={() => rejectProposal(proposal.changeRequestId)}
                />
              )) : <p className="assistant-muted">No proposals yet.</p>}
            </section>
          </aside>
        </div>
        {error && <div className="assistant-error">{error}</div>}
        <form className="assistant-composer" onSubmit={handleSubmit}>
          <label>
            <span>Message</span>
            <textarea value={input} onChange={event => setInput(event.target.value)} placeholder={mode === "dev" ? "Describe the UI change you want..." : "Ask a question about the knowledge base..."} />
          </label>
          <div className="assistant-composer-actions">
            <button className="button" type="submit" disabled={loading}>{loading ? "Sending..." : "Send"}</button>
            <button className="ghost-button" type="button" onClick={() => { setMessages([{ role: "assistant", content: "Conversation cleared.", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]); setProposals([]); setError(""); }}>Reset</button>
          </div>
        </form>
      </section>
    </div>
  );
}
