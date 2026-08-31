"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { MemoryRecord } from "@/lib/types";

export function AlbumScreen({ sessionId }: { sessionId: string }) {
  const [entries, setEntries] = useState<MemoryRecord[]>([]);

  useEffect(() => {
    apiClient.getAlbum(sessionId).then((res) => setEntries(res.entries));
  }, [sessionId]);

  return (
    <section className="screen active">
      <div className="app-bar">
        <div className="app-bar-title">手放したもののアルバム</div>
      </div>
      <div className="screen-scroll">
        <p className="hero-sub">物は手放しても、思い出はここに残ります。</p>
        <div className="album-list">
          {entries.map((entry) => (
            <div key={entry.id} className="card">
              <div className="mi-name">{entry.itemName}</div>
              {entry.episode ? <p>{entry.episode}</p> : null}
              <p>{entry.memory}</p>
              {entry.tags.length > 0 ? (
                <div className="tag-chip-row">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
