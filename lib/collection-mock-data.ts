import type { SyntheticEvent } from "react";
import type { CollectionPost, CollectionUser, ExtractCandidate } from "./collection-types";

export const PLACEHOLDER_IMG =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">' +
      '<rect width="400" height="400" fill="#e3e3e3"/>' +
      '<text x="50%" y="50%" font-size="18" fill="#aaa" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">No Image</text>' +
      "</svg>"
  );

// モック画像は実体が無いため、読み込み失敗時にプレースホルダーへ差し替える。
export function onImgError(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  img.onerror = null;
  img.src = PLACEHOLDER_IMG;
}

export const currentUser: CollectionUser = { name: "ゆーこ", avatar: "ゆ", rating: "良い 12" };
export const demoBuyer: CollectionUser = { name: "たなか", avatar: "た" };

export const mockExtractCandidates: ExtractCandidate[] = [
  { x: 30, y: 42, name: "木製のフロアランプ", category: "インテリア / ライト" },
  { x: 62, y: 58, name: "編みかごのバスケット", category: "インテリア / 収納" },
  { x: 48, y: 74, name: "ガラスの花器", category: "インテリア / 花瓶" },
  { x: 78, y: 30, name: "額装されたポスター", category: "インテリア / アート" },
];

export function createInitialCollections(): CollectionPost[] {
  return [
    {
      id: "c01",
      user: currentUser,
      photo: "photos/room-01.jpg",
      title: "一人暮らしの部屋、3年目",
      body: "少しずつ集めたものたちです。引っ越したときは何もなかった部屋も、ようやく落ち着いてきました。",
      postedAt: "2時間前",
      likes: 24,
      liked: false,
      comments: [
        { user: "あおい", text: "ランプどこのですか？" },
        { user: "kzk", text: "雰囲気すごく好きです" },
      ],
      tags: [
        { id: "t1", x: 30, y: 42, name: "木製のフロアランプ", category: "インテリア / ライト", status: "未出品", wants: [] },
        { id: "t2", x: 62, y: 58, name: "編みかごのバスケット", category: "インテリア / 収納", status: "未出品", wants: [] },
        { id: "t3", x: 48, y: 74, name: "ガラスの花器", category: "インテリア / 花瓶", status: "未出品", wants: [] },
        { id: "t4", x: 78, y: 30, name: "額装されたポスター", category: "インテリア / アート", status: "未出品", wants: [] },
      ],
    },
    {
      id: "c02",
      user: currentUser,
      photo: "photos/desk-01.jpg",
      title: "在宅ワークの机まわり",
      body: "長時間座っても疲れにくい椅子を探して、ようやく今の組み合わせに落ち着きました。",
      postedAt: "昨日",
      likes: 41,
      liked: false,
      comments: [
        { user: "みずき", text: "キーボードかっこいい" },
        { user: "yamada", text: "モニターアームどこの使ってますか" },
        { user: "れい", text: "参考になります！" },
      ],
      tags: [
        { id: "t5", x: 35, y: 36, name: "アーム式モニタースタンド", category: "家電 / PC周辺機器", status: "未出品", wants: [] },
        { id: "t6", x: 58, y: 62, name: "メカニカルキーボード", category: "家電 / PC周辺機器", status: "未出品", wants: [] },
        { id: "t7", x: 22, y: 70, name: "木製デスクマット", category: "インテリア / 雑貨", status: "未出品", wants: [] },
      ],
    },
    {
      id: "c03",
      user: currentUser,
      photo: "photos/outfit-01.jpg",
      title: "今日のコーディネート",
      body: "秋口はまだ調整が難しいですが、この組み合わせは気に入っています。",
      postedAt: "3日前",
      likes: 18,
      liked: false,
      comments: [{ user: "つぐみ", text: "色の組み合わせ好き" }],
      tags: [
        { id: "t8", x: 50, y: 22, name: "ウールのコート", category: "レディース / アウター", status: "未出品", wants: [] },
        { id: "t9", x: 44, y: 55, name: "レザーのベルト", category: "レディース / 小物", status: "未出品", wants: [] },
        { id: "t10", x: 60, y: 82, name: "サイドゴアブーツ", category: "レディース / 靴", status: "未出品", wants: [] },
      ],
    },
  ];
}
