"use client";

import { useState } from "react";
import { apiClient, resizeImageToBase64 } from "@/lib/api-client";
import { useSessionId } from "@/hooks/useSessionId";
import type { Item, PurposeType } from "@/lib/types";
import { HomeScreen } from "./screens/HomeScreen";
import { IntroScreen } from "./screens/IntroScreen";
import { LoadingScreen } from "./screens/LoadingScreen";
import { DeckScreen } from "./screens/DeckScreen";
import { FinalScreen } from "./screens/FinalScreen";

type Screen = "home" | "intro" | "loading" | "deck" | "final" | "dialogue" | "plan" | "album";

export function DeclutterApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [sessionId, setSessionId] = useSessionId();
  const [targetAmount, setTargetAmount] = useState(10000);
  const [items, setItems] = useState<Item[]>([]);

  async function handleIntroSubmit(input: {
    purposeType: PurposeType;
    targetAmount: number;
    file: File;
  }) {
    setTargetAmount(input.targetAmount);
    setScreen("loading");

    const session = await apiClient.createSession({
      purposeType: input.purposeType,
      targetAmount: input.targetAmount,
    });
    setSessionId(session.id);

    const { base64, mimeType } = await resizeImageToBase64(input.file);
    const { items: extractedItems } = await apiClient.extractItems({
      sessionId: session.id,
      imageBase64: base64,
      mimeType,
    });
    setItems(extractedItems);
    setScreen("deck");
  }

  if (screen === "home") {
    return <HomeScreen onStart={() => setScreen("intro")} />;
  }

  if (screen === "intro") {
    return <IntroScreen onSubmit={handleIntroSubmit} />;
  }

  if (screen === "loading") {
    return <LoadingScreen message="写真を読み込み中..." />;
  }

  if (screen === "deck" && sessionId) {
    return (
      <DeckScreen
        sessionId={sessionId}
        items={items}
        onComplete={(classifiedItems) => {
          setItems(classifiedItems);
          setScreen("final");
        }}
      />
    );
  }

  if (screen === "final" && sessionId) {
    return (
      <FinalScreen
        sessionId={sessionId}
        items={items}
        onAllDecided={(decidedItems) => {
          setItems(decidedItems);
          setScreen("plan");
        }}
      />
    );
  }

  // "plan"分岐はTask 22で追加する
  return (
    <section className="screen active">
      <div className="screen-scroll">
        {sessionId} / {items.length} items（次のタスクで実装）
      </div>
    </section>
  );
}
