import { useEffect } from 'react';
import { liveTradeService } from '../services/liveTradeService';
import { useWalletStore } from '../store/walletStore';
import { useTradingStore } from '../store/tradingStore';
import { useWatchlistStore } from '../store/watchlistStore';

const LIVE_TRADING_ENABLED = import.meta.env.VITE_LIVE_TRADING === 'true';

export function useLiveTradingSync() {
  const activeAccountType = useWalletStore((state) => state.activeAccountType);
  const setBalancesFromLive = useWalletStore((state) => state.setBalancesFromLive);
  const syncLiveOrders = useTradingStore((state) => state.syncLiveOrders);
  const setLivePositionsFromBalances = useTradingStore((state) => state.setLivePositionsFromBalances);

  useEffect(() => {
    if (!LIVE_TRADING_ENABLED || activeAccountType !== 'real') return;

    let active = true;

    const poll = async () => {
      try {
        const [account, openOrders] = await Promise.all([
          liveTradeService.getAccount(),
          liveTradeService.getOpenOrders(),
        ]);

        if (!active) return;

        if (account?.balances) {
          setBalancesFromLive(account.balances);
          const priceLookup: Record<string, string> = {};
          const symbols = useWatchlistStore.getState().symbols;
          for (const s of symbols) {
            if (s.price) priceLookup[s.symbol] = s.price;
          }
          setLivePositionsFromBalances(account.balances, priceLookup);
        }

        if (openOrders) {
          syncLiveOrders(openOrders);
        }

        // Refresh status for recently submitted orders that are no longer open
        const state = useTradingStore.getState();
        const pendingLive = state.orders.filter(
          (o) => o.source === 'live' && ['submitted', 'open', 'partial'].includes(o.status)
        );
        const openIds = new Set((openOrders || []).map((o) => o.clientOrderId));
        const missing = pendingLive.filter((o) => !openIds.has(o.clientOrderId)).slice(0, 5);
        for (const order of missing) {
          try {
            const detail = await liveTradeService.getOrder({
              symbol: order.symbol,
              orderId: order.exchangeOrderId,
              origClientOrderId: order.clientOrderId,
            });
            syncLiveOrders([detail]);
          } catch {
            // ignore per-order errors
          }
        }
      } catch {
        // Ignore polling errors to keep UI responsive
      }
    };

    poll();
    const timer = setInterval(poll, 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [activeAccountType, setBalancesFromLive, setLivePositionsFromBalances, syncLiveOrders]);
}
