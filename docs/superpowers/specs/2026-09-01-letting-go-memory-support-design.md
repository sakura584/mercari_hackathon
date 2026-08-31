# 思い出ベースの手放し判断支援 — 要件定義書（技術設計）

対象読者：ハッカソンチームの実装担当者。
前提ドキュメント：[思い出ベース手放し判断支援_企画仕様.md](../../../思い出ベース手放し判断支援_企画仕様.md)（プロダクト企画・UX・非ゴールはこちらが正）。

本ドキュメントは企画をハッカソン（2日間）で動くデモに落とすための**技術要件定義**である。データはモック（相場・出品連携などは非ゴール）だが、画像からの商品抽出・「迷う」物へのAI対話ロジックは実際に動くものとして実装する。

---

## 1. スコープ

- Webアプリ（モバイルアプリは作らない）。詳細は「6. フロントエンド」参照
- 実装するロジック：①画像からの商品候補抽出、②「迷う」物へのReflection Agent（AI対話・要約）
- モックにするもの：推定売価（相場APIなし）、実際のメルカリ出品・決済・配送連携、真贋鑑定
- 永続化するもの：セッション、商品候補、一次分類、Reflection State（対話状態）、最終判断、手放したものアルバム

## 2. 全体アーキテクチャ

```
[ブラウザ]
  Next.js (App Router, TS) — UI + API Routes
      │  匿名 sessionId（localStorage発行）
      ▼
[Vercel] Next.js API Routes（サーバー側）
      │
      ├─▶ Anthropic Claude API（Messages API + tool use）
      │     - 画像抽出（Vision）
      │     - Reflection Agent（対話・要約）
      │     - アルバム用テキスト生成
      │
      └─▶ Firebase
            - Firestore：セッション/アイテム/ReflectionState/アルバム
            - Storage：アップロードされた部屋・棚の画像
```

- **フロントエンドとバックエンドは1つのNext.jsプロジェクト**にまとめ、Vercelにデプロイする。画面遷移・状態は既存の`index.html`プロトタイプ（フォンフレームUI）をNext.jsコンポーネントへ移植する
- **Anthropic Claude APIの呼び出しはすべてAPI Routes（サーバー側）経由**。APIキーはVercelの環境変数で管理し、クライアントに一切渡さない
- **認証なし・匿名セッション**：クライアントでUUIDを発行しlocalStorageに保持。Firestoreの`sessions/{sessionId}`をルートにデータをぶら下げる
- **DBはFirebase Firestore（無料枠）を使う**：チーム開発で画面ごとに担当を分けても同じセッション状態を参照できるようにするため、また本番デモ中のリロード・別タブに耐えるため。「データはモック」なのは相場・出品連携であり、ユーザーが実際に生成する分類・対話・判断・アルバムは実データとして永続化する
- **画像はFirebase Storageに保存**（Firestoreと同一プロジェクトで完結、無料枠内）

## 3. 技術選定サマリ

| 領域 | 採用技術 | 理由 |
| --- | --- | --- |
| フロントエンド | Next.js (App Router, TypeScript) | チームがNext.jsに習熟。既存プロトタイプを画面単位で移植しやすい |
| バックエンド | Next.js API Routes | フロントと同一プロジェクトで完結、Vercelに1つデプロイするだけで済む |
| ホスティング | Vercel（Next.js）+ Firebase（Firestore/Storage） | Next.jsの標準的なデプロイ先。DBとStorageはFirebase無料枠 |
| DB | Firebase Firestore | チームでの状態共有・リロード耐性。無料枠で十分 |
| 画像ストレージ | Firebase Storage | Firestoreと同一プロジェクト、無料枠 |
| 画像からの商品抽出 | Claude Vision（Messages API, マルチモーダル）+ tool use | 物体検出モデル（YOLO等）の学習・チューニングは2日ハッカソンに見合わない。任意の日用品カテゴリを学習なしで扱え、構造化出力もそのまま得られる |
| AI対話（迷う物のファシリテーション） | Claude Messages API + tool use + 自前State（Firestore） | 詳細は「8. Reflection Agent設計」 |
| 推定売価 | 完全にモック（アプリ側の簡易ロジック） | 非ゴール。カテゴリ→価格レンジのテーブル引き |
| 認証 | なし（匿名セッション） | デモの進行を止めないため |

**「一般的なWeb言語では実装しづらい」部分は、実質すべてAI連携部分に集約される**：①画像→構造化された商品候補リストへの変換（従来のWebでは画像認識モデルの学習・ホスティングが必要だったが、Vision LLMの登場でAPI呼び出し1回に置き換えられる）、②「決めずに引き出す」対話のガードレール設計（プロンプトエンジニアリング＋構造化出力の強制）。これ以外（CRUD、状態管理、UI）は通常のWeb開発の範囲。

## 4. Claudeモデル

画像抽出・Reflection Agentともに `claude-sonnet-5` を使用する（現時点で最新かつ最も能力の高いモデル）。レイテンシ上の問題が出た場合のみ、対話部分を軽量モデルに切り替える余地を残す。

## 5. データモデル

```ts
type PurposeType = "earn_money" | "declutter" | "preserve_memories" | "consider_letting_go" | "other";

type Session = {
  id: string;
  purposeType: PurposeType;
  targetAmount?: number;
  note?: string;
  createdAt: string;
};

type Item = {
  id: string;
  sessionId: string;
  imageUrl: string;          // Firebase Storage URL
  sourceImageId?: string;    // 元の部屋写真ID
  title: string;             // Claude Visionが付けた仮の商品名
  category: string;          // 価格モックのルックアップキー
  estimatedPrice?: number;
  initialClassification?: "keep" | "unsure" | "releaseable";
  finalDecision?: "keep" | "let_go" | "hold";
};

// --- Reflection Agent ---

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
  assistantReflectionText: string; // 言い換え・共感の一文
  question?: string;
  createdAt: string;
};

// --- 手放したもののアルバム ---

type MemoryRecord = {
  id: string;
  itemId: string;
  itemName: string;
  imageUrl: string;
  episode?: string;              // 生成された整った文章
  memory: string;                // memoryToPreserveベース
  reasonForLettingGo?: string;
  tags: string[];
  soldPrice?: number;
  listedAt?: string;
  soldAt?: string;
  createdAt: string;
};
```

Firestore構成：`sessions/{sessionId}`、`sessions/{sessionId}/items/{itemId}`、`sessions/{sessionId}/items/{itemId}/reflection`（ReflectionStateを1ドキュメントで保持）、`sessions/{sessionId}/items/{itemId}/reflection/turns/{turnIndex}`（デモ振り返り・デバッグ用の対話ログ、ロジックの入力には使わない）、`sessions/{sessionId}/album/{memoryRecordId}`。

## 6. フロントエンド（Web / モバイル表示）

- レスポンシブWebアプリとして実装し、ネイティブアプリ化はしない
- 既存プロトタイプのフォンフレーム（黒縁のスマホ風チュラム）はデスクトップ表示時のみ使用し、`window.matchMedia("(max-width: 480px)")` 相当の判定で実機スマホでは全画面表示に切り替える
- 写真アップロードは `<input type="file" accept="image/*" capture="environment">` を使用。スマホのブラウザで開けばカメラが起動し、PCではファイル選択でデモ可能
- 既存 `index.html` の画面・CSS変数・遷移ロジックをNext.jsコンポーネント単位（`screen-home`、`screen-declutter-deck`等）に移植し、状態管理はReactの状態＋Firestoreとの同期に置き換える

## 7. 画像からの商品抽出

1. ユーザーが部屋・棚の写真をアップロード → Firebase Storageに保存 → APIへ渡す
2. `POST /api/items/extract` がClaude Vision（Messages API、画像をbase64またはURLで送信）を呼び出す。tool use（`extract_items`ツール、`tool_choice: {type:"tool", name:"extract_items"}`で強制）で以下の構造化出力を得る：

```json
{
  "items": [
    { "title": "サークルTシャツ", "category": "clothing_tshirt", "confidence": 0.82 }
  ]
}
```

3. `category` をキーに、アプリ側の固定価格レンジテーブル（例：`clothing_tshirt` → 800〜2500円）を引き、レンジ内で疑似乱数の`estimatedPrice`を生成する（実相場APIには接続しない＝非ゴール）
4. 生成された`Item`をFirestoreに保存し、カード一覧としてクライアントへ返す
5. 送信前にクライアント側で画像をリサイズ・圧縮する（Vision APIのペイロード・コスト対策）

## 8. Reflection Agent設計（「迷う」物へのAI対話）

一次分類で「迷う」に分類された物だけを対象に、Claudeとの短い対話で判断材料を整理する。**AIは売る／残すを決定しない**。

### 8.1 全体フロー

```
「迷う」item
  → POST /api/reflections で対話開始（ReflectionState初期化）
  → ユーザー発話 → POST /api/reflections/:id/messages
  → Claudeが現在のStateを見て、
      不足している最も重要な判断材料を1つ特定し、
      ask_question または complete_reflection のいずれかのtoolを呼ぶ（tool_choice: "any"）
  → backendがstatePatchを既存Stateにmerge、turnCount+1
  → 最大3ターンに達したら、次回呼び出しは
      tool_choice: {type:"tool", name:"complete_reflection"} で強制終了
  → complete時、summaryをユーザーに提示
  → ユーザーが 残す / 手放す / 保留 を最終決定（POST /api/reflections/:id/decision）
  → 「手放す」の場合、会話とsummaryからアルバム用テキスト（episode/memory/reasonForLettingGo）を
      1回のClaude呼び出しで生成し、backendがMemoryRecordとして保存
```

### 8.2 なぜAgentic（自律マルチステップ）にしないか

各ステップの間に必ずユーザー入力が挟まるため、Claudeが複数ツールを自律的に連鎖実行する必要はない。「最大3ターン」「誘導しない」といったガードレールは、モデルの自律判断だけに委ねず、**backend側のturnCountチェックで強制する**（8.4参照）。tool useは実行される「機能」としてではなく、**出力をJSONスキーマに強制するための道具**として使う。フル会話履歴を毎回再送せず、「system prompt + item情報 + 現在のReflectionState + 直近のuser発言」だけを送ることで、トークン消費とレイテンシを抑える。

### 8.3 Tool定義

**対話ターン用（毎ターン、いずれか片方を強制呼び出し）**

```json
{
  "name": "ask_question",
  "description": "判断材料としてまだ不足している最も重要な点について、ユーザーに1つだけ質問する",
  "input_schema": {
    "type": "object",
    "properties": {
      "reflection": { "type": "string", "description": "直前の回答への短い言い換え・仮説的な共感の一文" },
      "question": { "type": "string" },
      "statePatch": {
        "type": "object",
        "properties": {
          "attachmentTypes": { "type": "array", "items": { "type": "string" } },
          "reasonsToKeep": { "type": "array", "items": { "type": "string" } },
          "reasonsToLetGo": { "type": "array", "items": { "type": "string" } },
          "memoryToPreserve": { "type": "string" },
          "regretIfSold": { "type": "string" },
          "regretIfKept": { "type": "string" },
          "unresolved": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "required": ["reflection", "question"]
  }
}
```

```json
{
  "name": "complete_reflection",
  "description": "判断材料が十分に整理できたので対話を終了し、要約を返す",
  "input_schema": {
    "type": "object",
    "properties": {
      "reflection": { "type": "string" },
      "summary": {
        "type": "object",
        "properties": {
          "reasonsToKeep": { "type": "array", "items": { "type": "string" } },
          "reasonsToLetGo": { "type": "array", "items": { "type": "string" } },
          "memoryToPreserve": { "type": "string" },
          "regretIfSold": { "type": "string" },
          "regretIfKept": { "type": "string" },
          "unresolved": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "required": ["reflection", "summary"]
  }
}
```

各ターンは `tools: [ask_question, complete_reflection]`、`tool_choice: {type: "any"}` で呼び出し、Claudeは必ずどちらか一方を呼ぶ。

**最終決定後（「手放す」を選んだ場合のみ、1回だけ呼ぶ構造化生成）**

```json
{
  "name": "save_memory_record",
  "description": "手放すと決めた物について、アルバムに残す文章（エピソード・思い出・手放した理由）を整える",
  "input_schema": {
    "type": "object",
    "properties": {
      "episode": { "type": "string" },
      "memory": { "type": "string" },
      "reasonForLettingGo": { "type": "string" },
      "tags": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["memory"]
  }
}
```

> 注：`save_memory_record`は「Claudeが実行する機能」ではなく、**backendが最終的にFirestoreへ書き込むための、構造化テキスト生成の一発呼び出し**として扱う。Claude自身にDB書き込み権限を持たせない（実際の`INSERT`はNext.js API Route側のコードが行う）。同様に、出品下書きが必要になった場合の`create_listing_draft`もP1機能として同じ扱いにする。

### 8.4 backend側のState更新とターン数制御

```ts
function applyStatePatch(current: ReflectionState, patch: Partial<ReflectionState>): ReflectionState {
  return {
    ...current,
    attachmentTypes: [...new Set([...current.attachmentTypes, ...(patch.attachmentTypes ?? [])])],
    reasonsToKeep: [...new Set([...current.reasonsToKeep, ...(patch.reasonsToKeep ?? [])])],
    reasonsToLetGo: [...new Set([...current.reasonsToLetGo, ...(patch.reasonsToLetGo ?? [])])],
    memoryToPreserve: patch.memoryToPreserve ?? current.memoryToPreserve,
    regretIfSold: patch.regretIfSold ?? current.regretIfSold,
    regretIfKept: patch.regretIfKept ?? current.regretIfKept,
    unresolved: patch.unresolved ?? current.unresolved,
    turnCount: current.turnCount + 1,
    status: patch.status ?? current.status,
  };
}

const MAX_TURNS = 3;
// turnCount >= MAX_TURNS の場合、次のClaude呼び出しは
// tool_choice: { type: "tool", name: "complete_reflection" } を強制し、
// モデルの自律判断に関わらず必ず要約を返させる。
```

### 8.5 System Prompt

```xml
<role>
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
</final_summary>
```

### 8.6 理論的根拠

- **Continuing Bonds理論**（Klass, Silverman & Nickman, 1996）：喪失対象と完全に決別することではなく、形を変えて関係・つながりを保ち続けることが健全な適応だとする理論。`<memory_preservation>`は「物を手放しても、その物に紐づく記憶や関係は別の形で残せる」という考え方をそのまま対話設計に反映している。プロダクトのコンセプト「物は手放しても、記憶は残る」自体の学術的裏付けとしても使える
- **Motivational Interviewing / OARS技法**（Miller & Rollnick）：支援者が結論を出さず、Open questions・Affirmations・Reflective listening・Summaryによって本人が自分の答えに気づけるよう導くカウンセリング技法。`<question_policy>`のOpen questions要件、`<conversation_style>`のReflective listening（仮説的な言い換え）、`<final_summary>`のSummaryは、OARSの主要素にそのまま対応する

参考：
- [Continuing bonds - Wikipedia](https://en.wikipedia.org/wiki/Continuing_bonds)
- [Continuing Bonds Theory in Grief Counselling - The Loss Foundation](https://thelossfoundation.org/continuing-bonds-theory-in-grief-counselling/)
- [How to Use OARS Skills in Motivational Interviewing - Relias](https://www.relias.com/blog/oars-motivational-interviewing)

## 9. API設計

Next.js API Routesとして実装する。

| API | 用途 | 実装 |
| --- | --- | --- |
| `POST /api/sessions` | 目的を含む整理セッションの作成 | Firestore書き込み |
| `POST /api/items/extract` | 画像から商品候補を抽出 | Claude Vision + tool use |
| `PATCH /api/items/:id/classification` | 一次分類（残したい/迷う/手放せそう）の保存 | Firestore書き込み |
| `POST /api/reflections` | 「迷う」itemに対するReflection対話の開始 | ReflectionState初期化 |
| `POST /api/reflections/:id/messages` | ユーザー発話を送り、次の質問または要約を得る | Claude Messages API（8.3のtool定義） |
| `POST /api/reflections/:id/decision` | 最終判断（残す/手放す/保留）の保存 | Firestore書き込み。「手放す」ならsave_memory_record生成も実行 |
| `GET /api/sale-plan?sessionId=` | 推定額・目標額・候補セットの取得 | Firestoreの`estimatedPrice`集計＋簡易ロジック |
| `GET /api/album?sessionId=` | 手放したもののアルバム一覧 | Firestore読み取り |

## 10. 非機能要件

- **APIキー管理**：Anthropic/Firebase Admin SDKのキーはVercel環境変数のみに置き、クライアントバンドルに含めない
- **Firestoreセキュリティルール**：匿名セッションでも「自分の`sessionId`配下のドキュメントのみ読み書き可」という簡易ルールを設定する
- **コスト対策**：抽出は画像1枚につきClaude呼び出し1回、Reflection対話は1itemあたり最大3ターン＋アルバムテキスト生成1回に制限。画像はクライアント側でリサイズ・圧縮してから送信する
- **エラーハンドリング**：Claude API呼び出し失敗時（デモ中のネットワーク不調等）は、画像抽出は固定のサンプル候補データへフォールバックできるようにしておく（デモ事故対策。ロジック自体はモックにしない、あくまで障害時のフォールバック）

## 11. MVP優先度

### P0（必須）
1. 目的設定、セッション作成
2. 画像アップロード→商品候補抽出（Claude Vision）
3. カードの高速仕分け（残したい/迷う/手放せそう）
4. Reflection Agentによる「迷う」物への対話（最大3ターン、tool use）
5. 本人による最終決定
6. エピソード付き「手放したもののアルバム」

### P1（あると強い）
1. 推定価格・売却候補の合計、目標額に対する候補セット提案
2. `create_listing_draft`（出品下書き生成）
3. タグ・検索・時系列表示

### P2（時間が余れば）
1. スワイプアニメーション
2. 対話ログ（`reflection/turns`）を使った振り返りUI
3. Claude API障害時のフォールバックUIの作り込み

## 12. 未解決事項 / 今後の検討

- Firestoreセキュリティルールの具体的な記述は実装時に詰める
- 価格レンジテーブル（カテゴリ→価格帯）の初期データセットの用意
- デモ用フォールバックの具体的なサンプルデータセット
