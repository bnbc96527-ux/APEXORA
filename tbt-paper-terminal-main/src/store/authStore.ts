import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LocaleKey } from '../i18n';
import { detectPreferredLocale } from '../i18n';
import { useTmsStore } from './tmsStore';

export type UserRole = 'boss' | 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  displayName: string;
  avatar: string | null;
  bio: string;
  timezone: string;
  createdAt: number;
  lastLogin: number;
  country?: string;
  emailVerifiedAt?: number | null;
  twoFactorEnabled?: boolean;
  status?: 'active' | 'inactive' | 'locked';
  fullName?: string;
  phone?: string;
  address?: string;
  commissionWalletAddress?: string;
  commissionWalletChain?: string;
  setupDeadlineAt?: number | null;
  setupCompletedAt?: number | null;
  adminVerifiedAt?: number | null;
}

export interface UserPreferences {
  language: LocaleKey;
  theme: 'light' | 'dark' | 'system';
  quoteAsset: 'USDT' | 'BTC';
  notifications: {
    priceThreshold: number;
    orderFills: boolean;
  };
}

interface RegisteredUsers {
  [username: string]: {
    passwordHash: string;
    userId: string;
    role: UserRole;
  };
}

const defaultPreferences: UserPreferences = {
  language: detectPreferredLocale(),
  theme: 'dark',
  quoteAsset: 'USDT',
  notifications: {
    priceThreshold: 5,
    orderFills: true,
  },
};

const normalize = (value: string) => String(value || '').trim().toLowerCase();

const hashLocal = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const isLocalAdminLocked = (userId: string) => {
  const local = useTmsStore.getState().users.find((u) => u.id === userId);
  if (!local || local.role !== 'admin') return false;
  const expired = Boolean(local.adminSetupDeadlineAt && local.adminSetupDeadlineAt < Date.now());
  return local.status === 'locked' || local.status === 'disabled' || (local.status !== 'active' && expired);
};

const readCsrfToken = () => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)apx_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const apiFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = payload?.error || payload?.message || 'Request failed';
    const err = new Error(error) as Error & { status?: number; payload?: unknown };
    err.status = response.status;
    err.payload = payload;
    throw err;
  }

  return payload as T;
};

const seedRegisteredUsers = (users: RegisteredUsers): RegisteredUsers => {
  return { ...users };
};

interface AuthState {
  user: User | null;
  preferences: UserPreferences;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  sessionReady: boolean;
  registeredUsers: RegisteredUsers;
  refreshSession: () => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
    options?: { country?: string; captchaToken?: string }
  ) => Promise<{ success: boolean; error?: string; verificationRequired?: boolean; devVerificationCode?: string }>;
  verifyEmail: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  resendVerification: (email: string, captchaToken?: string) => Promise<{ success: boolean; error?: string; devVerificationCode?: string }>;
  login: (
    identifier: string,
    password: string,
    options?: { captchaToken?: string; twoFactorCode?: string }
  ) => Promise<{ success: boolean; error?: string; requiresTwoFactor?: boolean }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<User, 'displayName' | 'bio' | 'timezone'>>) => void;
  updateAvatar: (dataUrl: string | null) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string, captchaToken?: string) => Promise<{ success: boolean; error?: string; devResetCode?: string }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  setupTwoFactor: () => Promise<{ success: boolean; error?: string; qrCodeDataUrl?: string; secret?: string; otpauthUrl?: string }>;
  confirmTwoFactor: (code: string) => Promise<{ success: boolean; error?: string }>;
  provisionCredentials: (params: {
    userId: string;
    role: UserRole;
    username: string;
    email: string;
    password: string;
  }) => { success: boolean; error?: string };
  rekeyCredentialsForUser: (userId: string, username: string, email: string) => { success: boolean; error?: string };
  resetPasswordForUser: (userId: string, newPassword: string) => { success: boolean; error?: string };
  markAsInitialized: () => void;
}

const initialState = {
  user: null,
  preferences: defaultPreferences,
  isAuthenticated: false,
  isInitialized: false,
  isLoading: false,
  sessionReady: false,
  registeredUsers: seedRegisteredUsers({}),
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,

      refreshSession: async () => {
        try {
          const payload = await apiFetch<{ user: User }>('/api/auth/me');
          set({
            user: payload.user,
            isAuthenticated: true,
            sessionReady: true,
          });
        } catch {
          const state = get();
          const localUser = state.user;
          if (localUser) {
            const localKey = normalize(localUser.email) || normalize(localUser.username);
            const creds = state.registeredUsers[localKey];
            const localTmsUser = useTmsStore.getState().users.find((u) => u.id === localUser.id);
            if (creds && creds.userId === localUser.id && localTmsUser && localTmsUser.status !== 'locked' && localTmsUser.status !== 'disabled') {
              set({
                user: {
                  ...localUser,
                  status: localTmsUser.status,
                  fullName: localTmsUser.fullName,
                  phone: localTmsUser.phone,
                  address: localTmsUser.address,
                  commissionWalletAddress: localTmsUser.commissionWalletAddress,
                  commissionWalletChain: localTmsUser.commissionWalletChain,
                  setupDeadlineAt: localTmsUser.adminSetupDeadlineAt ?? null,
                  setupCompletedAt: localTmsUser.adminSetupCompletedAt ?? null,
                  adminVerifiedAt: localTmsUser.adminVerifiedAt ?? null,
                },
                isAuthenticated: true,
                sessionReady: true,
              });
              return;
            }
          }
          try {
            const refreshed = await apiFetch<{ ok: boolean; user: User }>('/api/auth/refresh', {
              method: 'POST',
            });
            set({
              user: refreshed.user,
              isAuthenticated: true,
              sessionReady: true,
            });
          } catch {
            set({
              user: null,
              isAuthenticated: false,
              sessionReady: true,
            });
          }
        }
      },

      register: async (username, email, password, options) => {
        set({ isLoading: true });
        try {
          const payload = await apiFetch<{
            ok: boolean;
            verificationRequired: boolean;
            devVerificationCode?: string;
          }>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              username,
              email,
              password,
              country: options?.country,
              captchaToken: options?.captchaToken,
            }),
          });

          set({ isLoading: false });
          return {
            success: payload.ok,
            verificationRequired: payload.verificationRequired,
            devVerificationCode: payload.devVerificationCode,
          };
        } catch (error) {
          set({ isLoading: false });
          return { success: false, error: error instanceof Error ? error.message : 'Registration failed' };
        }
      },

      verifyEmail: async (email, code) => {
        set({ isLoading: true });
        try {
          const payload = await apiFetch<{ ok: boolean; user: User; csrfToken: string }>('/api/auth/verify-email', {
            method: 'POST',
            body: JSON.stringify({ email, code }),
          });
          set({
            user: payload.user,
            isAuthenticated: true,
            isLoading: false,
            sessionReady: true,
          });
          return { success: payload.ok };
        } catch (error) {
          set({ isLoading: false });
          return { success: false, error: error instanceof Error ? error.message : 'Verification failed' };
        }
      },

      resendVerification: async (email, captchaToken) => {
        try {
          const payload = await apiFetch<{ ok: boolean; devVerificationCode?: string }>('/api/auth/resend-verification', {
            method: 'POST',
            body: JSON.stringify({
              email,
              captchaToken,
            }),
          });
          return { success: payload.ok, devVerificationCode: payload.devVerificationCode };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unable to resend verification code' };
        }
      },

      login: async (identifier, password, options) => {
        set({ isLoading: true });
        try {
          const payload = await apiFetch<{ ok?: boolean; user?: User; requiresTwoFactor?: boolean; message?: string }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
              identifier,
              password,
              captchaToken: options?.captchaToken,
              twoFactorCode: options?.twoFactorCode,
            }),
          });

          if (payload.requiresTwoFactor) {
            set({ isLoading: false });
            return { success: false, requiresTwoFactor: true, error: payload.message || 'Two-factor code required' };
          }

          set({
            user: payload.user || null,
            isAuthenticated: true,
            isLoading: false,
            sessionReady: true,
          });
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          const status = error instanceof Error ? (error as Error & { status?: number }).status : undefined;
          const input = normalize(identifier);
          const state = get();
          const local = state.registeredUsers[input];
          if ((status === 401 || status === 404 || status === undefined) && local && local.passwordHash === hashLocal(password)) {
            if (local.role === 'admin' && isLocalAdminLocked(local.userId)) {
              return { success: false, error: 'This admin account is locked until it is activated.' };
            }

            const localTmsUser = useTmsStore.getState().users.find((u) => u.id === local.userId);
            const displayUser: User = {
              id: local.userId,
              username: localTmsUser?.username || input,
              email: localTmsUser?.email || input,
              role: local.role,
              passwordHash: local.passwordHash,
              displayName: localTmsUser?.fullName || localTmsUser?.username || input,
              avatar: null,
              bio: '',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
              createdAt: localTmsUser?.createdAt || Date.now(),
              lastLogin: Date.now(),
              country: localTmsUser?.commissionWalletChain,
              emailVerifiedAt: localTmsUser?.adminVerifiedAt ?? null,
              twoFactorEnabled: false,
              status: localTmsUser?.status || 'inactive',
              fullName: localTmsUser?.fullName,
              phone: localTmsUser?.phone,
              address: localTmsUser?.address,
              commissionWalletAddress: localTmsUser?.commissionWalletAddress,
              commissionWalletChain: localTmsUser?.commissionWalletChain,
              setupDeadlineAt: localTmsUser?.adminSetupDeadlineAt ?? null,
              setupCompletedAt: localTmsUser?.adminSetupCompletedAt ?? null,
              adminVerifiedAt: localTmsUser?.adminVerifiedAt ?? null,
            };

            set({
              user: displayUser,
              isAuthenticated: true,
              isLoading: false,
              sessionReady: true,
            });
            return { success: true };
          }

          const message = error instanceof Error ? error.message : 'Sign in failed';
          return {
            success: false,
            error: message || 'Sign in failed. Please check your details and try again.',
          };
        }
      },

      logout: async () => {
        try {
          await apiFetch<{ ok: boolean }>('/api/auth/logout', {
            method: 'POST',
            headers: {
              'X-CSRF-Token': readCsrfToken(),
            },
          });
        } catch {
          // ignore logout network failures and clear local state below
        }

        import('./walletStore').then(({ useWalletStore }) => {
          useWalletStore.getState().resetWallet();
        });
        import('./tradingStore').then(({ useTradingStore }) => {
          useTradingStore.getState().resetAccount();
        });

        set({
          user: null,
          isAuthenticated: false,
          isInitialized: false,
        });
      },

      updateProfile: (updates) => {
        set((state) => {
          if (!state.user) return state;
          return { user: { ...state.user, ...updates } };
        });
      },

      updateAvatar: (dataUrl) => {
        set((state) => {
          if (!state.user) return state;
          return { user: { ...state.user, avatar: dataUrl } };
        });
      },

      updatePreferences: (prefs) => {
        set((state) => ({
          preferences: {
            ...state.preferences,
            ...prefs,
            notifications: {
              ...state.preferences.notifications,
              ...(prefs.notifications || {}),
            },
          },
        }));
      },

      changePassword: async (oldPass, newPass) => {
        try {
          await apiFetch<{ ok: boolean }>('/api/auth/change-password', {
            method: 'POST',
            headers: {
              'X-CSRF-Token': readCsrfToken(),
            },
            body: JSON.stringify({
              oldPassword: oldPass,
              newPassword: newPass,
            }),
          });
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to change password' };
        }
      },

      requestPasswordReset: async (email, captchaToken) => {
        try {
          const payload = await apiFetch<{ ok: boolean; devResetCode?: string }>('/api/auth/request-password-reset', {
            method: 'POST',
            body: JSON.stringify({
              email,
              captchaToken,
            }),
          });
          return { success: payload.ok, devResetCode: payload.devResetCode };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Password reset request failed' };
        }
      },

      resetPassword: async (email, code, newPassword) => {
        try {
          await apiFetch<{ ok: boolean }>('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({
              email,
              code,
              newPassword,
            }),
          });
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Password reset failed' };
        }
      },

      setupTwoFactor: async () => {
        try {
          const payload = await apiFetch<{ ok: boolean; qrCodeDataUrl: string; secret: string; otpauthUrl: string }>('/api/auth/2fa/setup', {
            method: 'POST',
            headers: {
              'X-CSRF-Token': readCsrfToken(),
            },
          });
          return {
            success: payload.ok,
            qrCodeDataUrl: payload.qrCodeDataUrl,
            secret: payload.secret,
            otpauthUrl: payload.otpauthUrl,
          };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : '2FA setup failed' };
        }
      },

      confirmTwoFactor: async (code) => {
        try {
          await apiFetch<{ ok: boolean }>('/api/auth/2fa/confirm', {
            method: 'POST',
            headers: {
              'X-CSRF-Token': readCsrfToken(),
            },
            body: JSON.stringify({ code }),
          });
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : '2FA confirmation failed' };
        }
      },

      provisionCredentials: ({ userId, role, username, email, password }) => {
        const state = get();
        const usernameKey = normalize(username);
        const emailKey = normalize(email);
        const pass = String(password || '');
        if (!usernameKey || !emailKey || pass.length < 6) return { success: false, error: 'invalidInput' };

        const collide = (key: string) => {
          const existing = state.registeredUsers[key];
          return existing && existing.userId !== userId;
        };
        if (collide(usernameKey) || collide(emailKey)) {
          return { success: false, error: 'loginIdTaken' };
        }

        const passwordHash = hashLocal(pass);
        set((s) => ({
          registeredUsers: {
            ...s.registeredUsers,
            [usernameKey]: { passwordHash, userId, role },
            [emailKey]: { passwordHash, userId, role },
          },
        }));
        return { success: true };
      },

      rekeyCredentialsForUser: (userId, username, email) => {
        const state = get();
        const usernameKey = normalize(username);
        const emailKey = normalize(email);
        if (!usernameKey || !emailKey) return { success: false, error: 'invalidInput' };

        const entries = Object.entries(state.registeredUsers).filter(([, value]) => value.userId === userId);
        if (entries.length === 0) return { success: false, error: 'noCredentials' };

        const template = entries[0]![1];
        const collide = (key: string) => {
          const existing = state.registeredUsers[key];
          return existing && existing.userId !== userId;
        };
        if (collide(usernameKey) || collide(emailKey)) {
          return { success: false, error: 'loginIdTaken' };
        }

        const next: RegisteredUsers = Object.fromEntries(
          Object.entries(state.registeredUsers).filter(([, value]) => value.userId !== userId)
        ) as RegisteredUsers;
        next[usernameKey] = { ...template, userId, role: template.role || 'user' };
        next[emailKey] = { ...template, userId, role: template.role || 'user' };

        set((s) => ({
          registeredUsers: next,
          user: s.user && s.user.id === userId ? { ...s.user, username, email } : s.user,
        }));
        return { success: true };
      },

      resetPasswordForUser: (userId, newPassword) => {
        const pass = String(newPassword || '');
        if (pass.length < 6) return { success: false, error: 'invalidInput' };
        const state = get();
        const entries = Object.entries(state.registeredUsers).filter(([, value]) => value.userId === userId);
        if (entries.length === 0) return { success: false, error: 'noCredentials' };

        const passwordHash = hashLocal(pass);
        set((s) => {
          const nextRegisteredUsers = { ...s.registeredUsers };
          for (const [key, value] of entries) {
            nextRegisteredUsers[key] = { ...value, passwordHash };
          }
          return {
            registeredUsers: nextRegisteredUsers,
            user: s.user && s.user.id === userId ? { ...s.user, passwordHash } : s.user,
          };
        });
        return { success: true };
      },

      markAsInitialized: () => {
        set({ isInitialized: true });
      },
    }),
    {
      name: 'paper-auth-storage',
      version: 4,
      partialize: (state) => ({
        preferences: state.preferences,
        registeredUsers: state.registeredUsers,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        sessionReady: state.sessionReady,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<AuthState>),
        registeredUsers: seedRegisteredUsers((persistedState as Partial<AuthState>)?.registeredUsers || {}),
      }),
    }
  )
);

queueMicrotask(() => {
  void useAuthStore.getState().refreshSession();
});
