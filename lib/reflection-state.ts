import type { ReflectionState } from "./types";

export function initialReflectionState(
  itemId: string,
  itemName: string
): ReflectionState {
  return {
    itemId,
    itemName,
    attachmentTypes: [],
    reasonsToKeep: [],
    reasonsToLetGo: [],
    unresolved: [],
    turnCount: 0,
    status: "in_progress",
  };
}

export function applyStatePatch(
  current: ReflectionState,
  patch: Partial<ReflectionState>
): ReflectionState {
  return {
    ...current,
    attachmentTypes: [
      ...new Set([...current.attachmentTypes, ...(patch.attachmentTypes ?? [])]),
    ],
    reasonsToKeep: [
      ...new Set([...current.reasonsToKeep, ...(patch.reasonsToKeep ?? [])]),
    ],
    reasonsToLetGo: [
      ...new Set([...current.reasonsToLetGo, ...(patch.reasonsToLetGo ?? [])]),
    ],
    memoryToPreserve: patch.memoryToPreserve ?? current.memoryToPreserve,
    regretIfSold: patch.regretIfSold ?? current.regretIfSold,
    regretIfKept: patch.regretIfKept ?? current.regretIfKept,
    unresolved: patch.unresolved ?? current.unresolved,
    turnCount: current.turnCount + 1,
    status: patch.status ?? current.status,
  };
}
