export type CollectionUser = {
  name: string;
  avatar: string;
  rating?: string;
};

export type TagStatus = "未出品" | "出品中";

export type WantRequest = {
  from: string;
  price: number;
  at: string;
};

export type ItemTag = {
  id: string;
  x: number;
  y: number;
  name: string;
  category: string;
  status: TagStatus;
  wants: WantRequest[];
};

export type DraftTag = {
  id: string;
  x: number;
  y: number;
  name: string;
  category: string;
  included: boolean;
};

export type Comment = {
  user: string;
  text: string;
};

export type CollectionPost = {
  id: string;
  user: CollectionUser;
  photo: string | null;
  title: string;
  body: string;
  postedAt: string;
  likes: number;
  liked: boolean;
  comments: Comment[];
  tags: ItemTag[];
};

export type CollectionDraft = {
  photo: string | null;
  title: string;
  body: string;
  tags: DraftTag[];
};

export type ExtractCandidate = {
  x: number;
  y: number;
  name: string;
  category: string;
};

export type MyPageTab = "selling" | "collection" | "bought";
