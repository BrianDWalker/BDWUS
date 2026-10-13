import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icons";
import { chatAssistant } from "../utils/assistantApi";

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function conversationId() {
  return window.crypto?.randomUUID?.() || `conv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function plainText(value) {
  return String(value || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+\n/g, "\n")
    .trim();
}

export function AiAssistPopover({ open, onClose, context }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversation, setConversation] = useState(() => window.sessionStorage.getItem("bdwus-ai-conversation-id") || conversationId());
  const inputRef = useRef(null);
  const threadRef = useRef(null);

  const payloadContext = useMemo(() => ({
    route: context?.route || "",
    pageTitle: context?.pageTitle || "",
    pageSummary: context?.pageSummary || "Current workspace context is attached automatically."
  }), [context]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function handleSubmit(event) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    setError("");
    setLoading(true);
    setInput("");
    setMessages(current => [...current, { role: "user", content: message, timestamp: formatTime() }]);
    try {
      const response = await chatAssistant({
        conversationId: conversation,
        mode: "knowledge",
        message,
        context: payloadContext,
        userName: "admin"
      });
      const nextConversation = response.conversationId || conversation;
      window.sessionStorage.setItem("bdwus-ai-conversation-id", nextConversation);
      setConversation(nextConversation);
      setMessages(current => [...current, {
        role: "assistant",
        content: plainText(response.assistantMessage || "I am ready."),
        timestamp: formatTime()
      }]);
    } catch (err) {
      setError(err.message || "Assistant request failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="topnav-ai-shell">
      <section className="topnav-ai-popover" role="dialog" aria-modal="false" aria-label="AI Assist">
        <header className="topnav-ai-header">
          <div className="topnav-ai-title">
            <strong>AI Assist</strong>
          </div>
          <button className="topnav-icon-button" type="button" aria-label="Close AI Assist" onClick={onClose}>
            <Icon name="close" className="button-icon" />
          </button>
        </header>
        <div className="topnav-ai-thread" ref={threadRef}>
          {messages.length === 0 && !loading ? (
            <div className="topnav-ai-empty">Ready to chat.</div>
          ) : null}
          {messages.map((message, index) => (
            <article key={`${message.role}-${index}-${message.timestamp}`} className={message.role === "user" ? "topnav-ai-message user" : "topnav-ai-message"}>
              <div className="topnav-ai-meta">{message.role === "user" ? "You" : "AI Assist"} · {message.timestamp}</div>
              <div className="topnav-ai-bubble">{message.content}</div>
            </article>
          ))}
          {loading ? (
            <div className="topnav-ai-message">
              <div className="topnav-ai-meta">AI Assist</div>
              <div className="topnav-ai-bubble">Thinking...</div>
            </div>
          ) : null}
          {error ? <div className="topnav-ai-error">{error}</div> : null}
        </div>
        <form className="topnav-ai-composer" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder="Ask a question"
            aria-label="Ask AI Assist"
          />
          <button className="button topnav-ai-send" type="submit" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
