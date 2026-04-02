import { create } from 'zustand';
import { createJSONStorage, persist, subscribeWithSelector } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import type {
  Account,
  AccountType,
  ChainType,
  CryptoAddress,
  Deposit,
  DepositStatus,
  LedgerEntry,
  LedgerFilter,
  PaymentMethod,
  PerformanceMetrics,
  ReferenceType,
  WalletBalance,
  Withdraw,
} from '../types/wallet';

const WITHDRAW_FEE_RATE = 0.001;
const MIN_WITHDRAW_FEE = 1;
const DEFAULT_DEMO_BALANCE = '10000';
const DEFAULT_DEMO_RESET_HOURS = 24;

const SUPPORTED_ASSETS = [
  'USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK',
  'MATIC', 'ARB', 'OP', 'APT', 'SUI', 'UNI', 'AAVE', 'LDO', 'FET', 'RENDER', 'WLD',
  'AXS', 'SAND', 'MANA', 'LTC', 'ATOM', 'NEAR', 'FIL', 'INJ', 'PEPE',
];

interface DemoSettings {
  enabled: boolean;
  defaultBalance: string;
  resetCooldownHours: number;
}

interface WalletAccountState {
  account: Account | null;
  balances: WalletBalance[];
  performanceMetrics: PerformanceMetrics;
  bootstrapped: boolean;
  lastResetAt?: number;
}

interface WalletState {
  activeAccountType: AccountType;
  accountStates: Record<AccountType, WalletAccountState>;

  account: Account | null;
  balances: WalletBalance[];
  paymentMethods: PaymentMethod[];
  cryptoAddresses: CryptoAddress[];
  deposits: Deposit[];
  withdraws: Withdraw[];
  ledger: LedgerEntry[];
  performanceMetrics: PerformanceMetrics;
  _pendingTimers: Map<string, ReturnType<typeof setTimeout>>;
  hasReceivedInitialGrant: boolean;
  demoSettings: DemoSettings;

  createAccount: () => Account;
  setActiveAccountType: (type: AccountType) => void;
  setDemoSettings: (patch: Partial<DemoSettings>) => void;
  resetDemoBalance: (forced?: boolean) => { success: boolean; error?: string };

  addPaymentMethod: (bankName: string, lastFour: string, alias: string) => PaymentMethod;
  removePaymentMethod: (id: string) => void;
  addCryptoAddress: (chain: ChainType, address: string, alias: string) => CryptoAddress;
  removeCryptoAddress: (id: string) => void;

  createDeposit: (asset: string, amount: string, sourceType: 'bank' | 'crypto', sourceId: string) => Deposit | null;
  confirmDeposit: (depositId: string) => void;
  approveDeposit: (depositId: string, approvedBy?: string) => void;
  rejectDeposit: (depositId: string, reason?: string, rejectedBy?: string) => void;

  createWithdraw: (asset: string, amount: string, destinationType: 'bank' | 'crypto', destinationId: string) => Withdraw | null;
  approveWithdraw: (withdrawId: string, approvedBy?: string) => void;
  rejectWithdraw: (withdrawId: string, reason?: string, rejectedBy?: string) => void;

  grantInitialFunds: () => boolean;

  freezeBalance: (asset: string, amount: string, referenceId: string, referenceType: ReferenceType, accountType?: AccountType) => boolean;
  unfreezeBalance: (asset: string, amount: string, referenceId: string, referenceType: ReferenceType, accountType?: AccountType) => boolean;
  deductFromFrozen: (asset: string, amount: string, fee: string, referenceId: string, referenceType: ReferenceType, accountType?: AccountType) => boolean;
  creditToAvailable: (asset: string, amount: string, referenceId: string, referenceType: ReferenceType, accountType?: AccountType) => boolean;

  getOnboardingStage: () => 'not_created' | 'no_payment_method' | 'no_funds' | 'funded';
  getBalance: (asset: string) => WalletBalance | undefined;
  getTotalEquity: (prices: Record<string, string>) => string;
  getFilteredLedger: (filter: LedgerFilter) => LedgerEntry[];
  getPendingRealDepositBalance: () => string;
  updatePerformanceMetrics: (prices: Record<string, string>) => void;
  resetWallet: () => void;
  setBalancesFromLive: (balances: { asset: string; free: string; locked: string }[]) => void;
}

const emptyPerformanceMetrics = (): PerformanceMetrics => ({
  totalTrades: 0,
  winRate: 0,
  profitFactor: 0,
  maxDrawdown: 0,
  peakEquity: '0',
  totalRealizedPnl: '0',
});

const createEmptyBalances = (): WalletBalance[] =>
  SUPPORTED_ASSETS.map((asset) => ({ asset, available: '0', frozen: '0', total: '0' }));

const createAccountRecord = (type: AccountType): Account => ({
  accountId: `${type === 'real' ? 'REAL' : 'DEMO'}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
  status: 'active',
  createdAt: Date.now(),
  type,
});

const setAssetBalance = (balances: WalletBalance[], asset: string, amount: string) =>
  balances.map((b) => (b.asset === asset ? { ...b, available: amount, frozen: '0', total: amount } : b));

const createInitialAccountState = (type: AccountType, settings?: DemoSettings): WalletAccountState => {
  if (type === 'demo' && settings?.enabled !== false) {
    const amount = new Decimal(settings?.defaultBalance || DEFAULT_DEMO_BALANCE).toFixed(8);
    return {
      account: createAccountRecord('demo'),
      balances: setAssetBalance(createEmptyBalances(), 'USDT', amount),
      performanceMetrics: emptyPerformanceMetrics(),
      bootstrapped: true,
      lastResetAt: Date.now(),
    };
  }

  return {
    account: createAccountRecord(type),
    balances: createEmptyBalances(),
    performanceMetrics: emptyPerformanceMetrics(),
    bootstrapped: false,
  };
};

const createDefaultAccountStates = (settings?: DemoSettings) => ({
  real: createInitialAccountState('real', settings),
  demo: createInitialAccountState('demo', settings),
});

const cloneAccountState = (state: WalletAccountState): WalletAccountState => ({
  account: state.account ? { ...state.account } : null,
  balances: state.balances.map((b) => ({ ...b })),
  performanceMetrics: { ...state.performanceMetrics },
  bootstrapped: state.bootstrapped,
  lastResetAt: state.lastResetAt,
});

const filterByAccount = <T extends { accountType: AccountType }>(type: AccountType, items: T[]) =>
  items.filter((item) => item.accountType === type);

const projectActive = (
  activeAccountType: AccountType,
  accountStates: Record<AccountType, WalletAccountState>,
  deposits: Deposit[],
  withdraws: Withdraw[],
  ledger: LedgerEntry[]
) => ({
  activeAccountType,
  account: accountStates[activeAccountType].account,
  balances: accountStates[activeAccountType].balances,
  performanceMetrics: accountStates[activeAccountType].performanceMetrics,
  hasReceivedInitialGrant: accountStates[activeAccountType].bootstrapped,
  deposits: filterByAccount(activeAccountType, deposits),
  withdraws: filterByAccount(activeAccountType, withdraws),
  ledger: filterByAccount(activeAccountType, ledger),
});

const applyActiveProjection = (state: WalletState, partial: Partial<WalletState>): Partial<WalletState> => {
  const activeAccountType = partial.activeAccountType ?? state.activeAccountType;
  const accountStates = partial.accountStates ?? state.accountStates;
  const deposits = partial.deposits ?? state.deposits;
  const withdraws = partial.withdraws ?? state.withdraws;
  const ledger = partial.ledger ?? state.ledger;
  return { ...partial, ...projectActive(activeAccountType, accountStates, deposits, withdraws, ledger) };
};

const updateBalances = (balances: WalletBalance[], asset: string, fn: (balance: WalletBalance) => WalletBalance) =>
  balances.map((balance) => (balance.asset === asset ? fn(balance) : balance));

const computeTotalEquity = (balances: WalletBalance[], prices: Record<string, string>) => {
  let total = new Decimal(0);
  for (const balance of balances) {
    const qty = new Decimal(balance.total);
    if (qty.lte(0)) continue;
    if (balance.asset === 'USDT') total = total.plus(qty);
    else if (prices[`${balance.asset}USDT`]) total = total.plus(qty.times(prices[`${balance.asset}USDT`]!));
  }
  return total.toFixed(2);
};

export const useWalletStore = create<WalletState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        activeAccountType: 'demo',
        accountStates: createDefaultAccountStates(),

        account: createDefaultAccountStates().demo.account,
        balances: createDefaultAccountStates().demo.balances,
        paymentMethods: [],
        cryptoAddresses: [],
        deposits: [],
        withdraws: [],
        ledger: [],
        performanceMetrics: createDefaultAccountStates().demo.performanceMetrics,
        _pendingTimers: new Map(),
        hasReceivedInitialGrant: true,
        demoSettings: { enabled: true, defaultBalance: DEFAULT_DEMO_BALANCE, resetCooldownHours: DEFAULT_DEMO_RESET_HOURS },

        createAccount: () => {
          const state = get();
          const next = cloneAccountState(state.accountStates[state.activeAccountType]);
          next.account = createAccountRecord(state.activeAccountType);
          const accountStates = { ...state.accountStates, [state.activeAccountType]: next };
          set(applyActiveProjection(state, { accountStates }));
          return next.account!;
        },

        setActiveAccountType: (type) => {
          const state = get();
          set(applyActiveProjection(state, { activeAccountType: type }));
        },

        setDemoSettings: (patch) => {
          const state = get();
          const demoSettings = { ...state.demoSettings, ...patch };
          const demo = cloneAccountState(state.accountStates.demo);
          if (patch.enabled === false) demo.balances = createEmptyBalances();
          const accountStates = { ...state.accountStates, demo };
          set(applyActiveProjection(state, { demoSettings, accountStates }));
        },

        resetDemoBalance: (forced = false) => {
          const state = get();
          const demo = cloneAccountState(state.accountStates.demo);
          const cooldownMs = state.demoSettings.resetCooldownHours * 60 * 60 * 1000;
          if (!forced && demo.lastResetAt && Date.now() - demo.lastResetAt < cooldownMs) {
            return { success: false, error: 'cooldown' };
          }
          const amount = new Decimal(state.demoSettings.defaultBalance).toFixed(8);
          demo.balances = setAssetBalance(createEmptyBalances(), 'USDT', amount);
          demo.performanceMetrics = emptyPerformanceMetrics();
          demo.lastResetAt = Date.now();
          const entry: LedgerEntry = {
            entryId: `led_${uuidv4().slice(0, 8)}`,
            accountType: 'demo',
            type: 'INITIAL_GRANT',
            direction: '+',
            asset: 'USDT',
            amount,
            fee: '0',
            balanceAfter: amount,
            referenceType: 'grant',
            referenceId: `demo_reset_${uuidv4().slice(0, 8)}`,
            note: 'Demo balance reset',
            createdAt: Date.now(),
          };
          set(applyActiveProjection(state, { accountStates: { ...state.accountStates, demo }, ledger: [entry, ...state.ledger] }));
          return { success: true };
        },

        addPaymentMethod: (bankName, lastFour, alias) => {
          const method: PaymentMethod = { id: uuidv4(), type: 'bank', bankName, lastFour, alias, createdAt: Date.now() };
          set((state) => ({ paymentMethods: [...state.paymentMethods, method] }));
          return method;
        },

        removePaymentMethod: (id) => set((state) => ({ paymentMethods: state.paymentMethods.filter((m) => m.id !== id) })),

        addCryptoAddress: (chain, address, alias) => {
          const cryptoAddress: CryptoAddress = { id: uuidv4(), chain, address, alias, createdAt: Date.now() };
          set((state) => ({ cryptoAddresses: [...state.cryptoAddresses, cryptoAddress] }));
          return cryptoAddress;
        },

        removeCryptoAddress: (id) => set((state) => ({ cryptoAddresses: state.cryptoAddresses.filter((m) => m.id !== id) })),

        createDeposit: (asset, amount, sourceType, sourceId) => {
          const state = get();
          if (state.activeAccountType !== 'real') return null;
          const deposit: Deposit = {
            depositId: `dep_${uuidv4().slice(0, 8)}`,
            accountType: 'real',
            asset,
            amount,
            sourceType,
            sourceId,
            status: 'pending_approval',
            createdAt: Date.now(),
          };
          set(applyActiveProjection(state, { deposits: [deposit, ...state.deposits] }));
          return deposit;
        },

        confirmDeposit: (depositId) => get().approveDeposit(depositId),

        approveDeposit: (depositId, approvedBy) => {
          const state = get();
          const deposit = state.deposits.find((item) => item.depositId === depositId);
          if (!deposit || deposit.accountType !== 'real') return;
          const real = cloneAccountState(state.accountStates.real);
          const amountDec = new Decimal(deposit.amount);
          real.balances = updateBalances(real.balances, deposit.asset, (balance) => ({
            ...balance,
            available: new Decimal(balance.available).plus(amountDec).toFixed(8),
            total: new Decimal(balance.total).plus(amountDec).toFixed(8),
          }));
          const balanceAfter = real.balances.find((item) => item.asset === deposit.asset)?.available || '0';
          const entry: LedgerEntry = {
            entryId: `led_${uuidv4().slice(0, 8)}`,
            accountType: 'real',
            type: 'DEPOSIT',
            direction: '+',
            asset: deposit.asset,
            amount: deposit.amount,
            fee: '0',
            balanceAfter,
            referenceType: 'deposit',
            referenceId: deposit.depositId,
            note: approvedBy ? `Approved by ${approvedBy}` : 'Approved deposit',
            createdAt: Date.now(),
          };
          set(applyActiveProjection(state, {
            accountStates: { ...state.accountStates, real },
            deposits: state.deposits.map((item) =>
              item.depositId === depositId
                ? { ...item, status: 'approved' as DepositStatus, approvedAt: Date.now(), approvedBy, confirmedAt: Date.now() }
                : item
            ),
            ledger: [entry, ...state.ledger],
          }));
        },

        rejectDeposit: (depositId, reason, rejectedBy) => {
          const state = get();
          set(applyActiveProjection(state, {
            deposits: state.deposits.map((item) =>
              item.depositId === depositId
                ? { ...item, status: 'rejected', rejectedAt: Date.now(), rejectionReason: reason || rejectedBy || 'Rejected' }
                : item
            ),
          }));
        },

        createWithdraw: (asset, amount, destinationType, destinationId) => {
          const state = get();
          if (state.activeAccountType !== 'real') return null;
          const balance = get().getBalance(asset);
          if (!balance) return null;
          const amountDec = new Decimal(amount);
          const fee = Decimal.max(amountDec.times(WITHDRAW_FEE_RATE), asset === 'USDT' ? MIN_WITHDRAW_FEE : 0);
          if (new Decimal(balance.available).lt(amountDec.plus(fee))) return null;
          const withdraw: Withdraw = {
            withdrawId: `wdr_${uuidv4().slice(0, 8)}`,
            accountType: 'real',
            asset,
            amount,
            fee: fee.toFixed(8),
            destinationType,
            destinationId,
            status: 'pending_approval',
            createdAt: Date.now(),
          };
          set(applyActiveProjection(state, { withdraws: [withdraw, ...state.withdraws] }));
          return withdraw;
        },

        approveWithdraw: (withdrawId, approvedBy) => {
          const withdraw = get().withdraws.find((item) => item.withdrawId === withdrawId);
          if (!withdraw || withdraw.status !== 'pending_approval') return;
          const totalRequired = new Decimal(withdraw.amount).plus(withdraw.fee).toFixed(8);
          if (!get().freezeBalance(withdraw.asset, totalRequired, withdrawId, 'withdraw', withdraw.accountType)) return;
          const current = get();
          set(applyActiveProjection(current, {
            withdraws: current.withdraws.map((item) =>
              item.withdrawId === withdrawId ? { ...item, status: 'approved', approvedAt: Date.now(), approvedBy } : item
            ),
          }));
          const timer = setTimeout(() => {
            const latest = get().withdraws.find((item) => item.withdrawId === withdrawId);
            if (!latest || latest.status !== 'approved') return;
            if (!get().deductFromFrozen(latest.asset, latest.amount, latest.fee, latest.withdrawId, 'withdraw', latest.accountType)) return;
            const state = get();
            set(applyActiveProjection(state, {
              withdraws: state.withdraws.map((item) =>
                item.withdrawId === withdrawId ? { ...item, status: 'completed', completedAt: Date.now() } : item
              ),
            }));
          }, 1500);
          get()._pendingTimers.set(withdrawId, timer);
        },

        rejectWithdraw: (withdrawId, reason, rejectedBy) => {
          const state = get();
          set(applyActiveProjection(state, {
            withdraws: state.withdraws.map((item) =>
              item.withdrawId === withdrawId
                ? { ...item, status: 'rejected', rejectedAt: Date.now(), rejectionReason: reason || rejectedBy || 'Rejected' }
                : item
            ),
          }));
        },

        grantInitialFunds: () => {
          const state = get();
          if (state.accountStates.real.bootstrapped && state.accountStates.demo.bootstrapped) return false;
          const real = cloneAccountState(state.accountStates.real);
          const demo = cloneAccountState(state.accountStates.demo);
          real.account = real.account || createAccountRecord('real');
          real.bootstrapped = true;
          if (state.demoSettings.enabled) {
            const amount = new Decimal(state.demoSettings.defaultBalance).toFixed(8);
            demo.account = demo.account || createAccountRecord('demo');
            demo.balances = setAssetBalance(createEmptyBalances(), 'USDT', amount);
            demo.bootstrapped = true;
            demo.lastResetAt = Date.now();
            const existingGrant = state.ledger.find((entry) => entry.accountType === 'demo' && entry.referenceType === 'grant');
            const ledger = existingGrant
              ? state.ledger
              : [{
                  entryId: `led_${uuidv4().slice(0, 8)}`,
                  accountType: 'demo' as const,
                  type: 'INITIAL_GRANT' as const,
                  direction: '+',
                  asset: 'USDT',
                  amount,
                  fee: '0',
                  balanceAfter: amount,
                  referenceType: 'grant' as const,
                  referenceId: `demo_grant_${uuidv4().slice(0, 8)}`,
                  note: 'Demo starting balance',
                  createdAt: Date.now(),
                }, ...state.ledger];
            set(applyActiveProjection(state, { accountStates: { real, demo }, ledger }));
          } else {
            set(applyActiveProjection(state, { accountStates: { real, demo } }));
          }
          return true;
        },

        freezeBalance: (asset, amount, referenceId, referenceType, accountType) => {
          const state = get();
          const resolvedAccountType = accountType || state.activeAccountType;
          const active = cloneAccountState(state.accountStates[resolvedAccountType]);
          const amountDec = new Decimal(amount);
          const balance = active.balances.find((item) => item.asset === asset);
          if (!balance || new Decimal(balance.available).lt(amountDec)) return false;
          active.balances = updateBalances(active.balances, asset, (item) => ({
            ...item,
            available: new Decimal(item.available).minus(amountDec).toFixed(8),
            frozen: new Decimal(item.frozen).plus(amountDec).toFixed(8),
          }));
          const balanceAfter = active.balances.find((item) => item.asset === asset)?.available || '0';
          const entry: LedgerEntry = {
            entryId: `led_${uuidv4().slice(0, 8)}`,
            accountType: resolvedAccountType,
            type: referenceType === 'order' ? 'ORDER_FREEZE' : 'WITHDRAW_FREEZE',
            direction: '-',
            asset,
            amount,
            fee: '0',
            balanceAfter,
            referenceType,
            referenceId,
            createdAt: Date.now(),
          };
          set(applyActiveProjection(state, { accountStates: { ...state.accountStates, [resolvedAccountType]: active }, ledger: [entry, ...state.ledger] }));
          return true;
        },

        unfreezeBalance: (asset, amount, referenceId, referenceType, accountType) => {
          const state = get();
          const resolvedAccountType = accountType || state.activeAccountType;
          const active = cloneAccountState(state.accountStates[resolvedAccountType]);
          const amountDec = new Decimal(amount);
          const balance = active.balances.find((item) => item.asset === asset);
          if (!balance || new Decimal(balance.frozen).lt(amountDec)) return false;
          active.balances = updateBalances(active.balances, asset, (item) => ({
            ...item,
            available: new Decimal(item.available).plus(amountDec).toFixed(8),
            frozen: new Decimal(item.frozen).minus(amountDec).toFixed(8),
          }));
          const balanceAfter = active.balances.find((item) => item.asset === asset)?.available || '0';
          const entry: LedgerEntry = {
            entryId: `led_${uuidv4().slice(0, 8)}`,
            accountType: resolvedAccountType,
            type: referenceType === 'order' ? 'ORDER_UNFREEZE' : 'WITHDRAW_REFUND',
            direction: '+',
            asset,
            amount,
            fee: '0',
            balanceAfter,
            referenceType,
            referenceId,
            createdAt: Date.now(),
          };
          set(applyActiveProjection(state, { accountStates: { ...state.accountStates, [resolvedAccountType]: active }, ledger: [entry, ...state.ledger] }));
          return true;
        },

        deductFromFrozen: (asset, amount, fee, referenceId, referenceType, accountType) => {
          const state = get();
          const resolvedAccountType = accountType || state.activeAccountType;
          const active = cloneAccountState(state.accountStates[resolvedAccountType]);
          const totalDeduct = new Decimal(amount).plus(new Decimal(fee));
          const balance = active.balances.find((item) => item.asset === asset);
          if (!balance || new Decimal(balance.frozen).lt(totalDeduct)) return false;
          active.balances = updateBalances(active.balances, asset, (item) => ({
            ...item,
            frozen: new Decimal(item.frozen).minus(totalDeduct).toFixed(8),
            total: new Decimal(item.total).minus(totalDeduct).toFixed(8),
          }));
          const balanceAfter = active.balances.find((item) => item.asset === asset)?.total || '0';
          const entry: LedgerEntry = {
            entryId: `led_${uuidv4().slice(0, 8)}`,
            accountType: resolvedAccountType,
            type: referenceType === 'withdraw' ? 'WITHDRAW_COMPLETE' : 'FILL',
            direction: '-',
            asset,
            amount,
            fee,
            balanceAfter,
            referenceType,
            referenceId,
            createdAt: Date.now(),
          };
          set(applyActiveProjection(state, { accountStates: { ...state.accountStates, [resolvedAccountType]: active }, ledger: [entry, ...state.ledger] }));
          return true;
        },

        creditToAvailable: (asset, amount, referenceId, referenceType, accountType) => {
          const state = get();
          const resolvedAccountType = accountType || state.activeAccountType;
          const active = cloneAccountState(state.accountStates[resolvedAccountType]);
          const amountDec = new Decimal(amount);
          active.balances = updateBalances(active.balances, asset, (item) => ({
            ...item,
            available: new Decimal(item.available).plus(amountDec).toFixed(8),
            total: new Decimal(item.total).plus(amountDec).toFixed(8),
          }));
          const balanceAfter = active.balances.find((item) => item.asset === asset)?.available || '0';
          const entry: LedgerEntry = {
            entryId: `led_${uuidv4().slice(0, 8)}`,
            accountType: resolvedAccountType,
            type: referenceType === 'deposit' ? 'DEPOSIT' : 'FILL',
            direction: '+',
            asset,
            amount,
            fee: '0',
            balanceAfter,
            referenceType,
            referenceId,
            createdAt: Date.now(),
          };
          set(applyActiveProjection(state, { accountStates: { ...state.accountStates, [resolvedAccountType]: active }, ledger: [entry, ...state.ledger] }));
          return true;
        },

        getOnboardingStage: () => {
          const state = get();
          const active = state.accountStates[state.activeAccountType];
          if (!active.account) return 'not_created';
          if (state.activeAccountType === 'demo') return 'funded';
          if (state.paymentMethods.length === 0 && state.cryptoAddresses.length === 0) return 'no_payment_method';
          return active.balances.some((b) => new Decimal(b.total).gt(0)) ? 'funded' : 'no_funds';
        },

        getBalance: (asset) => get().balances.find((item) => item.asset === asset),
        getTotalEquity: (prices) => computeTotalEquity(get().balances, prices),
        getFilteredLedger: (filter) => {
          const state = get();
          if (filter === 'all') return state.ledger;
          const types: Record<LedgerFilter, string[]> = {
            all: [],
            deposit: ['DEPOSIT'],
            withdraw: ['WITHDRAW_FREEZE', 'WITHDRAW_COMPLETE', 'WITHDRAW_REFUND'],
            trade: ['ORDER_FREEZE', 'ORDER_UNFREEZE', 'FILL'],
            fee: ['FEE'],
          };
          return state.ledger.filter((entry) => types[filter].includes(entry.type));
        },
        getPendingRealDepositBalance: () => filterByAccount('real', get().deposits).filter((d) => d.status === 'pending_approval').reduce((sum, d) => sum.plus(d.amount), new Decimal(0)).toFixed(2),

        updatePerformanceMetrics: (prices) => {
          const state = get();
          const active = cloneAccountState(state.accountStates[state.activeAccountType]);
          const currentEquity = new Decimal(computeTotalEquity(active.balances, prices));
          const metrics = { ...active.performanceMetrics };
          const peak = new Decimal(metrics.peakEquity);
          if (currentEquity.gt(peak)) metrics.peakEquity = currentEquity.toFixed(2);
          else if (peak.gt(0)) metrics.maxDrawdown = Math.max(metrics.maxDrawdown, peak.minus(currentEquity).div(peak).times(100).toNumber());
          active.performanceMetrics = metrics;
          set(applyActiveProjection(state, { accountStates: { ...state.accountStates, [state.activeAccountType]: active } }));
        },

        setBalancesFromLive: (balances) => {
          const state = get();
          const real = cloneAccountState(state.accountStates.real);
          const liveMap = new Map(balances.map((item) => [item.asset, item]));
          real.balances = real.balances.map((balance) => {
            const live = liveMap.get(balance.asset);
            if (!live) return balance;
            return { ...balance, available: live.free, frozen: live.locked, total: new Decimal(live.free).plus(live.locked).toFixed(8) };
          });
          set(applyActiveProjection(state, { accountStates: { ...state.accountStates, real } }));
        },

        resetWallet: () => {
          get()._pendingTimers.forEach(clearTimeout);
          const accountStates = createDefaultAccountStates(get().demoSettings);
          set({
            activeAccountType: 'demo',
            accountStates,
            account: accountStates.demo.account,
            balances: accountStates.demo.balances,
            paymentMethods: [],
            cryptoAddresses: [],
            deposits: [],
            withdraws: [],
            ledger: [],
            performanceMetrics: accountStates.demo.performanceMetrics,
            _pendingTimers: new Map(),
            hasReceivedInitialGrant: true,
          });
        },
      }),
      {
        name: 'paper-wallet-storage',
        version: 5,
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          activeAccountType: state.activeAccountType,
          accountStates: state.accountStates,
          paymentMethods: state.paymentMethods,
          cryptoAddresses: state.cryptoAddresses,
          deposits: state.deposits,
          withdraws: state.withdraws,
          ledger: state.ledger,
          demoSettings: state.demoSettings,
        }),
        migrate: (persistedState: any, version) => {
          if (version >= 5) return persistedState;
          const settings: DemoSettings = { enabled: true, defaultBalance: DEFAULT_DEMO_BALANCE, resetCooldownHours: DEFAULT_DEMO_RESET_HOURS };
          const migrated = persistedState || {};
          const real: WalletAccountState = {
            account: migrated.account ? { ...migrated.account, type: 'real' } : createAccountRecord('real'),
            balances: createEmptyBalances(),
            performanceMetrics: migrated.performanceMetrics || emptyPerformanceMetrics(),
            bootstrapped: true,
          };
          const demo = createInitialAccountState('demo', settings);
          const deposits = Array.isArray(migrated.deposits) ? migrated.deposits.map((item: Deposit) => ({ ...item, accountType: item.accountType || 'real', status: item.status === 'confirmed' ? 'approved' : item.status })) : [];
          const withdraws = Array.isArray(migrated.withdraws) ? migrated.withdraws.map((item: Withdraw) => ({ ...item, accountType: item.accountType || 'real' })) : [];
          const ledger = Array.isArray(migrated.ledger) ? migrated.ledger.map((item: LedgerEntry) => ({ ...item, accountType: item.accountType || 'real' })) : [];
          return {
            activeAccountType: migrated.activeAccountType || 'demo',
            accountStates: { real, demo },
            paymentMethods: migrated.paymentMethods || [],
            cryptoAddresses: migrated.cryptoAddresses || [],
            deposits,
            withdraws,
            ledger,
            demoSettings: settings,
            ...projectActive(migrated.activeAccountType || 'demo', { real, demo }, deposits, withdraws, ledger),
          };
        },
        onRehydrateStorage: () => (state) => {
          if (!state) return;
          state._pendingTimers = new Map();
          Object.assign(state, projectActive(state.activeAccountType, state.accountStates, state.deposits, state.withdraws, state.ledger));
        },
      }
    )
  )
);

export const selectActiveAccountType = (state: WalletState) => state.activeAccountType;
export const selectAccount = (state: WalletState) => state.account;
export const selectBalances = (state: WalletState) => state.balances;
export const selectPaymentMethods = (state: WalletState) => state.paymentMethods;
export const selectCryptoAddresses = (state: WalletState) => state.cryptoAddresses;
export const selectDeposits = (state: WalletState) => state.deposits;
export const selectWithdraws = (state: WalletState) => state.withdraws;
export const selectLedger = (state: WalletState) => state.ledger;
export const selectOnboardingStage = (state: WalletState) => state.getOnboardingStage();
export const selectDemoSettings = (state: WalletState) => state.demoSettings;
