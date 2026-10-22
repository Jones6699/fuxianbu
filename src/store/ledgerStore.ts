import { createPersistStore } from "../services/storage/database";
import { generateId } from "../utils/id";
import type { LedgerStatus, StoryLedgerItem } from "../types/ledger";
interface LedgerState { items: StoryLedgerItem[]; }
export const useLedgerStore = createPersistStore({ items: [] } as LedgerState, (set, get) => ({
  addItem(data: Omit<StoryLedgerItem, "id" | "createdAt" | "updatedAt">) { const now = Date.now(); const item = { ...data, id: generateId(), createdAt: now, updatedAt: now }; set((s) => ({ items: [...s.items, item] })); get().markUpdate(); return item; },
  updateItem(id: string, data: Partial<StoryLedgerItem>) { set((s) => ({ items: s.items.map((item) => item.id === id ? { ...item, ...data, updatedAt: Date.now() } : item) })); get().markUpdate(); },
  removeItem(id: string) { set((s) => ({ items: s.items.filter((item) => item.id !== id) })); get().markUpdate(); },
  forProject(projectId: string) { return get().items.filter((item) => item.projectId === projectId); },
  setStatus(id: string, status: LedgerStatus) { set((s) => ({ items: s.items.map((item) => item.id === id ? { ...item, status, updatedAt: Date.now() } : item) })); get().markUpdate(); },
  exportProject(projectId: string) { return JSON.stringify({ version: 1, items: get().items.filter((item) => item.projectId === projectId) }, null, 2); },
  importProject(projectId: string, raw: string) { const parsed = JSON.parse(raw); const incoming = Array.isArray(parsed) ? parsed : parsed.items; if (!Array.isArray(incoming)) throw new Error("账本文件格式不正确"); const now = Date.now(); const normalized = incoming.map((item: any) => ({ ...item, id: item.id || generateId(), projectId, createdAt: item.createdAt || now, updatedAt: now })); set((s) => ({ items: [...s.items.filter((item) => item.projectId !== projectId), ...normalized] })); get().markUpdate(); },
}), { name: "inkflow-ledger", version: 1 });
