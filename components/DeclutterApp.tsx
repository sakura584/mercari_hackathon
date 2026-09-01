"use client";

import { useState } from "react";
import { HomeScreen } from "./screens/HomeScreen";
import { CollectionApp } from "./collection/CollectionApp";

type Screen = "home" | "collection";

export function DeclutterApp() {
  const [screen, setScreen] = useState<Screen>("home");
  const [collectionEntry, setCollectionEntry] = useState<"create" | "mypage">("mypage");

  function openCollection(entry: "create" | "mypage") {
    setCollectionEntry(entry);
    setScreen("collection");
  }

  if (screen === "collection") {
    return <CollectionApp initialScreen={collectionEntry} onExit={() => setScreen("home")} />;
  }

  return (
    <HomeScreen
      onStart={() => openCollection("create")}
      onOpenCollectionCreate={() => openCollection("create")}
      onOpenCollectionMyPage={() => openCollection("mypage")}
    />
  );
}
