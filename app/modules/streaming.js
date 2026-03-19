/**
 * streaming.js — Token-by-token streaming utilities for Orion chat.
 * Provides a typed streaming reader that handles SSE and JSON responses.
 */
"use strict";

/**
 * Stream a response from the Orion backend token-by-token.
 * Calls onDelta(text) for each streamed token, onStatus(evt) for status events.
 * Returns { text, sources, files, quota } on completion.
 */
export async function streamResponse(res, { onDelta, onStatus } = {}) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();

  if (ct.includes("application/json")) {
    const data = await res.json();
    const text = data.reply || data.text || data.message || "(no reply)";
    if (onDelta) onDelta(text);
    return {
      text,
      sources: Array.isArray(data.sources) ? data.sources : [],
      files: data.files || null,
      quota: data.quota || null,
    };
  }

  // SSE / text stream
  const reader  = res.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text   = "";
  let sources = [];
  let files   = null;
  let quota   = null;

  while (reader) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let si;
    while ((si = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, si);
      buffer = buffer.slice(si + 2);
      const dl = chunk.split("\n").find(l => l.startsWith("data:"));
      if (!dl) continue;

      let evt;
      try { evt = JSON.parse(dl.slice(5).trim()); } catch { continue; }

      if (evt.type === "delta") {
        const tok = evt.text || "";
        text += tok;
        if (onDelta) onDelta(tok);
      } else if (evt.type === "status") {
        if (onStatus) onStatus(evt);
      } else if (evt.type === "done") {
        if (!text.trim() && evt.reply) { text = evt.reply; if (onDelta) onDelta(evt.reply); }
        sources = Array.isArray(evt.sources) ? evt.sources : [];
        files   = evt.files || null;
        quota   = evt.quota || null;
      } else if (evt.type === "error") {
        throw new Error(evt.message || "Streaming failed");
      }
    }
  }

  return { text, sources, files, quota };
}
