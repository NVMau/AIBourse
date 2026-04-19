import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Watchlist } from "./watchlist.ts";

export type WatchlistStore = {
  save(workspaceId: string, watchlist: Watchlist): void;
  load(workspaceId: string): Watchlist | null;
};

export class FileWatchlistStore implements WatchlistStore {
  private readonly basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private filePath(workspaceId: string) {
    return `${this.basePath}/${workspaceId}.watchlist.json`;
  }

  save(workspaceId: string, watchlist: Watchlist): void {
    const path = this.filePath(workspaceId);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(watchlist, null, 2), "utf8");
  }

  load(workspaceId: string): Watchlist | null {
    const path = this.filePath(workspaceId);
    try {
      const raw = readFileSync(path, "utf8");
      return JSON.parse(raw) as Watchlist;
    } catch {
      return null;
    }
  }
}
