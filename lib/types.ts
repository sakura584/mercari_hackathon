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
