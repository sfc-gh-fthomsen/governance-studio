import { create } from "zustand";
import type { ChangeItem, ExecutionMode } from "@/types/governance";

interface StagingState {
  mode: ExecutionMode;
  changes: ChangeItem[];
  setMode: (mode: ExecutionMode) => void;
  addChange: (change: ChangeItem) => void;
  removeChange: (id: string) => void;
  clearChanges: () => void;
  updateChangeStatus: (
    id: string,
    status: ChangeItem["status"],
    error?: string
  ) => void;
}

export const useStagingStore = create<StagingState>((set) => ({
  mode: "dry-run",
  changes: [],
  setMode: (mode) => set({ mode }),
  addChange: (change) =>
    set((s) => ({ changes: [...s.changes, change] })),
  removeChange: (id) =>
    set((s) => ({ changes: s.changes.filter((c) => c.id !== id) })),
  clearChanges: () => set({ changes: [] }),
  updateChangeStatus: (id, status, error) =>
    set((s) => ({
      changes: s.changes.map((c) =>
        c.id === id ? { ...c, status, error } : c
      ),
    })),
}));
