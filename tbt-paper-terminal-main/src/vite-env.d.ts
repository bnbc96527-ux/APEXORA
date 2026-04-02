/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIVE_TRADING?: string;
  readonly VITE_LIVE_API_BASE?: string;
  readonly VITE_BINANCE_REST_TARGET?: string;
  readonly VITE_BINANCE_WS_BASE?: string;
  readonly VITE_BINANCE_WS_BASES?: string;
  readonly VITE_BINANCE_WS_URLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}



