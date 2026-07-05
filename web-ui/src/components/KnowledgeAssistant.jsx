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

const assistantAgents = [
  {
    id: "knowledge",
    mode: "knowledge",
    title: "Knowledge Search",
    subtitle: "Read-only search of products, policies, promotions, procedures, and documentation.",
    promptPlaceholder: "Ask anything about your telecom platform...",
    icon: "knowledge",
    chip: "Search"
  },
  {
    id: "lead",
    mode: "agent",
    title: "Lead Agent",
    subtitle: "Create, update, convert, log activity, and recommend the next action for leads.",
    promptPlaceholder: "Describe the lead action you want handled...",
    icon: "leads",
    chip: "Lead"
  },
  {
    id: "sales",
    mode: "agent",
    title: "Sales Assistant",
    subtitle: "Accounts, opportunities, pipeline, and forecasting support.",
    promptPlaceholder: "Ask about accounts, opportunities, pipeline, or forecast...",
    icon: "sales",
    chip: "Sales"
  },
  {
    id: "pricing",
    mode: "knowledge",
    title: "Pricing Assistant",
    subtitle: "Pricing models, rate elements, margin analysis, discounts, and approval routing.",
    promptPlaceholder: "Ask about pricing, margin, discounts, or approvals...",
    icon: "pricing",
    chip: "Pricing"
  },
  {
    id: "quote",
    mode: "knowledge",
    title: "Quote Assistant",
    subtitle: "Quote creation, product recommendations, modifications, and generated pricing.",
    promptPlaceholder: "Ask for quote help, product recommendations, or pricing...",
    icon: "file",
    chip: "Quote"
  },
  {
    id: "order",
    mode: "knowledge",
    title: "Order Assistant",
    subtitle: "Submit, modify, and track telecom orders.",
    promptPlaceholder: "Ask about order submission, modification, or tracking...",
    icon: "orders",
    chip: "Order"
  },
  {
    id: "activation",
    mode: "knowledge",
    title: "Activation Assistant",
    subtitle: "Provisioning, activation status, and service status workflows.",
    promptPlaceholder: "Ask about provisioning, activation, or service status...",
    icon: "radio",
    chip: "Activation"
  },
  {
    id: "billing",
    mode: "knowledge",
    title: "Billing Assistant",
    subtitle: "Billing accounts, charges, adjustments, and recurring charges.",
    promptPlaceholder: "Ask about billing accounts, charges, or adjustments...",
    icon: "billing",
    chip: "Billing"
  },
  {
    id: "invoice",
    mode: "knowledge",
    title: "Invoice Assistant",
    subtitle: "Generate invoices, credits, payments, and invoice status answers.",
    promptPlaceholder: "Ask about invoices, credits, payments, or status...",
    icon: "settlement",
    chip: "Invoice"
  },
  {
    id: "customer-service",
    mode: "knowledge",
    title: "Customer Service Assistant",
    subtitle: "Accounts, services, tickets, and customer history.",
    promptPlaceholder: "Ask about accounts, tickets, services, or customer history...",
    icon: "serviceDesk",
    chip: "Care"
  },
  {
    id: "reporting",
    mode: "knowledge",
    title: "Reporting Assistant",
    subtitle: "KPIs, reports, forecasting, dashboards, and generated SQL.",
    promptPlaceholder: "Ask for KPIs, reports, dashboards, or SQL...",
    icon: "reports",
    chip: "Reports"
  },
  {
    id: "platform",
    mode: "knowledge",
    title: "Platform Assistant",
    subtitle: "Navigation, configuration, administration, and platform guidance.",
    promptPlaceholder: "Ask for platform navigation or configuration help...",
    icon: "server",
    chip: "Platform"
  },
  {
    id: "dev",
    mode: "dev",
    title: "Admin / Dev",
    subtitle: "Browse repo context, read files, generate code, review commits, and stage GitHub changes.",
    promptPlaceholder: "Describe the code or repository change you want...",
    icon: "code",
    chip: "Repo"
  }
];

const mcpServers = [
  { name: "Azure SQL", icon: "database", status: "Ready" },
  { name: "Azure AI Foundry", icon: "bot", status: "Ready" },
  { name: "GitHub", icon: "github", status: "Connected" },
  { name: "Knowledge Base", icon: "knowledge", status: "Ready" }
];

const repoQuickAccess = [
  { label: "pricing-microservice", path: "pricing-microservice", type: "dir" },
  { label: "web-ui", path: "web-ui", type: "dir" },
  { label: ".github/workflows", path: ".github/workflows", type: "dir" },
  { label: "README.md", path: "README.md", type: "file" },
  { label: "package.json", path: "web-ui/package.json", type: "file" }
];

const routeLabels = {
  dashboard: "Dashboard",
  knowledge: "Knowledge",
  sales: "Sales",
  "product-pricing": "Pricing",
  "customer-service": "Customer Service",
  "customer-360": "Customer 360",
  billing: "Billing",
  orders: "Orders",
  reports: "Reporting",
  administration: "Administration",
  network: "Network",
  provisioning: "Activation",
  "service-management": "Service Management",
  "carrier-settlement": "Carrier Settlement"
};

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

function streamDelay(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function activeHashRoute() {
  const route = window.location.hash.replace(/^#\/?/, "") || "knowledge";
  return route === "quotes" ? "sales" : route;
}

function inferPageContext(context = {}) {
  const route = context.route || activeHashRoute();
  const parts = route.split("/");
  const detailType = parts[0] === "details" ? parts[1] : "";
  const detailId = parts[0] === "details" ? parts[2] : "";
  const label = detailType
    ? `${detailType.replaceAll("-", " ")} ${detailId || ""}`.trim()
    : routeLabels[route] || routeLabels[parts[0]] || route.replaceAll("-", " ");
  return {
    route,
    pageTitle: context.pageTitle || label,
    pageSummary: context.pageSummary || context.pageDescription || "Current telecom workspace context is attached automatically.",
    entityType: context.entityType || detailType || parts[0],
    entityId: context.entityId || detailId || "",
    customer: context.customer || context.account || "",
    products: context.products || context.product || [],
    pricing: context.pricing || {},
    approvals: context.approvals || []
  };
}

function githubProposalFiles(proposal) {
  const github = proposal.patch?.github || {};
  if (Array.isArray(github.files) && github.files.length) return github.files;
  if (github.filePath) return [{ filePath: github.filePath, content: github.content || "" }];
  return [];
}

function parseInlineMarkdown(text) {
  const parts = String(text).split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

function MarkdownBlock({ content }) {
  const text = String(content || "");
  const blocks = text.split(/```/g);
  if (blocks.length > 1) {
    return (
      <div className="assistant-markdown">
        {blocks.map((block, index) => {
          if (index % 2 === 1) {
            const [language, ...lines] = block.split("\n");
            return (
              <div className="assistant-chat-code" key={`code-${index}`}>
                <div><span>{language || "code"}</span></div>
                <pre>{lines.join("\n").trim()}</pre>
              </div>
            );
          }
          return <MarkdownBlock key={`text-${index}`} content={block.trim()} />;
        })}
      </div>
    );
  }

  const lines = text.split("\n").filter(line => line.trim());
  const tableLines = lines.filter(line => line.trim().startsWith("|") && line.trim().endsWith("|"));
  if (tableLines.length >= 2) {
    const rows = tableLines
      .filter(line => !/^\|\s*-+/.test(line))
      .map(line => line.split("|").slice(1, -1).map(cell => cell.trim()));
    const [head, ...body] = rows;
    return (
      <div className="assistant-table-wrap">
        <table>
          <thead><tr>{head.map(cell => <th key={cell}>{parseInlineMarkdown(cell)}</th>)}</tr></thead>
          <tbody>{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{parseInlineMarkdown(cell)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="assistant-markdown">
      {lines.length ? lines.map((line, index) => {
        const trimmed = line.trim();
        const imageMatch = trimmed.match(/^!\[(.*)\]\((https?:\/\/[^)]+)\)$/);
        if (imageMatch) return <img className="assistant-chat-image" key={index} src={imageMatch[2]} alt={imageMatch[1] || "Assistant generated visual"} />;
        if (/^[-*]\s+/.test(trimmed)) return <p className="assistant-list-line" key={index}>{parseInlineMarkdown(trimmed.replace(/^[-*]\s+/, ""))}</p>;
        if (/^\d+\.\s+/.test(trimmed)) return <p className="assistant-list-line" key={index}>{parseInlineMarkdown(trimmed)}</p>;
        return <p key={index}>{parseInlineMarkdown(trimmed)}</p>;
      }) : <p>{parseInlineMarkdown(text)}</p>}
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <article className={isUser ? "assistant-message user" : "assistant-message"}>
      <div className="assistant-message-avatar">
        <Icon name={isUser ? "account" : "bot"} className="button-icon" />
      </div>
      <div className="assistant-message-body">
        <div className="assistant-message-meta">
          <strong>{isUser ? "You" : "BDWUS AI"}</strong>
          <span>{message.timestamp}</span>
        </div>
        <MarkdownBlock content={message.content} />
      </div>
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

function FileBrowserEntry({ entry, onOpen }) {
  return (
    <button type="button" className={`assistant-file-entry ${entry.type}`} onClick={() => onOpen(entry)}>
      <Icon name={entry.type === "dir" ? "folder" : "file"} className="button-icon" />
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

function ContextRow({ label, value }) {
  return (
    <div className="assistant-context-row">
      <span>{label}</span>
      <strong>{value || "Not set"}</strong>
    </div>
  );
}

export function KnowledgeAssistant({ open, onClose, showToast, context, uiOverrides, onUiOverridesChange }) {
  const [agentId, setAgentId] = useState("knowledge");
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [conversationId, setConversationId] = useState(randomConversationId);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "I can search knowledge, draft telecom actions, or work with repository context. Choose an agent and ask naturally.",
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

  const activeAgent = assistantAgents.find(item => item.id === agentId) || assistantAgents[0];
  const mode = activeAgent.mode;
  const pageContext = useMemo(() => inferPageContext(context), [context]);

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

  const mergedContext = useMemo(() => ({
    ...context,
    ...pageContext,
    uiOverrides: uiOverrides || [],
    mode,
    agentId,
    agentTitle: activeAgent.title,
    agentResponsibilities: activeAgent.subtitle,
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
    recentFiles: [githubTarget.githubFilePath, activeFile?.path, ...selectedFiles.map(file => file.path)].filter(Boolean),
    connectedMcpServers: mcpServers.map(server => server.name),
    salesDefaults: mode === "agent" ? {
      accountName: agentDraft.accountName,
      contactName: agentDraft.contactName,
      ownerName: agentDraft.ownerName,
      estimatedValue: Number(agentDraft.estimatedValue) || 0,
      productInterest: agentDraft.productInterest,
      serviceNeeds: agentDraft.productInterest ? [agentDraft.productInterest] : []
    } : {}
  }), [activeAgent, activeFile, agentDraft, agentId, context, githubTarget, mode, pageContext, selectedFiles, uiOverrides]);

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
      const assistantTimestamp = formatTime();
      setMessages(current => [...current, { role: "assistant", content: "", timestamp: assistantTimestamp }]);
      const chunks = String(response.assistantMessage || "I am ready.").split(/(\s+)/);
      let streamed = "";
      for (let index = 0; index < chunks.length; index += 3) {
        streamed += chunks.slice(index, index + 3).join("");
        setMessages(current => current.map((item, itemIndex) => (
          itemIndex === current.length - 1 && item.role === "assistant"
            ? { ...item, content: streamed }
            : item
        )));
        await streamDelay(18);
      }
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

  function openQuickAccess(item) {
    if (mode !== "dev") setAgentId("dev");
    if (item.type === "dir") {
      setGithubTarget(current => ({ ...current, githubTreePath: item.path, githubFilePath: "" }));
      return;
    }
    openGithubEntry({ ...item, name: item.label });
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
    setMessages([{ role: "assistant", content: "Conversation cleared. Pick an agent and send the next request when you are ready.", timestamp: formatTime() }]);
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

  const recentActivity = [
    activeFile?.path && `Viewed ${activeFile.path}`,
    selectedFiles.length ? `Staged ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"}` : "",
    proposals.length ? `${proposals.length} approval card${proposals.length === 1 ? "" : "s"} generated` : "",
    `Searched ${pageContext.pageTitle}`,
    mode === "agent" ? "Lead workflow context ready" : "",
    mode === "dev" ? `Repository branch ${githubTarget.githubBranch}` : ""
  ].filter(Boolean);

  if (!open) return null;

  return (
    <div className="assistant-backdrop">
      <section className="assistant-modal assistant-modal-elevated" role="dialog" aria-modal="true" aria-label="Telecom AI assistant">
        <header className="assistant-modal-header assistant-modal-header-elevated">
          <div className="assistant-brand">
            <div className="assistant-brand-mark"><Icon name="radio" className="button-icon" /></div>
            <div>
              <strong>Telecom AI</strong>
              <span>AI-powered assistant for your telecom platform</span>
            </div>
          </div>
          <div className="assistant-window-actions">
            <span className="assistant-connection-badge"><i />Repo Connected</span>
            <button type="button" className="assistant-icon-button" aria-label="Settings"><Icon name="settings" className="button-icon" /></button>
            <button type="button" className="assistant-icon-button" aria-label="Minimize"><Icon name="minimize" className="button-icon" /></button>
            <button type="button" className="assistant-icon-button" aria-label="Close" onClick={onClose}><Icon name="close" className="button-icon" /></button>
          </div>
        </header>

        <section className="assistant-agent-bar">
          <div className="assistant-agent-select">
            <span>Agent / Action</span>
            <button type="button" className="assistant-agent-trigger" onClick={() => setAgentMenuOpen(current => !current)}>
              <Icon name={activeAgent.icon} className="button-icon" />
              <strong>{activeAgent.title}</strong>
              <Icon name="chevronDown" className="button-icon" />
            </button>
            {agentMenuOpen && (
              <div className="assistant-agent-menu">
                {assistantAgents.map(agent => (
                  <button
                    type="button"
                    className={agent.id === agentId ? "active" : ""}
                    key={agent.id}
                    onClick={() => {
                      setAgentId(agent.id);
                      setAgentMenuOpen(false);
                    }}
                  >
                    <Icon name={agent.icon} className="button-icon" />
                    <span>
                      <strong>{agent.title}</strong>
                      <small>{agent.subtitle}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="assistant-agent-summary">
            <div className="assistant-agent-icon"><Icon name={activeAgent.icon} className="button-icon" /></div>
            <div>
              <strong>{activeAgent.title}</strong>
              <span>{activeAgent.subtitle}</span>
            </div>
          </div>
        </section>

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

        <div className="assistant-body assistant-body-elevated">
          <main className="assistant-conversation-shell">
            <div className="assistant-thread">
              {messages.map((message, index) => <MessageBubble key={`${message.role}-${index}-${message.timestamp}`} message={message} />)}
              {loading && (
                <div className="assistant-thinking">
                  <span /><span /><span />
                  <strong>{activeAgent.title} is thinking</strong>
                </div>
              )}
            </div>

            {(error || repoError) && <div className="assistant-error">{error || repoError}</div>}

            <form className="assistant-composer assistant-composer-elevated" onSubmit={handleSubmit}>
              <textarea
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder={activeAgent.promptPlaceholder}
              />
              <div className="assistant-composer-footer">
                <div className="assistant-composer-tools">
                  <button type="button" aria-label="Attach file"><Icon name="paperclip" className="button-icon" /></button>
                  <button type="button" aria-label="Voice input" disabled><Icon name="mic" className="button-icon" /></button>
                  <button type="button" aria-label="Image upload" disabled><Icon name="image" className="button-icon" /></button>
                </div>
                <div className="assistant-composer-actions">
                  <button type="button" className="ghost-button" onClick={resetConversation}>Reset</button>
                  <span className="assistant-agent-pill"><Icon name={activeAgent.icon} className="button-icon" />{activeAgent.title}</span>
                  <button className="button assistant-send" type="submit" disabled={loading}>
                    {loading ? "Sending..." : "Send"}
                    <Icon name="leads" className="button-icon" />
                  </button>
                </div>
              </div>
            </form>
          </main>

          <aside className="assistant-sidebar assistant-sidebar-workspace">
            <section className="assistant-panel assistant-panel-context">
              <div className="assistant-panel-heading">
                <div>
                  <strong>Context</strong>
                  <span>Automatically attached to every request</span>
                </div>
              </div>
              <ContextRow label="Current Agent" value={activeAgent.title} />
              <ContextRow label="Repository" value={githubTarget.githubRepo} />
              <ContextRow label="Branch" value={githubTarget.githubBranch} />
              <ContextRow label="Focused Path" value={githubTarget.githubFilePath || githubTarget.githubTreePath || pageContext.route} />
              <ContextRow label="Current Model" value="Azure AI Foundry / gpt-5-nano" />
              <ContextRow label="Workspace Status" value={mode === "dev" ? `${selectedFiles.length} staged file${selectedFiles.length === 1 ? "" : "s"}` : pageContext.pageTitle} />
              <ContextRow label="Knowledge Status" value={`${context?.knowledgeDocuments?.length || 0} docs in context`} />
              <div className="assistant-mcp-list">
                {mcpServers.map(server => (
                  <span key={server.name}><Icon name={server.icon} className="button-icon" />{server.name}</span>
                ))}
              </div>
            </section>

            <section className="assistant-panel assistant-panel-workspace">
              <div className="assistant-panel-heading">
                <div>
                  <strong>Repository Quick Access</strong>
                  <span>{repoLoading.tree ? "Refreshing files..." : `${treeEntries.length || 0} visible items`}</span>
                </div>
                <button type="button" className="ghost-button" onClick={resetRepoWorkspace}>Clear</button>
              </div>
              <div className="assistant-repo-controls">
                <input value={githubTarget.githubRepo} onChange={event => setGithubTarget(current => ({ ...current, githubRepo: event.target.value }))} placeholder="owner/repo" />
                <select value={githubTarget.githubBranch} onChange={event => setGithubTarget(current => ({ ...current, githubBranch: event.target.value, githubTreePath: "", githubFilePath: "" }))}>
                  {githubBranches.length ? githubBranches.map(branch => (
                    <option key={branch.name} value={branch.name}>{branch.name}</option>
                  )) : <option value={githubTarget.githubBranch}>{githubTarget.githubBranch || "Select branch"}</option>}
                </select>
              </div>
              <RepoBreadcrumbs path={githubTarget.githubTreePath} onNavigate={path => setGithubTarget(current => ({ ...current, githubTreePath: path, githubFilePath: "" }))} />
              <div className="assistant-quick-list">
                {repoQuickAccess.map(item => (
                  <button type="button" key={item.path} onClick={() => openQuickAccess(item)}>
                    <Icon name={item.type === "dir" ? "folder" : "file"} className="button-icon" />
                    <span><strong>{item.label}</strong><small>{item.type === "dir" ? "Open" : "Read"}</small></span>
                  </button>
                ))}
              </div>
              {mode === "dev" && (
                <div className="assistant-file-browser">
                  {treeEntries.length ? treeEntries.slice(0, 8).map(entry => (
                    <FileBrowserEntry key={`${entry.type}-${entry.path}`} entry={entry} onOpen={openGithubEntry} />
                  )) : <p className="assistant-muted">Select Admin / Dev or open a folder to browse repository files.</p>}
                </div>
              )}
            </section>

            {mode === "dev" && (
              <>
                <section className="assistant-panel assistant-panel-preview">
                  <div className="assistant-panel-heading">
                    <div>
                      <strong>Active File</strong>
                      <span>{activeFile?.path || "Open a file from the workspace"}</span>
                    </div>
                    <button type="button" className="button" onClick={stageActiveFile} disabled={!activeFile}>Stage</button>
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
                      <strong>Staged Files</strong>
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
                    )) : <p className="assistant-muted">Stage files to let the Admin / Dev agent work across real branch content.</p>}
                  </div>
                </section>
              </>
            )}

            <section className="assistant-panel assistant-panel-proposals">
              <div className="assistant-panel-heading">
                <div>
                  <strong>Approval Cards</strong>
                  <span>{proposals.length ? `${proposals.length} ready for review` : "No pending approvals"}</span>
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
              )) : <p className="assistant-muted">Lead, GitHub, SQL, and UI actions will appear here for approval.</p>}
            </section>

            <section className="assistant-panel assistant-panel-activity">
              <div className="assistant-panel-heading">
                <div>
                  <strong>Recent Activity</strong>
                  <span>Files, searches, commits, SQL, leads, and quotes</span>
                </div>
              </div>
              <div className="assistant-activity-list">
                {recentActivity.map((item, index) => <span key={`${item}-${index}`}><Icon name={index % 2 ? "search" : "activity"} className="button-icon" />{item}</span>)}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </div>
  );
}
