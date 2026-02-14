import { join } from "node:path";

export function getProjectRoot(): string {
  return join(import.meta.dir, "..", "..");
}

export function getWorkspaceRoot(): string {
  return join(getProjectRoot(), "workspace");
}

export function getMemoryRoot(): string {
  return join(getWorkspaceRoot(), "memory");
}

export function getHistoryRoot(): string {
  return join(getWorkspaceRoot(), "history");
}
