import { useEffect, useState, useSyncExternalStore } from "react";
import type { ConnectionStatus } from "../types";
import { connectionStatusStore, fleetStore } from "./fleet";
import type { FleetSnapshot } from "./store";

export function useFleet(): FleetSnapshot {
  return useSyncExternalStore(fleetStore.subscribe, fleetStore.getSnapshot);
}

export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(connectionStatusStore.subscribe, connectionStatusStore.getSnapshot);
}

/** A clock that ticks so "3s ago" style labels stay honest. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
