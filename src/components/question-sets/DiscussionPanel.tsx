"use client";

import { useState } from "react";
import { Markdown } from "@/components/ui/Markdown";

type Message = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
};

const QUICK_PROMPTS = [
  { label: "Explain further", prompt: "Explain this concept further in simpler terms." },
  { label: "Give an example", prompt: "Give me a real-life example to help me understand." },
  { label: "Why did I lose marks?", prompt: "Why did I lose marks, and how would I get full marks?" },
  { label: "More possible answers", prompt: "What other valid points could I have included?" },
  { label: "Quiz me", prompt: "Ask me a follow-up question to test my understanding." },
];

export function DiscussionPanel({ gradingId }: { gradingId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && messages === null) {
      setLoading(true);
      const res = await fetch(`/api/gradings/${gradingId}/messages`);
      setLoading(false);
      if (res.ok) {
        const body = await res.json();
        setMessages(body.messages);
      } else {
        setMessages([]);
        setError("Could not load this discussion.");
      }
    }
  }

  async function send(content: string) {
    const text = content.trim();
    if (!text || pending) return;
    setError(null);
    setPending(text);
    setDraft("");

    const res = await fetch(`/api/gradings/${gradingId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    setPending(null);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Could not get a reply. Try again.");
      setDraft(text);
      return;
    }
    const body = await res.json();
    setMessages((prev) => [...(prev ?? []), ...body.messages]);
  }

  return (
    <div className="mt-3 border-t border-success/30 pt-3">
      <button
        type="button"
        onClick={toggle}
        className="text-xs font-medium text-primary hover:underline"
      >
        {open ? "Hide discussion" : "Discuss this answer"}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

          {messages?.length === 0 && !pending && (
            <p className="text-xs text-muted-foreground">
              Not sure about something? Ask for an explanation, an example, or more possible answers.
            </p>
          )}

          {messages?.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "USER"
                  ? "self-end max-w-[85%] rounded-md bg-primary px-3 py-2 text-primary-foreground"
                  : "self-start max-w-[95%] rounded-md border border-border bg-card px-3 py-2 text-foreground"
              }
            >
              {m.role === "USER" ? <p className="whitespace-pre-wrap">{m.content}</p> : <Markdown>{m.content}</Markdown>}
            </div>
          ))}

          {pending && (
            <>
              <div className="self-end max-w-[85%] rounded-md bg-primary px-3 py-2 text-primary-foreground opacity-70">
                <p className="whitespace-pre-wrap">{pending}</p>
              </div>
              <p className="text-xs text-muted-foreground">Thinking…</p>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map(({ label, prompt }) => (
              <button
                key={label}
                type="button"
                onClick={() => send(prompt)}
                disabled={pending !== null || loading}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex gap-2"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder="Ask anything about this question…"
              rows={2}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={pending !== null || loading || !draft.trim()}
              className="self-end rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Send
            </button>
          </form>

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
