import type { WorkbenchContext } from "./handoff";

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  workbenchContext?: WorkbenchContext;
}
