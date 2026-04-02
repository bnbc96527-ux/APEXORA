import { useEffect, useRef } from 'react';
import { useWatchlistStore } from '../store/watchlistStore';

const WS_URLS = (() => {
  const fromEnv = (import.meta.env.VITE_BINANCE_WS_URLS as string | undefined)
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const base = import.meta.env.VITE_BINANCE_WS_BASE || 'wss://testnet.binance.vision';
  return [
    `${base.replace(/\/+$/, '')}/ws/!miniTicker@arr`,
    'wss://stream.binance.com:9443/ws/!miniTicker@arr',
    'wss://stream.binance.com:443/ws/!miniTicker@arr',
  ];
})();

const FLUSH_INTERVAL_MS = 500;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;

export function useWatchlistTicker() {
  const symbols = useWatchlistStore((state) => state.symbols);
  const updateSymbolPrices = useWatchlistStore((state) => state.updateSymbolPrices);

  const symbolsRef = useRef(new Set<string>());
  const updateRef = useRef(updateSymbolPrices);

  useEffect(() => {
    symbolsRef.current = new Set(symbols.map((s) => s.symbol));
  }, [symbols]);

  useEffect(() => {
    updateRef.current = updateSymbolPrices;
  }, [updateSymbolPrices]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let flushTimer: ReturnType<typeof setInterval> | null = null;
    let closed = false;
    let urlIndex = 0;
    let reconnectDelay = RECONNECT_BASE_DELAY_MS;
    const pending = new Map<string, { price: string; priceChange24h?: number }>();

    const flush = () => {
      if (pending.size === 0) return;
      const batch: Record<string, { price: string; priceChange24h?: number }> = {};
      for (const [symbol, data] of pending.entries()) {
        batch[symbol] = data;
      }
      pending.clear();
      updateRef.current(batch);
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer) return;
      const delay = Math.min(reconnectDelay, RECONNECT_MAX_DELAY_MS);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        urlIndex = (urlIndex + 1) % WS_URLS.length;
        reconnectDelay = Math.min(Math.round(reconnectDelay * 1.5), RECONNECT_MAX_DELAY_MS);
        connect();
      }, delay);
    };

    const connect = () => {
      const url = WS_URLS[urlIndex % WS_URLS.length] ?? WS_URLS[0];
      if (!url) {
        scheduleReconnect();
        return;
      }
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        reconnectDelay = RECONNECT_BASE_DELAY_MS;
      };

      ws.onmessage = (event) => {
        let payload: unknown;
        try {
          payload = JSON.parse(event.data as string);
        } catch {
          return;
        }

        const data = Array.isArray(payload)
          ? payload
          : (payload as { data?: unknown }).data;
        if (!Array.isArray(data)) return;

        const symbolSet = symbolsRef.current;
        for (const item of data) {
          if (!item || typeof item !== 'object') continue;
          const ticker = item as { s?: string; c?: string; o?: string; P?: string };
          const symbol = ticker.s;
          if (!symbol || !symbolSet.has(symbol)) continue;
          if (!ticker.c) continue;
          let changePercent: number | undefined = undefined;
          if (ticker.o) {
            const open = parseFloat(ticker.o);
            const close = parseFloat(ticker.c);
            if (open > 0 && Number.isFinite(open) && Number.isFinite(close)) {
              changePercent = ((close - open) / open) * 100;
            }
          }
          pending.set(symbol, {
            price: ticker.c,
            priceChange24h: changePercent ?? (ticker.P ? parseFloat(ticker.P) : undefined),
          });
        }
      };

      ws.onerror = () => {
        // onclose handles reconnect
      };

      ws.onclose = () => {
        ws = null;
        if (!closed) scheduleReconnect();
      };
    };

    connect();
    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (flushTimer) clearInterval(flushTimer);
      flush();
      if (ws) ws.close();
    };
  }, []);
}
