import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { registerAuthRoutes } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.disable('x-powered-by');
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));
registerAuthRoutes(app);

const PORT = Number(process.env.LIVE_TRADE_PORT || 4010);
const BASE_URL = process.env.BINANCE_BASE_URL || 'https://testnet.binance.vision';
const PUBLIC_URL = process.env.BINANCE_PUBLIC_URL || BASE_URL;
const API_KEY = process.env.BINANCE_API_KEY || '';
const API_SECRET = process.env.BINANCE_API_SECRET || '';
const DEFAULT_RECV_WINDOW = Number(process.env.BINANCE_RECV_WINDOW || 5000);
const DEMO_MODE = process.env.DEMO_MODE === 'true' || !API_KEY || !API_SECRET;

let timeOffsetMs = 0;

const buildQuery = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  return search.toString();
};

const signQuery = (query) => {
  return crypto.createHmac('sha256', API_SECRET).update(query).digest('hex');
};

const withSignedQuery = (params) => {
  const timestamp = Date.now() + timeOffsetMs;
  const merged = {
    ...params,
    recvWindow: params.recvWindow || DEFAULT_RECV_WINDOW,
    timestamp,
  };
  const query = buildQuery(merged);
  const signature = signQuery(query);
  return `${query}&signature=${signature}`;
};

const ensureKeys = (_req, res, next) => {
  if (DEMO_MODE) return next();
  if (!API_KEY || !API_SECRET) {
    return res.status(500).json({
      error: 'Missing BINANCE_API_KEY or BINANCE_API_SECRET on the server.',
    });
  }
  return next();
};

const requestBinance = async (path, { method = 'GET', params = {}, signed = false, baseUrl = BASE_URL } = {}) => {
  const url = signed
    ? `${baseUrl}${path}?${withSignedQuery(params)}`
    : (() => {
        const query = buildQuery(params);
        return query ? `${baseUrl}${path}?${query}` : `${baseUrl}${path}`;
      })();

  const headers = signed ? { 'X-MBX-APIKEY': API_KEY } : {};

  const response = await fetch(url, { method, headers });
  const text = await response.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const error = typeof data === 'object' && data !== null ? data : { message: text };
    throw { status: response.status, error };
  }
  return data;
};

// ===== Demo Trading (no API keys) =====
const FEE_RATE = 0.001;
let demoOrderId = 100000;
let demoTradeId = 500000;
const demoOrders = [];
const demoTrades = [];
const demoBalances = new Map([
  ['USDT', { asset: 'USDT', free: '10000', locked: '0' }],
  ['BTC', { asset: 'BTC', free: '0', locked: '0' }],
]);

const getBalance = (asset) => {
  const existing = demoBalances.get(asset);
  if (existing) return existing;
  const fresh = { asset, free: '0', locked: '0' };
  demoBalances.set(asset, fresh);
  return fresh;
};

const fetchPrice = async (symbol) => {
  try {
    const data = await requestBinance('/api/v3/ticker/price', {
      params: { symbol },
      baseUrl: PUBLIC_URL,
    });
    return data?.price ? Number(data.price) : null;
  } catch {
    return null;
  }
};

const normalizeSymbol = (symbol) => String(symbol || '').toUpperCase();
const nowMs = () => Date.now();

const computeLockedFromOrders = () => {
  // Reset locks
  demoBalances.forEach((b) => { b.locked = '0'; });
  for (const order of demoOrders) {
    if (order.status !== 'NEW' && order.status !== 'PARTIALLY_FILLED') continue;
    if (order.side === 'BUY') {
      const quote = getBalance(order.quoteAsset);
      const locked = Number(quote.locked) + Number(order.lockedQuote || 0);
      quote.locked = locked.toFixed(8);
    } else {
      const base = getBalance(order.baseAsset);
      const locked = Number(base.locked) + Number(order.lockedBase || 0);
      base.locked = locked.toFixed(8);
    }
  }
};

const fillOrder = (order, fillPrice) => {
  const qty = Number(order.origQty);
  const quoteQty = qty * fillPrice;
  const fee = quoteQty * FEE_RATE;
  const now = nowMs();

  if (order.side === 'BUY') {
    const quote = getBalance(order.quoteAsset);
    const base = getBalance(order.baseAsset);
    const lockedQuote = Number(order.lockedQuote || 0);
    const quoteFree = Number(quote.free);
    const toDeduct = lockedQuote > 0 ? lockedQuote : quoteQty;
    quote.locked = Math.max(0, Number(quote.locked) - lockedQuote).toFixed(8);
    quote.free = (quoteFree - (lockedQuote > 0 ? 0 : quoteQty) - fee).toFixed(8);
    base.free = (Number(base.free) + qty).toFixed(8);
  } else {
    const base = getBalance(order.baseAsset);
    const quote = getBalance(order.quoteAsset);
    const lockedBase = Number(order.lockedBase || 0);
    const baseFree = Number(base.free);
    base.locked = Math.max(0, Number(base.locked) - lockedBase).toFixed(8);
    base.free = (baseFree - (lockedBase > 0 ? 0 : qty)).toFixed(8);
    quote.free = (Number(quote.free) + quoteQty - fee).toFixed(8);
  }

  order.status = 'FILLED';
  order.executedQty = order.origQty;
  order.cummulativeQuoteQty = quoteQty.toFixed(8);
  order.updateTime = now;

  demoTrades.unshift({
    symbol: order.symbol,
    id: demoTradeId++,
    orderId: order.orderId,
    price: fillPrice.toFixed(8),
    qty: order.origQty,
    quoteQty: quoteQty.toFixed(8),
    commission: fee.toFixed(8),
    commissionAsset: 'USDT',
    time: now,
    isBuyer: order.side === 'BUY',
  });
};

const maybeFillOpenOrders = async (symbol) => {
  const targets = demoOrders.filter((o) =>
    (o.status === 'NEW' || o.status === 'PARTIALLY_FILLED') && (!symbol || o.symbol === symbol)
  );
  if (targets.length === 0) return;
  const price = await fetchPrice(symbol || targets[0].symbol);
  if (!price) return;
  for (const order of targets) {
    if (order.type !== 'LIMIT') continue;
    if (order.side === 'BUY' && price <= Number(order.price)) fillOrder(order, price);
    if (order.side === 'SELL' && price >= Number(order.price)) fillOrder(order, price);
  }
  computeLockedFromOrders();
};

const createDemoOrder = async ({ symbol, side, type, quantity, price, newClientOrderId }) => {
  const upperSymbol = normalizeSymbol(symbol);
  const baseAsset = upperSymbol.replace('USDT', '');
  const quoteAsset = 'USDT';
  const qty = Number(quantity);
  const limitPrice = price ? Number(price) : null;
  const now = nowMs();
  const order = {
    symbol: upperSymbol,
    orderId: demoOrderId++,
    clientOrderId: newClientOrderId || `demo_${demoOrderId}`,
    status: 'NEW',
    price: limitPrice ? String(limitPrice) : '0',
    origQty: String(qty),
    executedQty: '0',
    cummulativeQuoteQty: '0',
    type: type,
    side: side,
    time: now,
    updateTime: now,
    baseAsset,
    quoteAsset,
  };

  if (type === 'MARKET') {
    const fillPrice = await fetchPrice(upperSymbol);
    if (!fillPrice) throw new Error('Price unavailable');
    const quote = getBalance(quoteAsset);
    const base = getBalance(baseAsset);
    const quoteQty = qty * fillPrice;
    if (side === 'BUY' && Number(quote.free) < quoteQty * (1 + FEE_RATE)) {
      throw new Error('INSUFFICIENT_BALANCE');
    }
    if (side === 'SELL' && Number(base.free) < qty) {
      throw new Error('INSUFFICIENT_BALANCE');
    }
    order.status = 'FILLED';
    demoOrders.unshift(order);
    fillOrder(order, fillPrice);
    return order;
  }

  // LIMIT orders
  const quote = getBalance(quoteAsset);
  const base = getBalance(baseAsset);
  if (side === 'BUY') {
    const cost = qty * (limitPrice || 0);
    if (Number(quote.free) < cost) throw new Error('INSUFFICIENT_BALANCE');
    quote.free = (Number(quote.free) - cost).toFixed(8);
    order.lockedQuote = cost.toFixed(8);
  } else {
    if (Number(base.free) < qty) throw new Error('INSUFFICIENT_BALANCE');
    base.free = (Number(base.free) - qty).toFixed(8);
    order.lockedBase = qty.toFixed(8);
  }
  demoOrders.unshift(order);
  computeLockedFromOrders();

  // Try immediate fill if price crosses
  await maybeFillOpenOrders(upperSymbol);
  return order;
};

const cancelDemoOrder = (symbol, orderId, clientOrderId) => {
  const upperSymbol = normalizeSymbol(symbol);
  const order = demoOrders.find(
    (o) => o.symbol === upperSymbol && (String(o.orderId) === String(orderId) || o.clientOrderId === clientOrderId)
  );
  if (!order) return null;
  if (order.status === 'NEW' || order.status === 'PARTIALLY_FILLED') {
    // release locks
    if (order.side === 'BUY' && order.lockedQuote) {
      const quote = getBalance(order.quoteAsset);
      quote.free = (Number(quote.free) + Number(order.lockedQuote)).toFixed(8);
    }
    if (order.side === 'SELL' && order.lockedBase) {
      const base = getBalance(order.baseAsset);
      base.free = (Number(base.free) + Number(order.lockedBase)).toFixed(8);
    }
    order.status = 'CANCELED';
    order.updateTime = nowMs();
    order.lockedQuote = '0';
    order.lockedBase = '0';
    computeLockedFromOrders();
  }
  return order;
};

const syncTime = async () => {
  try {
    const data = await requestBinance('/api/v3/time');
    if (data?.serverTime) {
      timeOffsetMs = data.serverTime - Date.now();
    }
  } catch {
    // ignore time sync errors and keep last offset
  }
};

// Initial time sync + periodic refresh
syncTime();
setInterval(syncTime, 30 * 60 * 1000);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    baseUrl: BASE_URL,
    demoMode: DEMO_MODE,
    timeOffsetMs,
  });
});

app.get('/api/time', async (_req, res) => {
  try {
    const data = await requestBinance('/api/v3/time');
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json(err.error || { error: 'Failed to fetch server time' });
  }
});

app.get('/api/exchange-info', async (req, res) => {
  try {
    const symbol = req.query.symbol;
    const data = await requestBinance('/api/v3/exchangeInfo', { params: symbol ? { symbol } : {} });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json(err.error || { error: 'Failed to fetch exchange info' });
  }
});

app.get('/api/account', ensureKeys, async (req, res) => {
  try {
    if (DEMO_MODE) {
      computeLockedFromOrders();
      return res.json({ balances: Array.from(demoBalances.values()) });
    }
    const data = await requestBinance('/api/v3/account', { signed: true, params: req.query });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json(err.error || { error: 'Failed to fetch account' });
  }
});

app.get('/api/open-orders', ensureKeys, async (req, res) => {
  try {
    if (DEMO_MODE) {
      const symbol = req.query.symbol ? normalizeSymbol(req.query.symbol) : null;
      await maybeFillOpenOrders(symbol || undefined);
      const open = demoOrders.filter((o) => (o.status === 'NEW' || o.status === 'PARTIALLY_FILLED') && (!symbol || o.symbol === symbol));
      return res.json(open);
    }
    const params = req.query.symbol ? { symbol: req.query.symbol } : {};
    const data = await requestBinance('/api/v3/openOrders', { signed: true, params });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json(err.error || { error: 'Failed to fetch open orders' });
  }
});

app.get('/api/all-orders', ensureKeys, async (req, res) => {
  try {
    const { symbol, limit, startTime, endTime, orderId } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'symbol is required.' });
    }
    if (DEMO_MODE) {
      const upper = normalizeSymbol(symbol);
      await maybeFillOpenOrders(upper);
      const data = demoOrders.filter((o) => o.symbol === upper);
      return res.json(data);
    }
    const params = { symbol, limit, startTime, endTime, orderId };
    const data = await requestBinance('/api/v3/allOrders', { signed: true, params });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json(err.error || { error: 'Failed to fetch order history' });
  }
});

app.get('/api/my-trades', ensureKeys, async (req, res) => {
  try {
    const { symbol, limit, startTime, endTime, fromId } = req.query;
    if (!symbol) {
      return res.status(400).json({ error: 'symbol is required.' });
    }
    if (DEMO_MODE) {
      const upper = normalizeSymbol(symbol);
      const data = demoTrades.filter((t) => t.symbol === upper);
      return res.json(data);
    }
    const params = { symbol, limit, startTime, endTime, fromId };
    const data = await requestBinance('/api/v3/myTrades', { signed: true, params });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json(err.error || { error: 'Failed to fetch trade history' });
  }
});

app.get('/api/order', ensureKeys, async (req, res) => {
  try {
    const { symbol, orderId, origClientOrderId } = req.query;
    if (!symbol || (!orderId && !origClientOrderId)) {
      return res.status(400).json({ error: 'symbol and orderId or origClientOrderId are required.' });
    }
    if (DEMO_MODE) {
      const upper = normalizeSymbol(symbol);
      const order = demoOrders.find(
        (o) => o.symbol === upper && (String(o.orderId) === String(orderId) || o.clientOrderId === origClientOrderId)
      );
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      return res.json(order);
    }
    const params = { symbol, orderId, origClientOrderId };
    const data = await requestBinance('/api/v3/order', { signed: true, params });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json(err.error || { error: 'Failed to fetch order' });
  }
});

app.post('/api/order', ensureKeys, async (req, res) => {
  try {
    const {
      symbol,
      side,
      type,
      quantity,
      price,
      timeInForce,
      newClientOrderId,
    } = req.body || {};

    if (!symbol || !side || !type || !quantity) {
      return res.status(400).json({ error: 'symbol, side, type, quantity are required.' });
    }

    const upperType = String(type).toUpperCase();
    const params = {
      symbol: String(symbol).toUpperCase(),
      side: String(side).toUpperCase(),
      type: upperType,
      quantity,
      newClientOrderId,
    };

    if (upperType === 'LIMIT') {
      if (!price) {
        return res.status(400).json({ error: 'price is required for LIMIT orders.' });
      }
      params.price = price;
      params.timeInForce = timeInForce || 'GTC';
    }

    if (DEMO_MODE) {
      const order = await createDemoOrder(params);
      return res.json(order);
    }

    const data = await requestBinance('/api/v3/order', {
      method: 'POST',
      signed: true,
      params,
    });
    res.json(data);
  } catch (err) {
    if (DEMO_MODE && err?.message) {
      const msg = err.message === 'INSUFFICIENT_BALANCE' ? 'Insufficient balance' : err.message;
      return res.status(400).json({ msg });
    }
    res.status(err.status || 500).json(err.error || { error: 'Failed to place order' });
  }
});

app.delete('/api/order', ensureKeys, async (req, res) => {
  try {
    const { symbol, orderId, origClientOrderId } = req.query;
    if (!symbol || (!orderId && !origClientOrderId)) {
      return res.status(400).json({ error: 'symbol and orderId or origClientOrderId are required.' });
    }
    if (DEMO_MODE) {
      const order = cancelDemoOrder(symbol, orderId, origClientOrderId);
      if (!order) return res.status(404).json({ error: 'Order not found.' });
      return res.json(order);
    }
    const params = { symbol, orderId, origClientOrderId };
    const data = await requestBinance('/api/v3/order', {
      method: 'DELETE',
      signed: true,
      params,
    });
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json(err.error || { error: 'Failed to cancel order' });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Live trading server listening on http://localhost:${PORT}`);
});
