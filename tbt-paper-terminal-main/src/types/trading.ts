import type { AccountType } from './wallet';

export type OrderStatus =
  | 'pending'
  | 'submitted'
  | 'open'
  | 'partial'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'expired'
  | 'triggered';

export type OrderSide = 'buy' | 'sell';
export type OrderType =
  | 'limit'
  | 'market'
  | 'stop_limit'
  | 'stop_market'
  | 'take_profit_limit'
  | 'take_profit_market'
  | 'trailing_stop';

export type TriggerDirection = 'up' | 'down';
export type TrailingType = 'percent' | 'absolute';

export interface PaperOrder {
  clientOrderId: string;
  accountType: AccountType;
  exchangeOrderId?: string;
  source?: 'paper' | 'live';
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: string | null;
  quantity: string;
  filledQty: string;
  avgPrice: string;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  fills: Fill[];
  rejectReason?: string;
  takeProfitPrice?: string;
  stopLossPrice?: string;
  triggerPrice?: string;
  triggerDirection?: TriggerDirection;
  isTriggered?: boolean;
  triggeredAt?: number;
  ocoGroupId?: string;
  ocoLinkedOrderId?: string;
  isOcoOrder?: boolean;
  trailingType?: TrailingType;
  trailingValue?: string;
  trailingActivationPrice?: string;
  trailingHighestPrice?: string;
  trailingLowestPrice?: string;
  trailingStopPrice?: string;
}

export interface Fill {
  fillId: string;
  price: string;
  quantity: string;
  fee: string;
  feeAsset: string;
  time: number;
  triggerTradeId?: string;
}

export interface Position {
  accountType: AccountType;
  symbol: string;
  side: 'long' | 'flat';
  quantity: string;
  avgEntryPrice: string;
  unrealizedPnl: string;
  realizedPnl: string;
  updatedAt: number;
  takeProfitPrice?: string;
  stopLossPrice?: string;
}

export interface AccountBalance {
  asset: string;
  free: string;
  locked: string;
  total: string;
}

export interface OCOOrder {
  ocoGroupId: string;
  accountType: AccountType;
  symbol: string;
  side: OrderSide;
  quantity: string;
  limitPrice: string;
  stopPrice: string;
  stopLimitPrice: string;
  status: 'active' | 'cancelled' | 'filled' | 'partially_filled';
  limitOrderId: string;
  stopOrderId: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateOCOParams {
  symbol: string;
  side: OrderSide;
  quantity: string;
  limitPrice: string;
  stopPrice: string;
  stopLimitPrice: string;
}

export interface CreateTrailingStopParams {
  symbol: string;
  side: OrderSide;
  quantity: string;
  trailingType: TrailingType;
  trailingValue: string;
  activationPrice?: string;
}

export interface OrderUIConstraints {
  canCancel: boolean;
  canModify: boolean;
  displayStyle: 'pending' | 'processing' | 'active' | 'success' | 'cancelled' | 'error';
}

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['submitted', 'cancelled'],
  submitted: ['open', 'rejected'],
  open: ['partial', 'filled', 'cancelled', 'triggered'],
  triggered: ['open', 'cancelled'],
  partial: ['filled', 'cancelled'],
  filled: [],
  cancelled: [],
  rejected: [],
  expired: [],
};

export const ORDER_UI_CONSTRAINTS: Record<OrderStatus, OrderUIConstraints> = {
  pending: { canCancel: true, canModify: true, displayStyle: 'pending' },
  submitted: { canCancel: false, canModify: false, displayStyle: 'processing' },
  open: { canCancel: true, canModify: false, displayStyle: 'active' },
  partial: { canCancel: true, canModify: false, displayStyle: 'active' },
  triggered: { canCancel: false, canModify: false, displayStyle: 'processing' },
  filled: { canCancel: false, canModify: false, displayStyle: 'success' },
  cancelled: { canCancel: false, canModify: false, displayStyle: 'cancelled' },
  rejected: { canCancel: false, canModify: false, displayStyle: 'error' },
  expired: { canCancel: false, canModify: false, displayStyle: 'cancelled' },
};
