# 思い出ベース手放し判断支援 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 部屋・棚の写真から商品候補を抽出し、ユーザーが直感で仕分け、「迷う」物だけClaudeとの短い対話（Reflection Agent）で判断材料を整理し、最終的に「残す/手放す/保留」を決定、手放したものはエピソード付きアルバムに残せる、という一連のフローをWebアプリとして動かす（P0スコープ）。

**Architecture:** Next.js (App Router, TypeScript) 単一プロジェクトをVercelにデプロイ。UIとAPI Routesを同居させ、Claude API呼び出しはすべてサーバー側（API Routes）から行う。永続化はFirebase Firestore（セッション/アイテム/ReflectionState/アルバム）とFirebase Storage（画像）。認証なしの匿名セッション。

**Tech Stack:** Next.js 14+ (App Router, TypeScript), Firebase (Firestore, Storage, Admin SDK + Client SDK), `@anthropic-ai/sdk`, Vitest（単体テスト）, Firebase Local Emulator Suite（Firestore/Storageの統合テスト）。

**Spec:** [docs/superpowers/specs/2026-09-01-letting-go-memory-support-design.md](../specs/2026-09-01-letting-go-memory-support-design.md)

## Global Constraints

- Claudeモデルは `claude-sonnet-5` を使用する（spec 4節）
- Anthropic/Firebase Admin SDKのキーはサーバー側環境変数のみに置き、クライアントバンドルに含めない（spec 10節）
- Reflection対話は1itemあたり最大3ターン。turnCountがこの上限に達したら次回呼び出しは `tool_choice: {type:"tool", name:"complete_reflection"}` を強制する（spec 8.4節）
- Reflection対話の各ターンは `tools: [ask_question, complete_reflection]`、`tool_choice: {type:"any"}` で呼び出し、Claudeは必ずどちらかを呼ぶ（spec 8.3節）
- Claude自身にFirestore書き込み権限を持たせない。実際の書き込みはAPI Route側のコードが行う（spec 8.3節）
- 推定売価は完全にモック（カテゴリ→価格レンジのテーブル引き）。実相場APIには接続しない（spec 7節）
- 部屋・棚の写真はClaude Vision/Storageへ送る前にクライアント側で長辺1024pxまでリサイズしJPEGに変換する（spec 10節）
- 認証は実装しない。匿名セッション（クライアント発行UUID）のみ（spec 2節）
- Firestoreパスは `sessions/{sessionId}`、`sessions/{sessionId}/items/{itemId}`、`sessions/{sessionId}/items/{itemId}/reflection`（ドキュメント）、`.../reflection/turns/{turnIndex}`、`sessions/{sessionId}/album/{memoryRecordId}` を使う（spec 5節）

---

## Task 1: プロジェクトスキャフォールディング

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.env.local.example`, `.gitignore`
- Create: `app/layout.tsx`, `app/page.tsx`（Next.js動作確認用の最小ページ）
- Create: `vitest.config.ts`
- Create: `firebase.json`, `.firebaserc`, `firestore.rules`, `storage.rules`（エミュレータ設定含む）
- Create: `lib/firebase/admin.ts`（Firebase Admin SDK初期化）
- Create: `lib/anthropic.ts`（Anthropicクライアント初期化）
- Test: `lib/anthropic.test.ts`

**Interfaces:**
- Produces: `getAdminFirestore(): Firestore`、`getAdminStorage(): Storage`（`lib/firebase/admin.ts`）。`getAnthropicClient(): Anthropic`（`lib/anthropic.ts`）

> フロントエンドはFirestore/Storageに直接アクセスせず、すべてNext.js API Routes（Admin SDK）経由にする（Task 11で画像もbase64でAPI Routeに送る）。そのためFirebase Client SDKはこのプロジェクトでは使わない。

- [ ] **Step 1: Next.jsプロジェクトを初期化する**

```bash
npx create-next-app@latest . --typescript --app --eslint --src-dir=false --import-alias "@/*" --use-npm --tailwind=false
```

既存の `index.html` と `思い出ベース手放し判断支援_企画仕様.md` は上書きされないことを確認する（`create-next-app`は空でないディレクトリで確認を求めるので、既存ファイルは残す形で進める）。

- [ ] **Step 2: 依存パッケージを追加する**

```bash
npm install @anthropic-ai/sdk firebase-admin
npm install -D vitest @vitejs/plugin-react firebase-tools
```

- [ ] **Step 3: 環境変数のテンプレートを作成する**

`.env.local.example`:

```
ANTHROPIC_API_KEY=
FIREBASE_PROJECT_ID=demo-letting-go
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIRESTORE_EMULATOR_HOST=localhost:8080
FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199
```

`FIREBASE_PROJECT_ID`は`demo-`プレフィックスのダミープロジェクトID（Firebase公式のエミュレータ専用プロジェクトID）にしておく。`FIRESTORE_EMULATOR_HOST`/`FIREBASE_STORAGE_EMULATOR_HOST`が設定されている限り、`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`は空でよく、実在のFirebaseプロジェクトも実サービスアカウントキーも不要（Step 4のAdmin SDK初期化で分岐する）。本番運用でチームが実プロジェクトを用意した段階で、`FIREBASE_PROJECT_ID`を実プロジェクトIDに、`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`をそのサービスアカウントの値に差し替え、`FIRESTORE_EMULATOR_HOST`/`FIREBASE_STORAGE_EMULATOR_HOST`を未設定にすればよい。

`.env.local` をコピーして使い、`.gitignore` に `.env.local` を追加する。

- [ ] **Step 4: Firebase Admin SDKの初期化ヘルパーを書く**

エミュレータ利用時（`FIRESTORE_EMULATOR_HOST`が設定されている場合）は、実サービスアカウント情報を一切要求せず、ダミーの`projectId`だけで初期化する。これにより、チームで実Firebaseプロジェクトの合意が取れていない段階でも、ローカルのエミュレータ・自動テストは支障なく動く。本番相当（実プロジェクト）に接続するときだけ`cert()`によるサービスアカウント認証を使う。

`lib/firebase/admin.ts`:

```ts
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

function isUsingEmulator(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const projectId = process.env.FIREBASE_PROJECT_ID ?? "demo-letting-go";

  if (isUsingEmulator()) {
    return initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
    storageBucket: `${projectId}.appspot.com`,
  });
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}
```

- [ ] **Step 5: Anthropicクライアントの初期化ヘルパーとテストを書く**

`lib/anthropic.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

describe("getAnthropicClient", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });

  it("throws if ANTHROPIC_API_KEY is not set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { getAnthropicClient } = await import("./anthropic");
    expect(() => getAnthropicClient()).toThrow("ANTHROPIC_API_KEY is not set");
  });

  it("returns a client when ANTHROPIC_API_KEY is set", async () => {
    const { getAnthropicClient } = await import("./anthropic");
    expect(getAnthropicClient()).toBeDefined();
  });
});
```

- [ ] **Step 6: テストを実行し失敗を確認する**

Run: `npx vitest run lib/anthropic.test.ts`
Expected: FAIL（`./anthropic` module not found）

- [ ] **Step 7: Anthropicクライアントの実装を書く**

`lib/anthropic.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = "claude-sonnet-5";

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey });
}
```

- [ ] **Step 8: テストを実行し成功を確認する**

Run: `npx vitest run lib/anthropic.test.ts`
Expected: PASS（2 tests）

- [ ] **Step 9: Firebaseエミュレータ設定を書く**

`.firebaserc`（`demo-`プレフィックスは実プロジェクトの作成・登録なしにFirebase CLIが受け付けるダミープロジェクトID）:

```json
{
  "projects": {
    "default": "demo-letting-go"
  }
}
```

`firebase.json`:

```json
{
  "firestore": { "rules": "firestore.rules" },
  "storage": { "rules": "storage.rules" },
  "emulators": {
    "firestore": { "port": 8080 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true }
  }
}
```

`firestore.rules`（すべてのFirestore/Storageアクセスはサーバー側Admin SDK経由で行い、Admin SDKはこれらのルールの対象外になる。ルールはFirestore/Storageエミュレータでの動作要件として必要な最小限の記述にとどめる）:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

`storage.rules`:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

- [ ] **Step 10: `vitest.config.ts`で`@/`エイリアスを設定する**

`create-next-app --import-alias "@/*"`はTypeScript/Next.jsのビルド向けにしか`@/*`を解決しない。Vitestは独自にモジュール解決するため、Task 9以降のテスト（`@/lib/...`形式のimportを使う）が解決できるよう、ここで明示的に設定する。

`vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
  },
});
```

`@/`エイリアスが実際に解決できることをこの場で検証するため、一時ファイルでテストを書いて実行し、削除する:

```bash
cat > lib/__alias_check.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import { CLAUDE_MODEL } from "@/lib/anthropic";

describe("@/ alias", () => {
  it("resolves to lib/anthropic.ts", () => {
    expect(CLAUDE_MODEL).toBe("claude-sonnet-5");
  });
});
EOF
npx vitest run lib/__alias_check.test.ts
rm lib/__alias_check.test.ts
```

Expected: 削除前の実行はPASS（1 test）。`@/lib/anthropic`が正しく`lib/anthropic.ts`に解決されていることを確認できたら一時ファイルを削除する。

- [ ] **Step 11: `npm run build` が通ることを確認する**

Run: `npm run build`
Expected: ビルド成功（Next.jsのデフォルトページのみ）

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: Next.jsプロジェクトをスキャフォールディングし、Firebase/Anthropicクライアントを初期化する"
```

---

## Task 2: ドメイン型とFirestoreパスヘルパー

**Files:**
- Create: `lib/types.ts`
- Create: `lib/firestore-paths.ts`
- Test: `lib/firestore-paths.test.ts`

**Interfaces:**
- Consumes: なし（最初の共通定義）
- Produces: `PurposeType`、`Session`、`Item`、`AttachmentType`、`ReflectionState`、`ReflectionTurn`、`MemoryRecord` 型（`lib/types.ts`）。`sessionPath(sessionId)`、`itemsCollectionPath(sessionId)`、`itemPath(sessionId, itemId)`、`reflectionPath(sessionId, itemId)`、`reflectionTurnsCollectionPath(sessionId, itemId)`、`albumCollectionPath(sessionId)`、`albumEntryPath(sessionId, memoryRecordId)`（`lib/firestore-paths.ts`）。以降の全タスクがこれらの型・パス関数を使う

- [ ] **Step 1: ドメイン型を定義する**

`lib/types.ts`:

```ts
export type PurposeType =
  | "earn_money"
  | "declutter"
  | "preserve_memories"
  | "consider_letting_go"
  | "other";

export type Session = {
  id: string;
  purposeType: PurposeType;
  targetAmount?: number;
  note?: string;
  createdAt: string;
};

export type ItemClassification = "keep" | "unsure" | "releaseable";
export type FinalDecision = "keep" | "let_go" | "hold";

export type Item = {
  id: string;
  sessionId: string;
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
```

- [ ] **Step 2: Firestoreパスのテストを書く**

`lib/firestore-paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  sessionPath,
  itemsCollectionPath,
  itemPath,
  reflectionPath,
  reflectionTurnsCollectionPath,
  albumCollectionPath,
  albumEntryPath,
} from "./firestore-paths";

describe("firestore-paths", () => {
  it("builds session path", () => {
    expect(sessionPath("s1")).toBe("sessions/s1");
  });

  it("builds items collection and item path", () => {
    expect(itemsCollectionPath("s1")).toBe("sessions/s1/items");
    expect(itemPath("s1", "i1")).toBe("sessions/s1/items/i1");
  });

  it("builds reflection document and turns collection path", () => {
    expect(reflectionPath("s1", "i1")).toBe(
      "sessions/s1/items/i1/reflection/state"
    );
    expect(reflectionTurnsCollectionPath("s1", "i1")).toBe(
      "sessions/s1/items/i1/reflection/state/turns"
    );
  });

  it("builds album collection and entry path", () => {
    expect(albumCollectionPath("s1")).toBe("sessions/s1/album");
    expect(albumEntryPath("s1", "m1")).toBe("sessions/s1/album/m1");
  });
});
```

- [ ] **Step 3: テストを実行し失敗を確認する**

Run: `npx vitest run lib/firestore-paths.test.ts`
Expected: FAIL（`./firestore-paths` module not found）

- [ ] **Step 4: Firestoreパスヘルパーを実装する**

`lib/firestore-paths.ts`:

```ts
export function sessionPath(sessionId: string): string {
  return `sessions/${sessionId}`;
}

export function itemsCollectionPath(sessionId: string): string {
  return `sessions/${sessionId}/items`;
}

export function itemPath(sessionId: string, itemId: string): string {
  return `sessions/${sessionId}/items/${itemId}`;
}

export function reflectionPath(sessionId: string, itemId: string): string {
  return `sessions/${sessionId}/items/${itemId}/reflection/state`;
}

export function reflectionTurnsCollectionPath(
  sessionId: string,
  itemId: string
): string {
  return `sessions/${sessionId}/items/${itemId}/reflection/state/turns`;
}

export function albumCollectionPath(sessionId: string): string {
  return `sessions/${sessionId}/album`;
}

export function albumEntryPath(sessionId: string, memoryRecordId: string): string {
  return `sessions/${sessionId}/album/${memoryRecordId}`;
}
```

- [ ] **Step 5: テストを実行し成功を確認する**

Run: `npx vitest run lib/firestore-paths.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/firestore-paths.ts lib/firestore-paths.test.ts
git commit -m "feat: ドメイン型とFirestoreパスヘルパーを追加する"
```

---

## Task 3: 推定価格モックロジック

**Files:**
- Create: `lib/pricing.ts`
- Test: `lib/pricing.test.ts`

**Interfaces:**
- Consumes: なし（純粋関数）
- Produces: `estimatePrice(category: string): number`（Task 10の商品抽出APIが使う）

- [ ] **Step 1: 失敗するテストを書く**

`lib/pricing.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { estimatePrice, PRICE_RANGES } from "./pricing";

describe("estimatePrice", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a value within the configured range for a known category", () => {
    const price = estimatePrice("clothing_tshirt");
    const range = PRICE_RANGES.clothing_tshirt;
    expect(price).toBeGreaterThanOrEqual(range.min);
    expect(price).toBeLessThanOrEqual(range.max);
  });

  it("is deterministic-ish but not always the same value", () => {
    const samples = new Set(
      Array.from({ length: 20 }, () => estimatePrice("clothing_tshirt"))
    );
    expect(samples.size).toBeGreaterThan(1);
  });

  it("falls back to the default range for an unknown category", () => {
    const price = estimatePrice("totally_unknown_category");
    const range = PRICE_RANGES.default;
    expect(price).toBeGreaterThanOrEqual(range.min);
    expect(price).toBeLessThanOrEqual(range.max);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run lib/pricing.test.ts`
Expected: FAIL（`./pricing` module not found）

- [ ] **Step 3: 価格レンジテーブルと推定関数を実装する**

`lib/pricing.ts`:

```ts
type PriceRange = { min: number; max: number };

export const PRICE_RANGES: Record<string, PriceRange> = {
  clothing_tshirt: { min: 800, max: 2500 },
  clothing_outerwear: { min: 1500, max: 6000 },
  shoes: { min: 1000, max: 5000 },
  book: { min: 200, max: 1200 },
  figure: { min: 1000, max: 8000 },
  electronics_audio: { min: 1500, max: 12000 },
  bag: { min: 1000, max: 8000 },
  accessory: { min: 500, max: 4000 },
  toy: { min: 500, max: 3000 },
  stationery: { min: 100, max: 1000 },
  default: { min: 300, max: 3000 },
};

export function estimatePrice(category: string): number {
  const range = PRICE_RANGES[category] ?? PRICE_RANGES.default;
  const value = range.min + Math.random() * (range.max - range.min);
  return Math.round(value / 50) * 50;
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run lib/pricing.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add lib/pricing.ts lib/pricing.test.ts
git commit -m "feat: 推定売価のモックロジックを追加する"
```

---

## Task 4: ReflectionStateパターンマージ関数

**Files:**
- Create: `lib/reflection-state.ts`
- Test: `lib/reflection-state.test.ts`

**Interfaces:**
- Consumes: `ReflectionState`、`AttachmentType`（`lib/types.ts`）
- Produces: `initialReflectionState(itemId, itemName): ReflectionState`、`applyStatePatch(current: ReflectionState, patch: Partial<ReflectionState>): ReflectionState`（Task 13の対話APIが使う）

- [ ] **Step 1: 失敗するテストを書く**

`lib/reflection-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyStatePatch, initialReflectionState } from "./reflection-state";
import type { ReflectionState } from "./types";

describe("initialReflectionState", () => {
  it("creates an empty in_progress state with turnCount 0", () => {
    const state = initialReflectionState("item_001", "サークルTシャツ");
    expect(state).toEqual<ReflectionState>({
      itemId: "item_001",
      itemName: "サークルTシャツ",
      attachmentTypes: [],
      reasonsToKeep: [],
      reasonsToLetGo: [],
      unresolved: [],
      turnCount: 0,
      status: "in_progress",
    });
  });
});

describe("applyStatePatch", () => {
  const base: ReflectionState = {
    itemId: "item_001",
    itemName: "サークルTシャツ",
    attachmentTypes: ["memory"],
    reasonsToKeep: ["サークル最後の大会で着た"],
    reasonsToLetGo: [],
    unresolved: [],
    turnCount: 1,
    status: "in_progress",
  };

  it("merges array fields without duplicates", () => {
    const next = applyStatePatch(base, {
      attachmentTypes: ["memory", "identity"],
      reasonsToKeep: ["サークル最後の大会で着た", "同期からの寄せ書きがある"],
    });
    expect(next.attachmentTypes).toEqual(["memory", "identity"]);
    expect(next.reasonsToKeep).toEqual([
      "サークル最後の大会で着た",
      "同期からの寄せ書きがある",
    ]);
  });

  it("overwrites scalar fields when patch provides them", () => {
    const next = applyStatePatch(base, { memoryToPreserve: "最後の大会で優勝したこと" });
    expect(next.memoryToPreserve).toBe("最後の大会で優勝したこと");
  });

  it("keeps existing scalar fields when patch omits them", () => {
    const withMemory = applyStatePatch(base, { memoryToPreserve: "優勝したこと" });
    const next = applyStatePatch(withMemory, { reasonsToLetGo: ["今後着ない"] });
    expect(next.memoryToPreserve).toBe("優勝したこと");
  });

  it("increments turnCount by 1 regardless of patch content", () => {
    const next = applyStatePatch(base, {});
    expect(next.turnCount).toBe(2);
  });

  it("updates status when patch provides it", () => {
    const next = applyStatePatch(base, { status: "ready_for_decision" });
    expect(next.status).toBe("ready_for_decision");
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run lib/reflection-state.test.ts`
Expected: FAIL（`./reflection-state` module not found）

- [ ] **Step 3: 実装を書く**

`lib/reflection-state.ts`:

```ts
import type { ReflectionState } from "./types";

export function initialReflectionState(
  itemId: string,
  itemName: string
): ReflectionState {
  return {
    itemId,
    itemName,
    attachmentTypes: [],
    reasonsToKeep: [],
    reasonsToLetGo: [],
    unresolved: [],
    turnCount: 0,
    status: "in_progress",
  };
}

export function applyStatePatch(
  current: ReflectionState,
  patch: Partial<ReflectionState>
): ReflectionState {
  return {
    ...current,
    attachmentTypes: [
      ...new Set([...current.attachmentTypes, ...(patch.attachmentTypes ?? [])]),
    ],
    reasonsToKeep: [
      ...new Set([...current.reasonsToKeep, ...(patch.reasonsToKeep ?? [])]),
    ],
    reasonsToLetGo: [
      ...new Set([...current.reasonsToLetGo, ...(patch.reasonsToLetGo ?? [])]),
    ],
    memoryToPreserve: patch.memoryToPreserve ?? current.memoryToPreserve,
    regretIfSold: patch.regretIfSold ?? current.regretIfSold,
    regretIfKept: patch.regretIfKept ?? current.regretIfKept,
    unresolved: patch.unresolved ?? current.unresolved,
    turnCount: current.turnCount + 1,
    status: patch.status ?? current.status,
  };
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run lib/reflection-state.test.ts`
Expected: PASS（6 tests）

- [ ] **Step 5: Commit**

```bash
git add lib/reflection-state.ts lib/reflection-state.test.ts
git commit -m "feat: ReflectionStateの初期化とパッチマージ関数を追加する"
```

---

## Task 5: ターン数上限のtool_choice判定関数

**Files:**
- Create: `lib/reflection-tools.ts`
- Test: `lib/reflection-tools.test.ts`

**Interfaces:**
- Consumes: `ReflectionState`（`lib/types.ts`）
- Produces: `MAX_REFLECTION_TURNS`定数、`ASK_QUESTION_TOOL`・`COMPLETE_REFLECTION_TOOL`（Anthropic tool定義オブジェクト）、`resolveToolChoice(state: ReflectionState): Anthropic.ToolChoice`（Task 13の対話APIが使う）

- [ ] **Step 1: 失敗するテストを書く**

`lib/reflection-tools.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_REFLECTION_TURNS, resolveToolChoice } from "./reflection-tools";
import type { ReflectionState } from "./types";

function stateWithTurnCount(turnCount: number): ReflectionState {
  return {
    itemId: "item_001",
    itemName: "サークルTシャツ",
    attachmentTypes: [],
    reasonsToKeep: [],
    reasonsToLetGo: [],
    unresolved: [],
    turnCount,
    status: "in_progress",
  };
}

describe("resolveToolChoice", () => {
  it("allows either tool before the turn limit", () => {
    const choice = resolveToolChoice(stateWithTurnCount(MAX_REFLECTION_TURNS - 1));
    expect(choice).toEqual({ type: "any" });
  });

  it("forces complete_reflection once the turn limit is reached", () => {
    const choice = resolveToolChoice(stateWithTurnCount(MAX_REFLECTION_TURNS));
    expect(choice).toEqual({ type: "tool", name: "complete_reflection" });
  });

  it("forces complete_reflection beyond the turn limit", () => {
    const choice = resolveToolChoice(stateWithTurnCount(MAX_REFLECTION_TURNS + 5));
    expect(choice).toEqual({ type: "tool", name: "complete_reflection" });
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npx vitest run lib/reflection-tools.test.ts`
Expected: FAIL（`./reflection-tools` module not found）

- [ ] **Step 3: tool定義とターン数判定を実装する**

`lib/reflection-tools.ts`:

```ts
import type Anthropic from "@anthropic-ai/sdk";
import type { ReflectionState } from "./types";

export const MAX_REFLECTION_TURNS = 3;

export const ASK_QUESTION_TOOL: Anthropic.Tool = {
  name: "ask_question",
  description:
    "判断材料としてまだ不足している最も重要な点について、ユーザーに1つだけ質問する",
  input_schema: {
    type: "object",
    properties: {
      reflection: {
        type: "string",
        description: "直前の回答への短い言い換え・仮説的な共感の一文",
      },
      question: { type: "string" },
      statePatch: {
        type: "object",
        properties: {
          attachmentTypes: { type: "array", items: { type: "string" } },
          reasonsToKeep: { type: "array", items: { type: "string" } },
          reasonsToLetGo: { type: "array", items: { type: "string" } },
          memoryToPreserve: { type: "string" },
          regretIfSold: { type: "string" },
          regretIfKept: { type: "string" },
          unresolved: { type: "array", items: { type: "string" } },
        },
      },
    },
    required: ["reflection", "question"],
  },
};

export const COMPLETE_REFLECTION_TOOL: Anthropic.Tool = {
  name: "complete_reflection",
  description: "判断材料が十分に整理できたので対話を終了し、要約を返す",
  input_schema: {
    type: "object",
    properties: {
      reflection: { type: "string" },
      summary: {
        type: "object",
        properties: {
          reasonsToKeep: { type: "array", items: { type: "string" } },
          reasonsToLetGo: { type: "array", items: { type: "string" } },
          memoryToPreserve: { type: "string" },
          regretIfSold: { type: "string" },
          regretIfKept: { type: "string" },
          unresolved: { type: "array", items: { type: "string" } },
        },
      },
    },
    required: ["reflection", "summary"],
  },
};

export function resolveToolChoice(state: ReflectionState): Anthropic.ToolChoice {
  if (state.turnCount >= MAX_REFLECTION_TURNS) {
    return { type: "tool", name: "complete_reflection" };
  }
  return { type: "any" };
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npx vitest run lib/reflection-tools.test.ts`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add lib/reflection-tools.ts lib/reflection-tools.test.ts
git commit -m "feat: Reflection対話のtool定義とターン数上限ロジックを追加する"
```

---

## Task 6: Firestoreセッション/アイテムリポジトリ

このタスク以降、Firestoreエミュレータを使った統合テストを書く。テスト実行前に別ターミナルで `npx firebase emulators:start --only firestore,storage` を起動しておく（CIでは `firebase emulators:exec` でラップする）。`lib/firebase/admin.ts` は `FIRESTORE_EMULATOR_HOST` が設定されていれば自動的にエミュレータへ接続する（firebase-adminの標準挙動）。

**Files:**
- Create: `lib/repositories/session-repository.ts`
- Create: `lib/repositories/item-repository.ts`
- Test: `lib/repositories/session-repository.test.ts`
- Test: `lib/repositories/item-repository.test.ts`
- Modify: `package.json`（`test:emulator` スクリプト追加）

**Interfaces:**
- Consumes: `Session`、`Item`（`lib/types.ts`）、`sessionPath`、`itemsCollectionPath`、`itemPath`（`lib/firestore-paths.ts`）、`getAdminFirestore`（`lib/firebase/admin.ts`）、`estimatePrice`（`lib/pricing.ts`）
- Produces: `createSession(input: { purposeType: PurposeType; targetAmount?: number; note?: string }): Promise<Session>`、`getSession(sessionId: string): Promise<Session | null>`、`createItem(input: { sessionId: string; imageUrl: string; sourceImageId?: string; title: string; category: string }): Promise<Item>`、`listItems(sessionId: string): Promise<Item[]>`、`updateItemClassification(sessionId: string, itemId: string, classification: ItemClassification): Promise<void>`、`updateItemDecision(sessionId: string, itemId: string, decision: FinalDecision): Promise<void>`（Task 9・11・14が使う）

- [ ] **Step 1: `package.json` にエミュレータ用テストスクリプトを追加する**

```json
{
  "scripts": {
    "test:emulator": "firebase emulators:exec --only firestore,storage \"vitest run\""
  }
}
```

`test:emulator`は毎回テストスイート全体（Firestore不要な純粋関数のテストも含む）を実行する。個別ファイルだけ流したい場合はエミュレータを起動したまま `npx vitest run <path>` を直接使う。

- [ ] **Step 2: 失敗するテストを書く（セッション）**

`lib/repositories/session-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSession, getSession } from "./session-repository";

describe("session-repository", () => {
  it("creates a session and reads it back", async () => {
    const session = await createSession({ purposeType: "earn_money", targetAmount: 10000 });

    expect(session.id).toBeTruthy();
    expect(session.purposeType).toBe("earn_money");
    expect(session.targetAmount).toBe(10000);

    const fetched = await getSession(session.id);
    expect(fetched).toEqual(session);
  });

  it("returns null for an unknown session id", async () => {
    const fetched = await getSession("does-not-exist");
    expect(fetched).toBeNull();
  });
});
```

- [ ] **Step 3: 失敗するテストを書く（アイテム）**

`lib/repositories/item-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSession } from "./session-repository";
import {
  createItem,
  listItems,
  updateItemClassification,
  updateItemDecision,
} from "./item-repository";

describe("item-repository", () => {
  it("creates an item with an estimated price and lists it", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });

    expect(item.id).toBeTruthy();
    expect(item.sessionId).toBe(session.id);
    expect(item.estimatedPrice).toBeGreaterThan(0);

    const items = await listItems(session.id);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(item.id);
  });

  it("updates classification and final decision", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/book.jpg",
      title: "小説",
      category: "book",
    });

    await updateItemClassification(session.id, item.id, "unsure");
    await updateItemDecision(session.id, item.id, "let_go");

    const [updated] = await listItems(session.id);
    expect(updated.initialClassification).toBe("unsure");
    expect(updated.finalDecision).toBe("let_go");
  });
});
```

- [ ] **Step 4: テストを実行し失敗を確認する**

Run: `npm run test:emulator`
Expected: FAIL（`./session-repository`・`./item-repository` module not found）

- [ ] **Step 5: セッションリポジトリを実装する**

`lib/repositories/session-repository.ts`:

```ts
import { getAdminFirestore } from "../firebase/admin";
import { sessionPath } from "../firestore-paths";
import type { PurposeType, Session } from "../types";

export async function createSession(input: {
  purposeType: PurposeType;
  targetAmount?: number;
  note?: string;
}): Promise<Session> {
  const db = getAdminFirestore();
  const ref = db.collection("sessions").doc();
  const session: Session = {
    id: ref.id,
    purposeType: input.purposeType,
    targetAmount: input.targetAmount,
    note: input.note,
    createdAt: new Date().toISOString(),
  };
  await ref.set(session);
  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const db = getAdminFirestore();
  const snapshot = await db.doc(sessionPath(sessionId)).get();
  if (!snapshot.exists) return null;
  return snapshot.data() as Session;
}
```

- [ ] **Step 6: アイテムリポジトリを実装する**

`lib/repositories/item-repository.ts`:

```ts
import { getAdminFirestore } from "../firebase/admin";
import { itemPath, itemsCollectionPath } from "../firestore-paths";
import { estimatePrice } from "../pricing";
import type { FinalDecision, Item, ItemClassification } from "../types";

export async function createItem(input: {
  sessionId: string;
  imageUrl: string;
  sourceImageId?: string;
  title: string;
  category: string;
}): Promise<Item> {
  const db = getAdminFirestore();
  const ref = db.collection(itemsCollectionPath(input.sessionId)).doc();
  const item: Item = {
    id: ref.id,
    sessionId: input.sessionId,
    imageUrl: input.imageUrl,
    sourceImageId: input.sourceImageId,
    title: input.title,
    category: input.category,
    estimatedPrice: estimatePrice(input.category),
  };
  await ref.set(item);
  return item;
}

export async function listItems(sessionId: string): Promise<Item[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(itemsCollectionPath(sessionId)).get();
  return snapshot.docs.map((doc) => doc.data() as Item);
}

export async function updateItemClassification(
  sessionId: string,
  itemId: string,
  classification: ItemClassification
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(itemPath(sessionId, itemId)).update({
    initialClassification: classification,
  });
}

export async function updateItemDecision(
  sessionId: string,
  itemId: string,
  decision: FinalDecision
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(itemPath(sessionId, itemId)).update({ finalDecision: decision });
}
```

- [ ] **Step 7: テストを実行し成功を確認する**

Run: `npm run test:emulator`
Expected: PASS（4 tests）

- [ ] **Step 8: Commit**

```bash
git add lib/repositories/session-repository.ts lib/repositories/item-repository.ts \
  lib/repositories/session-repository.test.ts lib/repositories/item-repository.test.ts package.json
git commit -m "feat: セッション・アイテムのFirestoreリポジトリを追加する"
```

---

## Task 7: Firestore Reflectionリポジトリ

**Files:**
- Create: `lib/repositories/reflection-repository.ts`
- Test: `lib/repositories/reflection-repository.test.ts`

**Interfaces:**
- Consumes: `ReflectionState`、`ReflectionTurn`（`lib/types.ts`）、`reflectionPath`、`reflectionTurnsCollectionPath`（`lib/firestore-paths.ts`）、`initialReflectionState`（`lib/reflection-state.ts`）、`getAdminFirestore`（`lib/firebase/admin.ts`）
- Produces: `createReflection(sessionId, itemId, itemName): Promise<ReflectionState>`、`getReflectionState(sessionId, itemId): Promise<ReflectionState | null>`、`saveReflectionState(sessionId, itemId, state: ReflectionState): Promise<void>`、`appendReflectionTurn(sessionId, itemId, turn: Omit<ReflectionTurn, "reflectionId">): Promise<void>`（Task 12・13が使う）

- [ ] **Step 1: 失敗するテストを書く**

`lib/repositories/reflection-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSession } from "./session-repository";
import { createItem } from "./item-repository";
import {
  appendReflectionTurn,
  createReflection,
  getReflectionState,
  saveReflectionState,
} from "./reflection-repository";

describe("reflection-repository", () => {
  it("creates an initial reflection state and reads it back", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });

    const created = await createReflection(session.id, item.id, item.title);
    expect(created.turnCount).toBe(0);
    expect(created.status).toBe("in_progress");

    const fetched = await getReflectionState(session.id, item.id);
    expect(fetched).toEqual(created);
  });

  it("saves an updated state and returns it on read", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });
    const created = await createReflection(session.id, item.id, item.title);

    const updated = { ...created, turnCount: 1, reasonsToKeep: ["大会で着た"] };
    await saveReflectionState(session.id, item.id, updated);

    const fetched = await getReflectionState(session.id, item.id);
    expect(fetched?.turnCount).toBe(1);
    expect(fetched?.reasonsToKeep).toEqual(["大会で着た"]);
  });

  it("returns null when no reflection exists yet", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const fetched = await getReflectionState(session.id, "no-such-item");
    expect(fetched).toBeNull();
  });

  it("appends a turn log entry without throwing", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });
    await createReflection(session.id, item.id, item.title);

    await expect(
      appendReflectionTurn(session.id, item.id, {
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

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm run test:emulator`
Expected: FAIL（`./reflection-repository` module not found）

- [ ] **Step 3: 実装を書く**

`lib/repositories/reflection-repository.ts`:

```ts
import { getAdminFirestore } from "../firebase/admin";
import { reflectionPath, reflectionTurnsCollectionPath } from "../firestore-paths";
import { initialReflectionState } from "../reflection-state";
import type { ReflectionState, ReflectionTurn } from "../types";

export async function createReflection(
  sessionId: string,
  itemId: string,
  itemName: string
): Promise<ReflectionState> {
  const db = getAdminFirestore();
  const state = initialReflectionState(itemId, itemName);
  await db.doc(reflectionPath(sessionId, itemId)).set(state);
  return state;
}

export async function getReflectionState(
  sessionId: string,
  itemId: string
): Promise<ReflectionState | null> {
  const db = getAdminFirestore();
  const snapshot = await db.doc(reflectionPath(sessionId, itemId)).get();
  if (!snapshot.exists) return null;
  return snapshot.data() as ReflectionState;
}

export async function saveReflectionState(
  sessionId: string,
  itemId: string,
  state: ReflectionState
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(reflectionPath(sessionId, itemId)).set(state);
}

export async function appendReflectionTurn(
  sessionId: string,
  itemId: string,
  turn: Omit<ReflectionTurn, "reflectionId">
): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(reflectionTurnsCollectionPath(sessionId, itemId)).doc();
  const fullTurn: ReflectionTurn = { ...turn, reflectionId: ref.id };
  await ref.set(fullTurn);
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npm run test:emulator`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**

```bash
git add lib/repositories/reflection-repository.ts lib/repositories/reflection-repository.test.ts
git commit -m "feat: ReflectionStateのFirestoreリポジトリを追加する"
```

---

## Task 8: Firestoreアルバムリポジトリ

**Files:**
- Create: `lib/repositories/album-repository.ts`
- Test: `lib/repositories/album-repository.test.ts`

**Interfaces:**
- Consumes: `MemoryRecord`（`lib/types.ts`）、`albumCollectionPath`（`lib/firestore-paths.ts`）、`getAdminFirestore`（`lib/firebase/admin.ts`）
- Produces: `createAlbumEntry(sessionId, input: Omit<MemoryRecord, "id" | "createdAt">): Promise<MemoryRecord>`、`listAlbumEntries(sessionId: string): Promise<MemoryRecord[]>`（Task 14・15が使う）

- [ ] **Step 1: 失敗するテストを書く**

`lib/repositories/album-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSession } from "./session-repository";
import { createAlbumEntry, listAlbumEntries } from "./album-repository";

describe("album-repository", () => {
  it("creates an album entry and lists it back", async () => {
    const session = await createSession({ purposeType: "declutter" });

    const entry = await createAlbumEntry(session.id, {
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

    const entries = await listAlbumEntries(session.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].itemName).toBe("サークルTシャツ");
  });

  it("returns an empty array when there are no entries", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const entries = await listAlbumEntries(session.id);
    expect(entries).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm run test:emulator`
Expected: FAIL（`./album-repository` module not found）

- [ ] **Step 3: 実装を書く**

`lib/repositories/album-repository.ts`:

```ts
import { getAdminFirestore } from "../firebase/admin";
import { albumCollectionPath } from "../firestore-paths";
import type { MemoryRecord } from "../types";

export async function createAlbumEntry(
  sessionId: string,
  input: Omit<MemoryRecord, "id" | "createdAt">
): Promise<MemoryRecord> {
  const db = getAdminFirestore();
  const ref = db.collection(albumCollectionPath(sessionId)).doc();
  const entry: MemoryRecord = {
    ...input,
    id: ref.id,
    createdAt: new Date().toISOString(),
  };
  await ref.set(entry);
  return entry;
}

export async function listAlbumEntries(sessionId: string): Promise<MemoryRecord[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(albumCollectionPath(sessionId))
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map((doc) => doc.data() as MemoryRecord);
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npm run test:emulator`
Expected: PASS（2 tests）

- [ ] **Step 5: Commit**

```bash
git add lib/repositories/album-repository.ts lib/repositories/album-repository.test.ts
git commit -m "feat: 手放したものアルバムのFirestoreリポジトリを追加する"
```

---

## Task 9: `POST /api/sessions`

**Files:**
- Create: `app/api/sessions/route.ts`
- Test: `app/api/sessions/route.test.ts`

**Interfaces:**
- Consumes: `createSession`（`lib/repositories/session-repository.ts`）、`PurposeType`（`lib/types.ts`）
- Produces: `POST`ハンドラ。Request body `{ purposeType: PurposeType; targetAmount?: number; note?: string }` → Response `Session`（201）。不正な`purposeType`は400

- [ ] **Step 1: 失敗するテストを書く**

`app/api/sessions/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sessions", () => {
  it("creates a session with a valid purposeType", async () => {
    const res = await POST(jsonRequest({ purposeType: "earn_money", targetAmount: 10000 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.purposeType).toBe("earn_money");
    expect(body.targetAmount).toBe(10000);
  });

  it("rejects an invalid purposeType", async () => {
    const res = await POST(jsonRequest({ purposeType: "not_a_real_purpose" }));
    expect(res.status).toBe(400);
  });

  it("rejects a missing purposeType", async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm run test:emulator`
Expected: FAIL（`./route` module not found）

- [ ] **Step 3: 実装を書く**

`app/api/sessions/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createSession } from "@/lib/repositories/session-repository";
import type { PurposeType } from "@/lib/types";

const VALID_PURPOSE_TYPES: PurposeType[] = [
  "earn_money",
  "declutter",
  "preserve_memories",
  "consider_letting_go",
  "other",
];

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);

  if (!body || !VALID_PURPOSE_TYPES.includes(body.purposeType)) {
    return NextResponse.json(
      { error: "purposeType must be one of " + VALID_PURPOSE_TYPES.join(", ") },
      { status: 400 }
    );
  }

  const session = await createSession({
    purposeType: body.purposeType,
    targetAmount: typeof body.targetAmount === "number" ? body.targetAmount : undefined,
    note: typeof body.note === "string" ? body.note : undefined,
  });

  return NextResponse.json(session, { status: 201 });
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npm run test:emulator`
Expected: PASS（session-repository/item-repository/reflection-repository/album-repositoryの既存分に加え、`app/api/sessions/route.test.ts`の3 testsもPASS）

- [ ] **Step 5: Commit**

```bash
git add app/api/sessions/route.ts app/api/sessions/route.test.ts
git commit -m "feat: セッション作成APIを追加する"
```

---

## Task 10: Firebase Storageアップロードヘルパー

**Files:**
- Create: `lib/storage.ts`
- Test: `lib/storage.test.ts`

**Interfaces:**
- Consumes: `getAdminStorage`（`lib/firebase/admin.ts`）
- Produces: `uploadRoomImage(sessionId: string, imageBase64: string, mimeType: string): Promise<string>`（画像を保存し公開URLを返す。Task 11の抽出APIが使う）

- [ ] **Step 1: 失敗するテストを書く**

`lib/storage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { uploadRoomImage } from "./storage";

const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("uploadRoomImage", () => {
  it("uploads a base64 image and returns a public URL", async () => {
    const url = await uploadRoomImage("session_test", ONE_PX_PNG_BASE64, "image/png");
    expect(url).toMatch(/^https?:\/\//);
  });

  it("stores different uploads under different paths", async () => {
    const first = await uploadRoomImage("session_test", ONE_PX_PNG_BASE64, "image/png");
    const second = await uploadRoomImage("session_test", ONE_PX_PNG_BASE64, "image/png");
    expect(first).not.toBe(second);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm run test:emulator`
Expected: FAIL（`./storage` module not found）

- [ ] **Step 3: 実装を書く**

`lib/storage.ts`:

```ts
import { randomUUID } from "node:crypto";
import { getAdminStorage } from "./firebase/admin";

export async function uploadRoomImage(
  sessionId: string,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const extension = mimeType.split("/")[1] ?? "jpg";
  const path = `sessions/${sessionId}/room-photos/${randomUUID()}.${extension}`;
  const bucket = getAdminStorage().bucket();
  const file = bucket.file(path);

  const buffer = Buffer.from(imageBase64, "base64");
  await file.save(buffer, { metadata: { contentType: mimeType } });
  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npm run test:emulator`
Expected: PASS（2 tests）

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts lib/storage.test.ts
git commit -m "feat: 部屋写真のFirebase Storageアップロードヘルパーを追加する"
```

---

## Task 11: `POST /api/items/extract`（画像からの商品候補抽出）

**Files:**
- Create: `lib/extraction-tools.ts`
- Create: `lib/extraction-fallback.ts`
- Create: `app/api/items/extract/route.ts`
- Test: `lib/extraction-fallback.test.ts`
- Test: `app/api/items/extract/route.test.ts`

**Interfaces:**
- Consumes: `getAnthropicClient`、`CLAUDE_MODEL`（`lib/anthropic.ts`）、`uploadRoomImage`（`lib/storage.ts`）、`createItem`（`lib/repositories/item-repository.ts`）
- Produces: `EXTRACT_ITEMS_TOOL`（`lib/extraction-tools.ts`）、`FALLBACK_EXTRACTED_ITEMS: Array<{ title: string; category: string }>`（`lib/extraction-fallback.ts`）、`POST`ハンドラ。Request body `{ sessionId: string; imageBase64: string; mimeType: string }` → Response `{ items: Item[] }`（201）

- [ ] **Step 1: フォールバック候補データとテストを書く**

`lib/extraction-fallback.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FALLBACK_EXTRACTED_ITEMS } from "./extraction-fallback";

describe("FALLBACK_EXTRACTED_ITEMS", () => {
  it("provides at least 3 sample items with title and category", () => {
    expect(FALLBACK_EXTRACTED_ITEMS.length).toBeGreaterThanOrEqual(3);
    for (const item of FALLBACK_EXTRACTED_ITEMS) {
      expect(item.title).toBeTruthy();
      expect(item.category).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm run test:emulator`
Expected: FAIL（`./extraction-fallback` module not found）

- [ ] **Step 3: フォールバックデータを実装する**

`lib/extraction-fallback.ts`:

```ts
export const FALLBACK_EXTRACTED_ITEMS: Array<{ title: string; category: string }> = [
  { title: "サークルTシャツ", category: "clothing_tshirt" },
  { title: "小説 3冊セット", category: "book" },
  { title: "フィギュア", category: "figure" },
  { title: "ヘッドホン", category: "electronics_audio" },
];
```

- [ ] **Step 4: `extract_items` tool定義を書く**

`lib/extraction-tools.ts`:

```ts
import type Anthropic from "@anthropic-ai/sdk";

export const EXTRACT_ITEMS_TOOL: Anthropic.Tool = {
  name: "extract_items",
  description:
    "部屋や棚の写真に写っている、出品候補になりうる私物を1つずつ抽出する",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "仮の商品名（日本語）" },
            category: {
              type: "string",
              description:
                "clothing_tshirt, clothing_outerwear, shoes, book, figure, electronics_audio, bag, accessory, toy, stationery のいずれか。当てはまらない場合はdefault",
            },
            confidence: { type: "number" },
          },
          required: ["title", "category"],
        },
      },
    },
    required: ["items"],
  },
};
```

- [ ] **Step 5: 失敗するテストを書く（route）**

`app/api/items/extract/route.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSession } from "@/lib/repositories/session-repository";

const messagesCreateMock = vi.fn();

vi.mock("@/lib/anthropic", () => ({
  CLAUDE_MODEL: "claude-sonnet-5",
  getAnthropicClient: () => ({
    messages: { create: messagesCreateMock },
  }),
}));

vi.mock("@/lib/storage", () => ({
  uploadRoomImage: vi.fn().mockResolvedValue("https://storage.googleapis.com/test/room.jpg"),
}));

const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/items/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/items/extract", () => {
  beforeEach(() => {
    messagesCreateMock.mockReset();
  });

  it("creates items from a successful Claude Vision extraction", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "extract_items",
          input: {
            items: [
              { title: "サークルTシャツ", category: "clothing_tshirt", confidence: 0.8 },
              { title: "小説 3冊セット", category: "book", confidence: 0.7 },
            ],
          },
        },
      ],
    });

    const session = await createSession({ purposeType: "declutter" });
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({ sessionId: session.id, imageBase64: ONE_PX_PNG_BASE64, mimeType: "image/png" })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].title).toBe("サークルTシャツ");
    expect(body.items[0].estimatedPrice).toBeGreaterThan(0);
  });

  it("falls back to sample items when the Claude API call fails", async () => {
    messagesCreateMock.mockRejectedValue(new Error("network error"));

    const session = await createSession({ purposeType: "declutter" });
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({ sessionId: session.id, imageBase64: ONE_PX_PNG_BASE64, mimeType: "image/png" })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects a request missing imageBase64", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({ sessionId: session.id, mimeType: "image/png" }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 6: テストを実行し失敗を確認する**

Run: `npm run test:emulator`
Expected: FAIL（`./route` module not found）

- [ ] **Step 7: routeを実装する**

`app/api/items/extract/route.ts`:

```ts
import { NextResponse } from "next/server";
import { CLAUDE_MODEL, getAnthropicClient } from "@/lib/anthropic";
import { EXTRACT_ITEMS_TOOL } from "@/lib/extraction-tools";
import { FALLBACK_EXTRACTED_ITEMS } from "@/lib/extraction-fallback";
import { uploadRoomImage } from "@/lib/storage";
import { createItem } from "@/lib/repositories/item-repository";
import type { Item } from "@/lib/types";

type ExtractedCandidate = { title: string; category: string };

async function extractCandidates(
  imageBase64: string,
  mimeType: string
): Promise<ExtractedCandidate[]> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    tools: [EXTRACT_ITEMS_TOOL],
    tool_choice: { type: "tool", name: "extract_items" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType as "image/png", data: imageBase64 },
          },
          {
            type: "text",
            text: "この部屋・棚の写真から、出品候補になりうる私物を抽出してください。",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
  );
  const items = (toolUse?.input as { items?: ExtractedCandidate[] } | undefined)?.items;
  if (!items || items.length === 0) {
    throw new Error("Claude returned no items");
  }
  return items;
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);

  if (!body?.sessionId || !body?.imageBase64 || !body?.mimeType) {
    return NextResponse.json(
      { error: "sessionId, imageBase64, mimeType are required" },
      { status: 400 }
    );
  }

  const imageUrl = await uploadRoomImage(body.sessionId, body.imageBase64, body.mimeType);

  let candidates: ExtractedCandidate[];
  try {
    candidates = await extractCandidates(body.imageBase64, body.mimeType);
  } catch {
    candidates = FALLBACK_EXTRACTED_ITEMS;
  }

  const items: Item[] = [];
  for (const candidate of candidates) {
    const item = await createItem({
      sessionId: body.sessionId,
      imageUrl,
      title: candidate.title,
      category: candidate.category,
    });
    items.push(item);
  }

  return NextResponse.json({ items }, { status: 201 });
}
```

- [ ] **Step 8: テストを実行し成功を確認する**

Run: `npm run test:emulator`
Expected: PASS（`extraction-fallback`の1 test、`extract/route`の3 tests含め全体PASS）

- [ ] **Step 9: Commit**

```bash
git add lib/extraction-tools.ts lib/extraction-fallback.ts lib/extraction-fallback.test.ts \
  app/api/items/extract/route.ts app/api/items/extract/route.test.ts
git commit -m "feat: 画像からの商品候補抽出APIを追加する（Claude Vision + フォールバック）"
```

> **ルーティングの補足：** Firestoreのreflectionドキュメントは `sessions/{sessionId}/items/{itemId}/reflection/state` に固定名で1つだけ存在する（spec section 9の`reflectionId`は導入しない）。そのためTask 12以降のAPIは `spec`の`/api/reflections/:id`ではなく、`sessionId`と`itemId`をパスに含む形（`/api/sessions/[sessionId]/items/[itemId]/...`）に寄せる。データモデルと1対1になり、余分なID解決を挟まずに済むための実装上の調整であり、機能面での差分はない。

---

## Task 12: `PATCH /api/sessions/[sessionId]/items/[itemId]/classification`

**Files:**
- Create: `app/api/sessions/[sessionId]/items/[itemId]/classification/route.ts`
- Test: `app/api/sessions/[sessionId]/items/[itemId]/classification/route.test.ts`

**Interfaces:**
- Consumes: `updateItemClassification`（`lib/repositories/item-repository.ts`）
- Produces: `PATCH`ハンドラ。Request body `{ classification: ItemClassification }` → 204。不正な値は400

- [ ] **Step 1: 失敗するテストを書く**

`app/api/sessions/[sessionId]/items/[itemId]/classification/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSession } from "@/lib/repositories/session-repository";
import { createItem, listItems } from "@/lib/repositories/item-repository";
import { PATCH } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/sessions/x/items/y/classification", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH classification", () => {
  it("updates the item's initialClassification", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/x.jpg",
      title: "本",
      category: "book",
    });

    const res = await PATCH(jsonRequest({ classification: "unsure" }), {
      params: Promise.resolve({ sessionId: session.id, itemId: item.id }),
    });

    expect(res.status).toBe(204);
    const [updated] = await listItems(session.id);
    expect(updated.initialClassification).toBe("unsure");
  });

  it("rejects an invalid classification value", async () => {
    const res = await PATCH(jsonRequest({ classification: "nope" }), {
      params: Promise.resolve({ sessionId: "s1", itemId: "i1" }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm run test:emulator`
Expected: FAIL（`./route` module not found）

- [ ] **Step 3: 実装を書く**

`app/api/sessions/[sessionId]/items/[itemId]/classification/route.ts`:

```ts
import { NextResponse } from "next/server";
import { updateItemClassification } from "@/lib/repositories/item-repository";
import type { ItemClassification } from "@/lib/types";

const VALID_CLASSIFICATIONS: ItemClassification[] = ["keep", "unsure", "releaseable"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; itemId: string }> }
): Promise<Response> {
  const { sessionId, itemId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || !VALID_CLASSIFICATIONS.includes(body.classification)) {
    return NextResponse.json(
      { error: "classification must be one of " + VALID_CLASSIFICATIONS.join(", ") },
      { status: 400 }
    );
  }

  await updateItemClassification(sessionId, itemId, body.classification);
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npm run test:emulator`
Expected: PASS（2 tests）

- [ ] **Step 5: Commit**

```bash
git add "app/api/sessions/[sessionId]/items/[itemId]/classification/route.ts" \
  "app/api/sessions/[sessionId]/items/[itemId]/classification/route.test.ts"
git commit -m "feat: 一次分類の保存APIを追加する"
```

---

## Task 13: `POST /api/sessions/[sessionId]/items/[itemId]/reflection`（対話開始）

**Files:**
- Create: `app/api/sessions/[sessionId]/items/[itemId]/reflection/route.ts`
- Test: `app/api/sessions/[sessionId]/items/[itemId]/reflection/route.test.ts`

**Interfaces:**
- Consumes: `createReflection`（`lib/repositories/reflection-repository.ts`）
- Produces: `POST`ハンドラ。Request body `{ itemName: string }` → Response `ReflectionState`（201）

- [ ] **Step 1: 失敗するテストを書く**

`app/api/sessions/[sessionId]/items/[itemId]/reflection/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSession } from "@/lib/repositories/session-repository";
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
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/x.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });

    const res = await POST(jsonRequest({ itemName: item.title }), {
      params: Promise.resolve({ sessionId: session.id, itemId: item.id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.turnCount).toBe(0);
    expect(body.status).toBe("in_progress");
    expect(body.itemName).toBe("サークルTシャツ");
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm run test:emulator`
Expected: FAIL（`./route` module not found）

- [ ] **Step 3: 実装を書く**

`app/api/sessions/[sessionId]/items/[itemId]/reflection/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createReflection } from "@/lib/repositories/reflection-repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; itemId: string }> }
): Promise<Response> {
  const { sessionId, itemId } = await params;
  const body = await request.json().catch(() => null);

  if (!body?.itemName) {
    return NextResponse.json({ error: "itemName is required" }, { status: 400 });
  }

  const state = await createReflection(sessionId, itemId, body.itemName);
  return NextResponse.json(state, { status: 201 });
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npm run test:emulator`
Expected: PASS（1 test）

- [ ] **Step 5: Commit**

```bash
git add "app/api/sessions/[sessionId]/items/[itemId]/reflection/route.ts" \
  "app/api/sessions/[sessionId]/items/[itemId]/reflection/route.test.ts"
git commit -m "feat: Reflection対話の開始APIを追加する"
```

---

## Task 14: `POST /api/sessions/[sessionId]/items/[itemId]/reflection/messages`（対話ターン本体）

これがReflection Agentの中核。毎ターン、現在のStateと直近のユーザー発言だけをClaudeに送り、`ask_question`か`complete_reflection`のどちらかをtool_choice `"any"`で呼ばせる（turnCountが上限に達していれば`complete_reflection`を強制）。返ってきた`statePatch`／`summary`をFirestoreにマージ保存し、対話ログも記録する。

**Files:**
- Create: `lib/reflection-prompt.ts`
- Create: `app/api/sessions/[sessionId]/items/[itemId]/reflection/messages/route.ts`
- Test: `lib/reflection-prompt.test.ts`
- Test: `app/api/sessions/[sessionId]/items/[itemId]/reflection/messages/route.test.ts`

**Interfaces:**
- Consumes: `getAnthropicClient`、`CLAUDE_MODEL`（`lib/anthropic.ts`）、`ASK_QUESTION_TOOL`、`COMPLETE_REFLECTION_TOOL`、`resolveToolChoice`（`lib/reflection-tools.ts`）、`applyStatePatch`（`lib/reflection-state.ts`）、`getReflectionState`、`saveReflectionState`、`appendReflectionTurn`（`lib/repositories/reflection-repository.ts`）
- Produces: `REFLECTION_SYSTEM_PROMPT: string`、`buildReflectionUserMessage(itemName: string, state: ReflectionState, userMessage: string): string`（`lib/reflection-prompt.ts`）。`POST`ハンドラ。Request body `{ message: string }` → Response `{ action: "ask"; reflection: string; question: string } | { action: "complete"; reflection: string; summary: {...} }`（Task 15・フロントエンドが使う）

- [ ] **Step 1: System PromptとUser Message組み立てのテストを書く**

`lib/reflection-prompt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildReflectionUserMessage, REFLECTION_SYSTEM_PROMPT } from "./reflection-prompt";
import type { ReflectionState } from "./types";

describe("REFLECTION_SYSTEM_PROMPT", () => {
  it("instructs the model not to make the final decision", () => {
    expect(REFLECTION_SYSTEM_PROMPT).toContain("結論を出してはいけません");
  });

  it("caps questions to one per turn", () => {
    expect(REFLECTION_SYSTEM_PROMPT).toContain("1ターンにつき質問は1つだけ");
  });
});

describe("buildReflectionUserMessage", () => {
  it("embeds the item name, current state, and latest user message", () => {
    const state: ReflectionState = {
      itemId: "item_001",
      itemName: "サークルTシャツ",
      attachmentTypes: ["memory"],
      reasonsToKeep: ["大会で着た"],
      reasonsToLetGo: [],
      unresolved: [],
      turnCount: 1,
      status: "in_progress",
    };

    const message = buildReflectionUserMessage("サークルTシャツ", state, "写真は残ってる");

    expect(message).toContain("サークルTシャツ");
    expect(message).toContain("大会で着た");
    expect(message).toContain("写真は残ってる");
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm run test:emulator`
Expected: FAIL（`./reflection-prompt` module not found）

- [ ] **Step 3: System Prompt / User Message組み立てを実装する**

`lib/reflection-prompt.ts`:

```ts
import type { ReflectionState } from "./types";

export const REFLECTION_SYSTEM_PROMPT = `<role>
あなたは、所有物を「残す」「手放す」「保留する」判断をユーザー自身が納得して行うための
Reflection Agentです。
</role>

<goal>
ユーザーが迷っている理由を短い対話で整理し、最終的な判断に必要な材料を本人に返してください。
あなた自身が「売るべき」「残すべき」という結論を出してはいけません。
</goal>

<principles>
- 売却を促さない
- 保持を促さない
- 最終判断を代行しない
- ユーザーの感情を評価しない
- 思い入れの強さを数値化しない
- ユーザーが既に答えた内容を再質問しない
- 1ターンにつき質問は1つだけにする
- 質問はYes/Noで完結しない自由記述形式にする
- 最大3ターン程度で判断材料を整理する
- 十分な材料が集まった場合は質問を増やさず終了する
</principles>

<what_to_understand>
必要に応じて以下を探索してください。
1. 物そのものへの愛着
2. その物に紐づく記憶や出来事
3. 人とのつながり
4. 自分らしさやアイデンティティとの関係
5. 現在の実用性
6. 希少性・代替可能性
7. 残したい理由
8. 手放してもよいと思う理由
9. 手放した場合に後悔しそうなこと
10. 持ち続けた場合に後悔しそうなこと
11. 手放す場合でも残しておきたい記憶や意味
</what_to_understand>

<question_policy>
現在のReflectionStateを確認してください。
まず、判断に必要な情報のうち「最も重要なのに、まだ分かっていないこと」を1つ特定してください。
その情報を知るための、Yes/Noで終わらない自由記述の質問を1つだけしてください。
質問する必要がなければ、追加質問をせずcomplete_reflectionを呼んでください。
</question_policy>

<conversation_style>
質問の前に、必要な場合のみユーザーの直前の回答を1文程度で言い換えて返してください。
例：「物そのものより、その時の出来事との結びつきが大きそうですね。」
ただし、ユーザーの感情について断定してはいけません。
「〜なのですね」ではなく、「〜という部分が大きそうですね」「〜に近いようにも見えます」など、
仮説として表現してください。
</conversation_style>

<decision_support>
残したい理由だけでなく、手放してもよいと感じている理由も整理してください。
「手放した場合の後悔」だけでなく、「持ち続けた場合の後悔」についても必要に応じて確認してください。
どちらかの選択に誘導してはいけません。
</decision_support>

<memory_preservation>
ユーザーが物そのものよりも、出来事・人・当時の自分・経験などに価値を感じている場合があります。
その場合でも、「記憶を残せるなら手放すべき」とは判断しないでください。
必要であれば、「もし物を手放すとしたら、この物から何を残しておきたいですか？」のような質問によって、
残しておきたい記憶や意味を整理してください。
</memory_preservation>

<completion_condition>
以下がある程度整理できた場合、対話を終了してください。
- 残したい理由 / 手放してもよい理由 / 愛着の対象 / 手放した場合に失いたくないもの / 主要な未解決ポイント
全項目を必ず埋める必要はありません。判断に十分であれば終了してください。
</completion_condition>

<final_summary>
対話終了時には、残したい理由・手放してもよい理由・残しておきたい記憶・まだ迷っているポイントを整理してください。
最後に必ず、「残す」「手放す」「保留する」の判断はユーザー本人に委ねてください。
</final_summary>`;

export function buildReflectionUserMessage(
  itemName: string,
  state: ReflectionState,
  userMessage: string
): string {
  return `<item>
${JSON.stringify({ id: state.itemId, name: itemName })}
</item>

<reflection_state>
${JSON.stringify(state)}
</reflection_state>

<user_message>
${userMessage}
</user_message>`;
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npm run test:emulator`
Expected: PASS（3 tests）

- [ ] **Step 5: 失敗するテストを書く（route）**

`app/api/sessions/[sessionId]/items/[itemId]/reflection/messages/route.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSession } from "@/lib/repositories/session-repository";
import { createItem } from "@/lib/repositories/item-repository";
import { createReflection, getReflectionState } from "@/lib/repositories/reflection-repository";

const messagesCreateMock = vi.fn();

vi.mock("@/lib/anthropic", () => ({
  CLAUDE_MODEL: "claude-sonnet-5",
  getAnthropicClient: () => ({
    messages: { create: messagesCreateMock },
  }),
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/reflection/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function setupItem() {
  const session = await createSession({ purposeType: "declutter" });
  const item = await createItem({
    sessionId: session.id,
    imageUrl: "https://example.com/x.jpg",
    title: "サークルTシャツ",
    category: "clothing_tshirt",
  });
  await createReflection(session.id, item.id, item.title);
  return { session, item };
}

describe("POST reflection messages", () => {
  beforeEach(() => {
    messagesCreateMock.mockReset();
  });

  it("returns the next question and persists the state patch", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "ask_question",
          input: {
            reflection: "大会との結びつきが大きそうですね。",
            question: "一番覚えていることは何ですか？",
            statePatch: { attachmentTypes: ["memory"], reasonsToKeep: ["大会で着た"] },
          },
        },
      ],
    });

    const { session, item } = await setupItem();
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({ message: "最後の大会で着たから迷う" }), {
      params: Promise.resolve({ sessionId: session.id, itemId: item.id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("ask");
    expect(body.question).toBe("一番覚えていることは何ですか？");

    const state = await getReflectionState(session.id, item.id);
    expect(state?.turnCount).toBe(1);
    expect(state?.reasonsToKeep).toEqual(["大会で着た"]);
  });

  it("returns a summary when Claude calls complete_reflection", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "complete_reflection",
          input: {
            reflection: "十分に整理できました。",
            summary: { reasonsToKeep: ["大会で着た"], reasonsToLetGo: ["今後着ない"] },
          },
        },
      ],
    });

    const { session, item } = await setupItem();
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({ message: "もう着ないかも" }), {
      params: Promise.resolve({ sessionId: session.id, itemId: item.id }),
    });

    const body = await res.json();
    expect(body.action).toBe("complete");
    expect(body.summary.reasonsToLetGo).toEqual(["今後着ない"]);

    const state = await getReflectionState(session.id, item.id);
    expect(state?.status).toBe("ready_for_decision");
  });

  it("forces complete_reflection once the turn limit is reached", async () => {
    const { session, item } = await setupItem();

    // turnCountを上限まで進める
    for (let i = 0; i < 3; i += 1) {
      messagesCreateMock.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            name: "ask_question",
            input: { reflection: "…", question: `質問${i}`, statePatch: {} },
          },
        ],
      });
      const { POST } = await import("./route");
      await POST(jsonRequest({ message: `回答${i}` }), {
        params: Promise.resolve({ sessionId: session.id, itemId: item.id }),
      });
    }

    messagesCreateMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "complete_reflection",
          input: { reflection: "十分です。", summary: { reasonsToKeep: [] } },
        },
      ],
    });

    const { POST } = await import("./route");
    await POST(jsonRequest({ message: "最後の回答" }), {
      params: Promise.resolve({ sessionId: session.id, itemId: item.id }),
    });

    const lastCallArgs = messagesCreateMock.mock.calls.at(-1)?.[0];
    expect(lastCallArgs.tool_choice).toEqual({ type: "tool", name: "complete_reflection" });
  });
});
```

- [ ] **Step 6: テストを実行し失敗を確認する**

Run: `npm run test:emulator`
Expected: FAIL（`./route` module not found）

- [ ] **Step 7: routeを実装する**

`app/api/sessions/[sessionId]/items/[itemId]/reflection/messages/route.ts`:

```ts
import { NextResponse } from "next/server";
import { CLAUDE_MODEL, getAnthropicClient } from "@/lib/anthropic";
import { ASK_QUESTION_TOOL, COMPLETE_REFLECTION_TOOL, resolveToolChoice } from "@/lib/reflection-tools";
import { buildReflectionUserMessage, REFLECTION_SYSTEM_PROMPT } from "@/lib/reflection-prompt";
import { applyStatePatch } from "@/lib/reflection-state";
import {
  appendReflectionTurn,
  getReflectionState,
  saveReflectionState,
} from "@/lib/repositories/reflection-repository";
import type { ReflectionState } from "@/lib/types";

type AskInput = { reflection: string; question: string; statePatch?: Partial<ReflectionState> };
type CompleteInput = { reflection: string; summary?: Partial<ReflectionState> };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; itemId: string }> }
): Promise<Response> {
  const { sessionId, itemId } = await params;
  const body = await request.json().catch(() => null);

  if (!body?.message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const currentState = await getReflectionState(sessionId, itemId);
  if (!currentState) {
    return NextResponse.json({ error: "reflection not found" }, { status: 404 });
  }

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: REFLECTION_SYSTEM_PROMPT,
    tools: [ASK_QUESTION_TOOL, COMPLETE_REFLECTION_TOOL],
    tool_choice: resolveToolChoice(currentState),
    messages: [
      {
        role: "user",
        content: buildReflectionUserMessage(currentState.itemName, currentState, body.message),
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
  );

  if (!toolUse) {
    return NextResponse.json({ error: "Claude did not call a tool" }, { status: 502 });
  }

  if (toolUse.name === "ask_question") {
    const input = toolUse.input as AskInput;
    const nextState = applyStatePatch(currentState, input.statePatch ?? {});
    await saveReflectionState(sessionId, itemId, nextState);
    await appendReflectionTurn(sessionId, itemId, {
      turnIndex: nextState.turnCount,
      userMessage: body.message,
      assistantAction: "ask",
      assistantReflectionText: input.reflection,
      question: input.question,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({
      action: "ask",
      reflection: input.reflection,
      question: input.question,
    });
  }

  const input = toolUse.input as CompleteInput;
  const nextState = applyStatePatch(
    { ...currentState, status: "ready_for_decision" },
    input.summary ?? {}
  );
  await saveReflectionState(sessionId, itemId, nextState);
  await appendReflectionTurn(sessionId, itemId, {
    turnIndex: nextState.turnCount,
    userMessage: body.message,
    assistantAction: "complete",
    assistantReflectionText: input.reflection,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({
    action: "complete",
    reflection: input.reflection,
    summary: {
      reasonsToKeep: nextState.reasonsToKeep,
      reasonsToLetGo: nextState.reasonsToLetGo,
      memoryToPreserve: nextState.memoryToPreserve,
      regretIfSold: nextState.regretIfSold,
      regretIfKept: nextState.regretIfKept,
      unresolved: nextState.unresolved,
    },
  });
}
```

- [ ] **Step 8: テストを実行し成功を確認する**

Run: `npm run test:emulator`
Expected: PASS（`reflection-prompt`の3 tests、`messages/route`の3 tests含め全体PASS）

- [ ] **Step 9: Commit**

```bash
git add lib/reflection-prompt.ts lib/reflection-prompt.test.ts \
  "app/api/sessions/[sessionId]/items/[itemId]/reflection/messages/route.ts" \
  "app/api/sessions/[sessionId]/items/[itemId]/reflection/messages/route.test.ts"
git commit -m "feat: Reflection Agentの対話ターンAPIを追加する（System Prompt・ターン数強制含む）"
```

---

## Task 15: アルバム用テキスト生成（`save_memory_record`）

「手放す」を選んだときだけ呼ぶ、1回きりの構造化生成。Claudeはこの呼び出しでDBに書き込むわけではなく、backendがこの出力を使ってFirestoreに書き込む（spec 8.3節の注記どおり）。

**Files:**
- Create: `lib/memory-record-tool.ts`
- Create: `lib/memory-record-generator.ts`
- Test: `lib/memory-record-generator.test.ts`

**Interfaces:**
- Consumes: `getAnthropicClient`、`CLAUDE_MODEL`（`lib/anthropic.ts`）、`ReflectionState`（`lib/types.ts`）
- Produces: `SAVE_MEMORY_RECORD_TOOL`（`lib/memory-record-tool.ts`）、`generateMemoryRecordText(itemName: string, reflectionState: ReflectionState | null): Promise<{ episode?: string; memory: string; reasonForLettingGo?: string; tags: string[] }>`（Task 16の決定APIが使う）

- [ ] **Step 1: tool定義を書く**

`lib/memory-record-tool.ts`:

```ts
import type Anthropic from "@anthropic-ai/sdk";

export const SAVE_MEMORY_RECORD_TOOL: Anthropic.Tool = {
  name: "save_memory_record",
  description:
    "手放すと決めた所有物について、ユーザーが残したい思い出や手放した理由をアルバム用の文章として整える",
  input_schema: {
    type: "object",
    properties: {
      episode: { type: "string", description: "アルバムに表示する短いエピソード文" },
      memory: { type: "string", description: "残しておきたい記憶・意味" },
      reasonForLettingGo: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["memory"],
  },
};
```

- [ ] **Step 2: 失敗するテストを書く**

`lib/memory-record-generator.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const messagesCreateMock = vi.fn();

vi.mock("./anthropic", () => ({
  CLAUDE_MODEL: "claude-sonnet-5",
  getAnthropicClient: () => ({ messages: { create: messagesCreateMock } }),
}));

describe("generateMemoryRecordText", () => {
  beforeEach(() => {
    messagesCreateMock.mockReset();
  });

  it("uses reflection state as context when available", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "save_memory_record",
          input: {
            episode: "最後の大会で着たTシャツ。",
            memory: "2回生最後の大会でチームとして初めて優勝したこと",
            reasonForLettingGo: "今後着る予定はない",
            tags: ["サークル", "卒業"],
          },
        },
      ],
    });

    const { generateMemoryRecordText } = await import("./memory-record-generator");
    const result = await generateMemoryRecordText("サークルTシャツ", {
      itemId: "item_001",
      itemName: "サークルTシャツ",
      attachmentTypes: ["memory"],
      reasonsToKeep: ["最後の大会で着た"],
      reasonsToLetGo: ["今後着ない"],
      memoryToPreserve: "2回生最後の大会でチームとして初めて優勝したこと",
      unresolved: [],
      turnCount: 2,
      status: "ready_for_decision",
    });

    expect(result.memory).toContain("優勝");
    expect(result.tags).toContain("サークル");
  });

  it("falls back to a minimal record when there is no reflection state", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "save_memory_record",
          input: { memory: "特に記録なし", tags: [] },
        },
      ],
    });

    const { generateMemoryRecordText } = await import("./memory-record-generator");
    const result = await generateMemoryRecordText("小説 3冊セット", null);
    expect(result.memory).toBeTruthy();
  });
});
```

- [ ] **Step 3: テストを実行し失敗を確認する**

Run: `npm run test:emulator`
Expected: FAIL（`./memory-record-generator` module not found）

- [ ] **Step 4: 実装を書く**

`lib/memory-record-generator.ts`:

```ts
import { CLAUDE_MODEL, getAnthropicClient } from "./anthropic";
import { SAVE_MEMORY_RECORD_TOOL } from "./memory-record-tool";
import type { ReflectionState } from "./types";

type MemoryRecordText = {
  episode?: string;
  memory: string;
  reasonForLettingGo?: string;
  tags: string[];
};

export async function generateMemoryRecordText(
  itemName: string,
  reflectionState: ReflectionState | null
): Promise<MemoryRecordText> {
  const client = getAnthropicClient();
  const context = reflectionState
    ? JSON.stringify(reflectionState)
    : JSON.stringify({ itemName, note: "対話は行われていない" });

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    tools: [SAVE_MEMORY_RECORD_TOOL],
    tool_choice: { type: "tool", name: "save_memory_record" },
    messages: [
      {
        role: "user",
        content: `ユーザーは「${itemName}」を手放すことに決めました。以下の情報をもとに、手放したものアルバムに残す短いエピソード文と、残しておきたい記憶を整えてください。\n\n${context}`,
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
  );
  const input = toolUse?.input as MemoryRecordText | undefined;

  return {
    episode: input?.episode,
    memory: input?.memory ?? `${itemName}を手放しました。`,
    reasonForLettingGo: input?.reasonForLettingGo,
    tags: input?.tags ?? [],
  };
}
```

- [ ] **Step 5: テストを実行し成功を確認する**

Run: `npm run test:emulator`
Expected: PASS（2 tests）

- [ ] **Step 6: Commit**

```bash
git add lib/memory-record-tool.ts lib/memory-record-generator.ts lib/memory-record-generator.test.ts
git commit -m "feat: 手放したものアルバム用のテキスト生成を追加する"
```

---

## Task 16: `POST /api/sessions/[sessionId]/items/[itemId]/decision`（最終判断）

**Files:**
- Create: `app/api/sessions/[sessionId]/items/[itemId]/decision/route.ts`
- Test: `app/api/sessions/[sessionId]/items/[itemId]/decision/route.test.ts`

**Interfaces:**
- Consumes: `updateItemDecision`（`lib/repositories/item-repository.ts`）、`getReflectionState`（`lib/repositories/reflection-repository.ts`）、`generateMemoryRecordText`（`lib/memory-record-generator.ts`）、`createAlbumEntry`（`lib/repositories/album-repository.ts`）
- Produces: `POST`ハンドラ。Request body `{ decision: FinalDecision; itemId: string; itemName: string; imageUrl: string }` → `decision === "let_go"`のとき`MemoryRecord`を生成・保存して返す（201）。それ以外は`{ decision }`のみ返す（200）

- [ ] **Step 1: 失敗するテストを書く**

`app/api/sessions/[sessionId]/items/[itemId]/decision/route.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSession } from "@/lib/repositories/session-repository";
import { createItem, listItems } from "@/lib/repositories/item-repository";
import { createReflection } from "@/lib/repositories/reflection-repository";
import { listAlbumEntries } from "@/lib/repositories/album-repository";

const messagesCreateMock = vi.fn();

vi.mock("@/lib/anthropic", () => ({
  CLAUDE_MODEL: "claude-sonnet-5",
  getAnthropicClient: () => ({ messages: { create: messagesCreateMock } }),
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST decision", () => {
  beforeEach(() => {
    messagesCreateMock.mockReset();
  });

  it("saves finalDecision and creates an album entry when letting go", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "save_memory_record",
          input: { memory: "大会の記憶", tags: ["サークル"] },
        },
      ],
    });

    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/x.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });
    await createReflection(session.id, item.id, item.title);

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({ decision: "let_go", itemName: item.title, imageUrl: item.imageUrl }),
      { params: Promise.resolve({ sessionId: session.id, itemId: item.id }) }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.albumEntry.memory).toBe("大会の記憶");

    const [updated] = await listItems(session.id);
    expect(updated.finalDecision).toBe("let_go");

    const entries = await listAlbumEntries(session.id);
    expect(entries).toHaveLength(1);
  });

  it("saves finalDecision without creating an album entry when keeping", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/x.jpg",
      title: "ヘッドホン",
      category: "electronics_audio",
    });

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({ decision: "keep", itemName: item.title, imageUrl: item.imageUrl }),
      { params: Promise.resolve({ sessionId: session.id, itemId: item.id }) }
    );

    expect(res.status).toBe(200);
    const entries = await listAlbumEntries(session.id);
    expect(entries).toHaveLength(0);
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm run test:emulator`
Expected: FAIL（`./route` module not found）

- [ ] **Step 3: routeを実装する**

`app/api/sessions/[sessionId]/items/[itemId]/decision/route.ts`:

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
  { params }: { params: Promise<{ sessionId: string; itemId: string }> }
): Promise<Response> {
  const { sessionId, itemId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || !VALID_DECISIONS.includes(body.decision) || !body.itemName || !body.imageUrl) {
    return NextResponse.json(
      { error: "decision, itemName, imageUrl are required" },
      { status: 400 }
    );
  }

  await updateItemDecision(sessionId, itemId, body.decision);

  if (body.decision !== "let_go") {
    return NextResponse.json({ decision: body.decision }, { status: 200 });
  }

  const reflectionState = await getReflectionState(sessionId, itemId);
  const text = await generateMemoryRecordText(body.itemName, reflectionState);

  const albumEntry = await createAlbumEntry(sessionId, {
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

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npm run test:emulator`
Expected: PASS（2 tests）

- [ ] **Step 5: Commit**

```bash
git add "app/api/sessions/[sessionId]/items/[itemId]/decision/route.ts" \
  "app/api/sessions/[sessionId]/items/[itemId]/decision/route.test.ts"
git commit -m "feat: 最終判断の保存とアルバムエントリ作成APIを追加する"
```

---

## Task 17: `GET /api/sessions/[sessionId]/album`

**Files:**
- Create: `app/api/sessions/[sessionId]/album/route.ts`
- Test: `app/api/sessions/[sessionId]/album/route.test.ts`

**Interfaces:**
- Consumes: `listAlbumEntries`（`lib/repositories/album-repository.ts`）
- Produces: `GET`ハンドラ → Response `{ entries: MemoryRecord[] }`（200）

- [ ] **Step 1: 失敗するテストを書く**

`app/api/sessions/[sessionId]/album/route.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSession } from "@/lib/repositories/session-repository";
import { createAlbumEntry } from "@/lib/repositories/album-repository";
import { GET } from "./route";

describe("GET album", () => {
  it("returns album entries for the session", async () => {
    const session = await createSession({ purposeType: "declutter" });
    await createAlbumEntry(session.id, {
      itemId: "item_001",
      itemName: "サークルTシャツ",
      imageUrl: "https://example.com/x.jpg",
      memory: "大会の記憶",
      tags: [],
    });

    const res = await GET(new Request("http://localhost/api/album"), {
      params: Promise.resolve({ sessionId: session.id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].itemName).toBe("サークルTシャツ");
  });

  it("returns an empty array when there are no entries", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const res = await GET(new Request("http://localhost/api/album"), {
      params: Promise.resolve({ sessionId: session.id }),
    });
    const body = await res.json();
    expect(body.entries).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `npm run test:emulator`
Expected: FAIL（`./route` module not found）

- [ ] **Step 3: routeを実装する**

`app/api/sessions/[sessionId]/album/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listAlbumEntries } from "@/lib/repositories/album-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<Response> {
  const { sessionId } = await params;
  const entries = await listAlbumEntries(sessionId);
  return NextResponse.json({ entries }, { status: 200 });
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `npm run test:emulator`
Expected: PASS（2 tests）

- [ ] **Step 5: Commit**

```bash
git add "app/api/sessions/[sessionId]/album/route.ts" "app/api/sessions/[sessionId]/album/route.test.ts"
git commit -m "feat: 手放したものアルバム一覧取得APIを追加する"
```

---

## フロントエンド移植の方針

既存 `index.html`（リポジトリルート）は「自分の部屋から探す」機能（`screen-home`／`screen-input`／`screen-loading`／`screen-result`／`screen-draft`、非スコープ）と、本プロジェクトが対象とする「持ち物を整理する」機能（`screen-declutter-*`／`screen-mypage`／`screen-album`）の2つのプロトタイプが1ファイルに同居している。以降のタスクは**`screen-declutter-*`系と`screen-home`（入口として流用）・`screen-mypage`・`screen-album`のみ**を移植対象とし、`screen-input`/`screen-loading`/`screen-result`/`screen-draft`は移植しない。

CSS（`index.html:8-426`のインラインstyleブロック全体）はそのまま `app/globals.css` にコピーする。ロジック（`index.html:907`以降の`<script>`、特に`DECLUTTER_ITEMS`のハードコードや`state.declutter`によるモック状態管理）はReactのstate＋本プランで作成したAPI Routesへの呼び出しに置き換える。各画面のHTML構造・クラス名は対応するセクション（下記タスクに記載の行範囲）からそのまま持ってきてJSX化する。

以降のUIタスクは自動テストではなく、`npm run dev`での手動確認を検証手段とする（ビジュアル・遷移確認は自動テストに向かないため）。

---

## Task 18: APIクライアント・型・フォンフレームのアプリシェル

**Files:**
- Create: `lib/api-client.ts`
- Create: `app/globals.css`（`index.html:8-426`のCSSをそのままコピー）
- Modify: `app/layout.tsx`
- Create: `components/PhoneFrame.tsx`
- Create: `hooks/useSessionId.ts`

**Interfaces:**
- Consumes: `Session`、`Item`、`ReflectionState`、`MemoryRecord`、`PurposeType`、`ItemClassification`、`FinalDecision`（`lib/types.ts`）
- Produces: `apiClient.createSession(...)`、`apiClient.extractItems(...)`、`apiClient.updateClassification(...)`、`apiClient.startReflection(...)`、`apiClient.sendReflectionMessage(...)`、`apiClient.submitDecision(...)`、`apiClient.getAlbum(...)`（`lib/api-client.ts`。全フロントエンド画面が使う）。`useSessionId(): [string | null, (id: string) => void]`（`hooks/useSessionId.ts`、localStorageに永続化）。`<PhoneFrame>`（`components/PhoneFrame.tsx`、`matchMedia("(max-width: 480px)")`で実機スマホではフレームを外して全画面表示にする）

- [ ] **Step 1: APIクライアントを実装する**

`lib/api-client.ts`:

```ts
import type {
  FinalDecision,
  Item,
  ItemClassification,
  MemoryRecord,
  PurposeType,
  ReflectionState,
} from "./types";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return res.json();
}

export const apiClient = {
  createSession(input: { purposeType: PurposeType; targetAmount?: number; note?: string }) {
    return postJson<{ id: string; purposeType: PurposeType; targetAmount?: number }>(
      "/api/sessions",
      input
    );
  },

  extractItems(input: { sessionId: string; imageBase64: string; mimeType: string }) {
    return postJson<{ items: Item[] }>("/api/items/extract", input);
  },

  async updateClassification(
    sessionId: string,
    itemId: string,
    classification: ItemClassification
  ): Promise<void> {
    const res = await fetch(`/api/sessions/${sessionId}/items/${itemId}/classification`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classification }),
    });
    if (!res.ok) throw new Error(`classification update failed: ${res.status}`);
  },

  startReflection(sessionId: string, itemId: string, itemName: string) {
    return postJson<ReflectionState>(
      `/api/sessions/${sessionId}/items/${itemId}/reflection`,
      { itemName }
    );
  },

  sendReflectionMessage(sessionId: string, itemId: string, message: string) {
    return postJson<
      | { action: "ask"; reflection: string; question: string }
      | { action: "complete"; reflection: string; summary: Partial<ReflectionState> }
    >(`/api/sessions/${sessionId}/items/${itemId}/reflection/messages`, { message });
  },

  submitDecision(
    sessionId: string,
    itemId: string,
    input: { decision: FinalDecision; itemName: string; imageUrl: string }
  ) {
    return postJson<{ decision: FinalDecision; albumEntry?: MemoryRecord }>(
      `/api/sessions/${sessionId}/items/${itemId}/decision`,
      input
    );
  },

  async getAlbum(sessionId: string): Promise<{ entries: MemoryRecord[] }> {
    const res = await fetch(`/api/sessions/${sessionId}/album`);
    if (!res.ok) throw new Error(`get album failed: ${res.status}`);
    return res.json();
  },
};
```

- [ ] **Step 2: `index.html:8-426`のCSSを`app/globals.css`にコピーする**

`index.html`を開き、8行目から426行目までの内容（`:root{...}`から始まるCSS全体）をそのまま `app/globals.css` に貼り付ける。`<style>`/`</style>`タグは含めない。

- [ ] **Step 3: `useSessionId`フックを実装する**

`hooks/useSessionId.ts`:

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "letting-go-session-id";

export function useSessionId(): [string | null, (id: string) => void] {
  const [sessionId, setSessionIdState] = useState<string | null>(null);

  useEffect(() => {
    setSessionIdState(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const setSessionId = useCallback((id: string) => {
    window.localStorage.setItem(STORAGE_KEY, id);
    setSessionIdState(id);
  }, []);

  return [sessionId, setSessionId];
}
```

- [ ] **Step 4: `PhoneFrame`コンポーネントを実装する**

`components/PhoneFrame.tsx`（`index.html`の`.stage-bg`/`.phone-frame`/`.phone-inner`のクラス構造を利用。CSSは`app/globals.css`に既にある）:

```tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";

export function PhoneFrame({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 480px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  if (isMobile) {
    return <div className="phone-inner phone-inner--fullscreen">{children}</div>;
  }

  return (
    <div className="stage-bg">
      <div className="phone-frame">
        <div className="phone-inner">{children}</div>
      </div>
    </div>
  );
}
```

`app/globals.css`の末尾に、実機スマホ用の全画面クラスを追加する:

```css
.phone-inner--fullscreen {
  width: 100vw;
  height: 100vh;
  border-radius: 0;
}
```

- [ ] **Step 5: `app/layout.tsx`を更新する**

`app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "思い出ベースの手放し判断支援",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: `npm run dev`を起動し、白紙のフォンフレームがデスクトップ表示で中央に出ることを目視確認する**

Run: `npm run dev`
Expected: `http://localhost:3000` を開くと黒縁のフォンフレームが表示される（中身は空でよい、Task 19以降で埋める）

- [ ] **Step 7: Commit**

```bash
git add lib/api-client.ts app/globals.css app/layout.tsx components/PhoneFrame.tsx hooks/useSessionId.ts
git commit -m "feat: APIクライアント・フォンフレームレイアウト・globals.cssを追加する"
```

---

## Task 19: ホーム・目的入力・抽出ローディング画面

元プロトタイプは全画面を1つのDOMに持ち`showScreen()`で表示切り替えする作りだった（`index.html:991-999`）。移植先でも単一のクライアントコンポーネント`DeclutterApp`が`screen`という状態で画面を切り替える構成にする（App Routerのページ遷移は使わない。1セッションの操作がリロードなしで完結する既存プロトタイプの体験を保つため）。

**Files:**
- Create: `components/DeclutterApp.tsx`（画面状態を持つ最上位コンポーネント。以降のタスクで肉付けする）
- Create: `components/screens/HomeScreen.tsx`（`index.html:436-473`参照）
- Create: `components/screens/IntroScreen.tsx`（`index.html:666-708`参照）
- Create: `components/screens/LoadingScreen.tsx`（`index.html:710-718`参照）
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `apiClient`（`lib/api-client.ts`）、`useSessionId`（`hooks/useSessionId.ts`）、`PhoneFrame`（`components/PhoneFrame.tsx`）、`PurposeType`、`Item`（`lib/types.ts`）
- Produces: `<DeclutterApp>`（`components/DeclutterApp.tsx`。Task 20以降がこのファイルに`deck`/`dialogue`/`final`/`plan`/`album`分岐を追加していく）

- [ ] **Step 1: `HomeScreen`を実装する**

`components/screens/HomeScreen.tsx`（`index.html:436-473`のマークアップをJSX化。カテゴリチップ・おすすめ商品はデモ用の静的表示のまま、`promo-banner`のクリックだけ`onStart`につなぐ）:

```tsx
export function HomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className="screen active">
      <div className="home-header">
        <div className="mercari-wordmark">mercari</div>
        <div className="search-bar">🔍 なにをお探しですか？</div>
        <div className="bell-wrap">
          🔔<span className="bell-dot" />
        </div>
      </div>
      <div className="home-scroll">
        <button type="button" className="promo-banner" onClick={onStart}>
          <span className="pb-icon">🧹</span>
          <span className="pb-text">そろそろ持ち物を整理しませんか？思い出を残しながら手放せます</span>
          <span className="pb-chevron">›</span>
        </button>
      </div>
      <div className="tab-bar">
        <button type="button" className="tab-item active">
          <span className="tab-icon">🏠</span>ホーム
        </button>
        <button type="button" className="tab-item">
          <span className="tab-icon">🔍</span>検索
        </button>
        <button type="button" className="tab-item tab-sell">
          <span className="tab-icon">📷</span>出品
        </button>
        <button type="button" className="tab-item">
          <span className="tab-icon">🔔</span>お知らせ
        </button>
        <button type="button" className="tab-item">
          <span className="tab-icon">👤</span>マイページ
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `IntroScreen`を実装する**

`components/screens/IntroScreen.tsx`（`index.html:666-708`のマークアップをJSX化。写真ピッカーはデモ写真の選択ではなく実ファイルアップロードに置き換える）:

```tsx
"use client";

import { useState } from "react";
import type { PurposeType } from "@/lib/types";

const PURPOSE_OPTIONS: Array<{ value: PurposeType; label: string }> = [
  { value: "declutter", label: "部屋を片付けたい" },
  { value: "preserve_memories", label: "趣味整理" },
  { value: "consider_letting_go", label: "卒業・引越し" },
  { value: "other", label: "その他" },
];

export function IntroScreen({
  onSubmit,
}: {
  onSubmit: (input: { purposeType: PurposeType; targetAmount: number; file: File }) => void;
}) {
  const [purposeType, setPurposeType] = useState<PurposeType>("consider_letting_go");
  const [targetAmount, setTargetAmount] = useState(10000);
  const [file, setFile] = useState<File | null>(null);

  return (
    <section className="screen active">
      <div className="app-bar">
        <div className="app-bar-title">持ち物を整理する</div>
      </div>
      <div className="screen-scroll">
        <div className="card">
          <h1 className="hero">整理する目的を教えてください</h1>
          <p className="hero-sub">
            迷う物だけ、あとでAIと一緒に短く整理します。売るか残すかは、いつでもあなたが決められます。
          </p>

          <div className="field">
            <label className="field-label">目標金額（任意）</label>
            <input
              type="number"
              className="yen-input"
              value={targetAmount}
              step={500}
              min={0}
              onChange={(e) => setTargetAmount(Number(e.target.value))}
            />
          </div>

          <div className="field">
            <label className="field-label">今回の目的</label>
            <div className="chip-row">
              {PURPOSE_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className={`chip${purposeType === option.value ? " selected" : ""}`}
                  onClick={() => setPurposeType(option.value)}
                >
                  {option.label}
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label">整理する場所の写真</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <button
            type="button"
            className="cta"
            disabled={!file}
            onClick={() => file && onSubmit({ purposeType, targetAmount, file })}
          >
            商品候補を抽出する
          </button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `LoadingScreen`を実装する**

`components/screens/LoadingScreen.tsx`（`index.html:710-718`参照）:

```tsx
export function LoadingScreen({ message }: { message: string }) {
  return (
    <section className="screen active">
      <div className="screen-scroll">
        <div className="card">
          <div className="spinner" />
          <div>{message}</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: 画像ファイルをリサイズしてbase64化するヘルパーを`lib/api-client.ts`に追加する**

Vision APIのペイロード・コスト対策として、送信前にクライアント側で長辺1024pxまでリサイズしJPEGに変換する（spec 10節）。

`lib/api-client.ts`に追記:

```ts
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.8;

export function resizeImageToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to load image"));
    };

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas 2d context not available"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      resolve({ base64: dataUrl.split(",")[1] ?? "", mimeType: "image/jpeg" });
    };

    img.src = objectUrl;
  });
}
```

- [ ] **Step 5: `DeclutterApp`（画面状態機械の骨格）を実装する**

`components/DeclutterApp.tsx`:

```tsx
"use client";

import { useState } from "react";
import { apiClient, resizeImageToBase64 } from "@/lib/api-client";
import { useSessionId } from "@/hooks/useSessionId";
import type { Item, PurposeType } from "@/lib/types";
import { HomeScreen } from "./screens/HomeScreen";
import { IntroScreen } from "./screens/IntroScreen";
import { LoadingScreen } from "./screens/LoadingScreen";

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

  // Task 20以降でdeck/final/dialogue/plan/albumを追加する
  return (
    <section className="screen active">
      <div className="screen-scroll">
        {sessionId} / {items.length} items（次のタスクで実装）
      </div>
    </section>
  );
}
```

- [ ] **Step 6: `app/page.tsx`を更新する**

`app/page.tsx`:

```tsx
import { PhoneFrame } from "@/components/PhoneFrame";
import { DeclutterApp } from "@/components/DeclutterApp";

export default function Home() {
  return (
    <PhoneFrame>
      <DeclutterApp />
    </PhoneFrame>
  );
}
```

- [ ] **Step 7: `npm run dev`で目視確認する**

Run: `npm run dev`（別ターミナルで`npx firebase emulators:start --only firestore,storage`も起動しておく）
Expected: ホーム画面のバナーをクリック→目的入力画面→写真を選択して「商品候補を抽出する」を押すと、ローディング画面を経て `sessionId` とitem件数が表示される（`ANTHROPIC_API_KEY`を`.env.local`に設定していない場合はTask 11のフォールバックで4件が抽出される）

- [ ] **Step 8: Commit**

```bash
git add components/DeclutterApp.tsx components/screens/HomeScreen.tsx components/screens/IntroScreen.tsx \
  components/screens/LoadingScreen.tsx app/page.tsx lib/api-client.ts
git commit -m "feat: ホーム・目的入力・抽出ローディング画面を実装する"
```

---

## Task 20: 高速仕分け（デッキ）画面

**Files:**
- Create: `components/screens/DeckScreen.tsx`（`index.html:721-735`のマークアップ、`index.html:1550-1600`付近の進行ロジックを参照）
- Modify: `components/DeclutterApp.tsx`

**Interfaces:**
- Consumes: `apiClient.updateClassification`（`lib/api-client.ts`）、`Item`、`ItemClassification`（`lib/types.ts`）
- Produces: `<DeckScreen>`。`onComplete(classifiedItems: Item[])`（分類結果を反映した`Item[]`をTask 21の`final`/`dialogue`分岐へ渡す）

- [ ] **Step 1: `DeckScreen`を実装する**

`components/screens/DeckScreen.tsx`:

```tsx
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
```

- [ ] **Step 2: `DeclutterApp`にdeck画面を配線する**

`components/DeclutterApp.tsx`の末尾のプレースホルダーを置き換える:

```tsx
import { DeckScreen } from "./screens/DeckScreen";

// Screen型に "deck" を含める（Task 19で定義済み）

  // handleIntroSubmit の中の setScreen("deck") はそのまま

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

  // "final"分岐はTask 21で追加する
```

`Screen`型に`"deck"`を追加し、Step 4の仮のフォールバック表示は `"final"` 以降が実装されるTask 21まで残す。

- [ ] **Step 3: `npm run dev`で目視確認する**

Run: `npm run dev`
Expected: 抽出後に1件ずつカードが表示され、3ボタンいずれかを押すと次のカードに進み、最後の1件を分類すると`final`分岐（未実装のプレースホルダー表示）に遷移する

- [ ] **Step 4: Commit**

```bash
git add components/screens/DeckScreen.tsx components/DeclutterApp.tsx
git commit -m "feat: 高速仕分け（デッキ）画面を実装する"
```

---

## Task 21: 最終整理画面とReflection対話（迷い対話）画面

「迷う」に分類された物だけ`DialogueScreen`へ進み、Reflection Agentとの対話（最大3ターン）を経て売る/残す/保留を選ぶ。「残したい」「手放せそう」の物は`FinalScreen`でデフォルト値を確認して決定する。両方とも決定時に`POST .../decision`を呼ぶ（`let_go`の場合はレスポンスにアルバムエントリが含まれる）。

**Files:**
- Create: `components/screens/FinalScreen.tsx`（`index.html:759-770`参照）
- Create: `components/screens/DialogueScreen.tsx`（`index.html:738-757`参照）
- Modify: `components/DeclutterApp.tsx`

**Interfaces:**
- Consumes: `apiClient.startReflection`、`apiClient.sendReflectionMessage`、`apiClient.submitDecision`（`lib/api-client.ts`）、`Item`、`FinalDecision`、`ReflectionState`（`lib/types.ts`）
- Produces: `<FinalScreen>`（`onAllDecided(decidedItems: Item[])`でTask 22の`plan`分岐へ渡す）、`<DialogueScreen>`（1商品ぶんの対話を担当し、`onDecided(decision: FinalDecision)`で呼び出し元に決定を返す）

- [ ] **Step 1: `DialogueScreen`を実装する**

`components/screens/DialogueScreen.tsx`:

```tsx
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
```

- [ ] **Step 2: `FinalScreen`を実装する**

`components/screens/FinalScreen.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { FinalDecision, Item } from "@/lib/types";
import { DialogueScreen } from "./DialogueScreen";

export function FinalScreen({
  sessionId,
  items,
  onAllDecided,
}: {
  sessionId: string;
  items: Item[];
  onAllDecided: (decidedItems: Item[]) => void;
}) {
  const [decided, setDecided] = useState<Record<string, FinalDecision>>({});
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
```

- [ ] **Step 3: `DeclutterApp`に`final`分岐を配線する**

`components/DeclutterApp.tsx`のプレースホルダーを置き換える:

```tsx
import { FinalScreen } from "./screens/FinalScreen";

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
```

- [ ] **Step 4: `npm run dev`で目視確認する**

Run: `npm run dev`
Expected: 「迷う」に分類した物は対話画面に入り、1〜3問のやり取り後に要約と決定ボタンが出る。「残したい」「手放せそう」は最終確認画面で直接、売る/残すを選べる。すべて決定すると`plan`分岐（未実装のプレースホルダー）に進む

- [ ] **Step 5: Commit**

```bash
git add components/screens/FinalScreen.tsx components/screens/DialogueScreen.tsx components/DeclutterApp.tsx
git commit -m "feat: 最終確認画面とReflection対話画面を実装する"
```

---

## Task 22: 売却プラン画面と手放したものアルバム画面

**Files:**
- Create: `components/screens/PlanScreen.tsx`（`index.html:773-792`参照。P1の候補セット提案は含めず、合計額と目標額との差分のみを表示するP0範囲に絞る）
- Create: `components/screens/AlbumScreen.tsx`（`index.html:880-889`参照）
- Modify: `components/DeclutterApp.tsx`

**Interfaces:**
- Consumes: `apiClient.getAlbum`（`lib/api-client.ts`）、`Item`、`MemoryRecord`（`lib/types.ts`）
- Produces: `<PlanScreen>`（`onViewAlbum()`でTask 22の`album`分岐へ）、`<AlbumScreen>`

> マイページ画面（`index.html:850-877`）はナビゲーションのハブに過ぎずP0の体験に必須ではないため移植を省略し、売却プラン画面から直接アルバムへ遷移するボタンを設ける。

- [ ] **Step 1: `PlanScreen`を実装する**

`components/screens/PlanScreen.tsx`:

```tsx
import type { Item } from "@/lib/types";

export function PlanScreen({
  items,
  targetAmount,
  onViewAlbum,
}: {
  items: Item[];
  targetAmount: number;
  onViewAlbum: () => void;
}) {
  const soldItems = items.filter((item) => item.finalDecision === "let_go");
  const total = soldItems.reduce((sum, item) => sum + (item.estimatedPrice ?? 0), 0);
  const remaining = Math.max(targetAmount - total, 0);

  return (
    <section className="screen active">
      <div className="app-bar">
        <div className="app-bar-title">売却プラン</div>
      </div>
      <div className="screen-scroll">
        <div className="summary-bar">
          <div className="summary-tile">
            <div className="stile-label">売ると決めた合計</div>
            <div className="stile-value">¥{total.toLocaleString("ja-JP")}</div>
          </div>
          <div className="summary-tile">
            <div className="stile-label">目標まであと</div>
            <div className="stile-value">¥{remaining.toLocaleString("ja-JP")}</div>
          </div>
        </div>
        <div className="candidate-list">
          {soldItems.map((item) => (
            <div key={item.id} className="final-row">
              <span className="mi-name">{item.title}</span>
              <span className="mi-price">¥{(item.estimatedPrice ?? 0).toLocaleString("ja-JP")}</span>
            </div>
          ))}
        </div>
        <button type="button" className="cta" style={{ marginTop: 20 }} onClick={onViewAlbum}>
          手放したもののアルバムを見る
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `AlbumScreen`を実装する**

`components/screens/AlbumScreen.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { MemoryRecord } from "@/lib/types";

export function AlbumScreen({ sessionId }: { sessionId: string }) {
  const [entries, setEntries] = useState<MemoryRecord[]>([]);

  useEffect(() => {
    apiClient.getAlbum(sessionId).then((res) => setEntries(res.entries));
  }, [sessionId]);

  return (
    <section className="screen active">
      <div className="app-bar">
        <div className="app-bar-title">手放したもののアルバム</div>
      </div>
      <div className="screen-scroll">
        <p className="hero-sub">物は手放しても、思い出はここに残ります。</p>
        <div className="album-list">
          {entries.map((entry) => (
            <div key={entry.id} className="card">
              <div className="mi-name">{entry.itemName}</div>
              {entry.episode ? <p>{entry.episode}</p> : null}
              <p>{entry.memory}</p>
              {entry.tags.length > 0 ? (
                <div className="tag-chip-row">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: `DeclutterApp`に`plan`/`album`分岐を配線する**

`components/DeclutterApp.tsx`のプレースホルダーを置き換える:

```tsx
import { PlanScreen } from "./screens/PlanScreen";
import { AlbumScreen } from "./screens/AlbumScreen";

  if (screen === "plan") {
    return (
      <PlanScreen items={items} targetAmount={targetAmount} onViewAlbum={() => setScreen("album")} />
    );
  }

  if (screen === "album" && sessionId) {
    return <AlbumScreen sessionId={sessionId} />;
  }

  return null;
```

`Screen`型に`"plan"`・`"album"`を追加する（Task 19で定義済みの型に追記）。

- [ ] **Step 4: `npm run dev`で一連のフローを目視確認する**

Run: `npm run dev`
Expected: ホーム→目的入力→写真アップロード→仕分け→（迷う物は対話）→最終確認→売却プラン→アルバム、までリロードなしで一気通貫に遷移できる。「手放す」を選んだ物がアルバムにエピソード付きで表示される

- [ ] **Step 5: Commit**

```bash
git add components/screens/PlanScreen.tsx components/screens/AlbumScreen.tsx components/DeclutterApp.tsx
git commit -m "feat: 売却プラン画面と手放したものアルバム画面を実装する"
```

---

## 実行順序

Task 1〜17（スキャフォールディング〜バックエンドAPI）は上から順に依存関係があるため、この順で実装する。Task 18〜22（フロントエンド）はTask 17までの完了後、これも上から順に実装する（各画面が前の画面のコンポーネントに依存するため）。P1（推定価格・目標額に対する候補セット提案の高度化、`create_listing_draft`、タグ検索、時系列表示）とP2はこのプランのスコープ外とし、必要になった時点で別プランを作成する。
