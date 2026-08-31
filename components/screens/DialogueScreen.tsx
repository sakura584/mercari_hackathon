"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { FinalDecision, Item, ReflectionState } from "@/lib/types";

type ChatEntry = { role: "assistant" | "user"; text: string };

export function DialogueScreen({
  sessionId,
  item,
  onDecided,
}: {
  sessionId: string;
  item: Item;
  onDecided: (decision: FinalDecision) => void;
}) {
  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [summary, setSummary] = useState<Partial<ReflectionState> | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient.startReflection(sessionId, item.id, item.title).then(() => {
      if (cancelled) return;
      setChatLog([
        { role: "assistant", text: `「${item.title}」について、少しだけ質問させてください。` },
      ]);
      setPendingQuestion("この物そのものに愛着がありますか。それとも、紐づく出来事を残したいですか？");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, item.id, item.title]);

  async function sendAnswer() {
    if (!draft.trim()) return;
    const userText = draft;
    setChatLog((log) => [...log, { role: "user", text: userText }]);
    setDraft("");
    setLoading(true);

    const result = await apiClient.sendReflectionMessage(sessionId, item.id, userText);
    if (result.action === "ask") {
      setChatLog((log) => [...log, { role: "assistant", text: result.reflection }]);
      setPendingQuestion(result.question);
    } else {
      setChatLog((log) => [...log, { role: "assistant", text: result.reflection }]);
      setPendingQuestion(null);
      setSummary(result.summary);
    }
    setLoading(false);
  }

  async function decide(decision: FinalDecision) {
    await apiClient.submitDecision(sessionId, item.id, {
      decision,
      itemName: item.title,
      imageUrl: item.imageUrl,
    });
    onDecided(decision);
  }

  return (
    <section className="screen active">
      <div className="app-bar">
        <div className="app-bar-title">少しだけ質問させてください</div>
      </div>
      <div className="screen-scroll">
        <div className="chat-item-header">
          <span className="cih-name">{item.title}</span>
        </div>
        <div className="chat-log">
          {chatLog.map((entry, i) => (
            <div key={i} className={`chat-bubble chat-bubble--${entry.role}`}>
              {entry.text}
            </div>
          ))}
          {pendingQuestion ? <div className="chat-bubble chat-bubble--assistant">{pendingQuestion}</div> : null}
        </div>

        {summary ? (
          <div className="decision-row">
            <button type="button" className="decision-btn sell" onClick={() => decide("let_go")}>
              売る
            </button>
            <button type="button" className="decision-btn keep" onClick={() => decide("keep")}>
              残す
            </button>
            <button type="button" className="decision-btn hold" onClick={() => decide("hold")}>
              今は保留
            </button>
          </div>
        ) : (
          <div className="chat-choices">
            <input
              className="draft-input"
              value={draft}
              disabled={loading}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendAnswer()}
            />
            <button type="button" className="cta" disabled={loading} onClick={sendAnswer}>
              送信
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
