# コレクションピボット 要件定義書（非UI実装向け）

対象読者：バックエンド・ロジック実装担当。**UI/画面コンポーネントは別担当が実装するため、この文書には画面設計・レイアウト・スタイルは含めない。** API契約（リクエスト/レスポンス形状）はUI担当との接点になるため含める。

前提ドキュメント：
- [2026-09-01-letting-go-memory-support-design.md](2026-09-01-letting-go-memory-support-design.md)（旧要件定義書。アーキテクチャ・Firebaseエミュレータ運用方針など変更のない部分はこちらが正）
- 本書は旧要件定義書に対する**上書き改訂**。特に「6. 画像からの商品抽出」「8. Reflection Agent設計」「9. API設計」を置き換える

## 0. 変更点サマリ

1. **テーマを「持ち物の整理」から「コレクション」に変更**。`Session`（目的設定ごとの一回限りセッション）を廃止し、`Collection`を永続的な主エンティティにする
2. **AIプロバイダーをAnthropic Claude → Google Gemini（`@google/genai`）に変更**（チーム判断により実装済み。本書はGemini前提で書く）
3. 画像抽出に「単品撮影」「コレクション全体撮影→一括抽出」の2モードを追加
4. Item単位のReflection Agent（AI対話）は継続。Collection単位のチャット対話は行わず、代わりに**ワンショットの手放し提案機能**を追加
5. ログインなしの表示名によるコレクション所有者識別、他人のコレクション閲覧・いいね機能を追加（P1）

## 1. データモデル

```ts
type Collection = {
  id: string;
  ownerName: string;        // ログインなし。表示名のみ（UI側でlocalStorageに保持し、作成時に送る）
  title: string;            // 例：「推しグッズコレクション」
  coverImageUrl?: string;
  createdAt: string;
  likeCount: number;        // P1
};

type ItemClassification = "keep" | "unsure" | "releaseable";
type FinalDecision = "keep" | "let_go" | "hold";

type Item = {
  id: string;
  collectionId: string;     // 旧 sessionId から置き換え
  imageUrl: string;
  title: string;
  category: string;
  estimatedPrice?: number;
  initialClassification?: ItemClassification;
  finalDecision?: FinalDecision;
};

type AttachmentType =
  | "object" | "memory" | "person" | "identity" | "utility" | "rarity" | "unknown";

type ReflectionState = {
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
  status: "in_progress" | "ready_for_decision";
};

type ReflectionTurn = {
  reflectionId: string;
  turnIndex: number;
  userMessage: string;
  assistantAction: "ask" | "complete";
  assistantReflectionText: string;
  question?: string;
  createdAt: string;
};

type MemoryRecord = {
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

// --- 新規：コレクション単位のワンショット手放し提案 ---

type ReleaseCandidate = {
  itemId: string;
  itemName: string;
  reason: string;           // 「打ってもよさそうな理由」
};

// --- 新規：いいね（P1） ---

type Like = {
  likerId: string;          // UI側がlocalStorageで発行する匿名ID。ドキュメントIDとして使い二重いいねを防ぐ
  collectionId: string;
  createdAt: string;
};
```

`Session`型・`SalePurpose`型・`PurposeType`型は廃止する。「お金を稼ぐ／目標金額」という目的設定の概念はコレクションには持たない。

## 2. Firestoreパス

```
collections/{collectionId}
collections/{collectionId}/items/{itemId}
collections/{collectionId}/items/{itemId}/reflection/state
collections/{collectionId}/items/{itemId}/reflection/state/turns/{turnIndex}
collections/{collectionId}/album/{memoryRecordId}
collections/{collectionId}/likes/{likerId}
```

旧`sessions/...`配下の構造をそのまま`collections/...`に読み替える。リポジトリ層（`lib/repositories/session-repository.ts`等）・パスヘルパー（`lib/firestore-paths.ts`）・全APIルートの`sessionId`パラメータ名を`collectionId`にリネームする。

## 3. Gemini呼び出しの規約（既存実装を踏襲）

チームメイトによる移行で以下のパターンが既に確立している。新規実装（後述のワンショット提案）もこのパターンに合わせる。

- クライアント初期化：`lib/gemini.ts`の`getGeminiClient()`（`GEMINI_API_KEY`必須）、`GEMINI_MODEL`定数
- 構造化出力は`FunctionDeclaration`（`parametersJsonSchema`でJSON Schemaを書く）を`generateContent`の`config.tools: [{ functionDeclarations: [...] }]`に渡す
- 呼び出す関数を強制するときは`config.toolConfig.functionCallingConfig`に`mode: FunctionCallingConfigMode.ANY`と`allowedFunctionNames: [...]`を指定する
- レスポンスは`response.functionCalls?.[0]`から`.name`と`.args`を読む
- テストでは`vi.mock("@/lib/gemini", () => ({ GEMINI_MODEL: "...", getGeminiClient: () => ({ models: { generateContent: mockFn } }) }))`でモックする

既存コード例（`app/api/sessions/[sessionId]/items/[itemId]/reflection/messages/route.ts`、`lib/memory-record-generator.ts`）をそのまま参照実装として使う。

## 4. 画像からの商品抽出（変更点のみ）

エンドポイント自体（`POST /api/items/extract`）は維持し、`sessionId`を`collectionId`にリネームする。

**単品撮影 / コレクション全体撮影の2モード**は、抽出APIに`mode: "single" | "collection"`（省略時`"collection"`）を追加して区別する。

- `mode: "collection"`（既定）：今まで通り、写真に写っている複数の私物を抽出する
- `mode: "single"`：1枚の写真に写っているのは1点だけという前提で、抽出プロンプトに「写っているのは1点だけです」という一文を追加し、Geminiが複数点を誤検出した場合はconfidenceが最も高い1件だけを採用する（バックエンド側でフィルタする。UIに複数件返して選ばせることはしない）

```ts
// app/api/items/extract/route.ts の抜粋（変更差分のみ）
const body = await request.json(); // { collectionId, imageBase64, mimeType, mode? }
const mode: "single" | "collection" = body.mode === "single" ? "single" : "collection";

const promptText =
  mode === "single"
    ? "この写真には品物が1点だけ写っています。それを抽出してください。"
    : "この写真から、出品候補になりうる私物を漏れなく抽出してください。";

// extractCandidates呼び出し後：
if (mode === "single" && candidates.length > 1) {
  candidates = [candidates.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]];
}
```

価格モック・フォールバック（`lib/extraction-fallback.ts`）・Firebase Storageアップロードのロジックは変更しない。

## 5. Item単位のReflection Agent（変更なし、Collection配下に移動のみ）

対話の原則・System Prompt・tool定義（`ask_question`/`complete_reflection`）・ターン数上限（3ターン）・statePatchマージロジックは**変更しない**。既存実装（Gemini化済み）をそのまま`collections/{collectionId}/items/{itemId}/reflection`配下で使う。理論的根拠（Continuing Bonds理論 + Motivational Interviewing）も個別品への対話としてはそのまま有効なので変更しない。

## 6. コレクション単位のワンショット手放し提案（新規）

Collection単位のチャット対話は行わない。代わりに、状態を持たない一発診断のエンドポイントを追加する。

### 6.1 理論的根拠

個別の思い出の品と異なり、コレクションは「自分が何者か」を語る自己同一性（コレクター・アイデンティティ）と結びつきやすい。そのため以下の理論を反映する。

- **拡張自己理論（Belk, 1988）／コレクション研究**：所有物、特にコレクションは自己同一性の一部を構成する。コレクション内でも「核となる（アイデンティティに直結する）品」と「周辺的な（なくても集めている自分らしさは損なわれない）品」があるという前提でAIに考えさせる
- **Divestment Ritual（McCracken, 1986）**：手放す前に意味を言語化して切り離す行為が、心理的な整理を助けるという消費者行動研究の知見。提案の`reason`は単なる「売れそう」ではなく、「このコレクションにおけるこの品の位置づけ」を言語化する
- **Three Paths to Disposition（Price, Arnould & Curasi, 2000）**：見知らぬ他人に思い出の品を譲る際の実証研究。「次の持ち主に引き継がれる」という前向きな含意を`reason`の文言に反映する

### 6.2 対象アイテムの選定（アプリ側ロジック）

Geminiに渡す前に、backend側で以下のフィルタをかける（AIの提案が明示的な「残したい」を覆さないようにするため）。

```ts
function candidateEligibleItems(items: Item[]): Item[] {
  return items.filter(
    (item) => item.finalDecision === undefined && item.initialClassification !== "keep"
  );
}
```

対象が0件の場合はAPIを呼ばず、空の`candidates: []`を返す。

### 6.3 Tool定義

```ts
// lib/release-suggestion-tool.ts
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

### 6.4 System Prompt

```ts
// lib/release-suggestion-prompt.ts
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

### 6.5 API

```
POST /api/collections/{collectionId}/suggest-release
```

- Request body: なし（Firestoreからitem一覧を取得して判定する）
- Response（200）: `{ candidates: ReleaseCandidate[] }`
- 実装：`candidateEligibleItems`で対象を絞り込み → 0件なら`{ candidates: [] }`を即返す → 1件以上ならGeminiを1回呼び出し、`suggest_release_candidates`をtool_choice相当（`FunctionCallingConfigMode.ANY`、`allowedFunctionNames: ["suggest_release_candidates"]`）で強制する → `itemId`が実在するものだけにフィルタして返す（Geminiが存在しないIDを返す可能性への防御）
- 確定（出品）は既存の`decision`API（`decision: "let_go"`）をUI側が選択された`itemId`ごとに呼ぶだけでよい。新しいAPIは追加しない（アルバムへのエピソード自動生成も既存ロジックがそのまま使える）

## 7. API一覧

| API | 用途 | 備考 |
| --- | --- | --- |
| `POST /api/collections` | コレクション作成 | body: `{ ownerName: string; title: string }` → `Collection`（201） |
| `GET /api/collections` | 公開コレクション一覧 | P1。新しい順。`{ collections: Collection[] }` |
| `GET /api/collections/{id}` | コレクション詳細（items含む） | `{ collection: Collection; items: Item[] }` |
| `POST /api/items/extract` | 画像から商品候補を抽出 | body に`collectionId`・`mode?`を追加（4節参照） |
| `PATCH /api/collections/{id}/items/{itemId}/classification` | 一次分類の保存 | 変更なし（パスのみ） |
| `POST /api/collections/{id}/items/{itemId}/reflection` | item単位対話開始 | 変更なし（パスのみ） |
| `POST /api/collections/{id}/items/{itemId}/reflection/messages` | item単位対話ターン | 変更なし（パスのみ、Gemini化済み） |
| `POST /api/collections/{id}/items/{itemId}/decision` | 最終判断・アルバム登録 | 変更なし（パスのみ、Gemini化済み） |
| `GET /api/collections/{id}/album` | アルバム一覧 | 変更なし（パスのみ） |
| `POST /api/collections/{id}/suggest-release` | ワンショット手放し提案 | 新規（6節） |
| `POST /api/collections/{id}/like` | いいね | P1。body: `{ likerId: string }`。`likes/{likerId}`が既存なら何もせず現在の`likeCount`を返す（冪等）。新規なら`likeCount`を`FieldValue.increment(1)`で更新 |

## 8. 表示名・いいねの扱い（バックエンド視点、P1）

- 表示名はUIが最初にどこかで一度入力させlocalStorageに保持する想定（UI側の責務）。バックエンドは`POST /api/collections`の`ownerName`をそのまま保存するだけでよい。バリデーションは「空文字でない」程度でよい
- いいねの二重防止は、UIが発行した匿名`likerId`（localStorage保存のUUID）をFirestoreのドキュメントIDとして使うことで、backend側は「存在すれば何もしない」というシンプルな冪等処理だけで済む。ユーザー認証・IP判定などは行わない

## 9. モックモードとの整合

既存の`lib/mock-api-client.ts`（`NEXT_PUBLIC_USE_MOCK`）はUI側のフォールバックであり本書のスコープ外だが、実APIと呼び出し形状が食い違うと差し替え時に事故るため、新規API（`suggest-release`等）のレスポンス形状はモッククライアントの型（`lib/types.ts`）とも整合させること。

## 10. 移行が必要な既存ファイル（リネーム対象）

`sessionId`→`collectionId`、`Session`→`Collection`のリネームが必要な既存実装：

- `lib/types.ts`（`Session`型を`Collection`型に置き換え、`PurposeType`/`SalePurpose`削除）
- `lib/firestore-paths.ts`（`sessionPath`等を`collectionPath`等に）
- `lib/repositories/session-repository.ts` → `collection-repository.ts`
- `lib/repositories/item-repository.ts`（`sessionId`パラメータ名のみ変更）
- `lib/repositories/reflection-repository.ts`（同上）
- `lib/repositories/album-repository.ts`（同上）
- `app/api/sessions/**` → `app/api/collections/**`（ディレクトリごと移動）
- `app/api/items/extract/route.ts`（body の`sessionId`→`collectionId`、`mode`追加）

非機能要件（Firebaseエミュレータ運用方針、APIキー管理、コスト対策）は旧要件定義書10節から変更なし。
