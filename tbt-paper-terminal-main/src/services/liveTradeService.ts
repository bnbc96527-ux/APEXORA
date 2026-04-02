export interface LiveOrder {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  status: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty?: string;
  type: string;
  side: string;
  time?: number;
  updateTime?: number;
}

export interface LiveTrade {
  symbol: string;
  id: number;
  orderId: number;
  price: string;
  qty: string;
  quoteQty?: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
}

export interface LiveAccount {
  balances: { asset: string; free: string; locked: string }[];
}

export interface PlaceOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET';
  quantity: string;
  price?: string;
  timeInForce?: string;
  newClientOrderId?: string;
}

const API_BASE = import.meta.env.VITE_LIVE_API_BASE || '/live-api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Non-JSON response
  }

  if (!res.ok) {
    const message = typeof data === 'object' && data && 'msg' in data
      ? String((data as { msg: string }).msg)
      : `Live API error (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

export const liveTradeService = {
  getAccount: () => request<LiveAccount>('/api/account'),
  getOpenOrders: (symbol?: string) =>
    request<LiveOrder[]>(symbol ? `/api/open-orders?symbol=${encodeURIComponent(symbol)}` : '/api/open-orders'),
  getAllOrders: (symbol: string) =>
    request<LiveOrder[]>(`/api/all-orders?symbol=${encodeURIComponent(symbol)}`),
  getMyTrades: (symbol: string) =>
    request<LiveTrade[]>(`/api/my-trades?symbol=${encodeURIComponent(symbol)}`),
  getOrder: (params: { symbol: string; orderId?: string; origClientOrderId?: string }) => {
    const query = new URLSearchParams();
    query.set('symbol', params.symbol);
    if (params.orderId) query.set('orderId', params.orderId);
    if (params.origClientOrderId) query.set('origClientOrderId', params.origClientOrderId);
    return request<LiveOrder>(`/api/order?${query.toString()}`);
  },
  placeOrder: (params: PlaceOrderParams) =>
    request<LiveOrder>('/api/order', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  cancelOrder: (params: { symbol: string; orderId?: string; origClientOrderId?: string }) => {
    const query = new URLSearchParams();
    query.set('symbol', params.symbol);
    if (params.orderId) query.set('orderId', params.orderId);
    if (params.origClientOrderId) query.set('origClientOrderId', params.origClientOrderId);
    return request<LiveOrder>(`/api/order?${query.toString()}`, { method: 'DELETE' });
  },
};
