import type {
  FinalDecision,
  Item,
  ItemClassification,
  MemoryRecord,
  PurposeType,
  ReflectionState,
} from "./types";

const MOCK_SESSION_ID = "mock-session";

const MOCK_ITEMS: Item[] = [
  {
    id: "mock-tshirt",
    sessionId: MOCK_SESSION_ID,
    imageUrl: "",
    title: "ライブTシャツ",
    category: "clothing_tshirt",
    estimatedPrice: 1800,
  },
  {
    id: "mock-mug",
    sessionId: MOCK_SESSION_ID,
    imageUrl: "",
    title: "思い出のマグカップ",
    category: "kitchen_mug",
    estimatedPrice: 600,
  },
  {
    id: "mock-book",
    sessionId: MOCK_SESSION_ID,
    imageUrl: "",
    title: "旅行ガイドブック",
    category: "book_travel",
    estimatedPrice: 500,
  },
];

const MOCK_ALBUM: MemoryRecord[] = [
  {
    id: "mock-album-1",
    itemId: "mock-camera",
    itemName: "フィルムカメラ",
    imageUrl: "",
    episode: "大学の卒業旅行で持って行ったカメラ",
    memory: "写真はデータ化して残したので、思い出はこれからも見返せます。",
    reasonForLettingGo: "次に使ってくれる人へつなぐことにした。",
    tags: ["卒業旅行", "写真"],
    soldPrice: 3200,
    createdAt: "2026-09-01T00:00:00.000Z",
  },
];

let reflectionTurn = 0;
let albumEntries = [...MOCK_ALBUM];

type ReflectionMessageResult =
  | { action: "ask"; reflection: string; question: string }
  | { action: "complete"; reflection: string; summary: Partial<ReflectionState> };

function initialReflection(itemId: string, itemName: string): ReflectionState {
  return {
    itemId,
    itemName,
    attachmentTypes: ["memory"],
    reasonsToKeep: [],
    reasonsToLetGo: [],
    unresolved: [],
    turnCount: 0,
    status: "in_progress",
  };
}

export const mockApiClient = {
  async createSession(input: { purposeType: PurposeType; targetAmount?: number }) {
    return { id: MOCK_SESSION_ID, purposeType: input.purposeType, targetAmount: input.targetAmount };
  },

  async extractItems(_input: { sessionId: string; imageBase64: string; mimeType: string }) {
    return { items: MOCK_ITEMS.map((item) => ({ ...item })) };
  },

  async updateClassification(_sessionId: string, _itemId: string, _classification: ItemClassification) {},

  async startReflection(_sessionId: string, itemId: string, itemName: string) {
    reflectionTurn = 0;
    return initialReflection(itemId, itemName);
  },

  async sendReflectionMessage(
    _sessionId: string,
    _itemId: string,
    _message: string
  ): Promise<ReflectionMessageResult> {
    reflectionTurn += 1;

    if (reflectionTurn < 3) {
      return {
        action: "ask" as const,
        reflection: "大切な記憶と結びついた品なのですね。手放すかどうか、急いで決めなくても大丈夫です。",
        question:
          reflectionTurn === 1
            ? "これを残しておきたい一番の理由は、どんなことですか？"
            : "物そのものではなく、写真やメモに残せそうな思い出はありますか？",
      };
    }

    return {
      action: "complete" as const,
      reflection: "気持ちを整理できましたね。どの選択でも、思い出の価値が変わることはありません。",
      summary: {
        attachmentTypes: ["memory"],
        reasonsToKeep: ["手に取ると当時の出来事を思い出せる"],
        reasonsToLetGo: ["写真と短い記録を残せば、思い出は受け継げる"],
        memoryToPreserve: "大切な時間を思い出せる品だった。",
        unresolved: [],
        status: "ready_for_decision",
      },
    };
  },

  async submitDecision(
    _sessionId: string,
    itemId: string,
    input: { decision: FinalDecision; itemName: string; imageUrl: string }
  ) {
    let albumEntry: MemoryRecord | undefined;
    if (input.decision === "let_go") {
      albumEntry = {
        id: `mock-album-${itemId}`,
        itemId,
        itemName: input.itemName,
        imageUrl: input.imageUrl,
        episode: "モックモードで記録した思い出",
        memory: "手放しても、この品と過ごした時間は自分の中に残っています。",
        reasonForLettingGo: "次に大切にしてくれる人へ渡すことにした。",
        tags: ["モック", "思い出"],
        createdAt: new Date().toISOString(),
      };
      albumEntries = [albumEntry, ...albumEntries.filter((entry) => entry.id !== albumEntry!.id)];
    }
    return { decision: input.decision, albumEntry };
  },

  async getAlbum(_sessionId: string) {
    return { entries: albumEntries };
  },
};
