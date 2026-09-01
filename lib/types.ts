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
  x?: number;
  y?: number;
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

export type BuyRequestStatus = "pending" | "declined" | "listed";

export type BuyRequest = {
  id: string;
  collectionId: string;
  itemId: string;
  itemName: string;
  fromName: string;
  price: number;
  status: BuyRequestStatus;
  createdAt: string;
};

export type Comment = {
  id: string;
  collectionId: string;
  authorName: string;
  text: string;
  createdAt: string;
};
