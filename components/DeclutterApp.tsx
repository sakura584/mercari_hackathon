"use client";

import { useState } from "react";
import { apiClient, isMockMode, resizeImageToBase64 } from "@/lib/api-client";
import { useSessionId } from "@/hooks/useSessionId";
import type { Item, PurposeType } from "@/lib/types";
import { HomeScreen } from "./screens/HomeScreen";
import { IntroScreen } from "./screens/IntroScreen";
import { LoadingScreen } from "./screens/LoadingScreen";
import { DeckScreen } from "./screens/DeckScreen";
import { FinalScreen } from "./screens/FinalScreen";
import { PlanScreen } from "./screens/PlanScreen";
import { AlbumScreen } from "./screens/AlbumScreen";

type Screen = "home" | "intro" | "loading" | "deck" | "final" | "dialogue" | "plan" | "album";

export function DeclutterApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [sessionId, setSessionId] = useSessionId();
  const [targetAmount, setTargetAmount] = useState(10000);
  const [items, setItems] = useState<Item[]>([]);

  async function handleIntroSubmit(input: {
    purposeType: PurposeType;
    targetAmount: number;
    file?: File;
  }) {
    setTargetAmount(input.targetAmount);
    setScreen("loading");

    const session = await apiClient.createSession({
      purposeType: input.purposeType,
      targetAmount: input.targetAmount,
    });
    setSessionId(session.id);

    const { base64, mimeType } = input.file
      ? await resizeImageToBase64(input.file)
      : { base64: "", mimeType: "image/jpeg" };
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
    return <IntroScreen onSubmit={handleIntroSubmit} allowMockSubmit={isMockMode} />;
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

  if (screen === "plan") {
    return (
      <PlanScreen items={items} targetAmount={targetAmount} onViewAlbum={() => setScreen("album")} />
    );
  }

  if (screen === "album" && sessionId) {
    return <AlbumScreen sessionId={sessionId} />;
  }

  return null;
}
