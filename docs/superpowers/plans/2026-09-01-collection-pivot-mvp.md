# コレクションピボット Implementation Plan（非UI実装）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の「Session（目的設定ごとの一回限りセッション）」中心の実装を、「Collection（永続的なコレクション）」中心のデータモデル・APIに置き換える。画像抽出・Item単位のReflection Agentは既存ロジックをCollection配下に移し、新たにコレクション単位のワンショット手放し提案（チャットなし）といいね機能（P1）を追加する。**UI/画面コンポーネントはスコープ外**（別担当が実装する）。

**Architecture:** 既存のNext.js API Routes + Firestore（エミュレータ）+ Google Gemini（`@google/genai`、既にチームにより移行済み）構成はそのまま。`sessionId`を`collectionId`にリネームし、`Session`型を`Collection`型に置き換える。既存のtool-use（function calling）パターンを踏襲して新機能を実装する。

**Tech Stack:** Next.js (App Router, TypeScript), Firebase Admin SDK + Firestore/Storage Local Emulator, `@google/genai`, Vitest。

**Spec:** [docs/superpowers/specs/2026-09-01-collection-pivot-design.md](../specs/2026-09-01-collection-pivot-design.md)（変更点の正）、[docs/superpowers/specs/2026-09-01-letting-go-memory-support-design.md](../specs/2026-09-01-letting-go-memory-support-design.md)（変更のない部分の正：Firebaseエミュレータ運用方針、コスト対策等）

## Global Constraints

- `Session`/`PurposeType`/`SalePurpose`型は完全に廃止する。目的設定（お金を稼ぐ等）の概念はCollectionに持たない
- 全Firestoreパスは`sessions/...`から`collections/...`に変更する（spec 2節）
- Gemini呼び出しは既存の2パターンを踏襲する：①1つの出力形しかない単純な構造化出力は`responseMimeType: "application/json"` + `responseJsonSchema`（`lib/extraction-tools.ts`のパターン）、②複数の候補から1つを強制選択させる／既存の`FunctionDeclaration`ベースの資産と揃えたい場合は`tools: [{ functionDeclarations }]` + `toolConfig.functionCallingConfig`（`lib/reflection-tools.ts`・`lib/memory-record-tool.ts`のパターン）。新規の`suggest-release`は後者（`memory-record-generator.ts`と同じ、単一関数を強制する形）に合わせる
- Item単位のReflection Agent（対話原則・System Prompt・tool定義・最大3ターン）は内容を一切変更しない。パス（`collections/{collectionId}/items/{itemId}/reflection/...`）だけ変わる
- コレクション単位のチャット対話は作らない。手放し提案はワンショット（状態を持たない）の`POST /api/collections/{collectionId}/suggest-release`のみ
- 表示名（`ownerName`）はログイン・パスワードを伴わない。バリデーションは非空文字のみ
- いいねの二重防止はFirestoreドキュメントID（`likerId`をUIが発行）による冪等性のみで行う。認証・IP判定は行わない
- 既存のFirestoreエミュレータ運用方針（`demo-letting-go`ダミープロジェクト、`ignoreUndefinedProperties: true`）はそのまま使う
- `npm run test:emulator`（またはローカルで起動済みのエミュレータに対する`FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run`）で全テストを検証する

---

## Task 1: ドメイン型とFirestoreパスのCollection化

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/firestore-paths.ts`
- Modify: `lib/firestore-paths.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `Collection`、`ReleaseCandidate`、`Like`型（`Session`/`PurposeType`は削除）。`collectionPath(collectionId)`、`itemsCollectionPath(collectionId)`、`itemPath(collectionId, itemId)`、`reflectionPath(collectionId, itemId)`、`reflectionTurnsCollectionPath(collectionId, itemId)`、`albumCollectionPath(collectionId)`、`albumEntryPath(collectionId, memoryRecordId)`、`likesCollectionPath(collectionId)`、`likePath(collectionId, likerId)`（以降の全タスクが使う）

- [ ] **Step 1: `lib/types.ts`を書き換える**

`Session`/`PurposeType`を削除し、`Collection`・`ReleaseCandidate`・`Like`を追加、`Item`の`sessionId`を`collectionId`に変更する。

```ts
export type Collection = {
  id: string;
  ownerName: string;
  title: string;
  coverImageUrl?: string;
  createdAt: string;
  likeCount: number;
};

export type ItemClassification = "keep" | "unsure" | "releaseable";
export type FinalDecision = "keep" | "let_go" | "hold";

export type Item = {
  id: string;
  collectionId: string;
  imageUrl: string;
  sourceImageId?: string;
  title: string;
  category: string;
  estimatedPrice?: number;
  initialClassification?: ItemClassification;
  finalDecision?: FinalDecision;
};

export type AttachmentType =
  | "object"
  | "memory"
  | "person"
  | "identity"
  | "utility"
  | "rarity"
  | "unknown";

export type ReflectionStatus = "in_progress" | "ready_for_decision";

export type ReflectionState = {
  itemId: string;
  itemName: string;
  attachmentTypes: AttachmentType[];
  reasonsToKeep: string[];
  reasonsToLetGo: string[];
  memoryToPreserve?: string;
  regretIfSold?: string;
  regretIfKept?: string;
  unresolved: string[];
  turnCount: number;
  status: ReflectionStatus;
};

export type ReflectionTurn = {
  reflectionId: string;
  turnIndex: number;
  userMessage: string;
  assistantAction: "ask" | "complete";
  assistantReflectionText: string;
  question?: string;
  createdAt: string;
};

export type MemoryRecord = {
  id: string;
  itemId: string;
  itemName: string;
  imageUrl: string;
  episode?: string;
  memory: string;
  reasonForLettingGo?: string;
  tags: string[];
  soldPrice?: number;
  listedAt?: string;
  soldAt?: string;
  createdAt: string;
};

export type ReleaseCandidate = {
  itemId: string;
  itemName: string;
  reason: string;
};

export type Like = {
  likerId: string;
  collectionId: string;
  createdAt: string;
};
```

- [ ] **Step 2: `lib/firestore-paths.test.ts`を新しいパス名に書き換える**

```ts
import { describe, expect, it } from "vitest";
import {
  collectionPath,
  itemsCollectionPath,
  itemPath,
  reflectionPath,
  reflectionTurnsCollectionPath,
  albumCollectionPath,
  albumEntryPath,
  likesCollectionPath,
  likePath,
} from "./firestore-paths";

describe("firestore-paths", () => {
  it("builds collection path", () => {
    expect(collectionPath("c1")).toBe("collections/c1");
  });

  it("builds items collection and item path", () => {
    expect(itemsCollectionPath("c1")).toBe("collections/c1/items");
    expect(itemPath("c1", "i1")).toBe("collections/c1/items/i1");
  });

  it("builds reflection document and turns collection path", () => {
    expect(reflectionPath("c1", "i1")).toBe("collections/c1/items/i1/reflection/state");
    expect(reflectionTurnsCollectionPath("c1", "i1")).toBe(
      "collections/c1/items/i1/reflection/state/turns"
    );
  });

  it("builds album collection and entry path", () => {
    expect(albumCollectionPath("c1")).toBe("collections/c1/album");
    expect(albumEntryPath("c1", "m1")).toBe("collections/c1/album/m1");
  });

  it("builds likes collection and like path", () => {
    expect(likesCollectionPath("c1")).toBe("collections/c1/likes");
    expect(likePath("c1", "liker1")).toBe("collections/c1/likes/liker1");
  });
});
```

- [ ] **Step 3: テストを実行し失敗を確認する**

Run: `npx vitest run lib/firestore-paths.test.ts`
Expected: FAIL（`collectionPath`等が存在しない）

- [ ] **Step 4: `lib/firestore-paths.ts`を書き換える**

```ts
export function collectionPath(collectionId: string): string {
  return `collections/${collectionId}`;
}

export function itemsCollectionPath(collectionId: string): string {
  return `collections/${collectionId}/items`;
}

export function itemPath(collectionId: string, itemId: string): string {
  return `collections/${collectionId}/items/${itemId}`;
}

export function reflectionPath(collectionId: string, itemId: string): string {
  return `collections/${collectionId}/items/${itemId}/reflection/state`;
}

export function reflectionTurnsCollectionPath(
  collectionId: string,
  itemId: string
): string {
  return `collections/${collectionId}/items/${itemId}/reflection/state/turns`;
}

export function albumCollectionPath(collectionId: string): string {
  return `collections/${collectionId}/album`;
}

export function albumEntryPath(collectionId: string, memoryRecordId: string): string {
  return `collections/${collectionId}/album/${memoryRecordId}`;
}

export function likesCollectionPath(collectionId: string): string {
  return `collections/${collectionId}/likes`;
}

export function likePath(collectionId: string, likerId: string): string {
  return `collections/${collectionId}/likes/${likerId}`;
}
```

- [ ] **Step 5: テストを実行し成功を確認する**

Run: `npx vitest run lib/firestore-paths.test.ts`
Expected: PASS（6 tests）

- [ ] **Step 6: 型チェックを確認する（この時点でtypes.ts/firestore-pathsに依存する既存ファイルがエラーになるのは想定通り）**

Run: `npx tsc --noEmit`
Expected: FAIL — `lib/repositories/session-repository.ts`等、Task 2以降で直す既存ファイルのエラーが出る。ここでは`lib/types.ts`・`lib/firestore-paths.ts`自体に構文エラーがないことだけ確認できればよい

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/firestore-paths.ts lib/firestore-paths.test.ts
git commit -m "feat: ドメイン型とFirestoreパスをCollection中心に置き換える"
```

---

## Task 2: Collectionリポジトリ（新規） + 作成・一覧API

`lib/repositories/session-repository.ts`を置き換える。Item/Reflection/Albumリポジトリのリネーム（Task 3）より先に行う必要がある。Task 3以降のテストは、ここで作る`createCollection`を使って親のCollectionを用意するため。

**Files:**
- Delete: `lib/repositories/session-repository.ts`, `lib/repositories/session-repository.test.ts`
- Create: `lib/repositories/collection-repository.ts`
- Create: `lib/repositories/collection-repository.test.ts`
- Delete: `app/api/sessions/route.ts`, `app/api/sessions/route.test.ts`
- Create: `app/api/collections/route.ts`
- Create: `app/api/collections/route.test.ts`

**Interfaces:**
- Consumes: `Collection`（`lib/types.ts`）、`collectionPath`（`lib/firestore-paths.ts`）、`getAdminFirestore`（`lib/firebase/admin.ts`）
- Produces: `createCollection(input: { ownerName: string; title: string; coverImageUrl?: string }): Promise<Collection>`、`getCollection(collectionId: string): Promise<Collection | null>`、`listCollections(): Promise<Collection[]>`（Task 3以降の全テストと、Task 5のGET詳細APIが使う）

- [ ] **Step 1: 失敗するテストを書く**

`lib/repositories/collection-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCollection, getCollection, listCollections } from "./collection-repository";

describe("collection-repository", () => {
  it("creates a collection and reads it back", async () => {
    const collection = await createCollection({ ownerName: "ゆうき", title: "推しグッズコレクション" });

    expect(collection.id).toBeTruthy();
    expect(collection.ownerName).toBe("ゆうき");
    expect(collection.title).toBe("推しグッズコレクション");
    expect(collection.likeCount).toBe(0);

    const fetched = await getCollection(collection.id);
    expect(fetched).toEqual(collection);
  });

  it("returns null for an unknown collection id", async () => {
    const fetched = await getCollection("does-not-exist");
    expect(fetched).toBeNull();
  });

  it("lists collections newest first", async () => {
    const first = await createCollection({ ownerName: "A", title: "コレクション1" });
    const second = await createCollection({ ownerName: "B", title: "コレクション2" });

    const collections = await listCollections();
    const ids = collections.map((c) => c.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run lib/repositories/collection-repository.test.ts`
Expected: FAIL（`./collection-repository` module not found）

- [ ] **Step 3: 実装を書く**

`lib/repositories/collection-repository.ts`:

```ts
import { getAdminFirestore } from "../firebase/admin";
import { collectionPath } from "../firestore-paths";
import type { Collection } from "../types";

export async function createCollection(input: {
  ownerName: string;
  title: string;
  coverImageUrl?: string;
}): Promise<Collection> {
  const db = getAdminFirestore();
  const ref = db.collection("collections").doc();
  const collection: Collection = {
    id: ref.id,
    ownerName: input.ownerName,
    title: input.title,
    coverImageUrl: input.coverImageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
  };
  await ref.set(collection);
  return collection;
}

export async function getCollection(collectionId: string): Promise<Collection | null> {
  const db = getAdminFirestore();
  const snapshot = await db.doc(collectionPath(collectionId)).get();
  if (!snapshot.exists) return null;
  return snapshot.data() as Collection;
}

export async function listCollections(): Promise<Collection[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection("collections").orderBy("createdAt", "desc").get();
  return snapshot.docs.map((doc) => doc.data() as Collection);
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run lib/repositories/collection-repository.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: 旧`session-repository`を削除する**

```bash
rm lib/repositories/session-repository.ts lib/repositories/session-repository.test.ts
```

- [ ] **Step 6: 失敗するテストを書く（API）**

`app/api/collections/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { POST, GET } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/collections", () => {
  it("creates a collection", async () => {
    const res = await POST(jsonRequest({ ownerName: "ゆうき", title: "推しグッズ" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.ownerName).toBe("ゆうき");
    expect(body.title).toBe("推しグッズ");
  });

  it("rejects a missing title", async () => {
    const res = await POST(jsonRequest({ ownerName: "ゆうき" }));
    expect(res.status).toBe(400);
  });

  it("rejects an empty ownerName", async () => {
    const res = await POST(jsonRequest({ ownerName: "", title: "推しグッズ" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/collections", () => {
  it("returns created collections", async () => {
    await POST(jsonRequest({ ownerName: "ゆうき", title: "推しグッズ" }));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collections.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 7: テストを実行し失敗を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run app/api/collections/route.test.ts`
Expected: FAIL（`./route` module not found）

- [ ] **Step 8: routeを実装する**

`app/api/collections/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createCollection, listCollections } from "@/lib/repositories/collection-repository";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.title !== "string" || !body.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (typeof body.ownerName !== "string" || !body.ownerName) {
    return NextResponse.json({ error: "ownerName is required" }, { status: 400 });
  }

  const collection = await createCollection({
    ownerName: body.ownerName,
    title: body.title,
    coverImageUrl: typeof body.coverImageUrl === "string" ? body.coverImageUrl : undefined,
  });

  return NextResponse.json(collection, { status: 201 });
}

export async function GET(): Promise<Response> {
  const collections = await listCollections();
  return NextResponse.json({ collections }, { status: 200 });
}
```

- [ ] **Step 9: テストを実行し成功を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run lib/repositories/collection-repository.test.ts app/api/collections/route.test.ts`
Expected: PASS（3 + 4 = 7 tests）

- [ ] **Step 10: 旧`app/api/sessions/route.ts`を削除する**

```bash
rm app/api/sessions/route.ts app/api/sessions/route.test.ts
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: Collectionリポジトリと作成・一覧APIを追加し、旧Session実装を削除する"
```

---

## Task 3: Item/Reflection/Albumリポジトリのcollectionid化

`sessionId`パラメータを`collectionId`にリネームする。ロジックは変更しない。3ファイルとも同種の機械的リネームなので1タスクにまとめる。

**Files:**
- Modify: `lib/repositories/item-repository.ts`, `lib/repositories/item-repository.test.ts`
- Modify: `lib/repositories/reflection-repository.ts`, `lib/repositories/reflection-repository.test.ts`
- Modify: `lib/repositories/album-repository.ts`, `lib/repositories/album-repository.test.ts`

**Interfaces:**
- Consumes: `createCollection`（`lib/repositories/collection-repository.ts`、テストのセットアップ用）
- Produces: `createItem(input: { collectionId, imageUrl, sourceImageId?, title, category }): Promise<Item>`、`listItems(collectionId): Promise<Item[]>`、`updateItemClassification(collectionId, itemId, classification)`、`updateItemDecision(collectionId, itemId, decision)`、`createReflection(collectionId, itemId, itemName)`、`getReflectionState(collectionId, itemId)`、`saveReflectionState(collectionId, itemId, state)`、`appendReflectionTurn(collectionId, itemId, turn)`、`createAlbumEntry(collectionId, input)`、`listAlbumEntries(collectionId)`（Task 4・5・6・7の全APIが使う）

- [ ] **Step 1: 3つのテストファイルを`createCollection`ベースに書き換える**

`lib/repositories/item-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCollection } from "./collection-repository";
import {
  createItem,
  listItems,
  updateItemClassification,
  updateItemDecision,
} from "./item-repository";

describe("item-repository", () => {
  it("creates an item with an estimated price and lists it", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });

    expect(item.id).toBeTruthy();
    expect(item.collectionId).toBe(collection.id);
    expect(item.estimatedPrice).toBeGreaterThan(0);

    const items = await listItems(collection.id);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(item.id);
  });

  it("updates classification and final decision", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/book.jpg",
      title: "小説",
      category: "book",
    });

    await updateItemClassification(collection.id, item.id, "unsure");
    await updateItemDecision(collection.id, item.id, "let_go");

    const [updated] = await listItems(collection.id);
    expect(updated.initialClassification).toBe("unsure");
    expect(updated.finalDecision).toBe("let_go");
  });
});
```

`lib/repositories/reflection-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCollection } from "./collection-repository";
import { createItem } from "./item-repository";
import {
  appendReflectionTurn,
  createReflection,
  getReflectionState,
  saveReflectionState,
} from "./reflection-repository";

describe("reflection-repository", () => {
  it("creates an initial reflection state and reads it back", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });

    const created = await createReflection(collection.id, item.id, item.title);
    expect(created.turnCount).toBe(0);
    expect(created.status).toBe("in_progress");

    const fetched = await getReflectionState(collection.id, item.id);
    expect(fetched).toEqual(created);
  });

  it("saves an updated state and returns it on read", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });
    const created = await createReflection(collection.id, item.id, item.title);

    const updated = { ...created, turnCount: 1, reasonsToKeep: ["大会で着た"] };
    await saveReflectionState(collection.id, item.id, updated);

    const fetched = await getReflectionState(collection.id, item.id);
    expect(fetched?.turnCount).toBe(1);
    expect(fetched?.reasonsToKeep).toEqual(["大会で着た"]);
  });

  it("returns null when no reflection exists yet", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const fetched = await getReflectionState(collection.id, "no-such-item");
    expect(fetched).toBeNull();
  });

  it("appends a turn log entry without throwing", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });
    await createReflection(collection.id, item.id, item.title);

    await expect(
      appendReflectionTurn(collection.id, item.id, {
        turnIndex: 0,
        userMessage: "最後の大会で着たから迷う",
        assistantAction: "ask",
        assistantReflectionText: "大会との結びつきが大きそうですね。",
        question: "一番覚えていることは何ですか？",
        createdAt: new Date().toISOString(),
      })
    ).resolves.not.toThrow();
  });
});
```

`lib/repositories/album-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCollection } from "./collection-repository";
import { createAlbumEntry, listAlbumEntries } from "./album-repository";

describe("album-repository", () => {
  it("creates an album entry and lists it back", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });

    const entry = await createAlbumEntry(collection.id, {
      itemId: "item_001",
      itemName: "サークルTシャツ",
      imageUrl: "https://example.com/shirt.jpg",
      memory: "2回生最後の大会でチームとして初めて優勝したこと",
      episode: "最後の大会で着たTシャツ。",
      reasonForLettingGo: "今後着る予定はない",
      tags: ["サークル", "卒業"],
    });

    expect(entry.id).toBeTruthy();
    expect(entry.createdAt).toBeTruthy();

    const entries = await listAlbumEntries(collection.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].itemName).toBe("サークルTシャツ");
  });

  it("returns an empty array when there are no entries", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const entries = await listAlbumEntries(collection.id);
    expect(entries).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run lib/repositories`
Expected: FAIL（`item.collectionId`が`undefined`、または`createItem`が`sessionId`必須で型エラー）

- [ ] **Step 3: `lib/repositories/item-repository.ts`を書き換える**

```ts
import { getAdminFirestore } from "../firebase/admin";
import { itemPath, itemsCollectionPath } from "../firestore-paths";
import { estimatePrice } from "../pricing";
import type { FinalDecision, Item, ItemClassification } from "../types";

export async function createItem(input: {
  collectionId: string;
  imageUrl: string;
  sourceImageId?: string;
  title: string;
  category: string;
}): Promise<Item> {
  const db = getAdminFirestore();
  const ref = db.collection(itemsCollectionPath(input.collectionId)).doc();
  const item: Item = {
    id: ref.id,
    collectionId: input.collectionId,
    imageUrl: input.imageUrl,
    sourceImageId: input.sourceImageId,
    title: input.title,
    category: input.category,
    estimatedPrice: estimatePrice(input.category),
  };
  await ref.set(item);
  return item;
}

export async function listItems(collectionId: string): Promise<Item[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(itemsCollectionPath(collectionId)).get();
  return snapshot.docs.map((doc) => doc.data() as Item);
}

export async function updateItemClassification(
  collectionId: string,
  itemId: string,
  classification: ItemClassification
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(itemPath(collectionId, itemId)).update({
    initialClassification: classification,
  });
}

export async function updateItemDecision(
  collectionId: string,
  itemId: string,
  decision: FinalDecision
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(itemPath(collectionId, itemId)).update({ finalDecision: decision });
}
```

- [ ] **Step 4: `lib/repositories/reflection-repository.ts`を書き換える**

```ts
import { getAdminFirestore } from "../firebase/admin";
import { reflectionPath, reflectionTurnsCollectionPath } from "../firestore-paths";
import { initialReflectionState } from "../reflection-state";
import type { ReflectionState, ReflectionTurn } from "../types";

export async function createReflection(
  collectionId: string,
  itemId: string,
  itemName: string
): Promise<ReflectionState> {
  const db = getAdminFirestore();
  const state = initialReflectionState(itemId, itemName);
  await db.doc(reflectionPath(collectionId, itemId)).set(state);
  return state;
}

export async function getReflectionState(
  collectionId: string,
  itemId: string
): Promise<ReflectionState | null> {
  const db = getAdminFirestore();
  const snapshot = await db.doc(reflectionPath(collectionId, itemId)).get();
  if (!snapshot.exists) return null;
  return snapshot.data() as ReflectionState;
}

export async function saveReflectionState(
  collectionId: string,
  itemId: string,
  state: ReflectionState
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(reflectionPath(collectionId, itemId)).set(state);
}

export async function appendReflectionTurn(
  collectionId: string,
  itemId: string,
  turn: Omit<ReflectionTurn, "reflectionId">
): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(reflectionTurnsCollectionPath(collectionId, itemId)).doc();
  const fullTurn: ReflectionTurn = { ...turn, reflectionId: ref.id };
  await ref.set(fullTurn);
}
```

- [ ] **Step 5: `lib/repositories/album-repository.ts`を書き換える**

```ts
import { getAdminFirestore } from "../firebase/admin";
import { albumCollectionPath } from "../firestore-paths";
import type { MemoryRecord } from "../types";

export async function createAlbumEntry(
  collectionId: string,
  input: Omit<MemoryRecord, "id" | "createdAt">
): Promise<MemoryRecord> {
  const db = getAdminFirestore();
  const ref = db.collection(albumCollectionPath(collectionId)).doc();
  const entry: MemoryRecord = {
    ...input,
    id: ref.id,
    createdAt: new Date().toISOString(),
  };
  await ref.set(entry);
  return entry;
}

export async function listAlbumEntries(collectionId: string): Promise<MemoryRecord[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(albumCollectionPath(collectionId))
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map((doc) => doc.data() as MemoryRecord);
}
```

- [ ] **Step 6: テストを実行し成功を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run lib/repositories`
Expected: PASS（collection-repository 3 + item-repository 2 + reflection-repository 4 + album-repository 2 = 11 tests）

- [ ] **Step 7: Commit**

```bash
git add lib/repositories/item-repository.ts lib/repositories/item-repository.test.ts \
  lib/repositories/reflection-repository.ts lib/repositories/reflection-repository.test.ts \
  lib/repositories/album-repository.ts lib/repositories/album-repository.test.ts
git commit -m "feat: Item/Reflection/AlbumリポジトリをcollectionId化する"
```

---

## Task 4: 既存API routesを`app/api/sessions/**`から`app/api/collections/**`へ移動する

分類・item対話開始・item対話ターン・最終判断・アルバム取得の5ルート。ロジックは変更せず、ディレクトリと`sessionId`パラメータ名だけ変える。Item対話ターン・最終判断はGemini化済みの実装をそのまま移す。

**Files:**
- Delete: `app/api/sessions/[sessionId]/items/[itemId]/classification/route.ts`, `.../route.test.ts`
- Delete: `app/api/sessions/[sessionId]/items/[itemId]/reflection/route.ts`, `.../route.test.ts`
- Delete: `app/api/sessions/[sessionId]/items/[itemId]/reflection/messages/route.ts`, `.../route.test.ts`
- Delete: `app/api/sessions/[sessionId]/items/[itemId]/decision/route.ts`, `.../route.test.ts`
- Delete: `app/api/sessions/[sessionId]/album/route.ts`, `.../route.test.ts`
- Create: `app/api/collections/[collectionId]/items/[itemId]/classification/route.ts`, `.../route.test.ts`
- Create: `app/api/collections/[collectionId]/items/[itemId]/reflection/route.ts`, `.../route.test.ts`
- Create: `app/api/collections/[collectionId]/items/[itemId]/reflection/messages/route.ts`, `.../route.test.ts`
- Create: `app/api/collections/[collectionId]/items/[itemId]/decision/route.ts`, `.../route.test.ts`
- Create: `app/api/collections/[collectionId]/album/route.ts`, `.../route.test.ts`

**Interfaces:**
- Consumes: Task 3のリポジトリ全関数、`lib/reflection-tools.ts`・`lib/reflection-prompt.ts`・`lib/reflection-state.ts`・`lib/memory-record-generator.ts`（すべて変更なし）
- Produces: 変更なし（パスのみ）。Task 6・7が同じ`app/api/collections/[collectionId]/...`配下に追加していく

- [ ] **Step 1: 5つのルートを新しいディレクトリに作成する**

`app/api/collections/[collectionId]/items/[itemId]/classification/route.ts`:

```ts
import { NextResponse } from "next/server";
import { updateItemClassification } from "@/lib/repositories/item-repository";
import type { ItemClassification } from "@/lib/types";

const VALID_CLASSIFICATIONS: ItemClassification[] = ["keep", "unsure", "releaseable"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ collectionId: string; itemId: string }> }
): Promise<Response> {
  const { collectionId, itemId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || !VALID_CLASSIFICATIONS.includes(body.classification)) {
    return NextResponse.json(
      { error: "classification must be one of " + VALID_CLASSIFICATIONS.join(", ") },
      { status: 400 }
    );
  }

  await updateItemClassification(collectionId, itemId, body.classification);
  return new Response(null, { status: 204 });
}
```

`app/api/collections/[collectionId]/items/[itemId]/classification/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createItem, listItems } from "@/lib/repositories/item-repository";
import { PATCH } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/collections/x/items/y/classification", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH classification", () => {
  it("updates the item's initialClassification", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/x.jpg",
      title: "本",
      category: "book",
    });

    const res = await PATCH(jsonRequest({ classification: "unsure" }), {
      params: Promise.resolve({ collectionId: collection.id, itemId: item.id }),
    });

    expect(res.status).toBe(204);
    const [updated] = await listItems(collection.id);
    expect(updated.initialClassification).toBe("unsure");
  });

  it("rejects an invalid classification value", async () => {
    const res = await PATCH(jsonRequest({ classification: "nope" }), {
      params: Promise.resolve({ collectionId: "c1", itemId: "i1" }),
    });
    expect(res.status).toBe(400);
  });
});
```

`app/api/collections/[collectionId]/items/[itemId]/reflection/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createReflection } from "@/lib/repositories/reflection-repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string; itemId: string }> }
): Promise<Response> {
  const { collectionId, itemId } = await params;
  const body = await request.json().catch(() => null);

  if (!body?.itemName) {
    return NextResponse.json({ error: "itemName is required" }, { status: 400 });
  }

  const state = await createReflection(collectionId, itemId, body.itemName);
  return NextResponse.json(state, { status: 201 });
}
```

`app/api/collections/[collectionId]/items/[itemId]/reflection/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createItem } from "@/lib/repositories/item-repository";
import { POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/reflection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST reflection init", () => {
  it("creates an initial ReflectionState", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/x.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });

    const res = await POST(jsonRequest({ itemName: item.title }), {
      params: Promise.resolve({ collectionId: collection.id, itemId: item.id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.turnCount).toBe(0);
    expect(body.status).toBe("in_progress");
    expect(body.itemName).toBe("サークルTシャツ");
  });
});
```

`app/api/collections/[collectionId]/items/[itemId]/reflection/messages/route.ts`（Gemini化済みロジックはそのまま、パラメータ名のみ変更）:

```ts
import { NextResponse } from "next/server";
import { FunctionCallingConfigMode } from "@google/genai";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";
import { ASK_QUESTION_TOOL, COMPLETE_REFLECTION_TOOL, resolveToolChoice } from "@/lib/reflection-tools";
import { buildReflectionUserMessage, REFLECTION_SYSTEM_PROMPT } from "@/lib/reflection-prompt";
import { applyStatePatch } from "@/lib/reflection-state";
import { appendReflectionTurn, getReflectionState, saveReflectionState } from "@/lib/repositories/reflection-repository";
import type { ReflectionState } from "@/lib/types";

type AskInput = { reflection: string; question: string; statePatch?: Partial<ReflectionState> };
type CompleteInput = { reflection: string; summary?: Partial<ReflectionState> };

export async function POST(request: Request, { params }: { params: Promise<{ collectionId: string; itemId: string }> }): Promise<Response> {
  const { collectionId, itemId } = await params;
  const body = await request.json().catch(() => null);
  if (!body?.message) return NextResponse.json({ error: "message is required" }, { status: 400 });
  const currentState = await getReflectionState(collectionId, itemId);
  if (!currentState) return NextResponse.json({ error: "reflection not found" }, { status: 404 });
  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: buildReflectionUserMessage(currentState.itemName, currentState, body.message),
    config: {
      systemInstruction: REFLECTION_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: [ASK_QUESTION_TOOL, COMPLETE_REFLECTION_TOOL] }],
      toolConfig: { functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        allowedFunctionNames: resolveToolChoice(currentState),
      } },
    },
  });
  const functionCall = response.functionCalls?.[0];
  if (!functionCall) return NextResponse.json({ error: "Gemini did not call a function" }, { status: 502 });
  if (functionCall.name === "ask_question") {
    const input = functionCall.args as AskInput;
    const nextState = applyStatePatch(currentState, input.statePatch ?? {});
    await saveReflectionState(collectionId, itemId, nextState);
    await appendReflectionTurn(collectionId, itemId, {
      turnIndex: nextState.turnCount, userMessage: body.message, assistantAction: "ask",
      assistantReflectionText: input.reflection, question: input.question, createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ action: "ask", reflection: input.reflection, question: input.question });
  }
  if (functionCall.name !== "complete_reflection") {
    return NextResponse.json({ error: "Gemini called an unsupported function" }, { status: 502 });
  }
  const input = functionCall.args as CompleteInput;
  const nextState = applyStatePatch({ ...currentState, status: "ready_for_decision" }, input.summary ?? {});
  await saveReflectionState(collectionId, itemId, nextState);
  await appendReflectionTurn(collectionId, itemId, {
    turnIndex: nextState.turnCount, userMessage: body.message, assistantAction: "complete",
    assistantReflectionText: input.reflection, createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ action: "complete", reflection: input.reflection, summary: {
    reasonsToKeep: nextState.reasonsToKeep, reasonsToLetGo: nextState.reasonsToLetGo,
    memoryToPreserve: nextState.memoryToPreserve, regretIfSold: nextState.regretIfSold,
    regretIfKept: nextState.regretIfKept, unresolved: nextState.unresolved,
  } });
}
```

`app/api/collections/[collectionId]/items/[itemId]/reflection/messages/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createItem } from "@/lib/repositories/item-repository";
import { createReflection, getReflectionState } from "@/lib/repositories/reflection-repository";

const generateContentMock = vi.fn();
vi.mock("@/lib/gemini", () => ({ GEMINI_MODEL: "gemini-test", getGeminiClient: () => ({ models: { generateContent: generateContentMock } }) }));

async function setup() {
  const collection = await createCollection({ ownerName: "A", title: "コレクション" });
  const item = await createItem({ collectionId: collection.id, imageUrl: "https://example.com/a.jpg", title: "Tシャツ", category: "clothing_tshirt" });
  await createReflection(collection.id, item.id, item.title);
  return { collection, item };
}
function request(message: string) {
  return new Request("http://localhost/api/reflection/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
}

describe("POST reflection messages", () => {
  beforeEach(() => generateContentMock.mockReset());

  it("persists Gemini's ask_question function call", async () => {
    generateContentMock.mockResolvedValue({ functionCalls: [{ name: "ask_question", args: { reflection: "気持ちが伝わりました。", question: "何が一番大切ですか？", statePatch: { reasonsToKeep: ["思い出"] } } }] });
    const { collection, item } = await setup();
    const { POST } = await import("./route");
    const res = await POST(request("大切です"), { params: Promise.resolve({ collectionId: collection.id, itemId: item.id }) });
    expect((await res.json()).action).toBe("ask");
    expect((await getReflectionState(collection.id, item.id))?.reasonsToKeep).toEqual(["思い出"]);
  });

  it("forces complete_reflection after the maximum turns", async () => {
    const { collection, item } = await setup();
    const { POST } = await import("./route");
    for (let turn = 0; turn < 3; turn += 1) {
      generateContentMock.mockResolvedValueOnce({ functionCalls: [{ name: "ask_question", args: { reflection: "…", question: "質問", statePatch: {} } }] });
      await POST(request("回答"), { params: Promise.resolve({ collectionId: collection.id, itemId: item.id }) });
    }
    generateContentMock.mockResolvedValueOnce({ functionCalls: [{ name: "complete_reflection", args: { reflection: "整理できました。", summary: {} } }] });
    await POST(request("最後の回答"), { params: Promise.resolve({ collectionId: collection.id, itemId: item.id }) });
    const call = generateContentMock.mock.calls.at(-1)?.[0];
    expect(call.config.toolConfig.functionCallingConfig.allowedFunctionNames).toEqual(["complete_reflection"]);
  });
});
```

`app/api/collections/[collectionId]/items/[itemId]/decision/route.ts`:

```ts
import { NextResponse } from "next/server";
import { updateItemDecision } from "@/lib/repositories/item-repository";
import { getReflectionState } from "@/lib/repositories/reflection-repository";
import { generateMemoryRecordText } from "@/lib/memory-record-generator";
import { createAlbumEntry } from "@/lib/repositories/album-repository";
import type { FinalDecision } from "@/lib/types";

const VALID_DECISIONS: FinalDecision[] = ["keep", "let_go", "hold"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string; itemId: string }> }
): Promise<Response> {
  const { collectionId, itemId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || !VALID_DECISIONS.includes(body.decision) || !body.itemName || !body.imageUrl) {
    return NextResponse.json(
      { error: "decision, itemName, imageUrl are required" },
      { status: 400 }
    );
  }

  await updateItemDecision(collectionId, itemId, body.decision);

  if (body.decision !== "let_go") {
    return NextResponse.json({ decision: body.decision }, { status: 200 });
  }

  const reflectionState = await getReflectionState(collectionId, itemId);
  const text = await generateMemoryRecordText(body.itemName, reflectionState);

  const albumEntry = await createAlbumEntry(collectionId, {
    itemId,
    itemName: body.itemName,
    imageUrl: body.imageUrl,
    episode: text.episode,
    memory: text.memory,
    reasonForLettingGo: text.reasonForLettingGo,
    tags: text.tags,
  });

  return NextResponse.json({ decision: body.decision, albumEntry }, { status: 201 });
}
```

`app/api/collections/[collectionId]/items/[itemId]/decision/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createItem, listItems } from "@/lib/repositories/item-repository";
import { listAlbumEntries } from "@/lib/repositories/album-repository";

const generateContentMock = vi.fn();
vi.mock("@/lib/gemini", () => ({ GEMINI_MODEL: "gemini-test", getGeminiClient: () => ({ models: { generateContent: generateContentMock } }) }));

function request(body: unknown) {
  return new Request("http://localhost/api/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST decision", () => {
  beforeEach(() => generateContentMock.mockReset());

  it("creates an album entry from Gemini's function call", async () => {
    generateContentMock.mockResolvedValue({ functionCalls: [{ name: "save_memory_record", args: { memory: "大切な思い出", tags: ["Tシャツ"] } }] });
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({ collectionId: collection.id, imageUrl: "https://example.com/a.jpg", title: "Tシャツ", category: "clothing_tshirt" });
    const { POST } = await import("./route");
    const res = await POST(request({ decision: "let_go", itemName: item.title, imageUrl: item.imageUrl }), { params: Promise.resolve({ collectionId: collection.id, itemId: item.id }) });
    expect(res.status).toBe(201);
    expect((await res.json()).albumEntry.memory).toBe("大切な思い出");
    expect((await listItems(collection.id))[0].finalDecision).toBe("let_go");
    expect(await listAlbumEntries(collection.id)).toHaveLength(1);
  });
});
```

`app/api/collections/[collectionId]/album/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listAlbumEntries } from "@/lib/repositories/album-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
): Promise<Response> {
  const { collectionId } = await params;
  const entries = await listAlbumEntries(collectionId);
  return NextResponse.json({ entries }, { status: 200 });
}
```

`app/api/collections/[collectionId]/album/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createAlbumEntry } from "@/lib/repositories/album-repository";
import { GET } from "./route";

describe("GET album", () => {
  it("returns album entries for the collection", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    await createAlbumEntry(collection.id, {
      itemId: "item_001",
      itemName: "サークルTシャツ",
      imageUrl: "https://example.com/x.jpg",
      memory: "大会の記憶",
      tags: [],
    });

    const res = await GET(new Request("http://localhost/api/album"), {
      params: Promise.resolve({ collectionId: collection.id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].itemName).toBe("サークルTシャツ");
  });

  it("returns an empty array when there are no entries", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const res = await GET(new Request("http://localhost/api/album"), {
      params: Promise.resolve({ collectionId: collection.id }),
    });
    const body = await res.json();
    expect(body.entries).toEqual([]);
  });
});
```

- [ ] **Step 2: 旧`app/api/sessions/[sessionId]/**`ディレクトリを削除する**

```bash
rm -rf "app/api/sessions"
```

- [ ] **Step 3: テストを実行し成功を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run`
Expected: PASS（全テストが新パスで通る。`app/api/sessions`関連のテストファイルはもう存在しない）

- [ ] **Step 4: 型チェックとビルドを確認する**

Run: `npx tsc --noEmit && npm run build`
Expected: 両方成功（UIコンポーネント側で`sessionId`を参照している箇所はビルドエラーになる可能性がある。UI実装は別担当のため、ここで出たエラー箇所は一覧にして担当者に共有し、このタスク自体はAPI/ロジック側が正しくcollectionId化されていることの確認に留める）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 既存API routesをapp/api/sessions/**からapp/api/collections/**へ移動する"
```

---

## Task 5: `GET /api/collections/[collectionId]`（詳細取得）

**Files:**
- Create: `app/api/collections/[collectionId]/route.ts`
- Create: `app/api/collections/[collectionId]/route.test.ts`

**Interfaces:**
- Consumes: `getCollection`（`lib/repositories/collection-repository.ts`）、`listItems`（`lib/repositories/item-repository.ts`）
- Produces: `GET`ハンドラ → Response `{ collection: Collection; items: Item[] }`（200）。存在しないIDは404

- [ ] **Step 1: 失敗するテストを書く**

`app/api/collections/[collectionId]/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createItem } from "@/lib/repositories/item-repository";
import { GET } from "./route";

describe("GET /api/collections/[collectionId]", () => {
  it("returns the collection with its items", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/x.jpg",
      title: "本",
      category: "book",
    });

    const res = await GET(new Request("http://localhost/api/collections/x"), {
      params: Promise.resolve({ collectionId: collection.id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collection.id).toBe(collection.id);
    expect(body.items).toHaveLength(1);
  });

  it("returns 404 for an unknown collection", async () => {
    const res = await GET(new Request("http://localhost/api/collections/x"), {
      params: Promise.resolve({ collectionId: "does-not-exist" }),
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run app/api/collections`
Expected: FAIL（`./route` module not found）

- [ ] **Step 3: routeを実装する**

`app/api/collections/[collectionId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getCollection } from "@/lib/repositories/collection-repository";
import { listItems } from "@/lib/repositories/item-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
): Promise<Response> {
  const { collectionId } = await params;
  const collection = await getCollection(collectionId);

  if (!collection) {
    return NextResponse.json({ error: "collection not found" }, { status: 404 });
  }

  const items = await listItems(collectionId);
  return NextResponse.json({ collection, items }, { status: 200 });
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run`
Expected: PASS（全テスト。詳細取得APIの2 testsを含む）

- [ ] **Step 5: Commit**

```bash
git add app/api/collections/[collectionId]/route.ts app/api/collections/[collectionId]/route.test.ts
git commit -m "feat: コレクション詳細取得APIを追加する"
```

---

## Task 6: 画像抽出APIの更新（collectionId化 + 単品/コレクション全体モード）

**Files:**
- Modify: `lib/storage.ts`, `lib/storage.test.ts`
- Modify: `app/api/items/extract/route.ts`, `app/api/items/extract/route.test.ts`

**Interfaces:**
- Consumes: `EXTRACT_ITEMS_SCHEMA`（`lib/extraction-tools.ts`、変更なし）、`FALLBACK_EXTRACTED_ITEMS`（`lib/extraction-fallback.ts`、変更なし）、`createItem`（`lib/repositories/item-repository.ts`）
- Produces: `uploadRoomImage(collectionId, imageBase64, mimeType): Promise<string>`（`lib/storage.ts`）。`POST`ハンドラ。Request body `{ collectionId: string; imageBase64: string; mimeType: string; mode?: "single" | "collection" }` → Response `{ items: Item[] }`（201）

- [ ] **Step 1: `lib/storage.test.ts`を書き換える（引数名の意味だけ変える。挙動は変わらない）**

```ts
import { describe, expect, it } from "vitest";
import { uploadRoomImage } from "./storage";

const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("uploadRoomImage", () => {
  it("uploads a base64 image and returns a public URL", async () => {
    const url = await uploadRoomImage("collection_test", ONE_PX_PNG_BASE64, "image/png");
    expect(url).toMatch(/^https?:\/\//);
  });

  it("stores different uploads under different paths", async () => {
    const first = await uploadRoomImage("collection_test", ONE_PX_PNG_BASE64, "image/png");
    const second = await uploadRoomImage("collection_test", ONE_PX_PNG_BASE64, "image/png");
    expect(first).not.toBe(second);
  });
});
```

- [ ] **Step 2: `lib/storage.ts`を書き換える**

```ts
import { randomUUID } from "node:crypto";
import { getAdminStorage } from "./firebase/admin";

export async function uploadRoomImage(
  collectionId: string,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const extension = mimeType.split("/")[1] ?? "jpg";
  const path = `collections/${collectionId}/room-photos/${randomUUID()}.${extension}`;
  const bucket = getAdminStorage().bucket();
  const file = bucket.file(path);

  const buffer = Buffer.from(imageBase64, "base64");
  await file.save(buffer, { metadata: { contentType: mimeType } });
  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}
```

- [ ] **Step 3: `app/api/items/extract/route.test.ts`を書き換え、単品モードのテストを追加する**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";

const generateContentMock = vi.fn();
vi.mock("@/lib/gemini", () => ({ GEMINI_MODEL: "gemini-test", getGeminiClient: () => ({ models: { generateContent: generateContentMock } }) }));
vi.mock("@/lib/storage", () => ({ uploadRoomImage: vi.fn().mockResolvedValue("https://storage.googleapis.com/test/room.jpg") }));

function request(body: unknown) {
  return new Request("http://localhost/api/items/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/items/extract", () => {
  beforeEach(() => generateContentMock.mockReset());

  it("creates items from Gemini structured output (collection mode, default)", async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ items: [{ title: "Tシャツ", category: "clothing_tshirt" }, { title: "本", category: "book" }] }) });
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const { POST } = await import("./route");
    const res = await POST(request({ collectionId: collection.id, imageBase64: "abc", mimeType: "image/png" }));
    expect(res.status).toBe(201);
    expect((await res.json()).items).toHaveLength(2);
  });

  it("keeps only the highest-confidence item in single mode when Gemini returns more than one", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        items: [
          { title: "背景の棚", category: "default", confidence: 0.2 },
          { title: "フィギュア", category: "figure", confidence: 0.9 },
        ],
      }),
    });
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const { POST } = await import("./route");
    const res = await POST(request({ collectionId: collection.id, imageBase64: "abc", mimeType: "image/png", mode: "single" }));
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe("フィギュア");
  });

  it("falls back when Gemini fails", async () => {
    generateContentMock.mockResolvedValue({ text: "{}" });
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const { POST } = await import("./route");
    const res = await POST(request({ collectionId: collection.id, imageBase64: "abc", mimeType: "image/png" }));
    expect((await res.json()).items.length).toBeGreaterThanOrEqual(3);
  });

  it("falls back to a single item in single mode when Gemini fails", async () => {
    generateContentMock.mockResolvedValue({ text: "{}" });
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const { POST } = await import("./route");
    const res = await POST(request({ collectionId: collection.id, imageBase64: "abc", mimeType: "image/png", mode: "single" }));
    expect((await res.json()).items).toHaveLength(1);
  });
});
```

- [ ] **Step 4: テストを実行し失敗を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run lib/storage.test.ts app/api/items/extract`
Expected: FAIL（`collectionId`が未定義、`mode: "single"`のフィルタ未実装）

- [ ] **Step 5: `app/api/items/extract/route.ts`を書き換える**

```ts
import { NextResponse } from "next/server";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";
import { EXTRACT_ITEMS_SCHEMA } from "@/lib/extraction-tools";
import { FALLBACK_EXTRACTED_ITEMS } from "@/lib/extraction-fallback";
import { uploadRoomImage } from "@/lib/storage";
import { createItem } from "@/lib/repositories/item-repository";
import type { Item } from "@/lib/types";

type ExtractedCandidate = { title: string; category: string; confidence?: number };
type ExtractMode = "single" | "collection";

async function extractCandidates(
  imageBase64: string,
  mimeType: string,
  mode: ExtractMode
): Promise<ExtractedCandidate[]> {
  const promptText =
    mode === "single"
      ? "この写真には品物が1点だけ写っています。それを抽出し、指定されたJSON形式で返してください。"
      : "画像内の品物を漏れなく抽出し、指定されたJSON形式で返してください。";

  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      { inlineData: { mimeType, data: imageBase64 } },
      { text: promptText },
    ],
    config: { responseMimeType: "application/json", responseJsonSchema: EXTRACT_ITEMS_SCHEMA },
  });
  const items = (JSON.parse(response.text ?? "{}") as { items?: ExtractedCandidate[] }).items;
  if (!items?.length) throw new Error("Gemini returned no items");

  if (mode === "single" && items.length > 1) {
    return [[...items].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]];
  }
  return items;
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (!body?.collectionId || !body?.imageBase64 || !body?.mimeType) {
    return NextResponse.json(
      { error: "collectionId, imageBase64, mimeType are required" },
      { status: 400 }
    );
  }
  const mode: ExtractMode = body.mode === "single" ? "single" : "collection";

  const imageUrl = await uploadRoomImage(body.collectionId, body.imageBase64, body.mimeType);

  let candidates: ExtractedCandidate[];
  try {
    candidates = await extractCandidates(body.imageBase64, body.mimeType, mode);
  } catch {
    candidates = mode === "single" ? [FALLBACK_EXTRACTED_ITEMS[0]] : FALLBACK_EXTRACTED_ITEMS;
  }

  const items: Item[] = [];
  for (const candidate of candidates) {
    items.push(
      await createItem({
        collectionId: body.collectionId,
        imageUrl,
        title: candidate.title,
        category: candidate.category,
      })
    );
  }

  return NextResponse.json({ items }, { status: 201 });
}
```

- [ ] **Step 6: テストを実行し成功を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run`
Expected: PASS（全テスト。抽出APIの4 testsを含む）

- [ ] **Step 7: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts app/api/items/extract/route.ts app/api/items/extract/route.test.ts
git commit -m "feat: 画像抽出APIをcollectionId化し、単品/コレクション全体モードを追加する"
```

---

## Task 7: コレクション単位のワンショット手放し提案（新規）

チャット対話ではなく状態を持たない一発診断。spec 6節の理論的根拠（拡張自己理論・divestment ritual・Three Paths to Disposition）をSystem Promptに反映する。

**Files:**
- Create: `lib/release-suggestion-tool.ts`
- Create: `lib/release-suggestion-prompt.ts`
- Create: `app/api/collections/[collectionId]/suggest-release/route.ts`
- Create: `app/api/collections/[collectionId]/suggest-release/route.test.ts`

**Interfaces:**
- Consumes: `getGeminiClient`、`GEMINI_MODEL`（`lib/gemini.ts`）、`listItems`（`lib/repositories/item-repository.ts`）、`ReleaseCandidate`（`lib/types.ts`）
- Produces: `SUGGEST_RELEASE_CANDIDATES_TOOL`（`lib/release-suggestion-tool.ts`）、`RELEASE_SUGGESTION_SYSTEM_PROMPT`（`lib/release-suggestion-prompt.ts`）。`POST`ハンドラ → Response `{ candidates: ReleaseCandidate[] }`（200）

- [ ] **Step 1: tool定義を書く**

`lib/release-suggestion-tool.ts`:

```ts
import type { FunctionDeclaration } from "@google/genai";

export const SUGGEST_RELEASE_CANDIDATES_TOOL: FunctionDeclaration = {
  name: "suggest_release_candidates",
  description:
    "コレクションの中から、手放しても収集家としての自分らしさが損なわれなさそうな品を選び、理由を添えて提案する",
  parametersJsonSchema: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            itemId: { type: "string" },
            reason: {
              type: "string",
              description:
                "このコレクションの中でのこの品の位置づけ（核か周辺か）を踏まえた、手放してもよさそうな理由。次の持ち主に引き継がれるという前向きな含意を含める",
            },
          },
          required: ["itemId", "reason"],
        },
      },
    },
    required: ["candidates"],
  },
};
```

- [ ] **Step 2: System Promptを書く**

`lib/release-suggestion-prompt.ts`:

```ts
export const RELEASE_SUGGESTION_SYSTEM_PROMPT = `<role>
あなたは、コレクター自身が「収集家としての自分らしさ」を保ったまま、
コレクションの一部を手放す決断をしやすくなるよう手伝うアシスタントです。
</role>

<theory>
コレクションは持ち主の自己同一性の一部を構成します（拡張自己理論）。
コレクションの中には、そのコレクションらしさ・持ち主らしさの「核」となる品と、
なくても持ち主らしさが損なわれない「周辺的」な品があります。
周辺的な品を、次の持ち主に引き継ぐ形で手放すことは、
コレクションの核心的な価値を損なうものではありません（divestment ritual）。
</theory>

<goal>
渡されたコレクションの一覧から、周辺的だと考えられる品を選び、
それぞれについて「なぜ手放しても collector としての自分らしさは保たれるか」を
1〜2文で言語化してください。
</goal>

<principles>
- 全ての品を対象にする必要はない。周辺的だと判断できる品だけを選ぶ
- 「価値が低いから」ではなく、「このコレクションの中での位置づけ」を理由にする
- 断定せず、提案として表現する
- 次の持ち主に引き継がれるという前向きな含意を理由に含める
- 最終判断はユーザーが行うことを前提とし、結論を強制する表現は避ける
</principles>`;
```

- [ ] **Step 3: 失敗するテストを書く**

`app/api/collections/[collectionId]/suggest-release/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import {
  createItem,
  updateItemClassification,
  updateItemDecision,
} from "@/lib/repositories/item-repository";

const generateContentMock = vi.fn();
vi.mock("@/lib/gemini", () => ({
  GEMINI_MODEL: "gemini-test",
  getGeminiClient: () => ({ models: { generateContent: generateContentMock } }),
}));

function request(): Request {
  return new Request("http://localhost/api/suggest-release", { method: "POST" });
}

describe("POST suggest-release", () => {
  beforeEach(() => generateContentMock.mockReset());

  it("returns candidates from Gemini for undecided, non-keep items", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const eligible = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/a.jpg",
      title: "限定フィギュアB",
      category: "figure",
    });
    await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/b.jpg",
      title: "一番好きなフィギュア",
      category: "figure",
    });
    // 「keep」に一次分類済みの品は候補から除外する
    const kept = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/c.jpg",
      title: "殿堂入りフィギュア",
      category: "figure",
    });
    await updateItemClassification(collection.id, kept.id, "keep");

    generateContentMock.mockResolvedValue({
      functionCalls: [
        {
          name: "suggest_release_candidates",
          args: { candidates: [{ itemId: eligible.id, reason: "重複気味の一品なので次の人に引き継げそう" }] },
        },
      ],
    });

    const { POST } = await import("./route");
    const res = await POST(request(), { params: Promise.resolve({ collectionId: collection.id }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].itemId).toBe(eligible.id);
  });

  it("returns an empty array without calling Gemini when there are no eligible items", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/a.jpg",
      title: "手放し済みフィギュア",
      category: "figure",
    });
    await updateItemDecision(collection.id, item.id, "let_go");

    const { POST } = await import("./route");
    const res = await POST(request(), { params: Promise.resolve({ collectionId: collection.id }) });

    expect((await res.json()).candidates).toEqual([]);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("filters out itemIds that Gemini hallucinated", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/a.jpg",
      title: "フィギュア",
      category: "figure",
    });

    generateContentMock.mockResolvedValue({
      functionCalls: [
        {
          name: "suggest_release_candidates",
          args: { candidates: [{ itemId: "does-not-exist", reason: "存在しないID" }] },
        },
      ],
    });

    const { POST } = await import("./route");
    const res = await POST(request(), { params: Promise.resolve({ collectionId: collection.id }) });
    expect((await res.json()).candidates).toEqual([]);
  });
});
```

- [ ] **Step 4: テストを実行し失敗を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run app/api/collections`
Expected: FAIL（`./route` module not found）

- [ ] **Step 5: routeを実装する**

`app/api/collections/[collectionId]/suggest-release/route.ts`:

```ts
import { NextResponse } from "next/server";
import { FunctionCallingConfigMode } from "@google/genai";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";
import { SUGGEST_RELEASE_CANDIDATES_TOOL } from "@/lib/release-suggestion-tool";
import { RELEASE_SUGGESTION_SYSTEM_PROMPT } from "@/lib/release-suggestion-prompt";
import { listItems } from "@/lib/repositories/item-repository";
import type { Item, ReleaseCandidate } from "@/lib/types";

function eligibleItems(items: Item[]): Item[] {
  return items.filter(
    (item) => item.finalDecision === undefined && item.initialClassification !== "keep"
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
): Promise<Response> {
  const { collectionId } = await params;
  const items = eligibleItems(await listItems(collectionId));

  if (items.length === 0) {
    return NextResponse.json({ candidates: [] }, { status: 200 });
  }

  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: JSON.stringify(
      items.map((item) => ({ itemId: item.id, title: item.title, category: item.category }))
    ),
    config: {
      systemInstruction: RELEASE_SUGGESTION_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: [SUGGEST_RELEASE_CANDIDATES_TOOL] }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ["suggest_release_candidates"],
        },
      },
    },
  });

  const args = response.functionCalls?.[0]?.args as { candidates?: ReleaseCandidate[] } | undefined;
  const validItemIds = new Set(items.map((item) => item.id));
  const itemNameById = new Map(items.map((item) => [item.id, item.title]));

  const candidates: ReleaseCandidate[] = (args?.candidates ?? [])
    .filter((candidate) => validItemIds.has(candidate.itemId))
    .map((candidate) => ({
      itemId: candidate.itemId,
      itemName: itemNameById.get(candidate.itemId) ?? "",
      reason: candidate.reason,
    }));

  return NextResponse.json({ candidates }, { status: 200 });
}
```

- [ ] **Step 6: テストを実行し成功を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run`
Expected: PASS（全テスト。suggest-releaseの3 testsを含む）

- [ ] **Step 7: 型チェックを確認する**

Run: `npx tsc --noEmit`
Expected: 成功

- [ ] **Step 8: Commit**

```bash
git add lib/release-suggestion-tool.ts lib/release-suggestion-prompt.ts \
  "app/api/collections/[collectionId]/suggest-release/route.ts" \
  "app/api/collections/[collectionId]/suggest-release/route.test.ts"
git commit -m "feat: コレクション単位のワンショット手放し提案APIを追加する"
```

---

## Task 8: いいね機能（P1）

認証・IP判定は行わない。UIが発行した匿名`likerId`をFirestoreドキュメントIDとして使い、冪等性だけで二重いいねを防ぐ（spec 8節）。

**Files:**
- Create: `lib/repositories/like-repository.ts`
- Create: `lib/repositories/like-repository.test.ts`
- Create: `app/api/collections/[collectionId]/like/route.ts`
- Create: `app/api/collections/[collectionId]/like/route.test.ts`

**Interfaces:**
- Consumes: `likePath`、`collectionPath`（`lib/firestore-paths.ts`）、`getAdminFirestore`（`lib/firebase/admin.ts`）
- Produces: `addLike(collectionId: string, likerId: string): Promise<number>`（現在の`likeCount`を返す。冪等）。`POST`ハンドラ → Response `{ likeCount: number }`（200）

- [ ] **Step 1: 失敗するテストを書く（リポジトリ）**

`lib/repositories/like-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCollection, getCollection } from "./collection-repository";
import { addLike } from "./like-repository";

describe("like-repository", () => {
  it("increments likeCount on the first like", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const count = await addLike(collection.id, "liker-1");
    expect(count).toBe(1);
    expect((await getCollection(collection.id))?.likeCount).toBe(1);
  });

  it("does not increment again for the same likerId", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    await addLike(collection.id, "liker-1");
    const count = await addLike(collection.id, "liker-1");
    expect(count).toBe(1);
  });

  it("increments once per distinct likerId", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    await addLike(collection.id, "liker-1");
    const count = await addLike(collection.id, "liker-2");
    expect(count).toBe(2);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run lib/repositories/like-repository.test.ts`
Expected: FAIL（`./like-repository` module not found）

- [ ] **Step 3: 実装を書く**

`lib/repositories/like-repository.ts`:

```ts
import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../firebase/admin";
import { collectionPath, likePath } from "../firestore-paths";

export async function addLike(collectionId: string, likerId: string): Promise<number> {
  const db = getAdminFirestore();
  const likeRef = db.doc(likePath(collectionId, likerId));
  const existing = await likeRef.get();

  if (!existing.exists) {
    await likeRef.set({ likerId, collectionId, createdAt: new Date().toISOString() });
    await db.doc(collectionPath(collectionId)).update({ likeCount: FieldValue.increment(1) });
  }

  const snapshot = await db.doc(collectionPath(collectionId)).get();
  return (snapshot.data()?.likeCount as number | undefined) ?? 0;
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run lib/repositories/like-repository.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: 失敗するテストを書く（API）**

`app/api/collections/[collectionId]/like/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/like", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST like", () => {
  it("increments likeCount and is idempotent for the same likerId", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const params = Promise.resolve({ collectionId: collection.id });

    const first = await POST(jsonRequest({ likerId: "liker-1" }), { params });
    expect((await first.json()).likeCount).toBe(1);

    const second = await POST(jsonRequest({ likerId: "liker-1" }), { params });
    expect((await second.json()).likeCount).toBe(1);
  });

  it("rejects a missing likerId", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const res = await POST(jsonRequest({}), { params: Promise.resolve({ collectionId: collection.id }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 6: テストを実行し失敗を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run app/api/collections`
Expected: FAIL（`./route` module not found）

- [ ] **Step 7: routeを実装する**

`app/api/collections/[collectionId]/like/route.ts`:

```ts
import { NextResponse } from "next/server";
import { addLike } from "@/lib/repositories/like-repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
): Promise<Response> {
  const { collectionId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.likerId !== "string" || !body.likerId) {
    return NextResponse.json({ error: "likerId is required" }, { status: 400 });
  }

  const likeCount = await addLike(collectionId, body.likerId);
  return NextResponse.json({ likeCount }, { status: 200 });
}
```

- [ ] **Step 8: テストを実行し成功を確認する**

Run: `FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199 npx vitest run`
Expected: PASS（全テスト）

- [ ] **Step 9: 最終確認（型チェック・ビルド・全テスト）**

Run: `npx tsc --noEmit && npm run test:emulator`
Expected: 両方成功。`npm run test:emulator`はローカルで起動中のエミュレータがあれば一旦停止してから実行する（ポート競合を避けるため）

- [ ] **Step 10: Commit**

```bash
git add lib/repositories/like-repository.ts lib/repositories/like-repository.test.ts \
  "app/api/collections/[collectionId]/like/route.ts" \
  "app/api/collections/[collectionId]/like/route.test.ts"
git commit -m "feat: コレクションへのいいね機能を追加する"
```

---

## 実行順序と注意事項

Task 1〜8はこの順で依存関係があるため上から実装する。UI側（別担当）は、Task 4完了時点で`sessionId`ベースの呼び出しが型エラーになる可能性があるため、Task 4完了後に一度UI担当と同期し、APIパス変更（`/api/sessions/**` → `/api/collections/**`）とリクエスト/レスポンス形状の変更点を共有すること。

`lib/mock-api-client.ts`（UI側のモックモード実装）は本プランの対象外だが、Task 1のCollection型変更に伴い型エラーになる可能性がある。UI担当がモッククライアントの型を合わせる想定で、本プランでは修正しない。

