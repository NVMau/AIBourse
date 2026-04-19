import { AlertNotifier } from "./notifier.ts";
import { WatchlistRuleEngine } from "./rule-engine.ts";
import { WatchlistStore } from "./watchlist-store.ts";
import type { PriceChangeEvent, TriggeredAlert, Watchlist } from "./watchlist.ts";

export class WatchlistService {
  private readonly store: WatchlistStore;
  private readonly engine: WatchlistRuleEngine;
  private readonly notifier: AlertNotifier;

  constructor(store: WatchlistStore, engine: WatchlistRuleEngine, notifier: AlertNotifier) {
    this.store = store;
    this.engine = engine;
    this.notifier = notifier;
  }

  upsertWatchlist(workspaceId: string, next: Omit<Watchlist, "createdAtIso" | "updatedAtIso">): Watchlist {
    const now = new Date().toISOString();
    const prev = this.store.load(workspaceId);

    const watchlist: Watchlist = {
      ...next,
      workspaceId,
      createdAtIso: prev?.createdAtIso ?? now,
      updatedAtIso: now,
    };

    this.store.save(workspaceId, watchlist);
    return watchlist;
  }

  getWatchlist(workspaceId: string): Watchlist | null {
    return this.store.load(workspaceId);
  }

  async processPriceChange(workspaceId: string, event: PriceChangeEvent): Promise<TriggeredAlert[]> {
    const watchlist = this.store.load(workspaceId);
    if (!watchlist) {
      return [];
    }

    const alerts = this.engine.evaluateAll(watchlist.rules, event);
    if (!alerts.length) {
      return [];
    }

    if (watchlist.alertMode === "instant") {
      for (const alert of alerts) {
        await this.notifier.send(alert, watchlist.delivery);
      }
    }

    return alerts;
  }

  async flushScheduledAlerts(workspaceId: string, bufferedAlerts: TriggeredAlert[]): Promise<void> {
    if (!bufferedAlerts.length) {
      return;
    }

    const watchlist = this.store.load(workspaceId);
    if (!watchlist || watchlist.alertMode !== "scheduled") {
      return;
    }

    for (const alert of bufferedAlerts) {
      await this.notifier.send(alert, watchlist.delivery);
    }
  }
}
