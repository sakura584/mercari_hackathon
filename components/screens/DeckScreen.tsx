"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { Item, ItemClassification } from "@/lib/types";

export function DeckScreen({
  sessionId,
  items,
  onComplete,
}: {
  sessionId: string;
  items: Item[];
  onComplete: (classifiedItems: Item[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [classified, setClassified] = useState<Item[]>(items);

  const current = items[index];

  async function classify(classification: ItemClassification) {
    await apiClient.updateClassification(sessionId, current.id, classification);

    const next = classified.map((item) =>
      item.id === current.id ? { ...item, initialClassification: classification } : item
    );
    setClassified(next);

    if (index + 1 >= items.length) {
      onComplete(next);
      return;
    }
    setIndex(index + 1);
  }

  if (!current) {
    return null;
  }

  return (
    <section className="screen active">
      <div className="app-bar">
        <div className="app-bar-title">直感で仕分けよう</div>
      </div>
      <div className="screen-scroll">
        <div className="deck-progress">
          {index + 1} / {items.length}
        </div>
        <div className="deck-stage">
          <div className="deck-card">
            <div className="mi-thumb">📦</div>
            <div className="mi-name">{current.title}</div>
            {current.estimatedPrice ? <div className="mi-price">¥{current.estimatedPrice.toLocaleString("ja-JP")}</div> : null}
          </div>
        </div>
        <div className="deck-buttons">
          <button type="button" className="deck-btn keep" onClick={() => classify("keep")}>
            <span className="db-icon">◀</span>残したい
          </button>
          <button type="button" className="deck-btn unsure" onClick={() => classify("unsure")}>
            <span className="db-icon">🤔</span>迷う
          </button>
          <button type="button" className="deck-btn release" onClick={() => classify("releaseable")}>
            <span className="db-icon">▶</span>手放せそう
          </button>
        </div>
      </div>
    </section>
  );
}
