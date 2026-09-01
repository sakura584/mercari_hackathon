"use client";

import { useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { FinalDecision, Item } from "@/lib/types";
import { DialogueScreen } from "./DialogueScreen";

function decisionsFromInitialClassifications(items: Item[]): Record<string, FinalDecision> {
  return items.reduce<Record<string, FinalDecision>>((decisions, item) => {
    if (item.initialClassification === "keep") decisions[item.id] = "keep";
    if (item.initialClassification === "releaseable") decisions[item.id] = "let_go";
    return decisions;
  }, {});
}

export function FinalScreen({
  sessionId,
  items,
  onAllDecided,
}: {
  sessionId: string;
  items: Item[];
  onAllDecided: (decidedItems: Item[]) => void;
}) {
  // 「残す」「手放す」は一次判断をそのまま最終判断として引き継ぐ。
  // 「迷う」だけがReflection Agentによる追加判断の対象になる。
  const [decided, setDecided] = useState<Record<string, FinalDecision>>(() =>
    decisionsFromInitialClassifications(items)
  );
  const unsureItems = useMemo(
    () => items.filter((item) => item.initialClassification === "unsure"),
    [items]
  );
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [dialogueStarted, setDialogueStarted] = useState(false);

  const currentDialogueItem = dialogueStarted ? unsureItems[dialogueIndex] : undefined;

  async function decideNonDialogueItem(item: Item, decision: FinalDecision) {
    await apiClient.submitDecision(sessionId, item.id, {
      decision,
      itemName: item.title,
      imageUrl: item.imageUrl,
    });
    setDecided((prev) => ({ ...prev, [item.id]: decision }));
  }

  function handleDialogueDecided(decision: FinalDecision) {
    const item = unsureItems[dialogueIndex];
    setDecided((prev) => ({ ...prev, [item.id]: decision }));

    if (dialogueIndex + 1 < unsureItems.length) {
      setDialogueIndex(dialogueIndex + 1);
    } else {
      setDialogueStarted(false);
    }
  }

  if (currentDialogueItem) {
    return (
      <DialogueScreen
        sessionId={sessionId}
        item={currentDialogueItem}
        onDecided={handleDialogueDecided}
      />
    );
  }

  const allDecided = items.length > 0 && items.every((item) => decided[item.id] !== undefined);

  return (
    <section className="screen active">
      <div className="app-bar">
        <div className="app-bar-title">最終確認</div>
      </div>
      <div className="screen-scroll">
        <p className="hero-sub">AIの言葉はあくまで判断材料です。最終的な決定はいつでも変更できます。</p>
        <div className="final-list">
          {items.map((item) => (
            <div key={item.id} className="final-row">
              <span className="mi-name">{item.title}</span>
              {item.initialClassification === "unsure" ? (
                <span>{decided[item.id] ? `決定済み: ${decided[item.id]}` : "対話が必要"}</span>
              ) : (
                <div className="decision-row">
                  <button
                    type="button"
                    className="decision-btn sell"
                    onClick={() => decideNonDialogueItem(item, "let_go")}
                  >
                    売る
                  </button>
                  <button
                    type="button"
                    className="decision-btn keep"
                    onClick={() => decideNonDialogueItem(item, "keep")}
                  >
                    残す
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {unsureItems.length > 0 && !allDecided ? (
          <button type="button" className="cta" onClick={() => setDialogueStarted(true)}>
            「迷う」物について対話する（{unsureItems.length}件）
          </button>
        ) : null}

        <button
          type="button"
          className="cta"
          disabled={!allDecided}
          onClick={() =>
            onAllDecided(
              items.map((item) => ({ ...item, finalDecision: decided[item.id] ?? item.finalDecision }))
            )
          }
        >
          売却プランを見る
        </button>
      </div>
    </section>
  );
}
