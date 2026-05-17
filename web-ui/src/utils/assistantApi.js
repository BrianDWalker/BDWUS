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
