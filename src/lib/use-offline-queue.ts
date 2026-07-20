"use client";

import { useSyncExternalStore } from "react";
import {
  getOfflineQueueSnapshot,
  subscribeOfflineQueue,
  type OfflineQueueSnapshot,
} from "./offline-queue";

const SERVER_SNAPSHOT: OfflineQueueSnapshot = {
  online: true,
  pending: 0,
  phase: "idle",
};

export function useOfflineQueue(): OfflineQueueSnapshot {
  return useSyncExternalStore(
    subscribeOfflineQueue,
    getOfflineQueueSnapshot,
    () => SERVER_SNAPSHOT,
  );
}
