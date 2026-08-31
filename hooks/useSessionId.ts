"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "letting-go-session-id";

export function useSessionId(): [string | null, (id: string) => void] {
  const [sessionId, setSessionIdState] = useState<string | null>(null);

  useEffect(() => {
    setSessionIdState(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const setSessionId = useCallback((id: string) => {
    window.localStorage.setItem(STORAGE_KEY, id);
    setSessionIdState(id);
  }, []);

  return [sessionId, setSessionId];
}
