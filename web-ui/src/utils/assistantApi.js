const DEFAULT_ASSISTANT_API_BASE = "https://bdwusca.delightfulsea-ef64ed74.westus2.azurecontainerapps.io";

export const assistantApiBase = (import.meta.env.VITE_AI_API_BASE_URL || DEFAULT_ASSISTANT_API_BASE).replace(/\/$/, "");

function assistantUrl(path) {
  return `${assistantApiBase}${path}`;
}

async function requestJson(path, options = {}) {
  const response = await fetch(assistantUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Assistant request failed: ${response.status}`);
  }
  return response.json();
}

export function mergeKnowledgeUi(base, overrides = []) {
  const next = { ...base };
  overrides.forEach(override => {
    const key = override.targetKey || "";
    if (key === "knowledge.pageHeader.askAiLabel") next.askAiLabel = override.value;
    if (key === "knowledge.pageHeader.title") next.title = override.value;
    if (key === "knowledge.pageHeader.description") next.description = override.value;
    if (key === "knowledge.repository.title") next.repositoryTitle = override.value;
    if (key === "knowledge.repository.description") next.repositoryDescription = override.value;
    if (key === "knowledge.prompts") next.prompts = Array.isArray(override.value) ? override.value : next.prompts;
  });
  return next;
}

export function mergeAssistantPages(overrides = []) {
  const pages = [];
  const pageOverrides = new Map();
  overrides.forEach(override => {
    const key = override.targetKey || "";
    if (key === "assistant.pages") {
      const value = override.value;
      if (Array.isArray(value)) {
        value.forEach(item => pages.push(item));
      } else if (value) {
        pages.push(value);
      }
      return;
    }
    if (!["pageTitle", "pageContent", "pageDescription"].includes(key)) return;
    const bucketKey = String(override.sourceChangeRequestId || key);
    const bucket = pageOverrides.get(bucketKey) || { id: bucketKey, title: "", description: "", content: "" };
    if (key === "pageTitle") bucket.title = override.value;
    if (key === "pageDescription") bucket.description = override.value;
    if (key === "pageContent") bucket.content = override.value;
    pageOverrides.set(bucketKey, bucket);
  });
  pageOverrides.forEach(page => {
    pages.push({
      id: page.id,
      title: page.title || "Generated page",
      description: page.description || page.content || "Assistant-generated page",
      route: page.id,
      sections: [
        {
          title: "Content",
          body: page.content || page.description || "Approved by the assistant"
        }
      ]
    });
  });
  return pages;
}

export async function fetchAssistantUiOverrides(scope = "knowledge") {
  return requestJson(`/api/assistant/ui-overrides?scope=${encodeURIComponent(scope)}`);
}

export async function chatAssistant(payload) {
  return requestJson("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function approveAssistantChange(changeRequestId, approvedBy = "admin") {
  return requestJson(`/api/assistant/change-requests/${changeRequestId}/approve`, {
    method: "POST",
    body: JSON.stringify({ approvedBy })
  });
}

export async function rejectAssistantChange(changeRequestId, approvedBy = "admin") {
  return requestJson(`/api/assistant/change-requests/${changeRequestId}/reject`, {
    method: "POST",
    body: JSON.stringify({ approvedBy })
  });
}
