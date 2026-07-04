import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icons";
import {
  approveAssistantChange,
  chatAssistant,
  fetchAssistantUiOverrides,
  fetchGithubBranches,
  fetchGithubFile,
  fetchGithubTree,
  rejectAssistantChange
} from "../utils/assistantApi";

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
    subtitle: "Browse repo context, read real files, and stage multi-file GitHub changes.",
    promptPlaceholder: "Describe the code or repo change you want...",
    chip: "Agent"
  }
];

function randomConversationId() {
  return window.crypto?.randomUUID?.() || `conv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatFileSize(size) {
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function githubProposalFiles(proposal) {
  const github = proposal.patch?.github || {};
  if (Array.isArray(github.files) && github.files.length) return github.files;
  if (github.filePath) return [{ filePath: github.filePath, content: github.content || "" }];
  return [];
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
    const files = githubProposalFiles(proposal);
    return (
      <div className="assistant-proposal-patch">
        <div><strong>Repository</strong><span>{github.repository || "N/A"}</span></div>
        <div><strong>Branch</strong><span>{github.branch || "N/A"}</span></div>
        <div><strong>Files</strong><span>{files.length || 0}</span></div>
        <div><strong>Summary</strong><span>{github.changeSummary || "N/A"}</span></div>
        {files.slice(0, 4).map(file => (
          <div key={file.filePath} className="assistant-proposal-file-row">
            <strong>{file.filePath}</strong>
            <span>{(file.content || "").split("\n")[0] || "Ready to write"}</span>
          </div>
        ))}
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
  const files = proposal.kind === "github_update" ? githubProposalFiles(proposal) : [];
  const approveLabel =
    proposal.kind === "lead_create"
      ? "Create Lead"
      : proposal.kind === "github_update"
        ? files.length > 1 ? `Commit ${files.length} Files` : "Commit File"
        : "Approve";

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

function FileBrowserEntry({ entry, onOpen }) {
  return (
    <button type="button" className={`assistant-file-entry ${entry.type}`} onClick={() => onOpen(entry)}>
      <div className="assistant-file-entry-copy">
        <strong>{entry.name}</strong>
        <span>{entry.type === "dir" ? "Folder" : formatFileSize(entry.size)}</span>
      </div>
      <span className="assistant-file-entry-type">{entry.type === "dir" ? "Open" : "Read"}</span>
    </button>
  );
}

function StagedFileCard({ file, active, onSelect, onRemove }) {
  return (
    <div className={`assistant-staged-file ${active ? "active" : ""}`}>
      <button type="button" className="assistant-staged-file-main" onClick={() => onSelect(file)}>
        <strong>{file.path}</strong>
        <span>{formatFileSize(file.size)}</span>
      </button>
      <button type="button" className="assistant-staged-file-remove" onClick={() => onRemove(file.path)}>Remove</button>
    </div>
  );
}

function RepoBreadcrumbs({ path, onNavigate }) {
  const segments = path ? path.split("/").filter(Boolean) : [];
  const crumbs = [{ label: "Root", value: "" }];
  let current = "";
  segments.forEach(segment => {
    current = current ? `${current}/${segment}` : segment;
    crumbs.push({ label: segment, value: current });
  });
  return (
    <div className="assistant-breadcrumbs">
      {crumbs.map((crumb, index) => (
        <React.Fragment key={crumb.value || "root"}>
          {index > 0 && <span className="assistant-breadcrumb-divider">/</span>}
          <button type="button" onClick={() => onNavigate(crumb.value)}>{crumb.label}</button>
        </React.Fragment>
      ))}
    </div>
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
      content: "Use Knowledge Search for answers, Lead Agent to draft a lead, or Admin / Dev to browse repository context and stage GitHub changes.",
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
    githubFilePath: "",
    githubTreePath: ""
  });
  const [githubBranches, setGithubBranches] = useState([]);
  const [treeEntries, setTreeEntries] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [repoLoading, setRepoLoading] = useState({
    branches: false,
    tree: false,
    file: false
  });
  const [repoError, setRepoError] = useState("");

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

  useEffect(() => {
    if (!open || mode !== "dev" || !githubTarget.githubRepo.trim()) return undefined;
    let mounted = true;
    const handle = window.setTimeout(async () => {
      setRepoLoading(current => ({ ...current, branches: true }));
      try {
        const response = await fetchGithubBranches(githubTarget.githubRepo.trim());
        if (!mounted) return;
        const branches = response.branches || [];
        setGithubBranches(branches);
        setRepoError("");
        if (branches.length && !branches.some(item => item.name === githubTarget.githubBranch)) {
          setGithubTarget(current => ({
            ...current,
            githubBranch: branches[0].name,
            githubTreePath: "",
            githubFilePath: ""
          }));
        }
      } catch (err) {
        if (mounted) setRepoError(err.message || "Unable to load repository branches.");
      } finally {
        if (mounted) setRepoLoading(current => ({ ...current, branches: false }));
      }
    }, 250);
    return () => {
      mounted = false;
      window.clearTimeout(handle);
    };
  }, [open, mode, githubTarget.githubRepo, githubTarget.githubBranch]);

  useEffect(() => {
    if (!open || mode !== "dev" || !githubTarget.githubRepo.trim() || !githubTarget.githubBranch.trim()) return undefined;
    let mounted = true;
    const handle = window.setTimeout(async () => {
      setRepoLoading(current => ({ ...current, tree: true }));
      try {
        const response = await fetchGithubTree(
          githubTarget.githubRepo.trim(),
          githubTarget.githubBranch.trim(),
          githubTarget.githubTreePath || ""
        );
        if (!mounted) return;
        setTreeEntries(response.entries || []);
        setRepoError("");
      } catch (err) {
        if (mounted) setRepoError(err.message || "Unable to load repository files.");
      } finally {
        if (mounted) setRepoLoading(current => ({ ...current, tree: false }));
      }
    }, 150);
    return () => {
      mounted = false;
      window.clearTimeout(handle);
    };
  }, [open, mode, githubTarget.githubRepo, githubTarget.githubBranch, githubTarget.githubTreePath]);

  useEffect(() => {
    if (mode !== "dev") return;
    setActiveFile(null);
    setSelectedFiles([]);
  }, [mode, githubTarget.githubRepo, githubTarget.githubBranch]);

  const activeMode = assistantModes.find(item => item.id === mode) || assistantModes[0];

  const mergedContext = useMemo(() => ({
    ...context,
    uiOverrides: uiOverrides || [],
    mode,
    githubRepo: githubTarget.githubRepo,
    githubBranch: githubTarget.githubBranch,
    githubFilePath: githubTarget.githubFilePath,
    githubTreePath: githubTarget.githubTreePath,
    githubFiles: selectedFiles.map(file => ({
      path: file.path,
      sha: file.sha,
      size: file.size,
      content: file.content
    })),
    salesDefaults: mode === "agent" ? {
      accountName: agentDraft.accountName,
      contactName: agentDraft.contactName,
      ownerName: agentDraft.ownerName,
      estimatedValue: Number(agentDraft.estimatedValue) || 0,
      productInterest: agentDraft.productInterest,
      serviceNeeds: agentDraft.productInterest ? [agentDraft.productInterest] : []
    } : {}
  }), [agentDraft, context, githubTarget, mode, selectedFiles, uiOverrides]);

  async function handleSubmit(event) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    setError("");
    setLoading(true);
    const userMessage = { role: "user", content: message, timestamp: formatTime() };
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
        { role: "assistant", content: response.assistantMessage, timestamp: formatTime() }
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
        showToast("Lead created from approved agent action");
      } else if (proposal.kind === "github_update") {
        const fileCount = githubProposalFiles(proposal).length;
        showToast(`Committed ${fileCount || 1} GitHub ${fileCount === 1 ? "file" : "files"} to ${proposal.patch?.github?.branch || approved.target || "branch"}`);
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

  async function openGithubEntry(entry) {
    if (entry.type === "dir") {
      setGithubTarget(current => ({
        ...current,
        githubTreePath: entry.path,
        githubFilePath: ""
      }));
      return;
    }
    setRepoLoading(current => ({ ...current, file: true }));
    try {
      const file = await fetchGithubFile(
        githubTarget.githubRepo.trim(),
        githubTarget.githubBranch.trim(),
        entry.path
      );
      setActiveFile(file);
      setGithubTarget(current => ({ ...current, githubFilePath: file.path }));
      setRepoError("");
    } catch (err) {
      setRepoError(err.message || "Unable to read GitHub file.");
    } finally {
      setRepoLoading(current => ({ ...current, file: false }));
    }
  }

  function stageActiveFile() {
    if (!activeFile) return;
    setSelectedFiles(current => {
      const next = current.filter(item => item.path !== activeFile.path);
      return [...next, activeFile];
    });
    showToast(`Added ${activeFile.path} to the AI workspace`);
  }

  function removeSelectedFile(path) {
    setSelectedFiles(current => current.filter(item => item.path !== path));
  }

  function resetConversation() {
    setMessages([{ role: "assistant", content: "Conversation cleared.", timestamp: formatTime() }]);
    setProposals([]);
    setError("");
  }

  function resetRepoWorkspace() {
    setGithubTarget(current => ({
      ...current,
      githubTreePath: "",
      githubFilePath: ""
    }));
    setActiveFile(null);
    setSelectedFiles([]);
    setRepoError("");
  }

  const repoSummary = mode === "dev"
    ? `${selectedFiles.length} staged ${selectedFiles.length === 1 ? "file" : "files"}`
    : mode === "agent"
      ? "Lead workflow armed"
      : "Knowledge context ready";

  if (!open) return null;

  return (
    <div className="assistant-backdrop">
      <section className="assistant-modal assistant-modal-elevated" role="dialog" aria-modal="true" aria-label="Knowledge assistant">
        <header className="assistant-modal-header assistant-modal-header-elevated">
          <div>
            <strong>Ask AI</strong>
            <span>Knowledge search, lead automation, and repo-aware admin/dev actions</span>
          </div>
          <button type="button" className="assistant-close" onClick={onClose}>×</button>
        </header>

        <section className="assistant-hero assistant-hero-shell">
          <div className="assistant-hero-copy">
            <b>{activeMode.title}</b>
            <p>{activeMode.subtitle}</p>
          </div>
          <div className="assistant-hero-status">
            <div className="assistant-hero-stat">
              <span>Context</span>
              <strong>{mergedContext.pageTitle || mergedContext.route || "Knowledge"}</strong>
            </div>
            <div className="assistant-hero-stat">
              <span>Workspace</span>
              <strong>{repoSummary}</strong>
            </div>
            <div className="assistant-context-pills">
              <span>{mode === "dev" ? "Repo agent" : mode === "agent" ? "Lead action" : "Knowledge"}</span>
              {mode === "dev" && <span>{githubTarget.githubBranch || "No branch"}</span>}
            </div>
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
          <div className="assistant-input-strip assistant-input-strip-dev">
            <label>
              <span>Repository</span>
              <input value={githubTarget.githubRepo} onChange={event => setGithubTarget(current => ({ ...current, githubRepo: event.target.value }))} placeholder="owner/repo" />
            </label>
            <label>
              <span>Branch</span>
              <select value={githubTarget.githubBranch} onChange={event => setGithubTarget(current => ({ ...current, githubBranch: event.target.value, githubTreePath: "", githubFilePath: "" }))}>
                {githubBranches.length ? githubBranches.map(branch => (
                  <option key={branch.name} value={branch.name}>{branch.name}</option>
                )) : <option value={githubTarget.githubBranch}>{githubTarget.githubBranch || "Select branch"}</option>}
              </select>
            </label>
            <label className="wide">
              <span>Focused path</span>
              <input value={githubTarget.githubFilePath} onChange={event => setGithubTarget(current => ({ ...current, githubFilePath: event.target.value }))} placeholder="web-ui/src/components/KnowledgeAssistant.jsx" />
            </label>
          </div>
        )}

        <div className="assistant-body assistant-body-elevated">
          <div className="assistant-thread">
            {messages.map((message, index) => <MessageBubble key={`${message.role}-${index}-${message.timestamp}`} message={message} />)}
            {loading && <div className="assistant-loading"><Icon name="workflow" className="button-icon" />Thinking...</div>}
          </div>

          <aside className="assistant-sidebar assistant-sidebar-workspace">
            {mode === "dev" ? (
              <>
                <section className="assistant-panel assistant-panel-workspace">
                  <div className="assistant-panel-heading">
                    <div>
                      <strong>Repository Workspace</strong>
                      <span>{githubTarget.githubRepo || "No repository selected"}</span>
                    </div>
                    <div className="assistant-panel-actions">
                      <button type="button" className="ghost-button" onClick={resetRepoWorkspace}>Clear</button>
                    </div>
                  </div>
                  <RepoBreadcrumbs path={githubTarget.githubTreePath} onNavigate={path => setGithubTarget(current => ({ ...current, githubTreePath: path, githubFilePath: "" }))} />
                  <div className="assistant-repo-status">
                    <span>{repoLoading.branches ? "Loading branches..." : `${githubBranches.length || 0} branches`}</span>
                    <span>{repoLoading.tree ? "Refreshing files..." : `${treeEntries.length || 0} items`}</span>
                  </div>
                  <div className="assistant-file-browser">
                    {treeEntries.length ? treeEntries.map(entry => (
                      <FileBrowserEntry key={`${entry.type}-${entry.path}`} entry={entry} onOpen={openGithubEntry} />
                    )) : <p className="assistant-muted">No files loaded for this path.</p>}
                  </div>
                </section>

                <section className="assistant-panel assistant-panel-preview">
                  <div className="assistant-panel-heading">
                    <div>
                      <strong>Active File</strong>
                      <span>{activeFile?.path || "Open a file from the workspace"}</span>
                    </div>
                    <div className="assistant-panel-actions">
                      <button type="button" className="button" onClick={stageActiveFile} disabled={!activeFile}>Stage for AI</button>
                    </div>
                  </div>
                  {repoLoading.file && <div className="assistant-loading"><Icon name="workflow" className="button-icon" />Reading file...</div>}
                  {activeFile ? (
                    <div className="assistant-code-shell">
                      <div className="assistant-code-meta">
                        <span>{formatFileSize(activeFile.size)}</span>
                        <span>{activeFile.sha?.slice(0, 7) || "n/a"}</span>
                      </div>
                      <pre>{activeFile.content}</pre>
                    </div>
                  ) : <p className="assistant-muted">Read a file from any branch to add real code context before asking for changes.</p>}
                </section>

                <section className="assistant-panel assistant-panel-selection">
                  <div className="assistant-panel-heading">
                    <div>
                      <strong>Staged For AI</strong>
                      <span>{selectedFiles.length} files available to the Foundry model</span>
                    </div>
                  </div>
                  <div className="assistant-staged-list">
                    {selectedFiles.length ? selectedFiles.map(file => (
                      <StagedFileCard
                        key={file.path}
                        file={file}
                        active={activeFile?.path === file.path}
                        onSelect={setActiveFile}
                        onRemove={removeSelectedFile}
                      />
                    )) : <p className="assistant-muted">Stage one or more files to let the dev agent work across real branch content.</p>}
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="assistant-panel">
                  <strong>Context</strong>
                  <span>{mergedContext.pageTitle || mergedContext.route || "Knowledge"}</span>
                  {mergedContext.pageSummary && <p>{mergedContext.pageSummary}</p>}
                </section>
                <section className="assistant-panel">
                  <strong>Mode tips</strong>
                  {mode === "knowledge" && <p>Use this mode for telecom product questions, policy lookup, and document search.</p>}
                  {mode === "agent" && <p>Use this mode to draft a lead creation action and save it directly into the telecom sales workflow after approval.</p>}
                </section>
              </>
            )}

            <section className="assistant-panel assistant-panel-proposals">
              <div className="assistant-panel-heading">
                <div>
                  <strong>Proposals</strong>
                  <span>{proposals.length ? `${proposals.length} ready for review` : "No pending proposals"}</span>
                </div>
              </div>
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

        {(error || repoError) && <div className="assistant-error">{error || repoError}</div>}

        <form className="assistant-composer assistant-composer-elevated" onSubmit={handleSubmit}>
          <label>
            <span>{mode === "knowledge" ? "Search or ask" : mode === "agent" ? "Lead request" : "Agent request"}</span>
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder={activeMode.promptPlaceholder}
            />
          </label>
          <div className="assistant-composer-actions">
            <button className="button" type="submit" disabled={loading}>{loading ? "Sending..." : mode === "agent" ? "Draft Action" : mode === "dev" ? "Draft GitHub Plan" : "Send"}</button>
            <button className="ghost-button" type="button" onClick={resetConversation}>Reset</button>
          </div>
        </form>
      </section>
    </div>
  );
}
