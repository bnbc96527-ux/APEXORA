import { useEffect, useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { useIsMobile } from '../hooks/useMediaQuery';
import { Icon } from '../components/Icon';
import { useAuthStore, type UserRole } from '../store/authStore';
import { getUiLocale } from '../utils/locale';
import {
  useTmsStore,
  type SystemPaymentMethod,
  type SystemPaymentMethodType,
  type TmsMessage,
  type MessageKind,
  type TmsSignal,
  type SignalDirection,
  type TradeSide,
  type TmsTrade,
} from '../store/tmsStore';
import type { ChainType } from '../types/wallet';
import styles from './ManagementPage.module.css';

type Tab =
  | 'dashboard'
  | 'admins'
  | 'users'
  | 'kyc'
  | 'finance'
  | 'trading'
  | 'notifications'
  | 'payments'
  | 'reports'
  | 'settings';

const generateTempPassword = (length = 12): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
};

function formatUSDT(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return `${value} USDT`;
  return `${n.toLocaleString(getUiLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
}

function fmtTime(ms?: number): string {
  if (!ms) return '-';
  try {
    return new Date(ms).toLocaleString(getUiLocale());
  } catch {
    return String(ms);
  }
}

const csvEscape = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  if (raw.includes('"') || raw.includes(',') || raw.includes('\n') || raw.includes('\r')) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
};

const toCsv = (headers: string[], rows: Array<Record<string, unknown>>): string => {
  const headerLine = headers.map(csvEscape).join(',');
  const bodyLines = rows.map((row) => headers.map((h) => csvEscape(row[h] ?? '')).join(','));
  return [headerLine, ...bodyLines].join('\n');
};

const downloadTextFile = (filename: string, content: string, mime = 'text/plain;charset=utf-8') => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const downloadCsv = (filenameBase: string, headers: string[], rows: Array<Record<string, unknown>>) => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  const filename = `${filenameBase}_${stamp}.csv`;
  downloadTextFile(filename, toCsv(headers, rows), 'text/csv;charset=utf-8');
};

const escapeHtml = (value: unknown): string => {
  const raw = value === null || value === undefined ? '' : String(value);
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

const toHtmlTable = (headers: string[], rows: Array<Record<string, unknown>>): string => {
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${headers.map((h) => `<td>${escapeHtml(row[h] ?? '')}</td>`).join('')}</tr>`)
    .join('');
  return `<table class="tbl"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
};

const openPrintWindow = (title: string, bodyHtml: string) => {
  if (typeof window === 'undefined') return;
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; margin: 24px; color: #111827; }
      h1 { margin: 0 0 8px; font-size: 18px; }
      h2 { margin: 18px 0 10px; font-size: 14px; border-top: 1px solid #e5e7eb; padding-top: 14px; }
      .meta { margin: 0 0 14px; color: #6b7280; font-size: 12px; }
      .toolbar { position: sticky; top: 0; background: rgba(255,255,255,0.9); backdrop-filter: blur(6px); padding: 10px 0; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; }
      .btn { display: inline-block; border: 1px solid #111827; background: #111827; color: white; padding: 6px 10px; border-radius: 8px; font-size: 12px; cursor: pointer; }
      .note { color: #6b7280; font-size: 12px; margin-left: 10px; }
      .tbl { width: 100%; border-collapse: collapse; margin-top: 8px; }
      .tbl th, .tbl td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; font-size: 11px; }
      .tbl th { background: #f9fafb; color: #374151; }
      @media print { .toolbar { display: none; } body { margin: 0.5in; } }
    </style>
  </head>
  <body>
    <div class="toolbar">
      <button class="btn" onclick="window.print()">Print / Save as PDF</button>
      <span class="note">Tip: Choose “Save as PDF” in the print dialog.</span>
    </div>
    ${bodyHtml}
  </body>
</html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
};

function Pill({ children, tone }: { children: React.ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  const className =
    tone === 'good'
      ? styles.pillGood
      : tone === 'warn'
        ? styles.pillWarn
        : tone === 'bad'
          ? styles.pillBad
          : '';
  return <span className={`${styles.pill} ${className}`}>{children}</span>;
}

const statusTone = (status: string): 'good' | 'warn' | 'bad' | undefined => {
  if (status === 'active' || status === 'confirmed' || status === 'completed' || status === 'approved') return 'good';
  if (status === 'pending' || status === 'inactive' || status === 'needs_reupload') return 'warn';
  if (status === 'disabled' || status === 'locked' || status === 'rejected' || status === 'failed') return 'bad';
  return undefined;
};

const kycTone = (status: string): 'good' | 'warn' | 'bad' | undefined => {
  if (status === 'approved') return 'good';
  if (status === 'pending' || status === 'needs_reupload') return 'warn';
  if (status === 'rejected') return 'bad';
  return undefined;
};

export function ManagementPage() {
  const isMobile = useIsMobile();
  const { user: authUser, registeredUsers, provisionCredentials, resetPasswordForUser, rekeyCredentialsForUser } =
    useAuthStore((s) => ({
      user: s.user,
      registeredUsers: s.registeredUsers,
      provisionCredentials: s.provisionCredentials,
      resetPasswordForUser: s.resetPasswordForUser,
      rekeyCredentialsForUser: s.rekeyCredentialsForUser,
    }));
  const isBoss = authUser?.role === 'boss';
  const actor = useMemo(() => (authUser ? { id: authUser.id, role: authUser.role as UserRole } : null), [authUser]);

  const {
    users,
    walletsByUserId,
    messages,
    deposits,
    withdraws,
    trades,
    signals,
    kycRequests,
    paymentMethods,
    referralPayouts,
    auditLog,
    commissionPoolUSDT,
    settings,
    addPaymentMethod,
    updatePaymentMethod,
    createUser,
    createAdminAccount,
    updateUserProfile,
    updateAdminProfile,
    updateAdminWallet,
    issueAdminVerificationCode,
    confirmAdminVerificationCode,
    activateAdminAccount,
    lockExpiredAdminAccounts,
    setUserStatus,
    sendMessage,
    createDeposit,
    decideKyc,
    confirmDeposit,
    createWithdraw,
    decideWithdraw,
    completeWithdraw,
    createSignal,
    archiveSignal,
    createTrade,
    closeTrade,
    updateSettings,
    topUpCommissionPool,
    removePaymentMethod,
    resetDemo,
  } = useTmsStore((s) => ({
    users: s.users,
    walletsByUserId: s.walletsByUserId,
    messages: s.messages,
    deposits: s.deposits,
    withdraws: s.withdraws,
    trades: s.trades,
    signals: s.signals,
    kycRequests: s.kycRequests,
    paymentMethods: s.paymentMethods,
    referralPayouts: s.referralPayouts,
    auditLog: s.auditLog,
    commissionPoolUSDT: s.commissionPoolUSDT,
    settings: s.settings,
    addPaymentMethod: s.addPaymentMethod,
    updatePaymentMethod: s.updatePaymentMethod,
    createUser: s.createUser,
    createAdminAccount: s.createAdminAccount,
    updateUserProfile: s.updateUserProfile,
    updateAdminProfile: s.updateAdminProfile,
    updateAdminWallet: s.updateAdminWallet,
    issueAdminVerificationCode: s.issueAdminVerificationCode,
    confirmAdminVerificationCode: s.confirmAdminVerificationCode,
    activateAdminAccount: s.activateAdminAccount,
    lockExpiredAdminAccounts: s.lockExpiredAdminAccounts,
    setUserStatus: s.setUserStatus,
    sendMessage: s.sendMessage,
    createDeposit: s.createDeposit,
    decideKyc: s.decideKyc,
    confirmDeposit: s.confirmDeposit,
    createWithdraw: s.createWithdraw,
    decideWithdraw: s.decideWithdraw,
    completeWithdraw: s.completeWithdraw,
    createSignal: s.createSignal,
    archiveSignal: s.archiveSignal,
    createTrade: s.createTrade,
    closeTrade: s.closeTrade,
    updateSettings: s.updateSettings,
    topUpCommissionPool: s.topUpCommissionPool,
    removePaymentMethod: s.removePaymentMethod,
    resetDemo: s.resetDemo,
  }));

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  useEffect(() => {
    lockExpiredAdminAccounts();
  }, [lockExpiredAdminAccounts]);

  useEffect(() => {
    if (!isBoss && (activeTab === 'payments' || activeTab === 'settings' || activeTab === 'admins')) {
      setActiveTab('dashboard');
    }
  }, [activeTab, isBoss]);

  const roleLabel = useMemo(() => {
    if (!authUser) return 'UNKNOWN';
    if (authUser.role === 'boss') return 'Boss';
    if (authUser.role === 'admin') return 'Admin';
    return 'User';
  }, [authUser]);

  const traders = useMemo(() => users.filter((u) => u.role === 'user'), [users]);
  const admins = useMemo(() => users.filter((u) => u.role === 'admin'), [users]);
  const currentManagedUser = useMemo(() => users.find((u) => u.id === authUser.id) || null, [authUser.id, users]);
  const currentAdminProgress = useMemo(() => {
    if (!currentManagedUser || currentManagedUser.role !== 'admin') return null;
    const completed = [
      Boolean(currentManagedUser.fullName),
      Boolean(currentManagedUser.phone),
      Boolean(currentManagedUser.address),
      Boolean(currentManagedUser.commissionWalletAddress),
      Boolean(currentManagedUser.adminVerifiedAt),
    ].filter(Boolean).length;
    return {
      completed,
      total: 5,
      remaining: 5 - completed,
      deadlineAt: currentManagedUser.adminSetupDeadlineAt || null,
      expired: Boolean(currentManagedUser.adminSetupDeadlineAt && currentManagedUser.adminSetupDeadlineAt < Date.now()),
      status: currentManagedUser.status,
    };
  }, [currentManagedUser]);
  const accountsForBalance = useMemo(() => users.filter((u) => u.role !== 'boss'), [users]);
  const pendingKyc = useMemo(
    () => kycRequests.filter((r) => r.status === 'pending' || r.status === 'needs_reupload'),
    [kycRequests]
  );

  const stats = useMemo(() => {
    const totalUserBalance = accountsForBalance.reduce(
      (acc, u) => acc.plus(walletsByUserId[u.id]?.balanceUSDT || 0),
      new Decimal(0)
    );
    const approvedDeposits = deposits.filter((d) => d.status === 'approved');
    const completedWithdraws = withdraws.filter((w) => w.status === 'completed');
    const pendingWithdraws = withdraws.filter((w) => w.status === 'pending' || w.status === 'approved');

    const totalDeposits = approvedDeposits.reduce((acc, d) => acc.plus(d.amountUSDT || 0), new Decimal(0));
    const totalWithdrawals = completedWithdraws.reduce((acc, w) => acc.plus(w.amountUSDT || 0), new Decimal(0));
    const totalPnl = traders.reduce((acc, u) => acc.plus(walletsByUserId[u.id]?.tradingPnlUSDT || 0), new Decimal(0));
    const adminEarnings = admins.reduce((acc, a) => acc.plus(walletsByUserId[a.id]?.referralEarningsUSDT || 0), new Decimal(0));
    const totalReferralPayouts = referralPayouts.reduce((acc, p) => acc.plus(p.amountUSDT || 0), new Decimal(0));

    return {
      systemBalance: totalUserBalance.plus(commissionPoolUSDT || 0).toFixed(8),
      totalUserBalance: totalUserBalance.toFixed(8),
      totalDeposits: totalDeposits.toFixed(8),
      totalWithdrawals: totalWithdrawals.toFixed(8),
      totalPnl: totalPnl.toFixed(8),
      activeTraders: traders.filter((u) => u.status === 'active').length,
      adminEarnings: adminEarnings.toFixed(8),
      totalReferralPayouts: totalReferralPayouts.toFixed(8),
      pendingKyc: pendingKyc.length,
      pendingWithdrawals: pendingWithdraws.length,
      pendingDeposits: deposits.filter((d) => d.status === 'pending').length,
      openTrades: trades.filter((t) => t.status === 'open').length,
    };
  }, [accountsForBalance, admins, commissionPoolUSDT, deposits, pendingKyc.length, referralPayouts, traders, trades, walletsByUserId, withdraws]);

  const performance = useMemo(() => {
    const now = Date.now();
    const windows = [
      { label: '24h', since: now - 24 * 60 * 60 * 1000 },
      { label: '7d', since: now - 7 * 24 * 60 * 60 * 1000 },
      { label: '30d', since: now - 30 * 24 * 60 * 60 * 1000 },
    ];

    return windows.map((w) => {
      const depositsSum = deposits
        .filter((d) => d.status === 'approved' && (d.approvedAt ?? d.confirmedAt ?? d.createdAt) >= w.since)
        .reduce((acc, d) => acc.plus(d.amountUSDT || 0), new Decimal(0));

      const withdrawSum = withdraws
        .filter((wd) => wd.status === 'completed' && (wd.completedAt ?? wd.decidedAt ?? wd.createdAt) >= w.since)
        .reduce((acc, wd) => acc.plus(wd.amountUSDT || 0), new Decimal(0));

      const pnlSum = trades
        .filter((t) => t.status === 'closed' && (t.closedAt ?? t.openedAt) >= w.since)
        .reduce((acc, t) => acc.plus(t.pnlUSDT || 0), new Decimal(0));

      const payoutSum = referralPayouts
        .filter((p) => (p.createdAt || 0) >= w.since)
        .reduce((acc, p) => acc.plus(p.amountUSDT || 0), new Decimal(0));

      const closedTrades = trades.filter((t) => t.status === 'closed' && (t.closedAt ?? t.openedAt) >= w.since).length;

      return {
        label: w.label,
        depositsUSDT: depositsSum.toFixed(8),
        withdrawalsUSDT: withdrawSum.toFixed(8),
        pnlUSDT: pnlSum.toFixed(8),
        payoutsUSDT: payoutSum.toFixed(8),
        closedTrades,
      };
    });
  }, [deposits, referralPayouts, trades, withdraws]);

  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    role: 'user' as UserRole,
    invitedBy: '',
    password: '',
  });

  const [newAdmin, setNewAdmin] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    address: '',
    walletChain: 'TRC20' as ChainType,
    walletAddress: '',
  });
  const [adminTempPassword, setAdminTempPassword] = useState('');
  const [adminSetupCode, setAdminSetupCode] = useState('');

  const credentialCountByUserId = useMemo(() => {
    const out: Record<string, number> = {};
    for (const entry of Object.values(registeredUsers || {})) {
      if (!entry?.userId) continue;
      out[entry.userId] = (out[entry.userId] || 0) + 1;
    }
    return out;
  }, [registeredUsers]);

  const referrerOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [{ value: '', label: 'No referrer' }];
    for (const u of users) {
      if (u.role !== 'admin' && u.role !== 'user') continue;
      options.push({ value: `${u.role}:${u.id}`, label: `${u.role.toUpperCase()} - ${u.username} (${u.id})` });
    }
    return options;
  }, [users]);

  const roleOptions: Array<{ value: UserRole; label: string }> = [
    { value: 'user', label: 'User (Trader)' },
    ...(isBoss ? [{ value: 'admin' as const, label: 'Admin' }] : []),
  ];

  const [newPaymentType, setNewPaymentType] = useState<SystemPaymentMethodType>('bank');
  const [newPayment, setNewPayment] = useState({
    label: '',
    bankName: '',
    accountName: '',
    accountNumber: '',
    swiftCode: '',
    chain: 'TRC20' as ChainType,
    address: '',
    provider: '',
    publicKey: '',
  });

  const [newDeposit, setNewDeposit] = useState({ userId: traders[0]?.id || '', amountUSDT: '', note: '' });
  const [newWithdraw, setNewWithdraw] = useState({ userId: traders[0]?.id || '', amountUSDT: '', feeUSDT: '0', note: '' });

  useEffect(() => {
    if (traders.length === 0) return;
    setNewDeposit((s) => (s.userId ? s : { ...s, userId: traders[0]!.id }));
    setNewWithdraw((s) => (s.userId ? s : { ...s, userId: traders[0]!.id }));
  }, [traders]);

  const [newTrade, setNewTrade] = useState({
    userId: traders[0]?.id || '',
    symbol: 'BTCUSDT',
    side: 'long' as TradeSide,
    quantity: '',
    entryPrice: '',
    note: '',
  });

  useEffect(() => {
    if (traders.length === 0) return;
    setNewTrade((s) => (s.userId ? s : { ...s, userId: traders[0]!.id }));
  }, [traders]);

  const openTrades = useMemo(() => trades.filter((t) => t.status === 'open'), [trades]);
  const closedTrades = useMemo(() => trades.filter((t) => t.status === 'closed'), [trades]);

  const messageRecipients = useMemo(() => {
    const role = authUser?.role;
    const base: Array<{ value: string; label: string }> = [{ value: 'broadcast', label: 'Broadcast (All Traders)' }];
    const eligible = users.filter((u) => {
      if (u.role === 'boss') return false;
      if (role === 'admin') return u.role === 'user';
      if (role === 'boss') return u.role === 'user' || u.role === 'admin';
      return u.role === 'user';
    });
    for (const u of eligible) {
      base.push({ value: u.id, label: `${u.role.toUpperCase()} - ${u.username} (${u.id})` });
    }
    return base;
  }, [authUser?.role, users]);

  const [newMessage, setNewMessage] = useState({
    to: 'broadcast',
    kind: 'manual' as MessageKind,
    title: '',
    body: '',
  });

  const [messageQuery, setMessageQuery] = useState('');
  const filteredMessages = useMemo(() => {
    const q = messageQuery.trim().toLowerCase();
    const matches = (m: TmsMessage) => {
      if (!q) return true;
      const to = m.toUserId ? m.toUserId : 'broadcast';
      const blob = `${m.kind} ${to} ${m.title} ${m.body} ${m.createdByRole} ${m.createdBy}`;
      return blob.toLowerCase().includes(q);
    };
    return messages.filter(matches).slice(0, 200);
  }, [messageQuery, messages]);

  const [newSignal, setNewSignal] = useState({
    symbol: 'BTCUSDT',
    direction: 'long' as SignalDirection,
    timeframe: 'H1',
    entry: '',
    takeProfit: '',
    stopLoss: '',
    note: '',
  });

  const activeSignals = useMemo(() => signals.filter((s) => s.status === 'active'), [signals]);
  const archivedSignals = useMemo(() => signals.filter((s) => s.status === 'archived'), [signals]);
  const [showArchivedSignals, setShowArchivedSignals] = useState(false);

  const [auditQuery, setAuditQuery] = useState('');
  const filteredAudit = useMemo(() => {
    const q = auditQuery.trim().toLowerCase();
    const matches = (item: (typeof auditLog)[number]) => {
      if (!q) return true;
      const blob = `${item.actorRole} ${item.actorId} ${item.action} ${item.targetType} ${item.targetId} ${item.detail ?? ''}`;
      return blob.toLowerCase().includes(q);
    };
    return auditLog.filter(matches).slice(0, 100);
  }, [auditLog, auditQuery]);

  const [settingsDraft, setSettingsDraft] = useState(() => ({
    adminFirstDepositPct: Number((settings.adminFirstDepositRate * 100).toFixed(2)),
    userFirstDepositPct: Number((settings.userFirstDepositRate * 100).toFixed(2)),
    kycRequired: settings.kycRequired,
  }));

  const [commissionTopUp, setCommissionTopUp] = useState({ amountUSDT: '', note: '' });
  const [settingsTouchedAt, setSettingsTouchedAt] = useState<number | null>(null);

  useEffect(() => {
    if (activeTab !== 'settings') return;
    setSettingsDraft({
      adminFirstDepositPct: Number((settings.adminFirstDepositRate * 100).toFixed(2)),
      userFirstDepositPct: Number((settings.userFirstDepositRate * 100).toFixed(2)),
      kycRequired: settings.kycRequired,
    });
  }, [activeTab, settings.adminFirstDepositRate, settings.kycRequired, settings.userFirstDepositRate]);

  useEffect(() => {
    if (!currentManagedUser || currentManagedUser.role !== 'admin') return;
    setNewAdmin((state) => ({
      ...state,
      fullName: currentManagedUser.fullName || currentManagedUser.username || state.fullName,
      username: currentManagedUser.username,
      email: currentManagedUser.email,
      phone: currentManagedUser.phone || state.phone,
      address: currentManagedUser.address || state.address,
      walletChain: currentManagedUser.commissionWalletChain || state.walletChain,
      walletAddress: currentManagedUser.commissionWalletAddress || state.walletAddress,
    }));
  }, [currentManagedUser]);

  if (!authUser || !actor) return null;

  const handleCreateUser = () => {
    const username = newUser.username.trim();
    const email = newUser.email.trim();
    if (!username || !email) return;

    const dup = users.some(
      (u) => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase()
    );
    if (dup) {
      alert('Username or email already exists.');
      return;
    }

    const invitedBy = (() => {
      if (!newUser.invitedBy) return undefined;
      const [role, id] = newUser.invitedBy.split(':');
      if ((role !== 'admin' && role !== 'user') || !id) return undefined;
      return { role: role as 'admin' | 'user', id };
    })();

    const created = createUser({ username, email, role: newUser.role, invitedBy }, actor);
    if (!created) {
      alert('Not authorized to create that role.');
      return;
    }

    const password = newUser.password.trim() || generateTempPassword();
    const generated = !newUser.password.trim();
    const provisioned = provisionCredentials({
      userId: created.id,
      role: created.role,
      username: created.username,
      email: created.email,
      password,
    });

    if (!provisioned.success) {
      alert(`User created, but credentials were not provisioned (${provisioned.error || 'unknown'}).`);
    } else if (generated) {
      alert(`User created.\nLogin: ${created.email}\nTemporary password: ${password}`);
    }

    setNewUser({ username: '', email: '', role: 'user', invitedBy: '', password: '' });
  };

  const handleCreateAdmin = () => {
    if (!isBoss) return;
    const fullName = newAdmin.fullName.trim();
    const username = newAdmin.username.trim();
    const email = newAdmin.email.trim();
    if (!fullName || !username || !email) {
      alert('Enter full name, username, and email.');
      return;
    }

    const created = createAdminAccount(
      {
        fullName,
        username,
        email,
        phone: newAdmin.phone.trim() || undefined,
        address: newAdmin.address.trim() || undefined,
        commissionWalletAddress: newAdmin.walletAddress.trim() || undefined,
        commissionWalletChain: newAdmin.walletChain,
      },
      actor
    );

    if (!created) {
      alert('Unable to create admin. Username or email may already exist.');
      return;
    }

    const tempPassword = generateTempPassword();
    const provisioned = provisionCredentials({
      userId: created.user.id,
      role: 'admin',
      username: created.user.username,
      email: created.user.email,
      password: tempPassword,
    });

    if (!provisioned.success) {
      alert(`Admin created, but login credentials were not provisioned (${provisioned.error || 'unknown'}).`);
      return;
    }

    setAdminTempPassword(tempPassword);
    alert(`Admin created.\nLogin: ${created.user.email}\nTemporary password: ${tempPassword}\nCredentials should be sent securely to the admin.`);
    setNewAdmin({
      fullName: '',
      username: '',
      email: '',
      phone: '',
      address: '',
      walletChain: 'TRC20',
      walletAddress: '',
    });
  };

  const handleIssueAdminCode = () => {
    if (!currentManagedUser || currentManagedUser.role !== 'admin') return;
    const code = issueAdminVerificationCode(currentManagedUser.id, actor);
    if (!code) {
      alert('Unable to issue verification code.');
      return;
    }
    setAdminSetupCode(code);
    alert(`Verification code issued: ${code}`);
  };

  const handleConfirmAdminCode = () => {
    if (!currentManagedUser || currentManagedUser.role !== 'admin') return;
    const ok = confirmAdminVerificationCode(currentManagedUser.id, adminSetupCode, actor);
    if (!ok) {
      alert('Verification failed.');
      return;
    }
    alert('Verification complete.');
  };

  const handleActivateAdmin = () => {
    if (!currentManagedUser || currentManagedUser.role !== 'admin') return;
    const updated = activateAdminAccount(currentManagedUser.id, actor);
    if (!updated) {
      alert('Activation blocked. Complete profile, verification, and wallet setup first.');
      return;
    }
    setAdminSetupCode('');
    alert('Admin account activated.');
  };

  const handleUpdateAdminWallet = () => {
    if (!currentManagedUser || currentManagedUser.role !== 'admin') return;
    const updated = updateAdminWallet(
      currentManagedUser.id,
      {
        commissionWalletChain: newAdmin.walletChain,
        commissionWalletAddress: newAdmin.walletAddress,
      },
      actor
    );
    if (!updated) {
      alert('Invalid wallet address.');
      return;
    }
    alert('Commission wallet updated.');
  };

  const handleUpdateAdminProfile = () => {
    if (!currentManagedUser || currentManagedUser.role !== 'admin') return;
    const updated = updateAdminProfile(
      currentManagedUser.id,
      {
        fullName: newAdmin.fullName,
        phone: newAdmin.phone,
        address: newAdmin.address,
      },
      actor
    );
    if (!updated) {
      alert('Unable to update profile.');
      return;
    }
    alert('Profile updated.');
  };

  const currentAdminWallet = currentManagedUser ? walletsByUserId[currentManagedUser.id] : null;
  const currentAdminPayouts = useMemo(
    () => referralPayouts.filter((p) => p.referrerId === currentManagedUser?.id),
    [currentManagedUser?.id, referralPayouts]
  );
  const isAdminActive = currentManagedUser?.role === 'admin' && currentManagedUser.status === 'active';

  if (authUser.role === 'admin') {
    const deadlineText = currentAdminProgress?.deadlineAt ? fmtTime(currentAdminProgress.deadlineAt) : '-';
    const activeStatus = currentAdminProgress?.status || 'inactive';

    return (
      <div className={styles.container}>
        <div className="card">
          <div className="card-header">
            <div className={styles.headerRow}>
              <div className={styles.title}>
                <Icon name="user-cog" size="sm" />
                <span>Admin Console</span>
              </div>
              <span className={styles.roleBadge}>Admin</span>
            </div>
          </div>
          <div className="card-body">
            <div className={styles.statsGrid}>
              <div className="card">
                <div className="card-body">
                  <div className={styles.statLabel}>Account Status</div>
                  <div className={styles.statValue}>{activeStatus}</div>
                  <div className={styles.statSub}>Setup deadline: {deadlineText}</div>
                </div>
              </div>
              <div className="card">
                <div className="card-body">
                  <div className={styles.statLabel}>Setup Progress</div>
                  <div className={styles.statValue}>{currentAdminProgress ? `${currentAdminProgress.completed}/${currentAdminProgress.total}` : '0/0'}</div>
                  <div className={styles.statSub}>Complete all steps within 24 hours.</div>
                </div>
              </div>
              <div className="card">
                <div className="card-body">
                  <div className={styles.statLabel}>Commission Balance</div>
                  <div className={styles.statValue}>{formatUSDT(currentAdminWallet?.referralEarningsUSDT || '0')}</div>
                  <div className={styles.statSub}>Referral commissions only</div>
                </div>
              </div>
            </div>

            {!isAdminActive && (
              <div className="card" style={{ marginTop: '1.25rem' }}>
                <div className="card-header">24-Hour Setup Wizard</div>
                <div className="card-body">
                  <div className={styles.formGrid}>
                    <div>
                      <div className={styles.statLabel}>Full name</div>
                      <input
                        className={styles.input}
                        value={newAdmin.fullName}
                        onChange={(e) => setNewAdmin((s) => ({ ...s, fullName: e.target.value }))}
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <div className={styles.statLabel}>Phone</div>
                      <input
                        className={styles.input}
                        value={newAdmin.phone}
                        onChange={(e) => setNewAdmin((s) => ({ ...s, phone: e.target.value }))}
                        placeholder="+1 555 0100"
                      />
                    </div>
                    <div className={styles.checkboxRow}>
                      <input
                        className={styles.input}
                        style={{ height: 36 }}
                        value={newAdmin.address}
                        onChange={(e) => setNewAdmin((s) => ({ ...s, address: e.target.value }))}
                        placeholder="Address"
                      />
                    </div>
                    <div>
                      <div className={styles.statLabel}>Wallet chain</div>
                      <select
                        className={styles.input}
                        value={newAdmin.walletChain}
                        onChange={(e) => setNewAdmin((s) => ({ ...s, walletChain: e.target.value as ChainType }))}
                      >
                        <option value="TRC20">TRC20</option>
                        <option value="ERC20">ERC20</option>
                        <option value="BEP20">BEP20</option>
                      </select>
                    </div>
                    <div>
                      <div className={styles.statLabel}>Commission wallet</div>
                      <input
                        className={styles.input}
                        value={newAdmin.walletAddress}
                        onChange={(e) => setNewAdmin((s) => ({ ...s, walletAddress: e.target.value }))}
                        placeholder="USDT wallet address"
                      />
                    </div>
                  </div>

                  <div className={styles.actions} style={{ marginTop: '1rem' }}>
                    <button className="btn btn-secondary" onClick={handleUpdateAdminProfile}>
                      Save Profile
                    </button>
                    <button className="btn btn-secondary" onClick={handleUpdateAdminWallet}>
                      Save Wallet
                    </button>
                    <button className="btn btn-primary" onClick={handleIssueAdminCode}>
                      Issue OTP
                    </button>
                    <input
                      className={styles.input}
                      style={{ maxWidth: 180 }}
                      value={adminSetupCode}
                      onChange={(e) => setAdminSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="OTP code"
                    />
                    <button className="btn btn-primary" onClick={handleConfirmAdminCode}>
                      Verify OTP
                    </button>
                    <button className="btn btn-primary" onClick={handleActivateAdmin}>
                      Activate Account
                    </button>
                  </div>
                  <div className={styles.statSub} style={{ marginTop: '0.75rem' }}>
                    Admin accounts cannot edit system payment gateway settings.
                  </div>
                </div>
              </div>
            )}

            {isAdminActive && (
              <div className={styles.splitRow} style={{ marginTop: '1.25rem' }}>
                <div className="card">
                  <div className="card-header">Commission Wallet</div>
                  <div className="card-body">
                    <div className={styles.statLabel}>Wallet Address</div>
                    <div className={styles.statValue} style={{ fontSize: '1rem', wordBreak: 'break-word' }}>
                      {currentManagedUser?.commissionWalletAddress || 'Not set'}
                    </div>
                    <div className={styles.statSub}>Chain: {currentManagedUser?.commissionWalletChain || 'TRC20'}</div>
                    <div className={styles.statSub}>Balance: {formatUSDT(currentAdminWallet?.referralEarningsUSDT || '0')}</div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-header">Update Wallet</div>
                  <div className="card-body">
                    <div className={styles.formGrid}>
                      <div>
                        <div className={styles.statLabel}>Chain</div>
                        <select
                          className={styles.input}
                          value={newAdmin.walletChain}
                          onChange={(e) => setNewAdmin((s) => ({ ...s, walletChain: e.target.value as ChainType }))}
                        >
                          <option value="TRC20">TRC20</option>
                          <option value="ERC20">ERC20</option>
                          <option value="BEP20">BEP20</option>
                        </select>
                      </div>
                      <div>
                        <div className={styles.statLabel}>Address</div>
                        <input
                          className={styles.input}
                          value={newAdmin.walletAddress}
                          onChange={(e) => setNewAdmin((s) => ({ ...s, walletAddress: e.target.value }))}
                          placeholder="USDT address"
                        />
                      </div>
                    </div>
                    <div className={styles.actions} style={{ marginTop: '1rem' }}>
                      <button className="btn btn-primary" onClick={handleUpdateAdminWallet}>
                        Update Wallet
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isAdminActive && (
              <div className="card" style={{ marginTop: '1.25rem' }}>
                <div className="card-header">Commission History</div>
                <div className="card-body" style={{ overflowX: 'auto' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Deposit</th>
                        <th>Referrer</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentAdminPayouts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className={styles.muted}>
                            No commission payouts yet.
                          </td>
                        </tr>
                      ) : (
                        currentAdminPayouts.map((payout) => (
                          <tr key={payout.payoutId}>
                            <td className="tabular-nums">{fmtTime(payout.createdAt)}</td>
                            <td>{payout.depositId}</td>
                            <td>{payout.referrerRole}</td>
                            <td className="tabular-nums">{formatUSDT(payout.amountUSDT)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handlePrintManagementReport = () => {
    const stamp = new Date().toLocaleString(getUiLocale());
    const limit = 200;

    const summaryRows = [
      { metric: 'Total System Balance', value: formatUSDT(stats.systemBalance) },
      { metric: 'Users Balance', value: formatUSDT(stats.totalUserBalance) },
      { metric: 'Commission Pool', value: formatUSDT(commissionPoolUSDT) },
      { metric: 'Deposits (Confirmed)', value: formatUSDT(stats.totalDeposits) },
      { metric: 'Withdrawals (Completed)', value: formatUSDT(stats.totalWithdrawals) },
      { metric: 'Profit / Loss', value: formatUSDT(stats.totalPnl) },
      { metric: 'Admin Earnings', value: formatUSDT(stats.adminEarnings) },
      { metric: 'Referral Payouts', value: formatUSDT(stats.totalReferralPayouts) },
      { metric: 'Pending KYC', value: String(stats.pendingKyc) },
      { metric: 'Pending Deposits', value: String(stats.pendingDeposits) },
      { metric: 'Pending Withdrawals', value: String(stats.pendingWithdrawals) },
      { metric: 'Open Trades', value: String(stats.openTrades) },
      { metric: 'KYC Required', value: settings.kycRequired ? 'On' : 'Off' },
      { metric: 'Admin First Deposit Rate', value: `${(settings.adminFirstDepositRate * 100).toFixed(2)}%` },
      { metric: 'User First Deposit Rate', value: `${(settings.userFirstDepositRate * 100).toFixed(2)}%` },
    ];

    const performanceRows = performance.map((p) => ({
      window: p.label,
      depositsUSDT: p.depositsUSDT,
      withdrawalsUSDT: p.withdrawalsUSDT,
      pnlUSDT: p.pnlUSDT,
      payoutsUSDT: p.payoutsUSDT,
      closedTrades: p.closedTrades,
    }));

    const userRows = users.slice(0, limit).map((u) => {
      const wallet = walletsByUserId[u.id];
      return {
        id: u.id,
        role: u.role,
        status: u.status,
        username: u.username,
        email: u.email,
        kycStatus: u.kycStatus,
        lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : '',
        balanceUSDT: wallet?.balanceUSDT ?? '0',
        totalDepositsUSDT: wallet?.totalDepositsUSDT ?? '0',
        totalWithdrawalsUSDT: wallet?.totalWithdrawalsUSDT ?? '0',
        tradingPnlUSDT: wallet?.tradingPnlUSDT ?? '0',
        referralEarningsUSDT: wallet?.referralEarningsUSDT ?? '0',
      };
    });

    const depositRows = deposits.slice(0, limit).map((d) => ({
      depositId: d.depositId,
      userId: d.userId,
      username: users.find((u) => u.id === d.userId)?.username ?? d.userId,
      amountUSDT: d.amountUSDT,
      status: d.status,
      createdAt: new Date(d.createdAt).toISOString(),
      confirmedAt: d.confirmedAt ? new Date(d.confirmedAt).toISOString() : '',
      note: d.note ?? '',
    }));

    const withdrawRows = withdraws.slice(0, limit).map((w) => ({
      withdrawId: w.withdrawId,
      userId: w.userId,
      username: users.find((u) => u.id === w.userId)?.username ?? w.userId,
      amountUSDT: w.amountUSDT,
      feeUSDT: w.feeUSDT,
      status: w.status,
      createdAt: new Date(w.createdAt).toISOString(),
      decidedAt: w.decidedAt ? new Date(w.decidedAt).toISOString() : '',
      completedAt: w.completedAt ? new Date(w.completedAt).toISOString() : '',
      decidedBy: w.decidedBy ?? '',
      note: w.note ?? '',
    }));

    const tradeRows = trades.slice(0, limit).map((t) => ({
      tradeId: t.tradeId,
      userId: t.userId,
      username: users.find((u) => u.id === t.userId)?.username ?? t.userId,
      symbol: t.symbol,
      side: t.side,
      status: t.status,
      quantity: t.quantity,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice ?? '',
      pnlUSDT: t.pnlUSDT ?? '',
      openedAt: new Date(t.openedAt).toISOString(),
      closedAt: t.closedAt ? new Date(t.closedAt).toISOString() : '',
      note: t.note ?? '',
    }));

    const payoutRows = referralPayouts.slice(0, limit).map((p) => ({
      payoutId: p.payoutId,
      createdAt: new Date(p.createdAt).toISOString(),
      invitedUserId: p.invitedUserId,
      invitedUsername: users.find((u) => u.id === p.invitedUserId)?.username ?? p.invitedUserId,
      depositId: p.depositId,
      referrerId: p.referrerId,
      referrerUsername: users.find((u) => u.id === p.referrerId)?.username ?? p.referrerId,
      referrerRole: p.referrerRole,
      rate: p.rate,
      amountUSDT: p.amountUSDT,
    }));

    const kycRows = kycRequests.slice(0, limit).map((k) => ({
      requestId: k.requestId,
      userId: k.userId,
      username: users.find((u) => u.id === k.userId)?.username ?? k.userId,
      status: k.status,
      submittedAt: new Date(k.submittedAt).toISOString(),
      decidedAt: k.decidedAt ? new Date(k.decidedAt).toISOString() : '',
      decidedBy: k.decidedBy ?? '',
      rejectionReason: k.rejectionReason ?? '',
      idDocument: k.files.idDocument,
      selfieWithId: k.files.selfieWithId,
      proofOfAddress: k.files.proofOfAddress ?? '',
    }));

    const auditRows = auditLog.slice(0, limit).map((a) => ({
      createdAt: new Date(a.createdAt).toISOString(),
      actorRole: a.actorRole,
      actorId: a.actorId,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      detail: a.detail ?? '',
    }));

    const paymentRows = paymentMethods.slice(0, limit).map((m) => {
      if (m.type === 'bank') {
        return {
          id: m.id,
          type: m.type,
          enabled: m.enabled,
          label: m.label,
          bankName: m.bankName,
          accountName: m.accountName,
          accountNumber: m.accountNumber,
          swiftCode: m.swiftCode ?? '',
          address: '',
          provider: '',
          publicKey: '',
          updatedAt: new Date(m.updatedAt).toISOString(),
        };
      }
      if (m.type === 'crypto') {
        return {
          id: m.id,
          type: m.type,
          enabled: m.enabled,
          label: m.label,
          bankName: '',
          accountName: '',
          accountNumber: '',
          swiftCode: '',
          address: `${m.chain}:${m.address}`,
          provider: '',
          publicKey: '',
          updatedAt: new Date(m.updatedAt).toISOString(),
        };
      }
      return {
        id: m.id,
        type: m.type,
        enabled: m.enabled,
        label: m.label,
        bankName: '',
        accountName: '',
        accountNumber: '',
        swiftCode: '',
        address: '',
        provider: m.provider,
        publicKey: m.publicKey,
        updatedAt: new Date(m.updatedAt).toISOString(),
      };
    });

    const body = `
      <h1>Trading Management System Report</h1>
      <p class="meta">${escapeHtml(stamp)} | Role: ${escapeHtml(roleLabel)} | Actor: ${escapeHtml(authUser.email || authUser.username)}</p>
      <p class="meta">Row limits: showing up to ${limit} rows per table.</p>

      <h2>Summary</h2>
      ${toHtmlTable(['metric', 'value'], summaryRows)}

      <h2>Performance</h2>
      ${toHtmlTable(['window', 'depositsUSDT', 'withdrawalsUSDT', 'pnlUSDT', 'payoutsUSDT', 'closedTrades'], performanceRows)}

      <h2>Users</h2>
      ${toHtmlTable(
        ['id', 'role', 'status', 'username', 'email', 'kycStatus', 'lastLoginAt', 'balanceUSDT', 'totalDepositsUSDT', 'totalWithdrawalsUSDT', 'tradingPnlUSDT', 'referralEarningsUSDT'],
        userRows
      )}

      <h2>Deposits</h2>
      ${toHtmlTable(['depositId', 'userId', 'username', 'amountUSDT', 'status', 'createdAt', 'confirmedAt', 'note'], depositRows)}

      <h2>Withdrawals</h2>
      ${toHtmlTable(['withdrawId', 'userId', 'username', 'amountUSDT', 'feeUSDT', 'status', 'createdAt', 'decidedAt', 'completedAt', 'decidedBy', 'note'], withdrawRows)}

      <h2>Trades</h2>
      ${toHtmlTable(['tradeId', 'userId', 'username', 'symbol', 'side', 'status', 'quantity', 'entryPrice', 'exitPrice', 'pnlUSDT', 'openedAt', 'closedAt', 'note'], tradeRows)}

      <h2>Referral Payouts</h2>
      ${toHtmlTable(['payoutId', 'createdAt', 'invitedUserId', 'invitedUsername', 'depositId', 'referrerId', 'referrerUsername', 'referrerRole', 'rate', 'amountUSDT'], payoutRows)}

      <h2>KYC Requests</h2>
      ${toHtmlTable(['requestId', 'userId', 'username', 'status', 'submittedAt', 'decidedAt', 'decidedBy', 'rejectionReason', 'idDocument', 'selfieWithId', 'proofOfAddress'], kycRows)}

      ${isBoss ? `<h2>Payment Methods</h2>${toHtmlTable(['id', 'type', 'enabled', 'label', 'bankName', 'accountName', 'accountNumber', 'swiftCode', 'address', 'provider', 'publicKey', 'updatedAt'], paymentRows)}` : ''}

      <h2>Audit Log</h2>
      ${toHtmlTable(['createdAt', 'actorRole', 'actorId', 'action', 'targetType', 'targetId', 'detail'], auditRows)}
    `;

    openPrintWindow('TMS Management Report', body);
  };

  return (
    <div className={styles.container}>
      <div className="card">
        <div className="card-header">
          <div className={styles.headerRow}>
            <div className={styles.title}>
              <Icon name="user-cog" size="sm" />
              <span>Management</span>
            </div>
            <span className={styles.roleBadge}>{roleLabel}</span>
          </div>
        </div>

        <div className="card-body">
          {isMobile && (
            <p className={styles.mobileNote}>
              This console works best on desktop. All actions still work on mobile, but tables may scroll.
            </p>
          )}

          <div className={styles.tabs}>
            <button
              className={`btn ${styles.tabBtn} ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            {isBoss && (
              <button
                className={`btn ${styles.tabBtn} ${activeTab === 'admins' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('admins')}
              >
                Admins
              </button>
            )}
            <button
              className={`btn ${styles.tabBtn} ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('users')}
            >
              Users
            </button>
            <button
              className={`btn ${styles.tabBtn} ${activeTab === 'kyc' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('kyc')}
            >
              KYC
            </button>
            <button
              className={`btn ${styles.tabBtn} ${activeTab === 'finance' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('finance')}
            >
              Finance
            </button>
            <button
              className={`btn ${styles.tabBtn} ${activeTab === 'trading' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('trading')}
            >
              Trading
            </button>
            <button
              className={`btn ${styles.tabBtn} ${activeTab === 'notifications' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('notifications')}
            >
              Notifications
            </button>
            {isBoss && (
              <button
                className={`btn ${styles.tabBtn} ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('payments')}
              >
                Payments
              </button>
            )}
            <button
              className={`btn ${styles.tabBtn} ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('reports')}
            >
              Reports
            </button>
            {isBoss && (
              <button
                className={`btn ${styles.tabBtn} ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            )}
          </div>

          {activeTab === 'dashboard' && (
            <div className={styles.section}>
              <div className={styles.statsGrid}>
                <div className="card">
                  <div className="card-body">
                    <div className={styles.statLabel}>Total System Balance</div>
                    <div className={`${styles.statValue} tabular-nums`}>{formatUSDT(stats.systemBalance)}</div>
                    <div className={styles.statSub}>
                      Users: <span className="tabular-nums">{formatUSDT(stats.totalUserBalance)}</span> | Pool:{' '}
                      <span className="tabular-nums">{formatUSDT(commissionPoolUSDT)}</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className={styles.statLabel}>Deposits (Confirmed)</div>
                    <div className={`${styles.statValue} tabular-nums`}>{formatUSDT(stats.totalDeposits)}</div>
                    <div className={styles.statSub}>
                      Pending deposits: <span className="tabular-nums">{stats.pendingDeposits}</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className={styles.statLabel}>Withdrawals (Completed)</div>
                    <div className={`${styles.statValue} tabular-nums`}>{formatUSDT(stats.totalWithdrawals)}</div>
                    <div className={styles.statSub}>
                      Pending withdrawals: <span className="tabular-nums">{stats.pendingWithdrawals}</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className={styles.statLabel}>Profit / Loss</div>
                    <div className={`${styles.statValue} tabular-nums`}>{formatUSDT(stats.totalPnl)}</div>
                    <div className={styles.statSub}>
                      Active traders: <span className="tabular-nums">{stats.activeTraders}</span> | Open trades:{' '}
                      <span className="tabular-nums">{stats.openTrades}</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className={styles.statLabel}>Performance</div>
                    <div className={styles.statSub}>Last 24h / 7d / 30d</div>
                    <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                      {performance.map((p) => (
                        <div key={p.label} className={styles.statSub}>
                          <span className="tabular-nums">{p.label}</span>: Dep{' '}
                          <span className="tabular-nums">{formatUSDT(p.depositsUSDT)}</span> | Wd{' '}
                          <span className="tabular-nums">{formatUSDT(p.withdrawalsUSDT)}</span> | PnL{' '}
                          <span className="tabular-nums">{formatUSDT(p.pnlUSDT)}</span> | Payouts{' '}
                          <span className="tabular-nums">{formatUSDT(p.payoutsUSDT)}</span> | Trades{' '}
                          <span className="tabular-nums">{p.closedTrades}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className={styles.statLabel}>Admin Earnings</div>
                    <div className={`${styles.statValue} tabular-nums`}>{formatUSDT(stats.adminEarnings)}</div>
                    <div className={styles.statSub}>
                      Referral payouts: <span className="tabular-nums">{formatUSDT(stats.totalReferralPayouts)}</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    <div className={styles.statLabel}>Pending KYC</div>
                    <div className={`${styles.statValue} tabular-nums`}>{stats.pendingKyc}</div>
                    <div className={styles.statSub}>
                      KYC required:{' '}
                      <Pill tone={settings.kycRequired ? 'warn' : 'good'}>{settings.kycRequired ? 'on' : 'off'}</Pill>
                    </div>
                  </div>
                </div>
              </div>

              {isBoss && (
                <div className="card">
                  <div className="card-header">Maintenance</div>
                  <div className="card-body">
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        if (window.confirm('Reset demo management data?')) resetDemo();
                      }}
                    >
                      Reset Demo Data
                    </button>
                    <div className={styles.statSub} style={{ marginTop: '0.75rem' }}>
                      Audit entries: <span className="tabular-nums">{auditLog.length}</span> | Payment methods:{' '}
                      <span className="tabular-nums">{paymentMethods.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'admins' && isBoss && (
            <div className={styles.section}>
              <div className={styles.splitRow}>
                <div className="card">
                  <div className="card-header">Create Admin</div>
                  <div className="card-body">
                    <div className={styles.formGrid}>
                      <div>
                        <div className={styles.statLabel}>Full name</div>
                        <input className={styles.input} value={newAdmin.fullName} onChange={(e) => setNewAdmin((s) => ({ ...s, fullName: e.target.value }))} placeholder="Admin full name" />
                      </div>
                      <div>
                        <div className={styles.statLabel}>Username</div>
                        <input className={styles.input} value={newAdmin.username} onChange={(e) => setNewAdmin((s) => ({ ...s, username: e.target.value }))} placeholder="admin.username" />
                      </div>
                      <div>
                        <div className={styles.statLabel}>Login email</div>
                        <input className={styles.input} value={newAdmin.email} onChange={(e) => setNewAdmin((s) => ({ ...s, email: e.target.value }))} placeholder="admin@apexora.com" />
                      </div>
                      <div>
                        <div className={styles.statLabel}>Phone</div>
                        <input className={styles.input} value={newAdmin.phone} onChange={(e) => setNewAdmin((s) => ({ ...s, phone: e.target.value }))} placeholder="+1 555 0100" />
                      </div>
                      <div className={styles.checkboxRow}>
                        <input className={styles.input} style={{ height: 36 }} value={newAdmin.address} onChange={(e) => setNewAdmin((s) => ({ ...s, address: e.target.value }))} placeholder="Address" />
                      </div>
                      <div>
                        <div className={styles.statLabel}>Wallet chain</div>
                        <select className={styles.input} value={newAdmin.walletChain} onChange={(e) => setNewAdmin((s) => ({ ...s, walletChain: e.target.value as ChainType }))}>
                          <option value="TRC20">TRC20</option>
                          <option value="ERC20">ERC20</option>
                          <option value="BEP20">BEP20</option>
                        </select>
                      </div>
                      <div>
                        <div className={styles.statLabel}>Commission wallet</div>
                        <input className={styles.input} value={newAdmin.walletAddress} onChange={(e) => setNewAdmin((s) => ({ ...s, walletAddress: e.target.value }))} placeholder="USDT address" />
                      </div>
                    </div>
                    <div className={styles.actions} style={{ marginTop: '1rem' }}>
                      <button className="btn btn-primary" onClick={handleCreateAdmin}>
                        <Icon name="plus" size="xs" /> Create Admin
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setNewAdmin({ fullName: '', username: '', email: '', phone: '', address: '', walletChain: 'TRC20', walletAddress: '' })}
                      >
                        Clear
                      </button>
                    </div>
                    {adminTempPassword && (
                      <div className={styles.statSub} style={{ marginTop: '0.75rem' }}>
                        Temporary password issued: <span className="tabular-nums">{adminTempPassword}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">Admin Accounts</div>
                  <div className="card-body" style={{ overflowX: 'auto' }}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Admin</th>
                          <th>Status</th>
                          <th>Setup</th>
                          <th>Wallet</th>
                          <th>Deadline</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admins.map((admin) => (
                          <tr key={admin.id}>
                            <td>
                              <div>{admin.fullName || admin.username}</div>
                              <div className={styles.muted}>{admin.email}</div>
                            </td>
                            <td><Pill tone={statusTone(admin.status)}>{admin.status}</Pill></td>
                            <td>{admin.adminVerifiedAt ? <Pill tone="good">verified</Pill> : <Pill tone="warn">pending</Pill>}</td>
                            <td className={styles.muted}>{admin.commissionWalletAddress || 'Not set'}</td>
                            <td className="tabular-nums">{fmtTime(admin.adminSetupDeadlineAt)}</td>
                            <td className={styles.actions}>
                              <button
                                className="btn btn-secondary"
                                onClick={() => {
                                  const nextTemp = generateTempPassword();
                                  const res = provisionCredentials({ userId: admin.id, role: 'admin', username: admin.username, email: admin.email, password: nextTemp });
                                  if (!res.success) {
                                    alert(`Unable to resend credentials (${res.error || 'unknown'}).`);
                                    return;
                                  }
                                  setAdminTempPassword(nextTemp);
                                  alert(`Credentials resent.\nLogin: ${admin.email}\nTemporary password: ${nextTemp}`);
                                }}
                              >
                                Resend Credentials
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={() => {
                                  setNewAdmin({
                                    fullName: admin.fullName || '',
                                    username: admin.username,
                                    email: admin.email,
                                    phone: admin.phone || '',
                                    address: admin.address || '',
                                    walletChain: admin.commissionWalletChain || 'TRC20',
                                    walletAddress: admin.commissionWalletAddress || '',
                                  });
                                  setActiveTab('admins');
                                }}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className={styles.section}>
              <div className="card">
                <div className="card-header">Create User</div>
                <div className="card-body">
                  <div className={styles.formGrid}>
                    <div>
                      <div className={styles.statLabel}>Username</div>
                      <input
                        className={styles.input}
                        value={newUser.username}
                        onChange={(e) => setNewUser((s) => ({ ...s, username: e.target.value }))}
                        placeholder="e.g. alice"
                      />
                    </div>
                    <div>
                      <div className={styles.statLabel}>Email</div>
                      <input
                        className={styles.input}
                        value={newUser.email}
                        onChange={(e) => setNewUser((s) => ({ ...s, email: e.target.value }))}
                        placeholder="e.g. alice@paper.trading"
                      />
                    </div>
                    <div>
                      <div className={styles.statLabel}>Role</div>
                      <select
                        className={styles.input}
                        value={newUser.role}
                        onChange={(e) => setNewUser((s) => ({ ...s, role: e.target.value as UserRole }))}
                      >
                        {roleOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className={styles.statLabel}>Referrer (First Deposit Only)</div>
                      <select
                        className={styles.input}
                        value={newUser.invitedBy}
                        onChange={(e) => setNewUser((s) => ({ ...s, invitedBy: e.target.value }))}
                      >
                        {referrerOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className={styles.statLabel}>Initial Password</div>
                      <input
                        className={styles.input}
                        type="text"
                        value={newUser.password}
                        onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))}
                        placeholder="Leave blank to auto-generate"
                      />
                    </div>
                  </div>

                  <div className={styles.actions} style={{ marginTop: '1rem' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setNewUser((s) => ({ ...s, password: generateTempPassword() }))}
                    >
                      Generate Password
                    </button>
                    <button className="btn btn-primary" onClick={handleCreateUser}>
                      <Icon name="plus" size="xs" /> Create
                    </button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">Users</div>
                <div className="card-body" style={{ overflowX: 'auto' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>KYC</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Login</th>
                        <th>Referrer</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => {
                        const hasCreds = (credentialCountByUserId[u.id] || 0) > 0;
                        const canManage = u.role !== 'boss' && (u.role === 'user' || (isBoss && u.role === 'admin'));

                        return (
                          <tr key={u.id}>
                            <td className="tabular-nums">{u.id}</td>
                            <td>
                              <Pill>{u.role}</Pill>
                            </td>
                            <td>
                              <Pill tone={statusTone(u.status)}>{u.status}</Pill>
                            </td>
                            <td>
                              <Pill tone={kycTone(u.kycStatus)}>{u.kycStatus}</Pill>
                            </td>
                            <td>{u.username}</td>
                            <td>{u.email}</td>
                            <td>
                              <Pill tone={hasCreds ? 'good' : 'warn'}>{hasCreds ? 'provisioned' : 'missing'}</Pill>
                            </td>
                            <td className={styles.muted}>{u.invitedBy ? `${u.invitedBy.role}:${u.invitedBy.id}` : '-'}</td>
                            <td className="tabular-nums">{fmtTime(u.createdAt)}</td>
                            <td className={styles.actions}>
                              {canManage && (
                                <button
                                  className="btn btn-secondary"
                                  onClick={() =>
                                    setUserStatus(u.id, u.status === 'active' ? 'disabled' : 'active', actor)
                                  }
                                >
                                  {u.status === 'active' ? 'Disable' : 'Enable'}
                                </button>
                              )}

                              {canManage && (
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => {
                                    const nextUsername = window.prompt('Update username:', u.username);
                                    if (nextUsername === null) return;
                                    const nextEmail = window.prompt('Update email:', u.email);
                                    if (nextEmail === null) return;
                                    const updated = updateUserProfile(u.id, { username: nextUsername, email: nextEmail }, actor);
                                    if (!updated) {
                                      alert('Update failed (duplicate username/email or not authorized).');
                                      return;
                                    }
                                    if (hasCreds) {
                                      const rekey = rekeyCredentialsForUser(updated.id, updated.username, updated.email);
                                      if (!rekey.success) {
                                        alert(
                                          `Profile updated, but auth credentials could not be re-keyed (${rekey.error || 'unknown'}).`
                                        );
                                      }
                                    }
                                  }}
                                >
                                  Edit
                                </button>
                              )}

                              {canManage && hasCreds && (
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => {
                                    const next = window.prompt('New password (min 6 chars):');
                                    if (next === null) return;
                                    const pass = next.trim();
                                    if (!pass) return;
                                    const res = resetPasswordForUser(u.id, pass);
                                    if (!res.success) {
                                      alert(`Password reset failed (${res.error || 'unknown'}).`);
                                    } else {
                                      alert('Password updated.');
                                    }
                                  }}
                                >
                                  Reset Password
                                </button>
                              )}

                              {canManage && !hasCreds && (
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => {
                                    const next = window.prompt('Set a temporary password (leave blank to auto-generate):');
                                    if (next === null) return;
                                    const pass = next.trim() || generateTempPassword();
                                    const res = provisionCredentials({
                                      userId: u.id,
                                      role: u.role,
                                      username: u.username,
                                      email: u.email,
                                      password: pass,
                                    });
                                    if (!res.success) {
                                      alert(`Provision failed (${res.error || 'unknown'}).`);
                                      return;
                                    }
                                    alert(`Credentials provisioned.\nLogin: ${u.email}\nPassword: ${pass}`);
                                  }}
                                >
                                  Provision Login
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'kyc' && (
            <div className={styles.section}>
              <div className="card">
                <div className="card-header">KYC Requests</div>
                <div className="card-body" style={{ overflowX: 'auto' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Request</th>
                        <th>User</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th>Files</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kycRequests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className={styles.muted}>
                            No KYC requests.
                          </td>
                        </tr>
                      ) : (
                        kycRequests.map((req) => {
                          const u = users.find((x) => x.id === req.userId);
                          const canDecide = req.status === 'pending' || req.status === 'needs_reupload';
                          return (
                            <tr key={req.requestId}>
                              <td className="tabular-nums">{req.requestId}</td>
                              <td>{u ? u.username : req.userId}</td>
                              <td>
                                <Pill tone={statusTone(req.status)}>{req.status}</Pill>
                              </td>
                              <td className="tabular-nums">{fmtTime(req.submittedAt)}</td>
                              <td className={styles.muted}>
                                {req.files.idDocument}, {req.files.selfieWithId}
                                {req.files.proofOfAddress ? `, ${req.files.proofOfAddress}` : ''}
                              </td>
                              <td className={styles.actions}>
                                {canDecide && (
                                  <>
                                    <button
                                      className="btn btn-primary"
                                      onClick={() => decideKyc(req.requestId, 'approve', actor)}
                                    >
                                      Approve
                                    </button>
                                    <button
                                      className="btn btn-secondary"
                                      onClick={() => {
                                        const reason = window.prompt('Reject reason (optional):') || undefined;
                                        decideKyc(req.requestId, 'reject', actor, reason);
                                      }}
                                    >
                                      Reject
                                    </button>
                                    <button
                                      className="btn btn-secondary"
                                      onClick={() => {
                                        const note = window.prompt('Re-upload note (optional):') || undefined;
                                        decideKyc(req.requestId, 'reupload', actor, note);
                                      }}
                                    >
                                      Request Re-upload
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'finance' && (
            <div className={styles.section}>
              <div className={styles.splitRow}>
                <div className="card">
                  <div className="card-header">Create Deposit</div>
                  <div className="card-body">
                    <div className={styles.formGrid}>
                      <div>
                        <div className={styles.statLabel}>User</div>
                        <select
                          className={styles.input}
                          value={newDeposit.userId}
                          onChange={(e) => setNewDeposit((s) => ({ ...s, userId: e.target.value }))}
                        >
                          {traders.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username} ({u.id})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className={styles.statLabel}>Amount (USDT)</div>
                        <input
                          className={styles.input}
                          value={newDeposit.amountUSDT}
                          onChange={(e) => setNewDeposit((s) => ({ ...s, amountUSDT: e.target.value }))}
                          placeholder="e.g. 1000"
                        />
                      </div>
                      <div className={styles.checkboxRow}>
                        <input
                          className={styles.input}
                          style={{ height: 36 }}
                          value={newDeposit.note}
                          onChange={(e) => setNewDeposit((s) => ({ ...s, note: e.target.value }))}
                          placeholder="Note (optional)"
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem' }} className={styles.actions}>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          if (!newDeposit.userId) return;
                          const amount = newDeposit.amountUSDT.trim();
                          const n = Number(amount);
                          if (!amount || !Number.isFinite(n) || n <= 0) {
                            alert('Enter a positive deposit amount.');
                            return;
                          }
                          createDeposit(newDeposit.userId, amount, actor, newDeposit.note.trim() || undefined);
                          setNewDeposit((s) => ({ ...s, amountUSDT: '', note: '' }));
                        }}
                      >
                        <Icon name="plus" size="xs" /> Create
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">Create Withdrawal</div>
                  <div className="card-body">
                    <div className={styles.formGrid}>
                      <div>
                        <div className={styles.statLabel}>User</div>
                        <select
                          className={styles.input}
                          value={newWithdraw.userId}
                          onChange={(e) => setNewWithdraw((s) => ({ ...s, userId: e.target.value }))}
                        >
                          {traders.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username} ({u.id})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className={styles.statLabel}>Amount (USDT)</div>
                        <input
                          className={styles.input}
                          value={newWithdraw.amountUSDT}
                          onChange={(e) => setNewWithdraw((s) => ({ ...s, amountUSDT: e.target.value }))}
                          placeholder="e.g. 200"
                        />
                      </div>
                      <div>
                        <div className={styles.statLabel}>Fee (USDT)</div>
                        <input
                          className={styles.input}
                          value={newWithdraw.feeUSDT}
                          onChange={(e) => setNewWithdraw((s) => ({ ...s, feeUSDT: e.target.value }))}
                          placeholder="e.g. 1"
                        />
                      </div>
                      <div>
                        <div className={styles.statLabel}>Note (optional)</div>
                        <input
                          className={styles.input}
                          value={newWithdraw.note}
                          onChange={(e) => setNewWithdraw((s) => ({ ...s, note: e.target.value }))}
                          placeholder="e.g. USDT payout"
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem' }} className={styles.actions}>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          if (!newWithdraw.userId) return;
                          const amount = newWithdraw.amountUSDT.trim();
                          const fee = newWithdraw.feeUSDT.trim() || '0';
                          const n = Number(amount);
                          const f = Number(fee);
                          if (!amount || !Number.isFinite(n) || n <= 0) {
                            alert('Enter a positive withdrawal amount.');
                            return;
                          }
                          if (!Number.isFinite(f) || f < 0) {
                            alert('Fee must be >= 0.');
                            return;
                          }
                          createWithdraw(newWithdraw.userId, amount, fee, actor, newWithdraw.note.trim() || undefined);
                          setNewWithdraw((s) => ({ ...s, amountUSDT: '', note: '' }));
                        }}
                      >
                        <Icon name="plus" size="xs" /> Create
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.splitRow}>
                <div className="card">
                  <div className="card-header">Deposits</div>
                  <div className="card-body" style={{ overflowX: 'auto' }}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>User</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deposits.length === 0 ? (
                          <tr>
                            <td colSpan={6} className={styles.muted}>
                              No deposits.
                            </td>
                          </tr>
                        ) : (
                          deposits.map((d) => {
                            const u = users.find((x) => x.id === d.userId);
                            return (
                              <tr key={d.depositId}>
                                <td className="tabular-nums">{d.depositId}</td>
                                <td>{u ? u.username : d.userId}</td>
                                <td className="tabular-nums">{formatUSDT(d.amountUSDT)}</td>
                                <td>
                                  <Pill tone={statusTone(d.status)}>{d.status}</Pill>
                                </td>
                                <td className="tabular-nums">{fmtTime(d.createdAt)}</td>
                                <td className={styles.actions}>
                                  {d.status === 'pending' && (
                                    <button
                                      className="btn btn-primary"
                                      onClick={() => confirmDeposit(d.depositId, actor)}
                                    >
                                      Confirm
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">Withdrawals</div>
                  <div className="card-body" style={{ overflowX: 'auto' }}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>User</th>
                          <th>Amount</th>
                          <th>Fee</th>
                          <th>Status</th>
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {withdraws.length === 0 ? (
                          <tr>
                            <td colSpan={7} className={styles.muted}>
                              No withdrawals.
                            </td>
                          </tr>
                        ) : (
                          withdraws.map((w) => {
                            const u = users.find((x) => x.id === w.userId);
                            return (
                              <tr key={w.withdrawId}>
                                <td className="tabular-nums">{w.withdrawId}</td>
                                <td>{u ? u.username : w.userId}</td>
                                <td className="tabular-nums">{formatUSDT(w.amountUSDT)}</td>
                                <td className="tabular-nums">{formatUSDT(w.feeUSDT)}</td>
                                <td>
                                  <Pill tone={statusTone(w.status)}>{w.status}</Pill>
                                </td>
                                <td className="tabular-nums">{fmtTime(w.createdAt)}</td>
                                <td className={styles.actions}>
                                  {w.status === 'pending' && (
                                    <>
                                      <button
                                        className="btn btn-primary"
                                        onClick={() => decideWithdraw(w.withdrawId, 'approve', actor)}
                                      >
                                        Approve
                                      </button>
                                      <button
                                        className="btn btn-secondary"
                                        onClick={() => {
                                          const note = window.prompt('Reject reason (optional):') || undefined;
                                          decideWithdraw(w.withdrawId, 'reject', actor, note);
                                        }}
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}

                                  {w.status === 'approved' && (
                                    <button
                                      className="btn btn-primary"
                                      onClick={() => completeWithdraw(w.withdrawId, actor)}
                                    >
                                      Mark Completed
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">Referral Payouts (First Deposit Only)</div>
                <div className="card-body" style={{ overflowX: 'auto' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Payout</th>
                        <th>Invited User</th>
                        <th>Referrer</th>
                        <th>Rate</th>
                        <th>Amount</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referralPayouts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className={styles.muted}>
                            No referral payouts.
                          </td>
                        </tr>
                      ) : (
                        referralPayouts.map((p) => {
                          const invited = users.find((x) => x.id === p.invitedUserId);
                          const ref = users.find((x) => x.id === p.referrerId);
                          return (
                            <tr key={p.payoutId}>
                              <td className="tabular-nums">{p.payoutId}</td>
                              <td>{invited ? invited.username : p.invitedUserId}</td>
                              <td>
                                {ref ? ref.username : p.referrerId}{' '}
                                <span className={styles.muted}>({p.referrerRole})</span>
                              </td>
                              <td className="tabular-nums">{(p.rate * 100).toFixed(2)}%</td>
                              <td className="tabular-nums">{formatUSDT(p.amountUSDT)}</td>
                              <td className="tabular-nums">{fmtTime(p.createdAt)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>

                  <div className={styles.statSub} style={{ marginTop: '0.75rem' }}>
                    Commission pool balance:{' '}
                    <span className="tabular-nums">{formatUSDT(commissionPoolUSDT)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'trading' && (
            <div className={styles.section}>
              <div className={styles.splitRow}>
                <div className="card">
                  <div className="card-header">Manual Trade</div>
                  <div className="card-body">
                    <div className={styles.formGrid}>
                      <div>
                        <div className={styles.statLabel}>User</div>
                        <select
                          className={styles.input}
                          value={newTrade.userId}
                          onChange={(e) => setNewTrade((s) => ({ ...s, userId: e.target.value }))}
                        >
                          {traders.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username} ({u.id})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className={styles.statLabel}>Symbol</div>
                        <input
                          className={styles.input}
                          value={newTrade.symbol}
                          onChange={(e) => setNewTrade((s) => ({ ...s, symbol: e.target.value }))}
                          placeholder="e.g. BTCUSDT"
                        />
                      </div>
                      <div>
                        <div className={styles.statLabel}>Side</div>
                        <select
                          className={styles.input}
                          value={newTrade.side}
                          onChange={(e) => setNewTrade((s) => ({ ...s, side: e.target.value as TradeSide }))}
                        >
                          <option value="long">Long</option>
                          <option value="short">Short</option>
                        </select>
                      </div>
                      <div>
                        <div className={styles.statLabel}>Quantity</div>
                        <input
                          className={styles.input}
                          value={newTrade.quantity}
                          onChange={(e) => setNewTrade((s) => ({ ...s, quantity: e.target.value }))}
                          placeholder="e.g. 0.10"
                        />
                      </div>
                      <div>
                        <div className={styles.statLabel}>Entry Price</div>
                        <input
                          className={styles.input}
                          value={newTrade.entryPrice}
                          onChange={(e) => setNewTrade((s) => ({ ...s, entryPrice: e.target.value }))}
                          placeholder="e.g. 65000"
                        />
                      </div>
                      <div>
                        <div className={styles.statLabel}>Note (optional)</div>
                        <input
                          className={styles.input}
                          value={newTrade.note}
                          onChange={(e) => setNewTrade((s) => ({ ...s, note: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem' }} className={styles.actions}>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          if (!newTrade.userId) return;
                          const created = createTrade(
                            newTrade.userId,
                            {
                              symbol: newTrade.symbol,
                              side: newTrade.side,
                              quantity: newTrade.quantity,
                              entryPrice: newTrade.entryPrice,
                            },
                            actor,
                            newTrade.note.trim() || undefined
                          );
                          if (!created) {
                            alert('Could not create trade. Check inputs/permissions.');
                            return;
                          }
                          setNewTrade((s) => ({ ...s, quantity: '', entryPrice: '', note: '' }));
                        }}
                      >
                        <Icon name="plus" size="xs" /> Create Trade
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">Trading Summary</div>
                  <div className="card-body">
                    <div className={styles.statLabel}>Open Trades</div>
                    <div className={`${styles.statValue} tabular-nums`}>{openTrades.length}</div>
                    <div className={styles.statSub}>
                      Closed trades: <span className="tabular-nums">{closedTrades.length}</span>
                    </div>
                    <div className={styles.statSub} style={{ marginTop: '0.75rem' }}>
                      Total PnL (users): <span className="tabular-nums">{formatUSDT(stats.totalPnl)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">Open Trades</div>
                <div className="card-body" style={{ overflowX: 'auto' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Symbol</th>
                        <th>Side</th>
                        <th>Qty</th>
                        <th>Entry</th>
                        <th>Opened</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openTrades.length === 0 ? (
                        <tr>
                          <td colSpan={8} className={styles.muted}>
                            No open trades.
                          </td>
                        </tr>
                      ) : (
                        openTrades.map((t: TmsTrade) => {
                          const u = users.find((x) => x.id === t.userId);
                          return (
                            <tr key={t.tradeId}>
                              <td className="tabular-nums">{t.tradeId}</td>
                              <td>{u ? u.username : t.userId}</td>
                              <td className="tabular-nums">{t.symbol}</td>
                              <td>
                                <Pill>{t.side}</Pill>
                              </td>
                              <td className="tabular-nums">{t.quantity}</td>
                              <td className="tabular-nums">{t.entryPrice}</td>
                              <td className="tabular-nums">{fmtTime(t.openedAt)}</td>
                              <td className={styles.actions}>
                                <button
                                  className="btn btn-primary"
                                  onClick={() => {
                                    const exit = window.prompt('Exit price:');
                                    if (!exit) return;
                                    const note = window.prompt('Close note (optional):') || undefined;
                                    closeTrade(t.tradeId, exit, actor, note);
                                  }}
                                >
                                  Close
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <div className="card-header">Closed Trades</div>
                <div className="card-body" style={{ overflowX: 'auto' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Symbol</th>
                        <th>Side</th>
                        <th>Qty</th>
                        <th>Entry</th>
                        <th>Exit</th>
                        <th>PnL</th>
                        <th>Closed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedTrades.length === 0 ? (
                        <tr>
                          <td colSpan={9} className={styles.muted}>
                            No closed trades.
                          </td>
                        </tr>
                      ) : (
                        closedTrades.slice(0, 200).map((t: TmsTrade) => {
                          const u = users.find((x) => x.id === t.userId);
                          const pnl = t.pnlUSDT || '0';
                          const pnlNum = Number(pnl);
                          return (
                            <tr key={t.tradeId}>
                              <td className="tabular-nums">{t.tradeId}</td>
                              <td>{u ? u.username : t.userId}</td>
                              <td className="tabular-nums">{t.symbol}</td>
                              <td>
                                <Pill>{t.side}</Pill>
                              </td>
                              <td className="tabular-nums">{t.quantity}</td>
                              <td className="tabular-nums">{t.entryPrice}</td>
                              <td className="tabular-nums">{t.exitPrice || '-'}</td>
                              <td className="tabular-nums">
                                <Pill tone={Number.isFinite(pnlNum) ? (pnlNum > 0 ? 'good' : pnlNum < 0 ? 'bad' : undefined) : undefined}>
                                  {formatUSDT(pnl)}
                                </Pill>
                              </td>
                              <td className="tabular-nums">{fmtTime(t.closedAt)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                  {closedTrades.length > 200 && (
                    <div className={styles.statSub} style={{ marginTop: '0.75rem' }}>
                      Showing 200 / <span className="tabular-nums">{closedTrades.length}</span> closed trades.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className={styles.section}>
              <div className={styles.splitRow}>
                <div className="card">
                  <div className="card-header">Send Message</div>
                  <div className="card-body">
                    <div className={styles.formGrid}>
                      <div>
                        <div className={styles.statLabel}>Recipient</div>
                        <select
                          className={styles.input}
                          value={newMessage.to}
                          onChange={(e) => setNewMessage((s) => ({ ...s, to: e.target.value }))}
                        >
                          {messageRecipients.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className={styles.statLabel}>Kind</div>
                        <select
                          className={styles.input}
                          value={newMessage.kind}
                          onChange={(e) => setNewMessage((s) => ({ ...s, kind: e.target.value as MessageKind }))}
                        >
                          <option value="manual">manual</option>
                          <option value="system">system</option>
                          <option value="trade_opened">trade_opened</option>
                          <option value="trade_closed">trade_closed</option>
                          <option value="deposit_confirmed">deposit_confirmed</option>
                          <option value="withdraw_approved">withdraw_approved</option>
                          <option value="withdraw_rejected">withdraw_rejected</option>
                          <option value="kyc_approved">kyc_approved</option>
                          <option value="kyc_rejected">kyc_rejected</option>
                        </select>
                      </div>

                      <div className={styles.checkboxRow}>
                        <div style={{ width: '100%' }}>
                          <div className={styles.statLabel}>Title</div>
                          <input
                            className={styles.input}
                            value={newMessage.title}
                            onChange={(e) => setNewMessage((s) => ({ ...s, title: e.target.value }))}
                            placeholder="Short subject…"
                          />
                        </div>
                      </div>

                      <div className={styles.checkboxRow}>
                        <div style={{ width: '100%' }}>
                          <div className={styles.statLabel}>Body</div>
                          <textarea
                            className={styles.textarea}
                            rows={5}
                            value={newMessage.body}
                            onChange={(e) => setNewMessage((s) => ({ ...s, body: e.target.value }))}
                            placeholder="Write the message…"
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem' }} className={styles.actions}>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          const toUserId = newMessage.to === 'broadcast' ? null : newMessage.to;
                          const sent = sendMessage(
                            {
                              toUserId,
                              title: newMessage.title,
                              body: newMessage.body,
                              kind: newMessage.kind,
                            },
                            actor
                          );
                          if (!sent) {
                            alert('Message not sent. Check title/body.');
                            return;
                          }
                          setNewMessage((s) => ({ ...s, title: '', body: '' }));
                        }}
                      >
                        <Icon name="send" size="xs" /> Send
                      </button>
                      <button className="btn btn-secondary" onClick={() => setNewMessage((s) => ({ ...s, title: '', body: '' }))}>
                        Clear
                      </button>
                    </div>

                    <div className={styles.statSub} style={{ marginTop: '0.75rem' }}>
                      Messages are stored as in-app notifications (email/SMS not wired in this demo).
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">Create Trading Signal</div>
                  <div className="card-body">
                    <div className={styles.formGrid}>
                      <div>
                        <div className={styles.statLabel}>Symbol</div>
                        <input
                          className={styles.input}
                          value={newSignal.symbol}
                          onChange={(e) => setNewSignal((s) => ({ ...s, symbol: e.target.value }))}
                          placeholder="e.g. BTCUSDT"
                        />
                      </div>
                      <div>
                        <div className={styles.statLabel}>Direction</div>
                        <select
                          className={styles.input}
                          value={newSignal.direction}
                          onChange={(e) => setNewSignal((s) => ({ ...s, direction: e.target.value as SignalDirection }))}
                        >
                          <option value="long">Long</option>
                          <option value="short">Short</option>
                        </select>
                      </div>
                      <div>
                        <div className={styles.statLabel}>Timeframe</div>
                        <input
                          className={styles.input}
                          value={newSignal.timeframe}
                          onChange={(e) => setNewSignal((s) => ({ ...s, timeframe: e.target.value }))}
                          placeholder="e.g. H1"
                        />
                      </div>
                      <div>
                        <div className={styles.statLabel}>Entry (optional)</div>
                        <input
                          className={styles.input}
                          value={newSignal.entry}
                          onChange={(e) => setNewSignal((s) => ({ ...s, entry: e.target.value }))}
                          placeholder="e.g. 65000"
                        />
                      </div>
                      <div>
                        <div className={styles.statLabel}>Take Profit (optional)</div>
                        <input
                          className={styles.input}
                          value={newSignal.takeProfit}
                          onChange={(e) => setNewSignal((s) => ({ ...s, takeProfit: e.target.value }))}
                          placeholder="e.g. 67500"
                        />
                      </div>
                      <div>
                        <div className={styles.statLabel}>Stop Loss (optional)</div>
                        <input
                          className={styles.input}
                          value={newSignal.stopLoss}
                          onChange={(e) => setNewSignal((s) => ({ ...s, stopLoss: e.target.value }))}
                          placeholder="e.g. 63500"
                        />
                      </div>
                      <div className={styles.checkboxRow}>
                        <input
                          className={styles.input}
                          style={{ height: 36 }}
                          value={newSignal.note}
                          onChange={(e) => setNewSignal((s) => ({ ...s, note: e.target.value }))}
                          placeholder="Note (optional)"
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem' }} className={styles.actions}>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          const created = createSignal(
                            {
                              symbol: newSignal.symbol,
                              direction: newSignal.direction,
                              timeframe: newSignal.timeframe || undefined,
                              entry: newSignal.entry || undefined,
                              takeProfit: newSignal.takeProfit || undefined,
                              stopLoss: newSignal.stopLoss || undefined,
                              note: newSignal.note || undefined,
                            },
                            actor
                          );
                          if (!created) {
                            alert('Could not create signal. Check symbol.');
                            return;
                          }
                          setNewSignal((s) => ({ ...s, entry: '', takeProfit: '', stopLoss: '', note: '' }));
                        }}
                      >
                        <Icon name="plus" size="xs" /> Create
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          const title = `Signal: ${newSignal.symbol.trim().toUpperCase()} (${newSignal.direction.toUpperCase()})`;
                          const bodyParts = [
                            `Symbol: ${newSignal.symbol.trim().toUpperCase()}`,
                            `Direction: ${newSignal.direction.toUpperCase()}`,
                            newSignal.timeframe ? `Timeframe: ${newSignal.timeframe}` : null,
                            newSignal.entry ? `Entry: ${newSignal.entry}` : null,
                            newSignal.takeProfit ? `TP: ${newSignal.takeProfit}` : null,
                            newSignal.stopLoss ? `SL: ${newSignal.stopLoss}` : null,
                            newSignal.note ? `Note: ${newSignal.note}` : null,
                          ].filter(Boolean);
                          const sent = sendMessage({ toUserId: null, title, body: bodyParts.join('\n'), kind: 'system' }, actor);
                          if (!sent) alert('Broadcast failed.');
                        }}
                      >
                        <Icon name="send" size="xs" /> Broadcast
                      </button>
                    </div>

                    <div className={styles.statSub} style={{ marginTop: '0.75rem' }}>
                      Active signals: <span className="tabular-nums">{activeSignals.length}</span> | Archived:{' '}
                      <span className="tabular-nums">{archivedSignals.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">Signals</div>
                <div className="card-body">
                  <div className={styles.actions}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowArchivedSignals((v) => !v)}
                    >
                      {showArchivedSignals ? 'Hide Archived' : 'Show Archived'}
                    </button>
                    <div className={styles.muted} style={{ marginLeft: 'auto' }}>
                      Active: <span className="tabular-nums">{activeSignals.length}</span> | Archived:{' '}
                      <span className="tabular-nums">{archivedSignals.length}</span>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Status</th>
                          <th>Symbol</th>
                          <th>Dir</th>
                          <th>TF</th>
                          <th>Entry</th>
                          <th>TP</th>
                          <th>SL</th>
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(showArchivedSignals ? [...activeSignals, ...archivedSignals] : activeSignals).length === 0 ? (
                          <tr>
                            <td colSpan={10} className={styles.muted}>
                              No signals.
                            </td>
                          </tr>
                        ) : (
                          (showArchivedSignals ? [...activeSignals, ...archivedSignals] : activeSignals).map((sig: TmsSignal) => (
                            <tr key={sig.signalId}>
                              <td className="tabular-nums">{sig.signalId}</td>
                              <td>
                                <Pill tone={statusTone(sig.status)}>{sig.status}</Pill>
                              </td>
                              <td className="tabular-nums">{sig.symbol}</td>
                              <td>
                                <Pill>{sig.direction}</Pill>
                              </td>
                              <td className="tabular-nums">{sig.timeframe || '-'}</td>
                              <td className="tabular-nums">{sig.entry || '-'}</td>
                              <td className="tabular-nums">{sig.takeProfit || '-'}</td>
                              <td className="tabular-nums">{sig.stopLoss || '-'}</td>
                              <td className="tabular-nums">{fmtTime(sig.createdAt)}</td>
                              <td className={styles.actions}>
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => {
                                    const title = `Signal: ${sig.symbol} (${sig.direction.toUpperCase()})`;
                                    const bodyParts = [
                                      `Symbol: ${sig.symbol}`,
                                      `Direction: ${sig.direction.toUpperCase()}`,
                                      sig.timeframe ? `Timeframe: ${sig.timeframe}` : null,
                                      sig.entry ? `Entry: ${sig.entry}` : null,
                                      sig.takeProfit ? `TP: ${sig.takeProfit}` : null,
                                      sig.stopLoss ? `SL: ${sig.stopLoss}` : null,
                                      sig.note ? `Note: ${sig.note}` : null,
                                    ].filter(Boolean);
                                    const sent = sendMessage({ toUserId: null, title, body: bodyParts.join('\n'), kind: 'system' }, actor);
                                    if (!sent) alert('Broadcast failed.');
                                  }}
                                >
                                  Broadcast
                                </button>
                                {sig.status === 'active' && (
                                  <button className="btn btn-secondary" onClick={() => archiveSignal(sig.signalId, actor)}>
                                    Archive
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">Messages</div>
                <div className="card-body">
                  <div className={styles.filterRow}>
                    <input
                      className={styles.input}
                      style={{ maxWidth: 420 }}
                      placeholder="Filter messages..."
                      value={messageQuery}
                      onChange={(e) => setMessageQuery(e.target.value)}
                    />
                    <button className="btn btn-secondary" onClick={() => setMessageQuery('')}>
                      Clear
                    </button>
                    <div className={styles.muted} style={{ marginLeft: 'auto' }}>
                      Showing <span className="tabular-nums">{filteredMessages.length}</span> /{' '}
                      <span className="tabular-nums">{messages.length}</span>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Kind</th>
                          <th>To</th>
                          <th>Title</th>
                          <th>Body</th>
                          <th>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMessages.length === 0 ? (
                          <tr>
                            <td colSpan={6} className={styles.muted}>
                              No messages match the filter.
                            </td>
                          </tr>
                        ) : (
                          filteredMessages.map((m: TmsMessage) => {
                            const toUser = m.toUserId ? users.find((u) => u.id === m.toUserId) : null;
                            return (
                              <tr key={m.messageId}>
                                <td className="tabular-nums">{fmtTime(m.createdAt)}</td>
                                <td>
                                  <Pill>{m.kind}</Pill>
                                </td>
                                <td className={styles.muted}>
                                  {m.toUserId ? (toUser ? `${toUser.username} (${toUser.id})` : m.toUserId) : 'broadcast'}
                                </td>
                                <td>{m.title}</td>
                                <td className={styles.muted} style={{ whiteSpace: 'pre-wrap' }}>
                                  {m.body}
                                </td>
                                <td className={styles.muted}>
                                  <Pill>{m.createdByRole}</Pill> <span className="tabular-nums">{m.createdBy}</span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && isBoss && (
            <div className={styles.section}>
              <div className="card">
                <div className="card-header">Add Payment Method</div>
                <div className="card-body">
                  <div className={styles.formGrid}>
                    <div>
                      <div className={styles.statLabel}>Type</div>
                      <select
                        className={styles.input}
                        value={newPaymentType}
                        onChange={(e) => setNewPaymentType(e.target.value as SystemPaymentMethodType)}
                      >
                        <option value="bank">Bank</option>
                        <option value="crypto">Crypto</option>
                        <option value="gateway">Gateway</option>
                      </select>
                    </div>

                    <div>
                      <div className={styles.statLabel}>Label</div>
                      <input
                        className={styles.input}
                        value={newPayment.label}
                        onChange={(e) => setNewPayment((s) => ({ ...s, label: e.target.value }))}
                        placeholder="e.g. Primary Bank"
                      />
                    </div>

                    {newPaymentType === 'bank' && (
                      <>
                        <div>
                          <div className={styles.statLabel}>Bank Name</div>
                          <input
                            className={styles.input}
                            value={newPayment.bankName}
                            onChange={(e) => setNewPayment((s) => ({ ...s, bankName: e.target.value }))}
                          />
                        </div>
                        <div>
                          <div className={styles.statLabel}>Account Name</div>
                          <input
                            className={styles.input}
                            value={newPayment.accountName}
                            onChange={(e) => setNewPayment((s) => ({ ...s, accountName: e.target.value }))}
                          />
                        </div>
                        <div>
                          <div className={styles.statLabel}>Account Number</div>
                          <input
                            className={styles.input}
                            value={newPayment.accountNumber}
                            onChange={(e) => setNewPayment((s) => ({ ...s, accountNumber: e.target.value }))}
                          />
                        </div>
                        <div>
                          <div className={styles.statLabel}>SWIFT (optional)</div>
                          <input
                            className={styles.input}
                            value={newPayment.swiftCode}
                            onChange={(e) => setNewPayment((s) => ({ ...s, swiftCode: e.target.value }))}
                          />
                        </div>
                      </>
                    )}

                    {newPaymentType === 'crypto' && (
                      <>
                        <div>
                          <div className={styles.statLabel}>Chain</div>
                          <select
                            className={styles.input}
                            value={newPayment.chain}
                            onChange={(e) => setNewPayment((s) => ({ ...s, chain: e.target.value as ChainType }))}
                          >
                            <option value="TRC20">TRC20</option>
                            <option value="ERC20">ERC20</option>
                            <option value="BEP20">BEP20</option>
                          </select>
                        </div>
                        <div>
                          <div className={styles.statLabel}>Address</div>
                          <input
                            className={styles.input}
                            value={newPayment.address}
                            onChange={(e) => setNewPayment((s) => ({ ...s, address: e.target.value }))}
                          />
                        </div>
                      </>
                    )}

                    {newPaymentType === 'gateway' && (
                      <>
                        <div>
                          <div className={styles.statLabel}>Provider</div>
                          <input
                            className={styles.input}
                            value={newPayment.provider}
                            onChange={(e) => setNewPayment((s) => ({ ...s, provider: e.target.value }))}
                            placeholder="e.g. Stripe"
                          />
                        </div>
                        <div>
                          <div className={styles.statLabel}>Public Key</div>
                          <input
                            className={styles.input}
                            value={newPayment.publicKey}
                            onChange={(e) => setNewPayment((s) => ({ ...s, publicKey: e.target.value }))}
                            placeholder="public key only"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        const label = newPayment.label.trim();
                        if (!label) return;

                        const enabled = true;
                        const method =
                          newPaymentType === 'bank'
                            ? {
                                type: 'bank',
                                enabled,
                                label,
                                bankName: newPayment.bankName,
                                accountName: newPayment.accountName,
                                accountNumber: newPayment.accountNumber,
                                swiftCode: newPayment.swiftCode || undefined,
                              }
                            : newPaymentType === 'crypto'
                              ? {
                                  type: 'crypto',
                                  enabled,
                                  label,
                                  chain: newPayment.chain,
                                  address: newPayment.address,
                                }
                              : {
                                  type: 'gateway',
                                  enabled,
                                  label,
                                  provider: newPayment.provider,
                                  publicKey: newPayment.publicKey,
                                };

                        const created = addPaymentMethod(method as any, actor);
                        if (!created) {
                          alert('Not authorized.');
                          return;
                        }

                        setNewPayment({
                          label: '',
                          bankName: '',
                          accountName: '',
                          accountNumber: '',
                          swiftCode: '',
                          chain: 'TRC20',
                          address: '',
                          provider: '',
                          publicKey: '',
                        });
                      }}
                    >
                      <Icon name="plus" size="xs" /> Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">Payment Methods</div>
                <div className="card-body" style={{ overflowX: 'auto' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Label</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Updated</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentMethods.length === 0 ? (
                        <tr>
                          <td colSpan={6} className={styles.muted}>
                            No payment methods.
                          </td>
                        </tr>
                      ) : (
                        paymentMethods.map((m: SystemPaymentMethod) => (
                          <tr key={m.id}>
                            <td className="tabular-nums">{m.id}</td>
                            <td>{m.label}</td>
                            <td>
                              <Pill>{m.type}</Pill>
                            </td>
                            <td>
                              <Pill tone={m.enabled ? 'good' : 'bad'}>{m.enabled ? 'enabled' : 'disabled'}</Pill>
                            </td>
                            <td className="tabular-nums">{fmtTime(m.updatedAt)}</td>
                            <td className={styles.actions}>
                              <button
                                className="btn btn-secondary"
                                onClick={() => updatePaymentMethod(m.id, { enabled: !m.enabled }, actor)}
                              >
                                Toggle
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={() => {
                                  const nextLabel = window.prompt('Label:', m.label) ?? m.label;
                                  if (m.type === 'bank') {
                                    const bankName = window.prompt('Bank name:', m.bankName) ?? m.bankName;
                                    const accountName = window.prompt('Account name:', m.accountName) ?? m.accountName;
                                    const accountNumber = window.prompt('Account number:', m.accountNumber) ?? m.accountNumber;
                                    updatePaymentMethod(m.id, { label: nextLabel, bankName, accountName, accountNumber }, actor);
                                    return;
                                  }
                                  if (m.type === 'crypto') {
                                    const address = window.prompt('Address:', m.address) ?? m.address;
                                    updatePaymentMethod(m.id, { label: nextLabel, address }, actor);
                                    return;
                                  }
                                  const provider = window.prompt('Provider:', m.provider) ?? m.provider;
                                  const publicKey = window.prompt('Public key:', m.publicKey) ?? m.publicKey;
                                  updatePaymentMethod(m.id, { label: nextLabel, provider, publicKey }, actor);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-secondary"
                                onClick={() => {
                                  if (window.confirm(`Delete payment method ${m.id}?`)) {
                                    removePaymentMethod(m.id, actor);
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className={styles.section}>
              <div className={styles.splitRow}>
                <div className="card">
                  <div className="card-header">Exports (CSV)</div>
                  <div className="card-body">
                    <div className={styles.muted}>
                      Download current management data as CSV files for Excel/Sheets.
                    </div>

                    <div className={styles.actions} style={{ marginTop: '0.75rem' }}>
                      <button className="btn btn-secondary" onClick={handlePrintManagementReport}>
                        <Icon name="file-text" size="xs" /> Print (PDF)
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          downloadCsv(
                            'tms_users',
                            [
                              'id',
                              'role',
                              'status',
                              'username',
                              'email',
                              'createdAt',
                              'lastLoginAt',
                              'invitedByRole',
                              'invitedById',
                              'kycStatus',
                              'balanceUSDT',
                              'totalDepositsUSDT',
                              'totalWithdrawalsUSDT',
                              'tradingPnlUSDT',
                              'referralEarningsUSDT',
                            ],
                            users.map((u) => {
                              const wallet = walletsByUserId[u.id];
                              return {
                                id: u.id,
                                role: u.role,
                                status: u.status,
                                username: u.username,
                                email: u.email,
                                createdAt: new Date(u.createdAt).toISOString(),
                                lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : '',
                                invitedByRole: u.invitedBy?.role ?? '',
                                invitedById: u.invitedBy?.id ?? '',
                                kycStatus: u.kycStatus,
                                balanceUSDT: wallet?.balanceUSDT ?? '0',
                                totalDepositsUSDT: wallet?.totalDepositsUSDT ?? '0',
                                totalWithdrawalsUSDT: wallet?.totalWithdrawalsUSDT ?? '0',
                                tradingPnlUSDT: wallet?.tradingPnlUSDT ?? '0',
                                referralEarningsUSDT: wallet?.referralEarningsUSDT ?? '0',
                              };
                            })
                          );
                        }}
                      >
                        <Icon name="download" size="xs" /> Users
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          downloadCsv(
                            'tms_deposits',
                            ['depositId', 'userId', 'username', 'amountUSDT', 'status', 'createdAt', 'confirmedAt', 'note'],
                            deposits.map((d) => {
                              const username = users.find((u) => u.id === d.userId)?.username ?? d.userId;
                              return {
                                depositId: d.depositId,
                                userId: d.userId,
                                username,
                                amountUSDT: d.amountUSDT,
                                status: d.status,
                                createdAt: new Date(d.createdAt).toISOString(),
                                confirmedAt: d.confirmedAt ? new Date(d.confirmedAt).toISOString() : '',
                                note: d.note ?? '',
                              };
                            })
                          );
                        }}
                      >
                        <Icon name="download" size="xs" /> Deposits
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          downloadCsv(
                            'tms_withdrawals',
                            [
                              'withdrawId',
                              'userId',
                              'username',
                              'amountUSDT',
                              'feeUSDT',
                              'status',
                              'createdAt',
                              'decidedAt',
                              'decidedBy',
                              'note',
                            ],
                            withdraws.map((w) => {
                              const username = users.find((u) => u.id === w.userId)?.username ?? w.userId;
                              return {
                                withdrawId: w.withdrawId,
                                userId: w.userId,
                                username,
                                amountUSDT: w.amountUSDT,
                                feeUSDT: w.feeUSDT,
                                status: w.status,
                                createdAt: new Date(w.createdAt).toISOString(),
                                decidedAt: w.decidedAt ? new Date(w.decidedAt).toISOString() : '',
                                decidedBy: w.decidedBy ?? '',
                                note: w.note ?? '',
                              };
                            })
                          );
                        }}
                      >
                        <Icon name="download" size="xs" /> Withdrawals
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          downloadCsv(
                            'tms_kyc_requests',
                            [
                              'requestId',
                              'userId',
                              'username',
                              'status',
                              'submittedAt',
                              'decidedAt',
                              'decidedBy',
                              'rejectionReason',
                              'idDocument',
                              'selfieWithId',
                              'proofOfAddress',
                            ],
                            kycRequests.map((k) => {
                              const username = users.find((u) => u.id === k.userId)?.username ?? k.userId;
                              return {
                                requestId: k.requestId,
                                userId: k.userId,
                                username,
                                status: k.status,
                                submittedAt: new Date(k.submittedAt).toISOString(),
                                decidedAt: k.decidedAt ? new Date(k.decidedAt).toISOString() : '',
                                decidedBy: k.decidedBy ?? '',
                                rejectionReason: k.rejectionReason ?? '',
                                idDocument: k.files.idDocument,
                                selfieWithId: k.files.selfieWithId,
                                proofOfAddress: k.files.proofOfAddress ?? '',
                              };
                            })
                          );
                        }}
                      >
                        <Icon name="download" size="xs" /> KYC
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          downloadCsv(
                            'tms_referral_payouts',
                            [
                              'payoutId',
                              'invitedUserId',
                              'invitedUsername',
                              'depositId',
                              'referrerId',
                              'referrerUsername',
                              'referrerRole',
                              'rate',
                              'amountUSDT',
                              'createdAt',
                            ],
                            referralPayouts.map((p) => {
                              const invitedUsername = users.find((u) => u.id === p.invitedUserId)?.username ?? p.invitedUserId;
                              const referrerUsername = users.find((u) => u.id === p.referrerId)?.username ?? p.referrerId;
                              return {
                                payoutId: p.payoutId,
                                invitedUserId: p.invitedUserId,
                                invitedUsername,
                                depositId: p.depositId,
                                referrerId: p.referrerId,
                                referrerUsername,
                                referrerRole: p.referrerRole,
                                rate: p.rate,
                                amountUSDT: p.amountUSDT,
                                createdAt: new Date(p.createdAt).toISOString(),
                              };
                            })
                          );
                        }}
                      >
                        <Icon name="download" size="xs" /> Payouts
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          downloadCsv(
                            'tms_audit_log',
                            ['createdAt', 'actorRole', 'actorId', 'action', 'targetType', 'targetId', 'detail'],
                            auditLog.map((a) => ({
                              createdAt: new Date(a.createdAt).toISOString(),
                              actorRole: a.actorRole,
                              actorId: a.actorId,
                              action: a.action,
                              targetType: a.targetType,
                              targetId: a.targetId,
                              detail: a.detail ?? '',
                            }))
                          );
                        }}
                      >
                        <Icon name="download" size="xs" /> Audit
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          downloadCsv(
                            'tms_trades',
                            [
                              'tradeId',
                              'userId',
                              'username',
                              'symbol',
                              'side',
                              'status',
                              'quantity',
                              'entryPrice',
                              'exitPrice',
                              'pnlUSDT',
                              'openedAt',
                              'closedAt',
                              'createdBy',
                              'closedBy',
                              'note',
                            ],
                            trades.map((t) => {
                              const username = users.find((u) => u.id === t.userId)?.username ?? t.userId;
                              return {
                                tradeId: t.tradeId,
                                userId: t.userId,
                                username,
                                symbol: t.symbol,
                                side: t.side,
                                status: t.status,
                                quantity: t.quantity,
                                entryPrice: t.entryPrice,
                                exitPrice: t.exitPrice ?? '',
                                pnlUSDT: t.pnlUSDT ?? '',
                                openedAt: new Date(t.openedAt).toISOString(),
                                closedAt: t.closedAt ? new Date(t.closedAt).toISOString() : '',
                                createdBy: t.createdBy,
                                closedBy: t.closedBy ?? '',
                                note: t.note ?? '',
                              };
                            })
                          );
                        }}
                      >
                        <Icon name="download" size="xs" /> Trades
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          downloadCsv(
                            'tms_signals',
                            [
                              'signalId',
                              'status',
                              'symbol',
                              'direction',
                              'timeframe',
                              'entry',
                              'takeProfit',
                              'stopLoss',
                              'createdAt',
                              'createdByRole',
                              'createdBy',
                              'note',
                            ],
                            signals.map((s) => ({
                              signalId: s.signalId,
                              status: s.status,
                              symbol: s.symbol,
                              direction: s.direction,
                              timeframe: s.timeframe ?? '',
                              entry: s.entry ?? '',
                              takeProfit: s.takeProfit ?? '',
                              stopLoss: s.stopLoss ?? '',
                              createdAt: new Date(s.createdAt).toISOString(),
                              createdByRole: s.createdByRole,
                              createdBy: s.createdBy,
                              note: s.note ?? '',
                            }))
                          );
                        }}
                      >
                        <Icon name="download" size="xs" /> Signals
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          downloadCsv(
                            'tms_messages',
                            ['messageId', 'kind', 'toUserId', 'title', 'body', 'createdAt', 'createdByRole', 'createdBy'],
                            messages.map((m) => ({
                              messageId: m.messageId,
                              kind: m.kind,
                              toUserId: m.toUserId ?? 'broadcast',
                              title: m.title,
                              body: m.body,
                              createdAt: new Date(m.createdAt).toISOString(),
                              createdByRole: m.createdByRole,
                              createdBy: m.createdBy,
                            }))
                          );
                        }}
                      >
                        <Icon name="download" size="xs" /> Messages
                      </button>
                    </div>

                    <div className={styles.statSub} style={{ marginTop: '0.75rem' }}>
                      Users: <span className="tabular-nums">{users.length}</span> | Deposits:{' '}
                      <span className="tabular-nums">{deposits.length}</span> | Withdrawals:{' '}
                      <span className="tabular-nums">{withdraws.length}</span> | Audit:{' '}
                      <span className="tabular-nums">{auditLog.length}</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">System Snapshot</div>
                  <div className="card-body">
                    <div className={styles.statLabel}>Total System Balance</div>
                    <div className={`${styles.statValue} tabular-nums`}>{formatUSDT(stats.systemBalance)}</div>
                    <div className={styles.statSub}>
                      Pending KYC: <span className="tabular-nums">{stats.pendingKyc}</span> | Pending withdrawals:{' '}
                      <span className="tabular-nums">{stats.pendingWithdrawals}</span>
                    </div>
                    <div className={styles.statSub} style={{ marginTop: '0.75rem' }}>
                      KYC required: <Pill tone={settings.kycRequired ? 'warn' : 'good'}>{settings.kycRequired ? 'on' : 'off'}</Pill>
                      {' '}| Admin 1st deposit rate:{' '}
                      <span className="tabular-nums">{(settings.adminFirstDepositRate * 100).toFixed(2)}%</span>
                      {' '}| User 1st deposit rate:{' '}
                      <span className="tabular-nums">{(settings.userFirstDepositRate * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">Audit Log</div>
                <div className="card-body">
                  <div className={styles.filterRow}>
                    <input
                      className={styles.input}
                      style={{ maxWidth: 420 }}
                      placeholder="Filter by actor/action/target..."
                      value={auditQuery}
                      onChange={(e) => setAuditQuery(e.target.value)}
                    />
                    <button className="btn btn-secondary" onClick={() => setAuditQuery('')}>
                      Clear
                    </button>
                    <div className={styles.muted} style={{ marginLeft: 'auto' }}>
                      Showing <span className="tabular-nums">{filteredAudit.length}</span> /{' '}
                      <span className="tabular-nums">{auditLog.length}</span>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto', marginTop: '0.75rem' }}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Actor</th>
                          <th>Action</th>
                          <th>Target</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAudit.length === 0 ? (
                          <tr>
                            <td colSpan={5} className={styles.muted}>
                              No audit entries match the filter.
                            </td>
                          </tr>
                        ) : (
                          filteredAudit.map((a) => (
                            <tr key={a.id}>
                              <td className="tabular-nums">{fmtTime(a.createdAt)}</td>
                              <td>
                                <Pill>{a.actorRole}</Pill> <span className="tabular-nums">{a.actorId}</span>
                              </td>
                              <td className="tabular-nums">{a.action}</td>
                              <td>
                                <Pill>{a.targetType}</Pill> <span className="tabular-nums">{a.targetId}</span>
                              </td>
                              <td className={styles.muted}>{a.detail || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && isBoss && (
            <div className={styles.section}>
              <div className={styles.splitRow}>
                <div className="card">
                  <div className="card-header">System Settings</div>
                  <div className="card-body">
                    <div className={styles.formGrid}>
                      <div>
                        <div className={styles.statLabel}>Admin commission (1st deposit)</div>
                        <input
                          className={styles.input}
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={settingsDraft.adminFirstDepositPct}
                          onChange={(e) =>
                            setSettingsDraft((s) => ({ ...s, adminFirstDepositPct: Number(e.target.value) }))
                          }
                        />
                        <div className={styles.statSub}>Default: 40%</div>
                      </div>

                      <div>
                        <div className={styles.statLabel}>User commission (1st deposit)</div>
                        <input
                          className={styles.input}
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={settingsDraft.userFirstDepositPct}
                          onChange={(e) =>
                            setSettingsDraft((s) => ({ ...s, userFirstDepositPct: Number(e.target.value) }))
                          }
                        />
                        <div className={styles.statSub}>Default: 5%</div>
                      </div>

                      <div className={styles.checkboxRow}>
                        <label className={styles.muted} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={settingsDraft.kycRequired}
                            onChange={(e) => setSettingsDraft((s) => ({ ...s, kycRequired: e.target.checked }))}
                          />
                          KYC required
                        </label>
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem' }} className={styles.actions}>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          const adminRate = Number.isFinite(settingsDraft.adminFirstDepositPct)
                            ? settingsDraft.adminFirstDepositPct / 100
                            : 0;
                          const userRate = Number.isFinite(settingsDraft.userFirstDepositPct)
                            ? settingsDraft.userFirstDepositPct / 100
                            : 0;
                          updateSettings(
                            {
                              adminFirstDepositRate: adminRate,
                              userFirstDepositRate: userRate,
                              kycRequired: settingsDraft.kycRequired,
                            },
                            actor
                          );
                          setSettingsTouchedAt(Date.now());
                        }}
                      >
                        Save Settings
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setSettingsDraft({
                            adminFirstDepositPct: Number((settings.adminFirstDepositRate * 100).toFixed(2)),
                            userFirstDepositPct: Number((settings.userFirstDepositRate * 100).toFixed(2)),
                            kycRequired: settings.kycRequired,
                          });
                        }}
                      >
                        Reset Form
                      </button>
                    </div>

                    {settingsTouchedAt && (
                      <div className={styles.statSub} style={{ marginTop: '0.75rem' }}>
                        Last update: <span className="tabular-nums">{fmtTime(settingsTouchedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">Commission Pool</div>
                  <div className="card-body">
                    <div className={styles.statLabel}>Current Pool Balance</div>
                    <div className={`${styles.statValue} tabular-nums`}>{formatUSDT(commissionPoolUSDT)}</div>
                    <div className={styles.statSub}>
                      Referral payouts are paid from this pool (not from user deposits).
                    </div>

                    <div style={{ marginTop: '1rem' }} className={styles.formGrid}>
                      <div>
                        <div className={styles.statLabel}>Top up amount (USDT)</div>
                        <input
                          className={styles.input}
                          value={commissionTopUp.amountUSDT}
                          onChange={(e) => setCommissionTopUp((s) => ({ ...s, amountUSDT: e.target.value }))}
                          placeholder="e.g. 2500"
                        />
                      </div>
                      <div>
                        <div className={styles.statLabel}>Note (optional)</div>
                        <input
                          className={styles.input}
                          value={commissionTopUp.note}
                          onChange={(e) => setCommissionTopUp((s) => ({ ...s, note: e.target.value }))}
                          placeholder="e.g. monthly funding"
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem' }} className={styles.actions}>
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          const amt = commissionTopUp.amountUSDT.trim();
                          const n = Number(amt);
                          if (!amt || !Number.isFinite(n) || n <= 0) {
                            alert('Enter a positive amount.');
                            return;
                          }
                          topUpCommissionPool(amt, actor, commissionTopUp.note.trim() || undefined);
                          setCommissionTopUp({ amountUSDT: '', note: '' });
                          setSettingsTouchedAt(Date.now());
                        }}
                      >
                        Top Up Pool
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
