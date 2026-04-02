import { useEffect } from 'react';
import { liveTradeService } from '../services/liveTradeService';
import { useTradingStore } from '../store/tradingStore';
import { useWalletStore } from '../store/walletStore';

const LIVE_TRADING_ENABLED = import.meta.env.VITE_LIVE_TRADING === 'true';

export function useLiveHistorySync(symbols: string[], intervalMs = 30000) {
  const activeAccountType = useWalletStore((state) => state.activeAccountType);
  const syncLiveOrders = useTradingStore((state) => state.syncLiveOrders);
  const syncLiveTrades = useTradingStore((state) => state.syncLiveTrades);

  useEffect(() => {
    if (!LIVE_TRADING_ENABLED || activeAccountType !== 'real') return;
    const uniqueSymbols = Array.from(new Set(symbols.filter(Boolean)));
    if (uniqueSymbols.length === 0) return;

    let active = true;

    const run = async () => {
      for (const symbol of uniqueSymbols) {
        if (!active) return;
        try {
          const [orders, trades] = await Promise.all([
            liveTradeService.getAllOrders(symbol),
            liveTradeService.getMyTrades(symbol),
          ]);
          if (!active) return;
          if (orders) syncLiveOrders(orders);
          if (trades) syncLiveTrades(trades);
        } catch {
          // ignore per-symbol errors
        }
        // small spacing to reduce burst load
        await new Promise((r) => setTimeout(r, 150));
      }
    };

    run();
    const timer = setInterval(run, intervalMs);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [activeAccountType, symbols.join('|'), intervalMs, syncLiveOrders, syncLiveTrades]);
}
