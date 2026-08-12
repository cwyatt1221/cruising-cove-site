/**
 * Cruising Cove Ask AI First Mate chat widget.
 * Drop <script src="/assets/chat-widget.js" defer></script> before </body> on any page.
 *
 * Exposes window.CruisingCoveChat.open() for the nav First Mate control.
 */
(function () {
  "use strict";

  const SESSION_KEY = "cc_chat_session_id";
  const HISTORY_KEY = "cc_chat_history_v1";
  const MAX_HISTORY = 8;

  function getSessionId() {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now() + "-" + Math.random().toString(36).slice(2);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  /** @returns {{role: string, content: string}[]} */
  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function (t) {
          return t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string";
        })
        .slice(-MAX_HISTORY);
    } catch (_) {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch (_) {
      /* ignore quota */
    }
  }

  const styles = `
    .cc-chat-btn {
      position: fixed; bottom: 22px; right: 22px; z-index: 9999;
      width: 60px; height: 60px; border-radius: 50%;
      background: #c9a24b; border: none; cursor: pointer;
      box-shadow: 0 8px 24px -6px rgba(15,28,51,0.45);
      display: flex; align-items: center; justify-content: center;
      transition: transform .15s ease, background .2s ease;
      font-family: "Source Sans 3", system-ui, sans-serif;
    }
    .cc-chat-btn:hover { background: #d4b05a; transform: translateY(-2px); }
    .cc-chat-btn svg { width: 26px; height: 26px; }

    .cc-chat-panel {
      position: fixed; bottom: 94px; right: 22px; z-index: 9999;
      width: 360px; max-width: calc(100vw - 32px);
      height: 480px; max-height: calc(100vh - 140px);
      background: #f5f0e1; border-radius: 8px;
      box-shadow: 0 20px 50px -12px rgba(15,28,51,0.5);
      display: none; flex-direction: column; overflow: hidden;
      font-family: "Source Sans 3", system-ui, sans-serif;
      border: 1px solid rgba(26,42,74,0.1);
    }
    .cc-chat-panel.cc-open { display: flex; }

    .cc-chat-header {
      background: #0f1c33; color: #f5f0e1; padding: 16px 18px;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
    }
    .cc-chat-header h3 { margin: 0; font-size: 0.98rem; font-weight: 700; letter-spacing: 0.01em; }
    .cc-chat-header p { margin: 2px 0 0; font-size: 0.76rem; color: #c7cbd6; }
    .cc-chat-close {
      background: none; border: none; color: #c7cbd6; cursor: pointer;
      font-size: 1.3rem; line-height: 1; padding: 4px; margin-left: 8px;
    }
    .cc-chat-close:hover { color: #f5f0e1; }

    .cc-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex;
      flex-direction: column; gap: 12px; background: #faf7ee;
    }
    .cc-msg { max-width: 84%; padding: 10px 13px; border-radius: 10px; font-size: 0.88rem; line-height: 1.45; white-space: pre-wrap; }
    .cc-msg-user { align-self: flex-end; background: #1e5c5c; color: #f5f0e1; border-bottom-right-radius: 3px; }
    .cc-msg-bot { align-self: flex-start; background: #FFFFFF; color: #2c2c2a; border: 1px solid rgba(26,42,74,0.08); border-bottom-left-radius: 3px; }
    .cc-msg-error { align-self: flex-start; background: #FBEAE5; color: #7A2E1B; border: 1px solid #F0C7B8; }
    .cc-msg a { color: #1e5c5c; font-weight: 600; text-decoration: underline; }
    .cc-msg-user a { color: #f5f0e1; }

    .cc-typing { display: flex; gap: 4px; align-self: flex-start; padding: 10px 13px; }
    .cc-typing span {
      width: 6px; height: 6px; border-radius: 50%; background: #9CB3B8;
      animation: cc-bounce 1.2s infinite ease-in-out;
    }
    .cc-typing span:nth-child(2) { animation-delay: 0.15s; }
    .cc-typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes cc-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .cc-typing span { animation: none; opacity: 0.8; } }

    .cc-chat-input-row {
      display: flex; gap: 8px; padding: 12px; border-top: 1px solid rgba(26,42,74,0.08);
      background: #f5f0e1; flex-shrink: 0;
    }
    .cc-chat-input {
      flex: 1; border: 1px solid rgba(26,42,74,0.18); border-radius: 20px;
      padding: 9px 14px; font-size: 0.88rem; outline: none;
      font-family: inherit; color: #2c2c2a;
    }
    .cc-chat-input:focus { border-color: #1e5c5c; }
    .cc-chat-send {
      background: #c9a24b; border: none; border-radius: 50%;
      width: 38px; height: 38px; flex-shrink: 0; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background .2s ease;
    }
    .cc-chat-send:hover:not(:disabled) { background: #d4b05a; }
    .cc-chat-send:disabled { opacity: 0.5; cursor: default; }
    .cc-chat-send svg { width: 16px; height: 16px; }

    .cc-chat-disclaimer {
      font-size: 0.68rem; color: #6b6b62; text-align: center;
      padding: 6px 12px 10px; background: #f5f0e1;
    }
  `;

  function injectStyles() {
    const tag = document.createElement("style");
    tag.textContent = styles;
    document.head.appendChild(tag);
  }

  function el(tag, className, html) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function linkify(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(
      /(https?:\/\/[^\s<]+)|(Open this guide:\s*)(\/[^\s<]+)/gi,
      function (match, url, label, path) {
        if (url) {
          const clean = url.replace(/[.,);]+$/, "");
          const trailing = url.slice(clean.length);
          return '<a href="' + clean + '" target="_blank" rel="noopener noreferrer">' + clean + "</a>" + trailing;
        }
        const href = "https://www.cruisingcove.com" + path;
        return escapeHtml(label) + '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(path) + "</a>";
      }
    );
  }

  function buildWidget() {
    const btn = el("button", "cc-chat-btn");
    btn.setAttribute("aria-label", "Open Ask AI First Mate");
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="#0f1c33" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-4-1L3 20l1-5.5A8.38 8.38 0 0 1 3 11.5 8.5 8.5 0 0 1 11.5 3h.5a8.5 8.5 0 0 1 8.5 8.5z"/></svg>';

    const panel = el("div", "cc-chat-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Ask AI First Mate");

    const header = el("div", "cc-chat-header");
    header.innerHTML =
      "<div><h3>Ask AI First Mate</h3><p>Ships, ports, packing, costs — with memory</p></div>";
    const closeBtn = el("button", "cc-chat-close", "&times;");
    closeBtn.setAttribute("aria-label", "Close Ask AI First Mate");
    header.appendChild(closeBtn);

    const messages = el("div", "cc-chat-messages");
    messages.setAttribute("aria-live", "polite");

    const welcomeMsg = el(
      "div",
      "cc-msg cc-msg-bot",
      "Hi! I’m your AI First Mate. Ask about ships, stern characters, ports, packing, or costs — I’ll remember this chat and point you to the right Cruising Cove guide."
    );
    messages.appendChild(welcomeMsg);

    const inputRow = el("div", "cc-chat-input-row");
    const input = el("input", "cc-chat-input");
    input.type = "text";
    input.placeholder = "Ask AI First Mate...";
    input.setAttribute("aria-label", "Ask AI First Mate");
    const sendBtn = el("button", "cc-chat-send");
    sendBtn.setAttribute("aria-label", "Send question");
    sendBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="#0f1c33" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);

    const disclaimer = el(
      "div",
      "cc-chat-disclaimer",
      "Cruising Cove is an independent, unofficial resource — not affiliated with Disney."
    );

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(inputRow);
    panel.appendChild(disclaimer);

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    /** @type {{role: string, content: string}[]} */
    let history = loadHistory();

    function togglePanel(open) {
      const isOpen = open !== undefined ? open : !panel.classList.contains("cc-open");
      panel.classList.toggle("cc-open", isOpen);
      if (isOpen) input.focus();
    }

    btn.addEventListener("click", function () {
      togglePanel();
    });
    closeBtn.addEventListener("click", function () {
      togglePanel(false);
    });

    window.CruisingCoveChat = {
      open: function () {
        togglePanel(true);
      },
      close: function () {
        togglePanel(false);
      },
      toggle: function () {
        togglePanel();
      },
      clearHistory: function () {
        history = [];
        saveHistory(history);
      },
    };

    function addMessage(text, kind) {
      const msg = el("div", "cc-msg cc-msg-" + kind);
      if (kind === "bot") msg.innerHTML = linkify(text);
      else msg.textContent = text;
      messages.appendChild(msg);
      messages.scrollTop = messages.scrollHeight;
      return msg;
    }

    // Restore prior turns into the UI (welcome stays first).
    history.forEach(function (turn) {
      addMessage(turn.content, turn.role === "user" ? "user" : "bot");
    });

    function showTyping() {
      const typing = el("div", "cc-typing", "<span></span><span></span><span></span>");
      typing.setAttribute("data-typing", "1");
      messages.appendChild(typing);
      messages.scrollTop = messages.scrollHeight;
      return typing;
    }

    let sending = false;
    async function send() {
      const question = input.value.trim();
      if (!question || sending) return;

      addMessage(question, "user");
      input.value = "";
      sending = true;
      sendBtn.disabled = true;
      const typingEl = showTyping();

      const historyForRequest = history.slice();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: question,
            sessionId: getSessionId(),
            history: historyForRequest,
          }),
        });
        typingEl.remove();

        if (!res.ok) {
          const body = await res.json().catch(function () {
            return {};
          });
          addMessage(body.error || "Something went wrong. Please try again.", "error");
        } else {
          const data = await res.json();
          const answer = data.answer || "";
          addMessage(answer, "bot");
          history.push({ role: "user", content: question });
          history.push({ role: "assistant", content: answer });
          history = history.slice(-MAX_HISTORY);
          saveHistory(history);
        }
      } catch (err) {
        typingEl.remove();
        addMessage("Couldn't reach Ask AI First Mate right now. Please try again in a moment.", "error");
      } finally {
        sending = false;
        sendBtn.disabled = false;
        input.focus();
      }
    }

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") send();
    });
  }

  function init() {
    injectStyles();
    buildWidget();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
