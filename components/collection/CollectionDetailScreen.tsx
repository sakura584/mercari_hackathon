"use client";

import { useState } from "react";
import { onImgError } from "@/lib/collection-mock-data";
import type { CollectionPost, ItemTag } from "@/lib/collection-types";
import { TagPinLayer } from "./TagPinLayer";

export function CollectionDetailScreen({
  post,
  onBack,
  onToggleLike,
  onSendComment,
  onOpenBuySheet,
  showRoleSwitchBanner,
  onSwitchRole,
}: {
  post: CollectionPost;
  onBack: () => void;
  onToggleLike: () => void;
  onSendComment: (text: string) => void;
  onOpenBuySheet: (tagId: string) => void;
  showRoleSwitchBanner: boolean;
  onSwitchRole: () => void;
}) {
  const [activeTag, setActiveTag] = useState<ItemTag | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  function submitComment() {
    const text = commentDraft.trim();
    if (!text) return;
    onSendComment(text);
    setCommentDraft("");
  }

  return (
    <section className="screen active">
      <div className="app-bar">
        <button type="button" className="back-chevron" onClick={onBack}>
          ←
        </button>
        <div className="app-bar-title">投稿</div>
      </div>
      <div className="screen-scroll">
        <div className="collection-detail-user-row">
          <div className="mypage-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
            {post.user.avatar}
          </div>
          <div>
            <div className="collection-detail-user-name">{post.user.name}</div>
            <div className="collection-detail-posted-at">{post.postedAt}</div>
          </div>
        </div>

        <div className="collection-photo-area" onClick={() => setActiveTag(null)}>
          <img src={post.photo ?? undefined} onError={onImgError} alt="" />
          <TagPinLayer
            tags={post.tags}
            activeTag={activeTag}
            onPinClick={setActiveTag}
            renderPopup={(tag) => (
              <>
                <div className="tp-name">{tag.name}</div>
                <div className="tp-cat">{tag.category}</div>
                <div className="tp-status">{tag.status}</div>
                <button
                  type="button"
                  className="cta"
                  style={{ padding: "9px", fontSize: 12.5 }}
                  onClick={() => {
                    setActiveTag(null);
                    onOpenBuySheet(tag.id);
                  }}
                >
                  買いたい
                </button>
              </>
            )}
          />
        </div>

        <h1 className="hero" style={{ marginTop: 14 }}>
          {post.title}
        </h1>
        <p className="hero-sub" style={{ marginBottom: 0 }}>
          {post.body}
        </p>

        <div className="tag-chip-row" style={{ margin: "14px 0" }}>
          {post.tags.map((t) => (
            <span key={t.id} className="tag-chip">
              {t.name}
            </span>
          ))}
        </div>

        <div className="collection-action-bar">
          <button
            type="button"
            className={`collection-action-item${post.liked ? " liked" : ""}`}
            onClick={onToggleLike}
          >
            <span className="icon">{post.liked ? "♥" : "♡"}</span>
            {post.likes}
          </button>
          <div className="collection-action-item">
            <span className="icon">💬</span>
            {post.comments.length}
          </div>
          <div className="collection-action-item">
            <span className="icon">↗</span>シェア
          </div>
        </div>

        <div className="collection-comments-section">
          {post.comments.map((c, i) => (
            <div key={i} className="collection-comment-row">
              <span className="collection-comment-user">{c.user}</span>
              {c.text}
            </div>
          ))}
          <div className="collection-comment-input-row">
            <input
              className="collection-comment-input"
              placeholder="コメントする"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
            />
            <button type="button" className="collection-comment-send-btn" onClick={submitComment}>
              送信
            </button>
          </div>
        </div>
      </div>

      {showRoleSwitchBanner ? (
        <div className="collection-role-banner">
          <span>デモ：投稿者側の反応を見る</span>
          <button type="button" onClick={onSwitchRole}>
            投稿者の画面に切り替える
          </button>
        </div>
      ) : null}
    </section>
  );
}
