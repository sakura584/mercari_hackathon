"use client";

import { useState } from "react";
import { onImgError } from "@/lib/collection-mock-data";

export function CollectionSellScreen({
  photo,
  initialName,
  initialDescription,
  category,
  initialPrice,
  onBack,
  onComplete,
}: {
  photo: string | null;
  initialName: string;
  initialDescription: string;
  category: string;
  initialPrice: number;
  onBack: () => void;
  onComplete: (values: { name: string; description: string; price: number }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [price, setPrice] = useState(initialPrice);

  return (
    <section className="screen active">
      <div className="app-bar">
        <button type="button" className="back-chevron" onClick={onBack}>
          ←
        </button>
        <div className="app-bar-title">商品の情報を入力</div>
      </div>
      <div className="screen-scroll">
        <div className="progress-banner">
          買いたい人がすでにいます。内容を確認して出品してください。
        </div>

        {photo ? (
          <img
            src={photo}
            onError={onImgError}
            alt=""
            style={{ width: 88, height: 88, borderRadius: 8, objectFit: "cover", marginBottom: 16 }}
          />
        ) : null}

        <div className="draft-field">
          <label>商品名</label>
          <input className="draft-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="draft-field">
          <label>商品の説明</label>
          <textarea
            className="draft-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="draft-static-row">
          <span>カテゴリー</span>
          <span className="dsr-value">{category}</span>
        </div>
        <div className="draft-static-row">
          <span>商品の状態</span>
          <span className="dsr-value">目立った傷や汚れなし</span>
        </div>
        <div className="draft-static-row">
          <span>配送料の負担</span>
          <span className="dsr-value">出品者が負担</span>
        </div>
        <div className="draft-field" style={{ marginTop: 18 }}>
          <label>販売価格</label>
          <div className="draft-price-wrap">
            <span>¥</span>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(parseInt(e.target.value, 10) || 0)}
            />
          </div>
        </div>

        <button
          type="button"
          className="cta"
          onClick={() => onComplete({ name, description, price })}
        >
          出品する
        </button>
      </div>
    </section>
  );
}
