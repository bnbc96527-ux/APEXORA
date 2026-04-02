import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import type { UserRole } from './authStore';
import type { ChainType } from '../types/wallet';

export type TmsAccountStatus = 'active' | 'disabled' | 'inactive' | 'locked';
export type KycStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected' | 'needs_reupload';

export interface TmsUser {
  id: string;
  role: UserRole;
  status: TmsAccountStatus;
  username: string;
  email: string;
  createdAt: number;
  lastLoginAt?: number;
  invitedBy?: { role: 'admin' | 'user'; id: string };
  kycStatus: KycStatus;
  fullName?: string;
  phone?: string;
  address?: string;
  commissionWalletAddress?: string;
  commissionWalletChain?: ChainType;
  adminSetupDeadlineAt?: number;
  adminSetupCompletedAt?: number;
  adminCredentialsIssuedAt?: number;
  adminCredentialsResentAt?: number;
  adminVerificationCodeHash?: string | null;
  adminVerificationExpiresAt?: number | null;
  adminVerifiedAt?: number | null;
}

export interface TmsWalletSnapshot {
  balanceUSDT: string;
  totalDepositsUSDT: string;
  totalWithdrawalsUSDT: string;
  tradingPnlUSDT: string;
  referralEarningsUSDT: string;
}

export type MessageKind =
  | 'manual'
  | 'deposit_pending'
  | 'deposit_confirmed'
  | 'withdraw_pending'
  | 'withdraw_approved'
  | 'withdraw_rejected'
  | 'withdraw_completed'
  | 'kyc_pending'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'kyc_reupload'
  | 'referral_payout'
  | 'trade_opened'
  | 'trade_closed'
  | 'system';

export interface TmsMessage {
  messageId: string;
  kind: MessageKind;
  toUserId: string | null; // null = broadcast
  title: string;
  body: string;
  createdAt: number;
  createdBy: string;
  createdByRole: UserRole;
}

export type DepositStatus = 'pending' | 'approved' | 'failed';
export interface TmsDeposit {
  depositId: string;
  userId: string;
  amountUSDT: string;
  status: DepositStatus;
  createdAt: number;
  approvedAt?: number;
  confirmedAt?: number;
  note?: string;
}

export type WithdrawStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export interface TmsWithdraw {
  withdrawId: string;
  userId: string;
  amountUSDT: string;
  feeUSDT: string;
  status: WithdrawStatus;
  createdAt: number;
  decidedAt?: number;
  decidedBy?: string;
  completedAt?: number;
  note?: string;
}

export type TradeSide = 'long' | 'short';
export type TradeStatus = 'open' | 'closed';

export interface TmsTrade {
  tradeId: string;
  userId: string;
  symbol: string;
  side: TradeSide;
  status: TradeStatus;
  quantity: string;
  entryPrice: string;
  openedAt: number;
  createdBy: string;
  createdByRole: UserRole;
  exitPrice?: string;
  pnlUSDT?: string;
  closedAt?: number;
  closedBy?: string;
  closedByRole?: UserRole;
  note?: string;
}

export type SignalDirection = 'long' | 'short';
export type SignalStatus = 'active' | 'archived';

export interface TmsSignal {
  signalId: string;
  status: SignalStatus;
  symbol: string;
  direction: SignalDirection;
  timeframe?: string;
  entry?: string;
  takeProfit?: string;
  stopLoss?: string;
  createdAt: number;
  createdBy: string;
  createdByRole: UserRole;
  note?: string;
}

export interface KycRequest {
  requestId: string;
  userId: string;
  status: Exclude<KycStatus, 'not_submitted'>;
  submittedAt: number;
  decidedAt?: number;
  decidedBy?: string;
  rejectionReason?: string;
  files: {
    idDocument: string;
    selfieWithId: string;
    proofOfAddress?: string;
  };
}

export type SystemPaymentMethodType = 'bank' | 'crypto' | 'gateway';

export interface BankPaymentMethod {
  id: string;
  type: 'bank';
  enabled: boolean;
  label: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  swiftCode?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CryptoPaymentMethod {
  id: string;
  type: 'crypto';
  enabled: boolean;
  label: string;
  chain: ChainType;
  address: string;
  createdAt: number;
  updatedAt: number;
}

export interface GatewayPaymentMethod {
  id: string;
  type: 'gateway';
  enabled: boolean;
  label: string;
  provider: string;
  publicKey: string;
  createdAt: number;
  updatedAt: number;
}

export type SystemPaymentMethod = BankPaymentMethod | CryptoPaymentMethod | GatewayPaymentMethod;

export interface ReferralPayout {
  payoutId: string;
  invitedUserId: string;
  depositId: string;
  referrerId: string;
  referrerRole: 'admin' | 'user';
  rate: number;
  amountUSDT: string;
  createdAt: number;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorRole: UserRole;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: number;
  detail?: string;
}

export interface TmsSettings {
  adminFirstDepositRate: number; // 0.40
  userFirstDepositRate: number;  // 0.05
  kycRequired: boolean;
}

const clampRate = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

const fmtUSDT = (value: string): string => {
  try {
    const n = new Decimal(value || 0);
    if (!n.isFinite()) return `${value} USDT`;
    return `${n.toFixed(2)} USDT`;
  } catch {
    return `${value} USDT`;
  }
};

const add = (a: string, b: string) => new Decimal(a || 0).plus(b || 0).toFixed(8);
const sub = (a: string, b: string) => new Decimal(a || 0).minus(b || 0).toFixed(8);

const ADMIN_SETUP_WINDOW_MS = 24 * 60 * 60 * 1000;

const normalizeWalletAddress = (value: string) => String(value || '').trim();

const isValidWalletAddress = (address: string, chain?: ChainType): boolean => {
  const clean = normalizeWalletAddress(address);
  if (!clean) return false;
  if (chain === 'TRC20') return /^T[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(clean);
  if (chain === 'ERC20' || chain === 'BEP20') return /^0x[a-fA-F0-9]{40}$/.test(clean);
  return /^[A-Za-z0-9]{26,80}$/.test(clean);
};

const makeTempPassword = (length = 12): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
};

function createDemoState(now = Date.now()): Pick<
  TmsState,
  'users'
  | 'walletsByUserId'
  | 'messages'
  | 'deposits'
  | 'withdraws'
  | 'trades'
  | 'signals'
  | 'kycRequests'
  | 'paymentMethods'
  | 'referralPayouts'
  | 'auditLog'
  | 'commissionPoolUSDT'
  | 'settings'
> {
  const bossId = 'boss-0001';
  const adminId = 'admin-0001';

  const u1 = 'user-0001';
  const u2 = 'user-0002';
  const u3 = 'user-0003';

  const users: TmsUser[] = [
    { id: bossId, role: 'boss', status: 'active', username: 'boss', email: 'boss@apexora.local', createdAt: now - 1000 * 60 * 60 * 24 * 60, kycStatus: 'approved', lastLoginAt: now - 1000 * 60 * 12, fullName: 'Boss Apexora' },
    {
      id: adminId,
      role: 'admin',
      status: 'active',
      username: 'admin',
      email: 'admin@goail.com',
      createdAt: now - 1000 * 60 * 60 * 24 * 45,
      kycStatus: 'approved',
      lastLoginAt: now - 1000 * 60 * 55,
      fullName: 'Admin Apexora',
      phone: '+1 555-0142',
      address: '100 Market Street, New York, NY',
      commissionWalletAddress: 'TQ1demoWalletAddress0001',
      commissionWalletChain: 'TRC20',
      adminSetupCompletedAt: now - 1000 * 60 * 60 * 24 * 44,
      adminVerifiedAt: now - 1000 * 60 * 60 * 24 * 44,
    },
    { id: u1, role: 'user', status: 'active', username: 'alice', email: 'alice@paper.trading', createdAt: now - 1000 * 60 * 60 * 24 * 20, invitedBy: { role: 'admin', id: adminId }, kycStatus: 'pending', lastLoginAt: now - 1000 * 60 * 60 * 6 },
    { id: u2, role: 'user', status: 'active', username: 'bob', email: 'bob@paper.trading', createdAt: now - 1000 * 60 * 60 * 24 * 15, invitedBy: { role: 'user', id: u1 }, kycStatus: 'approved', lastLoginAt: now - 1000 * 60 * 60 * 2 },
    { id: u3, role: 'user', status: 'disabled', username: 'carol', email: 'carol@paper.trading', createdAt: now - 1000 * 60 * 60 * 24 * 10, invitedBy: { role: 'admin', id: adminId }, kycStatus: 'rejected' },
  ];

  const walletsByUserId: Record<string, TmsWalletSnapshot> = {
    [bossId]: { balanceUSDT: '0', totalDepositsUSDT: '0', totalWithdrawalsUSDT: '0', tradingPnlUSDT: '0', referralEarningsUSDT: '0' },
    [adminId]: { balanceUSDT: '400.00000000', totalDepositsUSDT: '0', totalWithdrawalsUSDT: '0', tradingPnlUSDT: '0', referralEarningsUSDT: '400.00000000' },
    [u1]: { balanceUSDT: '1145.00000000', totalDepositsUSDT: '1000.00000000', totalWithdrawalsUSDT: '0', tradingPnlUSDT: '120.00000000', referralEarningsUSDT: '25.00000000' },
    [u2]: { balanceUSDT: '480.00000000', totalDepositsUSDT: '500.00000000', totalWithdrawalsUSDT: '0', tradingPnlUSDT: '-20.00000000', referralEarningsUSDT: '0' },
    [u3]: { balanceUSDT: '0', totalDepositsUSDT: '0', totalWithdrawalsUSDT: '0', tradingPnlUSDT: '0', referralEarningsUSDT: '0' },
  };

  const deposits: TmsDeposit[] = [
    { depositId: 'dep_demo_1', userId: u1, amountUSDT: '1000.00000000', status: 'approved', createdAt: now - 1000 * 60 * 60 * 24 * 7, approvedAt: now - 1000 * 60 * 60 * 24 * 7 + 1000 * 40, confirmedAt: now - 1000 * 60 * 60 * 24 * 7 + 1000 * 40 },
    { depositId: 'dep_demo_2', userId: u2, amountUSDT: '500.00000000', status: 'approved', createdAt: now - 1000 * 60 * 60 * 24 * 3, approvedAt: now - 1000 * 60 * 60 * 24 * 3 + 1000 * 55, confirmedAt: now - 1000 * 60 * 60 * 24 * 3 + 1000 * 55 },
    { depositId: 'dep_demo_3', userId: u1, amountUSDT: '250.00000000', status: 'pending', createdAt: now - 1000 * 60 * 60 * 2 },
  ];

  const withdraws: TmsWithdraw[] = [
    { withdrawId: 'wd_demo_1', userId: u1, amountUSDT: '200.00000000', feeUSDT: '1.00000000', status: 'pending', createdAt: now - 1000 * 60 * 30 },
  ];

  const messages: TmsMessage[] = [
    {
      messageId: 'msg_demo_1',
      kind: 'deposit_confirmed',
      toUserId: u1,
      title: 'Deposit Confirmed',
      body: 'Your deposit of 1000.00 USDT has been confirmed. Reference: dep_demo_1.',
      createdAt: now - 1000 * 60 * 60 * 24 * 7 + 1000 * 40,
      createdBy: adminId,
      createdByRole: 'admin',
    },
    {
      messageId: 'msg_demo_2',
      kind: 'referral_payout',
      toUserId: adminId,
      title: 'Referral Commission Paid',
      body: 'Commission 400.00 USDT paid for invited user alice (dep_demo_1).',
      createdAt: now - 1000 * 60 * 60 * 24 * 7 + 1000 * 55,
      createdBy: bossId,
      createdByRole: 'boss',
    },
    {
      messageId: 'msg_demo_3',
      kind: 'system',
      toUserId: null,
      title: 'System Maintenance',
      body: 'Demo: management console data can be reset from Dashboard (Boss only).',
      createdAt: now - 1000 * 60 * 15,
      createdBy: bossId,
      createdByRole: 'boss',
    },
  ];

  const trades: TmsTrade[] = [
    {
      tradeId: 'trade_demo_1',
      userId: u1,
      symbol: 'BTCUSDT',
      side: 'long',
      status: 'closed',
      quantity: '0.02000000',
      entryPrice: '40000.00000000',
      openedAt: now - 1000 * 60 * 60 * 24 * 9,
      createdBy: adminId,
      createdByRole: 'admin',
      exitPrice: '46000.00000000',
      pnlUSDT: '120.00000000',
      closedAt: now - 1000 * 60 * 60 * 24 * 8,
      closedBy: adminId,
      closedByRole: 'admin',
      note: 'Demo manual trade',
    },
    {
      tradeId: 'trade_demo_2',
      userId: u2,
      symbol: 'ETHUSDT',
      side: 'long',
      status: 'closed',
      quantity: '0.20000000',
      entryPrice: '2000.00000000',
      openedAt: now - 1000 * 60 * 60 * 24 * 6,
      createdBy: adminId,
      createdByRole: 'admin',
      exitPrice: '1900.00000000',
      pnlUSDT: '-20.00000000',
      closedAt: now - 1000 * 60 * 60 * 24 * 5,
      closedBy: adminId,
      closedByRole: 'admin',
      note: 'Demo manual trade',
    },
    {
      tradeId: 'trade_demo_3',
      userId: u1,
      symbol: 'SOLUSDT',
      side: 'long',
      status: 'open',
      quantity: '10.00000000',
      entryPrice: '100.00000000',
      openedAt: now - 1000 * 60 * 60 * 5,
      createdBy: adminId,
      createdByRole: 'admin',
      note: 'Open demo position',
    },
  ];

  const signals: TmsSignal[] = [
    {
      signalId: 'sig_demo_1',
      status: 'active',
      symbol: 'BTCUSDT',
      direction: 'long',
      timeframe: 'H1',
      entry: '65000',
      takeProfit: '67500',
      stopLoss: '63500',
      createdAt: now - 1000 * 60 * 60 * 3,
      createdBy: adminId,
      createdByRole: 'admin',
      note: 'Demo signal',
    },
  ];

  const kycRequests: KycRequest[] = [
    {
      requestId: 'kyc_demo_1',
      userId: u1,
      status: 'pending',
      submittedAt: now - 1000 * 60 * 60 * 6,
      files: { idDocument: 'id_card_alice.jpg', selfieWithId: 'selfie_alice.jpg' },
    },
  ];

  const paymentMethods: SystemPaymentMethod[] = [
    {
      id: 'pm_bank_1',
      type: 'bank',
      enabled: true,
      label: 'Primary Bank',
      bankName: 'Example Bank',
      accountName: 'Apexora LLC',
      accountNumber: '****1234',
      swiftCode: 'EXAMPLEX1',
      createdAt: now - 1000 * 60 * 60 * 24 * 30,
      updatedAt: now - 1000 * 60 * 60 * 24 * 2,
    },
    {
      id: 'pm_crypto_1',
      type: 'crypto',
      enabled: true,
      label: 'USDT (TRC20)',
      chain: 'TRC20',
      address: 'TNwQp...demo...Address',
      createdAt: now - 1000 * 60 * 60 * 24 * 14,
      updatedAt: now - 1000 * 60 * 60 * 24 * 1,
    },
  ];

  const referralPayouts: ReferralPayout[] = [
    {
      payoutId: 'payout_demo_1',
      invitedUserId: u1,
      depositId: 'dep_demo_1',
      referrerId: adminId,
      referrerRole: 'admin',
      rate: 0.4,
      amountUSDT: '400.00000000',
      createdAt: now - 1000 * 60 * 60 * 24 * 7 + 1000 * 50,
    },
    {
      payoutId: 'payout_demo_2',
      invitedUserId: u2,
      depositId: 'dep_demo_2',
      referrerId: u1,
      referrerRole: 'user',
      rate: 0.05,
      amountUSDT: '25.00000000',
      createdAt: now - 1000 * 60 * 60 * 24 * 3 + 1000 * 80,
    },
  ];

  const auditLog: AuditLogEntry[] = [
    {
      id: 'audit_demo_1',
      actorId: bossId,
      actorRole: 'boss',
      action: 'seed_demo_state',
      targetType: 'system',
      targetId: 'tms',
      createdAt: now - 1000 * 60 * 5,
    },
  ];

  return {
    users,
    walletsByUserId,
    messages,
    deposits,
    withdraws,
    kycRequests,
    paymentMethods,
    referralPayouts,
    auditLog,
    commissionPoolUSDT: '9575.00000000',
    settings: { adminFirstDepositRate: 0.4, userFirstDepositRate: 0.05, kycRequired: true },
    trades,
    signals,
  };
}

interface TmsState {
  users: TmsUser[];
  walletsByUserId: Record<string, TmsWalletSnapshot>;
  messages: TmsMessage[];
  deposits: TmsDeposit[];
  withdraws: TmsWithdraw[];
  trades: TmsTrade[];
  signals: TmsSignal[];
  kycRequests: KycRequest[];
  paymentMethods: SystemPaymentMethod[];
  referralPayouts: ReferralPayout[];
  auditLog: AuditLogEntry[];
  commissionPoolUSDT: string;
  settings: TmsSettings;

  // Actions
  ensureUserWallet: (userId: string) => void;
  upsertUserFromAuth: (params: { userId: string; role: UserRole; username: string; email: string }) => TmsUser;
  createUser: (params: { username: string; email: string; role: UserRole; invitedBy?: TmsUser['invitedBy'] }, actor: { id: string; role: UserRole }) => TmsUser | null;
  createAdminAccount: (
    params: {
      username: string;
      email: string;
      fullName: string;
      phone?: string;
      address?: string;
      commissionWalletAddress?: string;
      commissionWalletChain?: ChainType;
      invitedBy?: TmsUser['invitedBy'];
    },
    actor: { id: string; role: UserRole }
  ) => { user: TmsUser; tempPassword: string } | null;
  updateUserProfile: (
    userId: string,
    patch: { username?: string; email?: string },
    actor: { id: string; role: UserRole }
  ) => TmsUser | null;
  updateAdminProfile: (
    userId: string,
    patch: { fullName?: string; phone?: string; address?: string },
    actor: { id: string; role: UserRole }
  ) => TmsUser | null;
  updateAdminWallet: (
    userId: string,
    patch: { commissionWalletAddress?: string; commissionWalletChain?: ChainType },
    actor: { id: string; role: UserRole }
  ) => TmsUser | null;
  issueAdminVerificationCode: (userId: string, actor: { id: string; role: UserRole }) => string | null;
  confirmAdminVerificationCode: (userId: string, code: string, actor: { id: string; role: UserRole }) => boolean;
  activateAdminAccount: (userId: string, actor: { id: string; role: UserRole }) => TmsUser | null;
  lockExpiredAdminAccounts: () => number;
  setUserStatus: (userId: string, status: TmsAccountStatus, actor: { id: string; role: UserRole }) => void;
  recordUserLogin: (userId: string, role: UserRole) => void;

  addMessage: (message: Omit<TmsMessage, 'messageId' | 'createdAt'>) => TmsMessage;
  sendMessage: (
    params: { toUserId?: string | null; title: string; body: string; kind?: MessageKind },
    actor: { id: string; role: UserRole }
  ) => TmsMessage | null;

  createDeposit: (userId: string, amountUSDT: string, actor: { id: string; role: UserRole }, note?: string) => TmsDeposit;
  confirmDeposit: (depositId: string, actor: { id: string; role: UserRole }) => void;

  createWithdraw: (userId: string, amountUSDT: string, feeUSDT: string, actor: { id: string; role: UserRole }, note?: string) => TmsWithdraw;
  decideWithdraw: (withdrawId: string, decision: 'approve' | 'reject', actor: { id: string; role: UserRole }, note?: string) => void;
  completeWithdraw: (withdrawId: string, actor: { id: string; role: UserRole }) => void;

  createSignal: (
    params: Omit<TmsSignal, 'signalId' | 'status' | 'createdAt' | 'createdBy' | 'createdByRole'>,
    actor: { id: string; role: UserRole }
  ) => TmsSignal | null;
  archiveSignal: (signalId: string, actor: { id: string; role: UserRole }) => void;

  createTrade: (
    userId: string,
    params: { symbol: string; side: TradeSide; quantity: string; entryPrice: string },
    actor: { id: string; role: UserRole },
    note?: string
  ) => TmsTrade | null;
  closeTrade: (tradeId: string, exitPrice: string, actor: { id: string; role: UserRole }, note?: string) => void;

  decideKyc: (requestId: string, decision: 'approve' | 'reject' | 'reupload', actor: { id: string; role: UserRole }, reason?: string) => void;

  addPaymentMethod: (method: Omit<SystemPaymentMethod, 'id' | 'createdAt' | 'updatedAt'>, actor: { id: string; role: UserRole }) => SystemPaymentMethod | null;
  updatePaymentMethod: (id: string, patch: Partial<SystemPaymentMethod>, actor: { id: string; role: UserRole }) => void;
  removePaymentMethod: (id: string, actor: { id: string; role: UserRole }) => void;

  updateSettings: (patch: Partial<TmsSettings>, actor: { id: string; role: UserRole }) => void;
  topUpCommissionPool: (amountUSDT: string, actor: { id: string; role: UserRole }, note?: string) => void;

  addAudit: (entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) => void;
  resetDemo: () => void;
}

const STORAGE_KEY = 'tms-storage-v1';

export const useTmsStore = create<TmsState>()(
  persist(
    (set, get) => ({
      ...createDemoState(),

      ensureUserWallet: (userId) => {
        const state = get();
        if (state.walletsByUserId[userId]) return;
        set((s) => ({
          walletsByUserId: {
            ...s.walletsByUserId,
            [userId]: {
              balanceUSDT: '0',
              totalDepositsUSDT: '0',
              totalWithdrawalsUSDT: '0',
              tradingPnlUSDT: '0',
              referralEarningsUSDT: '0',
            },
          },
        }));
      },

      upsertUserFromAuth: ({ userId, role, username, email }) => {
        const state = get();
        const existing = state.users.find((u) => u.id === userId);
        if (existing) {
          const nextUsername = String(username || existing.username).trim() || existing.username;
          const nextEmail = String(email || existing.email).trim() || existing.email;
          if (existing.username === nextUsername && existing.email === nextEmail) return existing;

          const updated = { ...existing, username: nextUsername, email: nextEmail };
          set((s) => ({
            users: s.users.map((u) => (u.id === userId ? updated : u)),
          }));
          return updated;
        }

        const now = Date.now();
        const created: TmsUser = {
          id: userId,
          role,
          status: 'active',
          username: String(username || '').trim() || userId,
          email: String(email || '').trim() || `${userId}@paper.trading`,
          createdAt: now,
        kycStatus: role === 'user' ? 'not_submitted' : 'approved',
          fullName: role === 'admin' ? undefined : undefined,
          adminSetupDeadlineAt: role === 'admin' ? now + 24 * 60 * 60 * 1000 : undefined,
          adminCredentialsIssuedAt: role === 'admin' ? now : undefined,
          adminVerificationCodeHash: role === 'admin' ? null : undefined,
          adminVerificationExpiresAt: role === 'admin' ? null : undefined,
          adminVerifiedAt: role === 'admin' ? null : undefined,
      };

        set((s) => ({ users: [created, ...s.users] }));
        get().ensureUserWallet(created.id);
        get().addAudit({
          actorId: created.id,
          actorRole: created.role,
          action: 'upsert_user_from_auth',
          targetType: 'user',
          targetId: created.id,
          detail: `${created.role}:${created.username}`,
        });
        return created;
      },

      addAudit: (entry) => {
        const item: AuditLogEntry = {
          id: `audit_${uuidv4().slice(0, 8)}`,
          createdAt: Date.now(),
          ...entry,
        };
        set((s) => ({ auditLog: [item, ...s.auditLog].slice(0, 500) }));
      },

      recordUserLogin: (userId, role) => {
        const now = Date.now();
        set((s) => ({
          users: s.users.map((u) => (u.id === userId ? { ...u, lastLoginAt: now } : u)),
        }));
        get().addAudit({
          actorId: userId,
          actorRole: role,
          action: 'login',
          targetType: 'user',
          targetId: userId,
        });
      },

      addMessage: (message) => {
        const item: TmsMessage = {
          messageId: `msg_${uuidv4().slice(0, 8)}`,
          createdAt: Date.now(),
          ...message,
        };
        set((s) => ({ messages: [item, ...s.messages].slice(0, 1000) }));
        return item;
      },

      sendMessage: (params, actor) => {
        if (actor.role !== 'boss' && actor.role !== 'admin') return null;
        const title = String(params.title || '').trim();
        const body = String(params.body || '').trim();
        if (!title || !body) return null;

        const msg = get().addMessage({
          kind: params.kind ?? 'manual',
          toUserId: params.toUserId ?? null,
          title,
          body,
          createdBy: actor.id,
          createdByRole: actor.role,
        });

        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'send_message',
          targetType: 'message',
          targetId: msg.messageId,
          detail: msg.toUserId ? `to:${msg.toUserId}` : 'broadcast',
        });
        return msg;
      },

      createUser: (params, actor) => {
        if (params.role !== 'user' && actor.role !== 'boss') {
          get().addAudit({
            actorId: actor.id,
            actorRole: actor.role,
            action: 'unauthorized_create_user',
            targetType: 'user',
            targetId: params.role,
            detail: `${params.role}:${params.username}`,
          });
          return null;
        }

        const state = get();
        const usernameKey = String(params.username || '').trim().toLowerCase();
        const emailKey = String(params.email || '').trim().toLowerCase();
        const conflict = state.users.some(
          (u) => u.username.toLowerCase() === usernameKey || u.email.toLowerCase() === emailKey
        );
        if (conflict) {
          get().addAudit({
            actorId: actor.id,
            actorRole: actor.role,
            action: 'create_user_conflict',
            targetType: 'user',
            targetId: `${params.role}:${params.username}`,
            detail: `${params.username}:${params.email}`,
          });
          return null;
        }

        const now = Date.now();
        const user: TmsUser = {
          id: `${params.role}_${uuidv4().slice(0, 8)}`,
          role: params.role,
          status: params.role === 'admin' ? 'inactive' : 'active',
          username: params.username,
          email: params.email,
          createdAt: now,
          invitedBy: params.invitedBy,
          kycStatus: params.role === 'user' ? 'not_submitted' : 'approved',
          adminSetupDeadlineAt: params.role === 'admin' ? now + ADMIN_SETUP_WINDOW_MS : undefined,
          adminCredentialsIssuedAt: params.role === 'admin' ? now : undefined,
          adminVerificationCodeHash: params.role === 'admin' ? null : undefined,
          adminVerificationExpiresAt: params.role === 'admin' ? null : undefined,
          adminVerifiedAt: params.role === 'admin' ? null : undefined,
        };

        set((s) => ({ users: [user, ...s.users] }));
        get().ensureUserWallet(user.id);
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'create_user',
          targetType: 'user',
          targetId: user.id,
          detail: `${user.role}:${user.username}`,
        });
        return user;
      },

      createAdminAccount: (params, actor) => {
        if (actor.role !== 'boss') {
          get().addAudit({
            actorId: actor.id,
            actorRole: actor.role,
            action: 'unauthorized_create_admin',
            targetType: 'user',
            targetId: params.email,
          });
          return null;
        }

        const state = get();
        const username = String(params.username || '').trim();
        const email = String(params.email || '').trim().toLowerCase();
        const fullName = String(params.fullName || '').trim();
        if (!username || !email || !fullName) return null;
        if (state.users.some((u) => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email)) {
          return null;
        }

        const now = Date.now();
        const tempPassword = makeTempPassword();
        const user: TmsUser = {
          id: `admin_${uuidv4().slice(0, 8)}`,
          role: 'admin',
          status: 'inactive',
          username,
          email,
          createdAt: now,
          invitedBy: params.invitedBy,
          kycStatus: 'approved',
          fullName,
          phone: params.phone?.trim() || undefined,
          address: params.address?.trim() || undefined,
          commissionWalletAddress: params.commissionWalletAddress?.trim() || undefined,
          commissionWalletChain: params.commissionWalletChain || 'TRC20',
          adminSetupDeadlineAt: now + ADMIN_SETUP_WINDOW_MS,
          adminCredentialsIssuedAt: now,
          adminVerificationCodeHash: null,
          adminVerificationExpiresAt: null,
          adminVerifiedAt: null,
        };

        set((s) => ({ users: [user, ...s.users] }));
        get().ensureUserWallet(user.id);
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'create_admin_account',
          targetType: 'user',
          targetId: user.id,
          detail: `${user.username}:${user.email}`,
        });
        return { user, tempPassword };
      },

      updateUserProfile: (userId, patch, actor) => {
        const state = get();
        const target = state.users.find((u) => u.id === userId);
        if (!target) return null;

        const canEdit =
          actor.role === 'boss' ? target.role !== 'boss' : actor.role === 'admin' ? target.role === 'user' : false;

        if (!canEdit) {
          get().addAudit({
            actorId: actor.id,
            actorRole: actor.role,
            action: 'unauthorized_update_user_profile',
            targetType: 'user',
            targetId: userId,
          });
          return null;
        }

        const nextUsername = patch.username !== undefined ? String(patch.username).trim() : target.username;
        const nextEmail = patch.email !== undefined ? String(patch.email).trim() : target.email;
        if (!nextUsername || !nextEmail) return null;

        const duplicateUsername = state.users.some(
          (u) => u.id !== userId && u.username.toLowerCase() === nextUsername.toLowerCase()
        );
        const duplicateEmail = state.users.some((u) => u.id !== userId && u.email.toLowerCase() === nextEmail.toLowerCase());
        if (duplicateUsername || duplicateEmail) return null;

        const updated: TmsUser = { ...target, username: nextUsername, email: nextEmail };
        set((s) => ({ users: s.users.map((u) => (u.id === userId ? updated : u)) }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'update_user_profile',
          targetType: 'user',
          targetId: userId,
          detail: `${nextUsername}:${nextEmail}`,
        });
        return updated;
      },

      updateAdminProfile: (userId, patch, actor) => {
        const state = get();
        const target = state.users.find((u) => u.id === userId);
        if (!target || target.role !== 'admin') return null;
        if (!(actor.role === 'boss' || actor.id === userId)) return null;
        const next = {
          ...target,
          fullName: patch.fullName !== undefined ? String(patch.fullName).trim() : target.fullName,
          phone: patch.phone !== undefined ? String(patch.phone).trim() : target.phone,
          address: patch.address !== undefined ? String(patch.address).trim() : target.address,
        };
        set((s) => ({ users: s.users.map((u) => (u.id === userId ? next : u)) }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'update_admin_profile',
          targetType: 'user',
          targetId: userId,
        });
        return next;
      },

      updateAdminWallet: (userId, patch, actor) => {
        const state = get();
        const target = state.users.find((u) => u.id === userId);
        if (!target || target.role !== 'admin') return null;
        if (!(actor.role === 'boss' || actor.id === userId)) return null;
        const nextAddress = patch.commissionWalletAddress !== undefined ? normalizeWalletAddress(patch.commissionWalletAddress) : target.commissionWalletAddress || '';
        const nextChain = patch.commissionWalletChain || target.commissionWalletChain || 'TRC20';
        if (!isValidWalletAddress(nextAddress, nextChain)) return null;
        const next = {
          ...target,
          commissionWalletAddress: nextAddress,
          commissionWalletChain: nextChain,
        };
        set((s) => ({ users: s.users.map((u) => (u.id === userId ? next : u)) }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'update_admin_wallet',
          targetType: 'user',
          targetId: userId,
          detail: `${nextChain}:${nextAddress}`,
        });
        return next;
      },

      issueAdminVerificationCode: (userId, actor) => {
        const state = get();
        const target = state.users.find((u) => u.id === userId);
        if (!target || target.role !== 'admin') return null;
        if (!(actor.role === 'boss' || actor.id === userId)) return null;
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const next = {
          ...target,
          adminVerificationCodeHash: hashLocal(code),
          adminVerificationExpiresAt: Date.now() + 15 * 60 * 1000,
        };
        set((s) => ({ users: s.users.map((u) => (u.id === userId ? next : u)) }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'issue_admin_verification_code',
          targetType: 'user',
          targetId: userId,
        });
        return code;
      },

      confirmAdminVerificationCode: (userId, code, actor) => {
        const state = get();
        const target = state.users.find((u) => u.id === userId);
        if (!target || target.role !== 'admin') return false;
        if (!(actor.role === 'boss' || actor.id === userId)) return false;
        const clean = String(code || '').replace(/\D/g, '').slice(0, 6);
        if (!clean || target.adminVerificationCodeHash !== hashLocal(clean)) return false;
        if (target.adminVerificationExpiresAt && target.adminVerificationExpiresAt < Date.now()) return false;
        const next = {
          ...target,
          adminVerifiedAt: Date.now(),
          adminVerificationCodeHash: null,
          adminVerificationExpiresAt: null,
        };
        set((s) => ({ users: s.users.map((u) => (u.id === userId ? next : u)) }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'confirm_admin_verification',
          targetType: 'user',
          targetId: userId,
        });
        return true;
      },

      activateAdminAccount: (userId, actor) => {
        const state = get();
        const target = state.users.find((u) => u.id === userId);
        if (!target || target.role !== 'admin') return null;
        if (!(actor.role === 'boss' || actor.id === userId)) return null;
        if (!target.fullName || !target.phone || !target.address || !target.commissionWalletAddress) return null;
        if (!target.adminVerifiedAt) return null;
        if (target.adminSetupDeadlineAt && target.adminSetupDeadlineAt < Date.now()) {
          const locked = { ...target, status: 'locked' as const };
          set((s) => ({ users: s.users.map((u) => (u.id === userId ? locked : u)) }));
          return null;
        }
        const next = {
          ...target,
          status: 'active' as const,
          adminSetupCompletedAt: Date.now(),
        };
        set((s) => ({ users: s.users.map((u) => (u.id === userId ? next : u)) }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'activate_admin_account',
          targetType: 'user',
          targetId: userId,
        });
        return next;
      },

      lockExpiredAdminAccounts: () => {
        const now = Date.now();
        let lockedCount = 0;
        set((state) => ({
          users: state.users.map((user) => {
            if (user.role !== 'admin' || user.status !== 'inactive' || !user.adminSetupDeadlineAt || user.adminSetupDeadlineAt > now) {
              return user;
            }
            lockedCount += 1;
            return { ...user, status: 'locked' as const };
          }),
        }));
        return lockedCount;
      },

      setUserStatus: (userId, status, actor) => {
        const state = get();
        const target = state.users.find((u) => u.id === userId);
        if (!target) return;

        const canChange =
          actor.role === 'boss' ? target.role !== 'boss' : actor.role === 'admin' ? target.role === 'user' : false;

        if (!canChange) {
          get().addAudit({
            actorId: actor.id,
            actorRole: actor.role,
            action: 'unauthorized_set_user_status',
            targetType: 'user',
            targetId: userId,
            detail: `${target.role}:${status}`,
          });
          return;
        }

        set((s) => ({
          users: s.users.map((u) => (u.id === userId ? { ...u, status } : u)),
        }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: status === 'disabled' ? 'disable_user' : 'enable_user',
          targetType: 'user',
          targetId: userId,
        });
      },

      createDeposit: (userId, amountUSDT, actor, note) => {
        get().ensureUserWallet(userId);
        const deposit: TmsDeposit = {
          depositId: `dep_${uuidv4().slice(0, 8)}`,
          userId,
          amountUSDT: new Decimal(amountUSDT || 0).toFixed(8),
          status: 'pending',
          createdAt: Date.now(),
          note,
        };
        set((s) => ({ deposits: [deposit, ...s.deposits] }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'create_deposit',
          targetType: 'deposit',
          targetId: deposit.depositId,
          detail: `${userId}:${deposit.amountUSDT}`,
        });
        get().addMessage({
          kind: 'deposit_pending',
          toUserId: userId,
          title: 'Deposit Pending',
          body: `A deposit request of ${fmtUSDT(deposit.amountUSDT)} is pending confirmation. Reference: ${deposit.depositId}.`,
          createdBy: actor.id,
          createdByRole: actor.role,
        });
        return deposit;
      },

      confirmDeposit: (depositId, actor) => {
        if (actor.role !== 'boss' && actor.role !== 'admin') return;
        const state = get();
        const deposit = state.deposits.find((d) => d.depositId === depositId);
        if (!deposit || deposit.status !== 'pending') return;

        const now = Date.now();
        const user = state.users.find((u) => u.id === deposit.userId);
        if (!user) return;

        // Approve deposit and credit the wallet only here
        set((s) => ({
          deposits: s.deposits.map((d) => (d.depositId === depositId ? { ...d, status: 'approved', approvedAt: now, confirmedAt: now } : d)),
          walletsByUserId: {
            ...s.walletsByUserId,
            [deposit.userId]: {
              ...(s.walletsByUserId[deposit.userId] || {
                balanceUSDT: '0',
                totalDepositsUSDT: '0',
                totalWithdrawalsUSDT: '0',
                tradingPnlUSDT: '0',
                referralEarningsUSDT: '0',
              }),
              balanceUSDT: add((s.walletsByUserId[deposit.userId]?.balanceUSDT || '0'), deposit.amountUSDT),
              totalDepositsUSDT: add((s.walletsByUserId[deposit.userId]?.totalDepositsUSDT || '0'), deposit.amountUSDT),
            },
          },
        }));

        // Pay referral commission exactly once on first approved deposit
        const alreadyPaid = state.referralPayouts.some((p) => p.invitedUserId === deposit.userId);
        const approvedDeposits = state.deposits
          .filter((d) => d.userId === deposit.userId && d.status === 'approved')
          .length;
        const isFirstConfirmedDeposit = approvedDeposits === 0; // state doesn't include this deposit as approved yet

        if (!alreadyPaid && isFirstConfirmedDeposit && user.invitedBy) {
          const refRole = user.invitedBy.role;
          const rate = refRole === 'admin' ? state.settings.adminFirstDepositRate : state.settings.userFirstDepositRate;
          const payoutAmount = new Decimal(deposit.amountUSDT).mul(clampRate(rate)).toFixed(8);

          // Ensure commission pool can cover payout
          if (new Decimal(state.commissionPoolUSDT).gte(payoutAmount)) {
            const payout: ReferralPayout = {
              payoutId: `payout_${uuidv4().slice(0, 8)}`,
              invitedUserId: deposit.userId,
              depositId: deposit.depositId,
              referrerId: user.invitedBy.id,
              referrerRole: refRole,
              rate: clampRate(rate),
              amountUSDT: payoutAmount,
              createdAt: now,
            };

            set((s) => ({
              referralPayouts: [payout, ...s.referralPayouts],
              commissionPoolUSDT: sub(s.commissionPoolUSDT, payoutAmount),
              walletsByUserId: {
                ...s.walletsByUserId,
                [payout.referrerId]: {
                  ...(s.walletsByUserId[payout.referrerId] || {
                    balanceUSDT: '0',
                    totalDepositsUSDT: '0',
                    totalWithdrawalsUSDT: '0',
                    tradingPnlUSDT: '0',
                    referralEarningsUSDT: '0',
                  }),
                  balanceUSDT: add((s.walletsByUserId[payout.referrerId]?.balanceUSDT || '0'), payoutAmount),
                  referralEarningsUSDT: add((s.walletsByUserId[payout.referrerId]?.referralEarningsUSDT || '0'), payoutAmount),
                },
              },
            }));
            get().addAudit({
              actorId: actor.id,
              actorRole: actor.role,
              action: 'referral_payout',
              targetType: 'payout',
              targetId: payout.payoutId,
              detail: `${payout.referrerRole}:${payout.referrerId} <= ${payout.amountUSDT}`,
            });
            get().addMessage({
              kind: 'referral_payout',
              toUserId: payout.referrerId,
              title: 'Referral Commission Paid',
              body: `Commission ${fmtUSDT(payout.amountUSDT)} paid for invited user ${user.username} (${deposit.depositId}).`,
              createdBy: actor.id,
              createdByRole: actor.role,
            });
          }
        }

        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'confirm_deposit',
          targetType: 'deposit',
          targetId: depositId,
        });
        get().addMessage({
          kind: 'deposit_confirmed',
          toUserId: deposit.userId,
          title: 'Deposit Approved',
          body: `Your deposit of ${fmtUSDT(deposit.amountUSDT)} has been approved. Reference: ${deposit.depositId}.`,
          createdBy: actor.id,
          createdByRole: actor.role,
        });
      },

      createWithdraw: (userId, amountUSDT, feeUSDT, actor, note) => {
        get().ensureUserWallet(userId);
        const withdraw: TmsWithdraw = {
          withdrawId: `wd_${uuidv4().slice(0, 8)}`,
          userId,
          amountUSDT: new Decimal(amountUSDT || 0).toFixed(8),
          feeUSDT: new Decimal(feeUSDT || 0).toFixed(8),
          status: 'pending',
          createdAt: Date.now(),
          note,
        };
        set((s) => ({ withdraws: [withdraw, ...s.withdraws] }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'create_withdraw',
          targetType: 'withdraw',
          targetId: withdraw.withdrawId,
          detail: `${userId}:${withdraw.amountUSDT}`,
        });
        get().addMessage({
          kind: 'withdraw_pending',
          toUserId: userId,
          title: 'Withdrawal Pending',
          body: `Your withdrawal request of ${fmtUSDT(withdraw.amountUSDT)} is pending review. Reference: ${withdraw.withdrawId}.`,
          createdBy: actor.id,
          createdByRole: actor.role,
        });
        return withdraw;
      },

      decideWithdraw: (withdrawId, decision, actor, note) => {
        if (actor.role !== 'boss' && actor.role !== 'admin') return;
        const state = get();
        const withdraw = state.withdraws.find((w) => w.withdrawId === withdrawId);
        if (!withdraw || withdraw.status !== 'pending') return;
        const now = Date.now();
        set((s) => ({
          withdraws: s.withdraws.map((w) =>
            w.withdrawId === withdrawId
              ? {
                  ...w,
                  status: decision === 'approve' ? 'approved' : 'rejected',
                  decidedAt: now,
                  decidedBy: actor.id,
                  note: note ?? w.note,
                }
              : w
          ),
        }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: decision === 'approve' ? 'approve_withdraw' : 'reject_withdraw',
          targetType: 'withdraw',
          targetId: withdrawId,
          detail: note,
        });
        get().addMessage({
          kind: decision === 'approve' ? 'withdraw_approved' : 'withdraw_rejected',
          toUserId: withdraw.userId,
          title: decision === 'approve' ? 'Withdrawal Approved' : 'Withdrawal Rejected',
          body:
            decision === 'approve'
              ? `Your withdrawal request (${withdraw.withdrawId}) has been approved. Amount: ${fmtUSDT(withdraw.amountUSDT)}.`
              : `Your withdrawal request (${withdraw.withdrawId}) was rejected.${note ? ` Note: ${note}` : ''}`,
          createdBy: actor.id,
          createdByRole: actor.role,
        });
      },

      completeWithdraw: (withdrawId, actor) => {
        if (actor.role !== 'boss' && actor.role !== 'admin') return;
        const state = get();
        const withdraw = state.withdraws.find((w) => w.withdrawId === withdrawId);
        if (!withdraw || withdraw.status !== 'approved') return;
        get().ensureUserWallet(withdraw.userId);
        const totalOut = add(withdraw.amountUSDT, withdraw.feeUSDT);
        const now = Date.now();

        set((s) => ({
          withdraws: s.withdraws.map((w) =>
            w.withdrawId === withdrawId
              ? { ...w, status: 'completed', completedAt: now, decidedAt: w.decidedAt || now, decidedBy: w.decidedBy || actor.id }
              : w
          ),
          walletsByUserId: {
            ...s.walletsByUserId,
            [withdraw.userId]: {
              ...(s.walletsByUserId[withdraw.userId] || {
                balanceUSDT: '0',
                totalDepositsUSDT: '0',
                totalWithdrawalsUSDT: '0',
                tradingPnlUSDT: '0',
                referralEarningsUSDT: '0',
              }),
              balanceUSDT: sub((s.walletsByUserId[withdraw.userId]?.balanceUSDT || '0'), totalOut),
              totalWithdrawalsUSDT: add((s.walletsByUserId[withdraw.userId]?.totalWithdrawalsUSDT || '0'), withdraw.amountUSDT),
            },
          },
        }));

        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'complete_withdraw',
          targetType: 'withdraw',
          targetId: withdrawId,
        });
        get().addMessage({
          kind: 'withdraw_completed',
          toUserId: withdraw.userId,
          title: 'Withdrawal Completed',
          body: `Your withdrawal (${withdraw.withdrawId}) is completed. Amount: ${fmtUSDT(withdraw.amountUSDT)} | Fee: ${fmtUSDT(withdraw.feeUSDT)}.`,
          createdBy: actor.id,
          createdByRole: actor.role,
        });
      },

      createSignal: (params, actor) => {
        if (actor.role !== 'boss' && actor.role !== 'admin') return null;
        const symbol = String(params.symbol || '').trim().toUpperCase();
        if (!symbol) return null;
        const direction: SignalDirection = params.direction === 'short' ? 'short' : 'long';
        const now = Date.now();
        const signal: TmsSignal = {
          signalId: `sig_${uuidv4().slice(0, 8)}`,
          status: 'active',
          symbol,
          direction,
          timeframe: params.timeframe ? String(params.timeframe) : undefined,
          entry: params.entry ? String(params.entry) : undefined,
          takeProfit: params.takeProfit ? String(params.takeProfit) : undefined,
          stopLoss: params.stopLoss ? String(params.stopLoss) : undefined,
          createdAt: now,
          createdBy: actor.id,
          createdByRole: actor.role,
          note: params.note ? String(params.note) : undefined,
        };
        set((s) => ({ signals: [signal, ...s.signals] }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'create_signal',
          targetType: 'signal',
          targetId: signal.signalId,
          detail: `${signal.symbol}:${signal.direction}`,
        });
        return signal;
      },

      archiveSignal: (signalId, actor) => {
        if (actor.role !== 'boss' && actor.role !== 'admin') return;
        const state = get();
        const target = state.signals.find((s) => s.signalId === signalId);
        if (!target || target.status !== 'active') return;
        set((s) => ({
          signals: s.signals.map((sig) => (sig.signalId === signalId ? { ...sig, status: 'archived' } : sig)),
        }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'archive_signal',
          targetType: 'signal',
          targetId: signalId,
        });
      },

      createTrade: (userId, params, actor, note) => {
        if (actor.role !== 'boss' && actor.role !== 'admin') return null;
        const target = get().users.find((u) => u.id === userId);
        if (!target || target.role !== 'user') return null;

        const symbol = String(params.symbol || '').trim().toUpperCase();
        const side: TradeSide = params.side === 'short' ? 'short' : 'long';
        const qty = new Decimal(params.quantity || 0);
        const entry = new Decimal(params.entryPrice || 0);
        if (!symbol || !qty.isFinite() || qty.lte(0) || !entry.isFinite() || entry.lte(0)) return null;

        const now = Date.now();
        const trade: TmsTrade = {
          tradeId: `trade_${uuidv4().slice(0, 8)}`,
          userId,
          symbol,
          side,
          status: 'open',
          quantity: qty.toFixed(8),
          entryPrice: entry.toFixed(8),
          openedAt: now,
          createdBy: actor.id,
          createdByRole: actor.role,
          note,
        };

        set((s) => ({ trades: [trade, ...s.trades] }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'create_trade',
          targetType: 'trade',
          targetId: trade.tradeId,
          detail: `${trade.userId}:${trade.symbol}:${trade.side}:${trade.quantity}@${trade.entryPrice}`,
        });
        get().addMessage({
          kind: 'trade_opened',
          toUserId: trade.userId,
          title: 'Trade Opened',
          body: `A ${trade.side.toUpperCase()} trade on ${trade.symbol} has been opened. Qty: ${trade.quantity} | Entry: ${trade.entryPrice}.`,
          createdBy: actor.id,
          createdByRole: actor.role,
        });
        return trade;
      },

      closeTrade: (tradeId, exitPrice, actor, note) => {
        if (actor.role !== 'boss' && actor.role !== 'admin') return;
        const state = get();
        const trade = state.trades.find((t) => t.tradeId === tradeId);
        if (!trade || trade.status !== 'open') return;

        const exit = new Decimal(exitPrice || 0);
        if (!exit.isFinite() || exit.lte(0)) return;

        const qty = new Decimal(trade.quantity || 0);
        const entry = new Decimal(trade.entryPrice || 0);
        const pnl = trade.side === 'short' ? entry.minus(exit).mul(qty) : exit.minus(entry).mul(qty);
        const pnlStr = pnl.toFixed(8);
        const now = Date.now();

        get().ensureUserWallet(trade.userId);

        set((s) => ({
          trades: s.trades.map((t) =>
            t.tradeId === tradeId
              ? {
                  ...t,
                  status: 'closed',
                  exitPrice: exit.toFixed(8),
                  pnlUSDT: pnlStr,
                  closedAt: now,
                  closedBy: actor.id,
                  closedByRole: actor.role,
                  note: note ?? t.note,
                }
              : t
          ),
          walletsByUserId: {
            ...s.walletsByUserId,
            [trade.userId]: {
              ...(s.walletsByUserId[trade.userId] || {
                balanceUSDT: '0',
                totalDepositsUSDT: '0',
                totalWithdrawalsUSDT: '0',
                tradingPnlUSDT: '0',
                referralEarningsUSDT: '0',
              }),
              balanceUSDT: add((s.walletsByUserId[trade.userId]?.balanceUSDT || '0'), pnlStr),
              tradingPnlUSDT: add((s.walletsByUserId[trade.userId]?.tradingPnlUSDT || '0'), pnlStr),
            },
          },
        }));

        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'close_trade',
          targetType: 'trade',
          targetId: tradeId,
          detail: `${trade.userId}:${trade.symbol}:${pnlStr}`,
        });
        get().addMessage({
          kind: 'trade_closed',
          toUserId: trade.userId,
          title: 'Trade Closed',
          body: `Trade ${trade.symbol} closed. Exit: ${exit.toFixed(8)} | PnL: ${fmtUSDT(pnlStr)}.`,
          createdBy: actor.id,
          createdByRole: actor.role,
        });
      },

      decideKyc: (requestId, decision, actor, reason) => {
        if (actor.role !== 'boss' && actor.role !== 'admin') return;
        const state = get();
        const req = state.kycRequests.find((r) => r.requestId === requestId);
        if (!req) return;

        const now = Date.now();
        const nextStatus: KycRequest['status'] =
          decision === 'approve' ? 'approved' : decision === 'reupload' ? 'needs_reupload' : 'rejected';

        set((s) => ({
          kycRequests: s.kycRequests.map((r) =>
            r.requestId === requestId
              ? {
                  ...r,
                  status: nextStatus,
                  decidedAt: now,
                  decidedBy: actor.id,
                  rejectionReason: decision === 'approve' ? undefined : reason,
                }
              : r
          ),
          users: s.users.map((u) => (u.id === req.userId ? { ...u, kycStatus: nextStatus } : u)),
        }));

        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: `kyc_${decision}`,
          targetType: 'kyc',
          targetId: requestId,
          detail: reason,
        });
        get().addMessage({
          kind: decision === 'approve' ? 'kyc_approved' : decision === 'reupload' ? 'kyc_reupload' : 'kyc_rejected',
          toUserId: req.userId,
          title: decision === 'approve' ? 'KYC Approved' : decision === 'reupload' ? 'KYC Re-upload Requested' : 'KYC Rejected',
          body:
            decision === 'approve'
              ? 'Your KYC has been approved.'
              : decision === 'reupload'
                ? `Please re-upload your KYC documents.${reason ? ` Note: ${reason}` : ''}`
                : `Your KYC was rejected.${reason ? ` Reason: ${reason}` : ''}`,
          createdBy: actor.id,
          createdByRole: actor.role,
        });
      },

      addPaymentMethod: (method, actor) => {
        if (actor.role !== 'boss') return null;
        const now = Date.now();
        const full: SystemPaymentMethod = {
          ...(method as SystemPaymentMethod),
          id: `pm_${uuidv4().slice(0, 8)}`,
          createdAt: now,
          updatedAt: now,
        } as SystemPaymentMethod;

        set((s) => ({ paymentMethods: [full, ...s.paymentMethods] }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'add_payment_method',
          targetType: 'payment_method',
          targetId: full.id,
          detail: `${full.type}:${full.label}`,
        });
        return full;
      },

      updatePaymentMethod: (id, patch, actor) => {
        if (actor.role !== 'boss') return;
        set((s) => ({
          paymentMethods: s.paymentMethods.map((m) =>
            m.id === id ? ({ ...m, ...(patch as SystemPaymentMethod), updatedAt: Date.now() } as SystemPaymentMethod) : m
          ),
        }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'update_payment_method',
          targetType: 'payment_method',
          targetId: id,
        });
      },

      removePaymentMethod: (id, actor) => {
        if (actor.role !== 'boss') return;
        set((s) => ({ paymentMethods: s.paymentMethods.filter((m) => m.id !== id) }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'remove_payment_method',
          targetType: 'payment_method',
          targetId: id,
        });
      },

      updateSettings: (patch, actor) => {
        if (actor.role !== 'boss') return;
        set((s) => ({
          settings: {
            ...s.settings,
            ...(patch.adminFirstDepositRate !== undefined
              ? { adminFirstDepositRate: clampRate(patch.adminFirstDepositRate) }
              : {}),
            ...(patch.userFirstDepositRate !== undefined
              ? { userFirstDepositRate: clampRate(patch.userFirstDepositRate) }
              : {}),
            ...(patch.kycRequired !== undefined ? { kycRequired: patch.kycRequired } : {}),
          },
        }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'update_settings',
          targetType: 'system',
          targetId: 'settings',
        });
      },

      topUpCommissionPool: (amountUSDT, actor, note) => {
        if (actor.role !== 'boss') return;
        const amt = new Decimal(amountUSDT || 0).toFixed(8);
        set((s) => ({ commissionPoolUSDT: add(s.commissionPoolUSDT, amt) }));
        get().addAudit({
          actorId: actor.id,
          actorRole: actor.role,
          action: 'topup_commission_pool',
          targetType: 'system',
          targetId: 'commission_pool',
          detail: note ? `${amt} (${note})` : amt,
        });
      },

      resetDemo: () => {
        set(() => ({ ...createDemoState() }));
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (state) => ({
        users: state.users,
        walletsByUserId: state.walletsByUserId,
        messages: state.messages,
        deposits: state.deposits,
        withdraws: state.withdraws,
        trades: state.trades,
        signals: state.signals,
        kycRequests: state.kycRequests,
        paymentMethods: state.paymentMethods,
        referralPayouts: state.referralPayouts,
        auditLog: state.auditLog,
        commissionPoolUSDT: state.commissionPoolUSDT,
        settings: state.settings,
      }),
    }
  )
);
