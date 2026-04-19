import { AlertNotifier } from "./notifier";
import { WatchlistRuleEngine } from "./rule-engine";
import { WatchlistStore } from "./watchlist-store";
import { PriceChangeEvent, TriggeredAlert, Watchlist } from "./watchlist";

export class WatchlistService {
  constructor(
    private readonly store: WatchlistStore,
    private readonly engine: WatchlistRuleEngine,
    private readonly notifier: AlertNotifier,
  ) {}

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
