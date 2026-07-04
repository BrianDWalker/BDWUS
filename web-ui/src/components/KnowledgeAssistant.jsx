import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icons";
import { approveAssistantChange, chatAssistant, fetchAssistantUiOverrides, rejectAssistantChange } from "../utils/assistantApi";
import { createLead } from "../utils/salesApi";

const assistantModes = [
  {
    id: "knowledge",
    title: "Knowledge Search",
    subtitle: "Search telecom docs, policy, and product information.",
    promptPlaceholder: "Ask a question about the telecom knowledge base...",
    chip: "Search"
  },
  {
    id: "agent",
    title: "Lead Agent",
    subtitle: "Draft and create a lead directly in the telecom workflow.",
    promptPlaceholder: "Describe the lead you want created...",
    chip: "Action"
  },
  {
    id: "dev",
    title: "Admin / Dev",
    subtitle: "Prepare UI and GitHub-targeted change requests for review.",
    promptPlaceholder: "Describe the UI or GitHub change you want...",
    chip: "Change"
  }
];

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

function ProposalPatch({ proposal }) {
  if (proposal.kind === "lead_create" && proposal.patch?.leadDraft) {
    const draft = proposal.patch.leadDraft;
    return (
      <div className="assistant-proposal-patch">
        <div><strong>Account</strong><span>{draft.accountName || "N/A"}</span></div>
        <div><strong>Contact</strong><span>{draft.contactName || "N/A"}</span></div>
        <div><strong>Product</strong><span>{draft.productInterest || "N/A"}</span></div>
        <div><strong>Owner</strong><span>{draft.ownerName || "N/A"}</span></div>
      </div>
    );
  }

  if (proposal.kind === "github_update" && proposal.patch?.github) {
    const github = proposal.patch.github;
    return (
      <div className="assistant-proposal-patch">
        <div><strong>Repository</strong><span>{github.repository || "N/A"}</span></div>
        <div><strong>Branch</strong><span>{github.branch || "N/A"}</span></div>
        <div><strong>File</strong><span>{github.filePath || "N/A"}</span></div>
        <div><strong>Summary</strong><span>{github.changeSummary || "N/A"}</span></div>
      </div>
    );
  }

  if (proposal.patch?.overrides?.length) {
    return (
      <div className="assistant-proposal-patch">
        {proposal.patch.overrides.map((item, index) => (
          <div key={`${proposal.title}-${index}`}>
            <strong>{item.targetKey}</strong>
            <span>{typeof item.value === "string" ? item.value : JSON.stringify(item.value)}</span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function ProposalCard({ proposal, onApprove, onReject, status = "pending" }) {
  const approveLabel = proposal.kind === "lead_create" ? "Create Lead" : proposal.kind === "github_update" ? "Approve Request" : "Approve";

  return (
    <section className="assistant-proposal-card">
      <div className="assistant-proposal-header">
        <div>
          <strong>{proposal.title}</strong>
          <span>{proposal.target}</span>
        </div>
        <span className={`assistant-proposal-badge ${proposal.kind}`}>{proposal.kind.replaceAll("_", " ")}</span>
      </div>
      <p>{proposal.summary}</p>
      <ProposalPatch proposal={proposal} />
      <div className="assistant-proposal-actions">
        <button className="button" type="button" onClick={onApprove} disabled={status !== "pending"}>{approveLabel}</button>
        <button className="ghost-button" type="button" onClick={onReject} disabled={status !== "pending"}>Reject</button>
      </div>
    </section>
  );
}

function ModeCard({ mode, active, onSelect }) {
  return (
    <button type="button" className={`assistant-mode-card ${active ? "active" : ""}`} onClick={() => onSelect(mode.id)}>
      <div className="assistant-mode-card-copy">
        <strong>{mode.title}</strong>
        <span>{mode.subtitle}</span>
      </div>
      <b>{mode.chip}</b>
    </button>
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
      content: "Use Knowledge Search for answers, Lead Agent to draft a lead, or Admin / Dev to prepare UI and GitHub-targeted changes.",
      timestamp: "Ready"
    }
  ]);
  const [proposals, setProposals] = useState([]);
  const [proposalStatus, setProposalStatus] = useState({});
  const [agentDraft, setAgentDraft] = useState({
    accountName: "",
    contactName: "",
    productInterest: "Fiber 500",
    ownerName: "Admin",
    estimatedValue: 0
  });
  const [githubTarget, setGithubTarget] = useState({
    githubRepo: "BrianDWalker/BDWUS",
    githubBranch: "fc-gpt",
    githubFilePath: ""
  });

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

  const activeMode = assistantModes.find(item => item.id === mode) || assistantModes[0];

  const mergedContext = useMemo(() => ({
    ...context,
    uiOverrides: uiOverrides || [],
    mode,
    githubRepo: githubTarget.githubRepo,
    githubBranch: githubTarget.githubBranch,
    githubFilePath: githubTarget.githubFilePath,
    salesDefaults: mode === "agent" ? {
      accountName: agentDraft.accountName,
      contactName: agentDraft.contactName,
      ownerName: agentDraft.ownerName,
      estimatedValue: Number(agentDraft.estimatedValue) || 0,
      productInterest: agentDraft.productInterest,
      serviceNeeds: agentDraft.productInterest ? [agentDraft.productInterest] : []
    } : {}
  }), [agentDraft, context, githubTarget, mode, uiOverrides]);

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

  async function approveProposal(proposal) {
    try {
      const approved = await approveAssistantChange(proposal.changeRequestId, "admin");
      if (proposal.kind === "lead_create" && proposal.patch?.leadDraft) {
        const createdLead = await createLead({
          ...proposal.patch.leadDraft,
          qualification: proposal.patch.leadDraft.qualification || "Open",
          status: proposal.patch.leadDraft.status || "Open"
        });
        showToast(`Lead ${createdLead.LeadNumber || createdLead.LeadId || "created"} saved`);
      } else if (proposal.kind === "github_update") {
        showToast(`GitHub change request approved for ${proposal.patch?.github?.repository || approved.target || "repository"}`);
      } else {
        const overrides = await fetchAssistantUiOverrides("knowledge");
        onUiOverridesChange?.(overrides);
        showToast(`Approved ${approved.title || "change request"}`);
      }
      setProposalStatus(current => ({ ...current, [proposal.changeRequestId]: "approved" }));
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
      <section className="assistant-modal assistant-modal-elevated" role="dialog" aria-modal="true" aria-label="Knowledge assistant">
        <header className="assistant-modal-header assistant-modal-header-elevated">
          <div>
            <strong>Ask AI</strong>
            <span>Knowledge search, lead agent actions, and admin/dev change requests</span>
          </div>
          <button type="button" className="assistant-close" onClick={onClose}>×</button>
        </header>

        <section className="assistant-hero">
          <div>
            <b>{activeMode.title}</b>
            <p>{activeMode.subtitle}</p>
          </div>
          <div className="assistant-context-pills">
            <span>{mergedContext.pageTitle || mergedContext.route || "Knowledge"}</span>
            {mode === "agent" && <span>Lead workflow</span>}
            {mode === "dev" && <span>Repo-aware</span>}
          </div>
        </section>

        <div className="assistant-mode-grid">
          {assistantModes.map(item => (
            <ModeCard key={item.id} mode={item} active={item.id === mode} onSelect={setMode} />
          ))}
        </div>

        {mode === "agent" && (
          <div className="assistant-input-strip">
            <label>
              <span>Account</span>
              <input value={agentDraft.accountName} onChange={event => setAgentDraft(current => ({ ...current, accountName: event.target.value }))} placeholder="Northstar Health" />
            </label>
            <label>
              <span>Contact</span>
              <input value={agentDraft.contactName} onChange={event => setAgentDraft(current => ({ ...current, contactName: event.target.value }))} placeholder="Jamie Lee" />
            </label>
            <label>
              <span>Product</span>
              <input value={agentDraft.productInterest} onChange={event => setAgentDraft(current => ({ ...current, productInterest: event.target.value }))} placeholder="Fiber 500" />
            </label>
            <label>
              <span>Owner</span>
              <input value={agentDraft.ownerName} onChange={event => setAgentDraft(current => ({ ...current, ownerName: event.target.value }))} placeholder="Admin" />
            </label>
          </div>
        )}

        {mode === "dev" && (
          <div className="assistant-input-strip">
            <label>
              <span>Repository</span>
              <input value={githubTarget.githubRepo} onChange={event => setGithubTarget(current => ({ ...current, githubRepo: event.target.value }))} placeholder="owner/repo" />
            </label>
            <label>
              <span>Branch</span>
              <input value={githubTarget.githubBranch} onChange={event => setGithubTarget(current => ({ ...current, githubBranch: event.target.value }))} placeholder="feature/change" />
            </label>
            <label className="wide">
              <span>File path</span>
              <input value={githubTarget.githubFilePath} onChange={event => setGithubTarget(current => ({ ...current, githubFilePath: event.target.value }))} placeholder="web-ui/src/components/KnowledgeAssistant.jsx" />
            </label>
          </div>
        )}

        <div className="assistant-body assistant-body-elevated">
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
              <strong>Mode tips</strong>
              {mode === "knowledge" && <p>Use this mode for telecom product questions, policy lookup, and document search.</p>}
              {mode === "agent" && <p>Use this mode to draft a lead creation action and save it directly into the telecom sales workflow after approval.</p>}
              {mode === "dev" && <p>Use this mode to prepare UI or GitHub-targeted changes with explicit repo, branch, and file targets.</p>}
            </section>
            <section className="assistant-panel">
              <strong>Proposals</strong>
              {proposals.length ? proposals.map((proposal, index) => (
                <ProposalCard
                  key={`${proposal.title}-${index}`}
                  proposal={proposal}
                  status={proposalStatus[proposal.changeRequestId] || "pending"}
                  onApprove={() => approveProposal(proposal)}
                  onReject={() => rejectProposal(proposal.changeRequestId)}
                />
              )) : <p className="assistant-muted">No proposals yet.</p>}
            </section>
          </aside>
        </div>

        {error && <div className="assistant-error">{error}</div>}

        <form className="assistant-composer assistant-composer-elevated" onSubmit={handleSubmit}>
          <label>
            <span>{mode === "knowledge" ? "Search or ask" : mode === "agent" ? "Lead request" : "Change request"}</span>
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder={activeMode.promptPlaceholder}
            />
          </label>
          <div className="assistant-composer-actions">
            <button className="button" type="submit" disabled={loading}>{loading ? "Sending..." : mode === "agent" ? "Draft Action" : "Send"}</button>
            <button className="ghost-button" type="button" onClick={() => { setMessages([{ role: "assistant", content: "Conversation cleared.", timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]); setProposals([]); setError(""); }}>Reset</button>
          </div>
        </form>
      </section>
    </div>
  );
}
