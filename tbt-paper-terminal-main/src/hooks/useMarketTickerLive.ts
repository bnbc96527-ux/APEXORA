import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { MarketTicker } from '../services/marketDataService';

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

export function useMarketTickerLive<T extends { symbol: string; ticker: MarketTicker | null }>(
  setMarkets: Dispatch<SetStateAction<T[]>>
) {
  const updateRef = useRef(setMarkets);
  const pending = useRef(new Map<string, Partial<MarketTicker>>());

  useEffect(() => {
    updateRef.current = setMarkets;
  }, [setMarkets]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let flushTimer: ReturnType<typeof setInterval> | null = null;
    let closed = false;
    let urlIndex = 0;
    let reconnectDelay = RECONNECT_BASE_DELAY_MS;

    const flush = () => {
      if (pending.current.size === 0) return;
      const updates = new Map(pending.current);
      pending.current.clear();
      updateRef.current((prev) =>
        prev.map((m) => {
          const patch = updates.get(m.symbol);
          if (!patch) return m;
          const ticker = m.ticker || {
            symbol: m.symbol,
            price: 0,
            priceChange: 0,
            priceChangePercent: 0,
            high24h: 0,
            low24h: 0,
            volume24h: 0,
            quoteVolume24h: 0,
            openPrice: 0,
            trades24h: 0,
            lastUpdated: Date.now(),
          };
          return { ...m, ticker: { ...ticker, ...patch } } as T;
        })
      );
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

        const now = Date.now();
        for (const item of data) {
          if (!item || typeof item !== 'object') continue;
          const ticker = item as {
            s?: string;
            c?: string;
            o?: string;
            h?: string;
            l?: string;
            v?: string;
            q?: string;
          };
          const symbol = ticker.s;
          if (!symbol || !ticker.c || !ticker.o) continue;
          const open = parseFloat(ticker.o);
          const close = parseFloat(ticker.c);
          if (!Number.isFinite(open) || !Number.isFinite(close) || open === 0) continue;
          const priceChange = close - open;
          const priceChangePercent = (priceChange / open) * 100;
          pending.current.set(symbol, {
            symbol,
            price: close,
            openPrice: open,
            priceChange,
            priceChangePercent,
            high24h: ticker.h ? parseFloat(ticker.h) : close,
            low24h: ticker.l ? parseFloat(ticker.l) : close,
            volume24h: ticker.v ? parseFloat(ticker.v) : 0,
            quoteVolume24h: ticker.q ? parseFloat(ticker.q) : 0,
            lastUpdated: now,
          });
        }
      };

      ws.onclose = () => {
        ws = null;
        if (!closed) scheduleReconnect();
      };

      ws.onerror = () => {
        // onclose handles reconnect
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
