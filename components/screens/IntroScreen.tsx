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
  allowMockSubmit = false,
}: {
  onSubmit: (input: { purposeType: PurposeType; targetAmount: number; file?: File }) => void;
  allowMockSubmit?: boolean;
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
            disabled={!file && !allowMockSubmit}
            onClick={() => onSubmit({ purposeType, targetAmount, file: file ?? undefined })}
          >
            商品候補を抽出する
          </button>
        </div>
      </div>
    </section>
  );
}
