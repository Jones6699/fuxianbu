export type LedgerKind = "fact" | "clue" | "event";
export type LedgerStatus = "confirmed" | "open" | "resolved";
export interface StoryLedgerItem { id: string; kind: LedgerKind; title: string; content: string; status: LedgerStatus; source?: string; createdAt: number; updatedAt: number; projectId: string; }
export interface LedgerConflict { itemId: string; title: string; reason: string; evidence: string; }
