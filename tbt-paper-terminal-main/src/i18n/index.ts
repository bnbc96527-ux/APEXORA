import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zhCN, type Locale } from './locales/zh-CN';
import { enUS } from './locales/en-US';
import { esES } from './locales/es-ES';
import { frFR } from './locales/fr-FR';
import { jaJP } from './locales/ja-JP';
import { koKR } from './locales/ko-KR';
import { ptBR } from './locales/pt-BR';
import { arSA } from './locales/ar-SA';

export type LocaleKey = 'zh-CN' | 'en-US' | 'es-ES' | 'fr-FR' | 'ja-JP' | 'ko-KR' | 'pt-BR' | 'ar-SA';

export interface LocaleOption {
  key: LocaleKey;
  label: string;
  nativeLabel: string;
  flag: string;
  dir?: 'ltr' | 'rtl';
}

const locales: Record<LocaleKey, Locale> = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'es-ES': esES,
  'fr-FR': frFR,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'pt-BR': ptBR,
  'ar-SA': arSA,
};

export const LOCALE_OPTIONS: LocaleOption[] = [
  { key: 'en-US', label: 'English', nativeLabel: 'English', flag: 'US' },
  { key: 'zh-CN', label: 'Chinese', nativeLabel: '中文', flag: 'CN' },
  { key: 'es-ES', label: 'Spanish', nativeLabel: 'Español', flag: 'ES' },
  { key: 'fr-FR', label: 'French', nativeLabel: 'Français', flag: 'FR' },
  { key: 'ja-JP', label: 'Japanese', nativeLabel: '日本語', flag: 'JP' },
  { key: 'ko-KR', label: 'Korean', nativeLabel: '한국어', flag: 'KR' },
  { key: 'pt-BR', label: 'Portuguese', nativeLabel: 'Português', flag: 'BR' },
  { key: 'ar-SA', label: 'Arabic', nativeLabel: 'العربية', flag: 'SA', dir: 'rtl' },
];

const DEFAULT_LOCALE: LocaleKey = 'en-US';

const isLocaleKey = (value: string): value is LocaleKey => value in locales;

export const getLocaleOption = (locale: LocaleKey) => LOCALE_OPTIONS.find((option) => option.key === locale) || LOCALE_OPTIONS[0]!;

export const detectPreferredLocale = (): LocaleKey => {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  const stored = window.localStorage.getItem('i18n-storage');
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { state?: { locale?: string } };
      const locale = parsed?.state?.locale;
      if (locale && isLocaleKey(locale)) return locale;
    } catch {
      // Ignore malformed storage and fall back to browser detection.
    }
  }

  const candidates = [navigator.language, ...(navigator.languages || [])]
    .filter(Boolean)
    .map((lang) => lang.toLowerCase());

  const directMatch = candidates.find((lang) => isLocaleKey(lang as LocaleKey));
  if (directMatch && isLocaleKey(directMatch as LocaleKey)) return directMatch as LocaleKey;

  if (candidates.some((lang) => lang.startsWith('zh'))) return 'zh-CN';
  if (candidates.some((lang) => lang.startsWith('es'))) return 'es-ES';
  if (candidates.some((lang) => lang.startsWith('fr'))) return 'fr-FR';
  if (candidates.some((lang) => lang.startsWith('ja'))) return 'ja-JP';
  if (candidates.some((lang) => lang.startsWith('ko'))) return 'ko-KR';
  if (candidates.some((lang) => lang.startsWith('pt'))) return 'pt-BR';
  if (candidates.some((lang) => lang.startsWith('ar'))) return 'ar-SA';
  return DEFAULT_LOCALE;
};

const applyDocumentLocale = (locale: LocaleKey) => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = getLocaleOption(locale).dir || 'ltr';
};

interface I18nState {
  locale: LocaleKey;
  setLocale: (locale: LocaleKey) => void;
  t: Locale;
}

export const useI18n = create<I18nState>()(
  persist(
    (set) => ({
      locale: detectPreferredLocale(),
      setLocale: (locale: LocaleKey) => {
        applyDocumentLocale(locale);
        set({ locale, t: locales[locale] });
      },
      t: locales[detectPreferredLocale()],
    }),
    {
      name: 'i18n-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const locale = isLocaleKey(state.locale) ? state.locale : DEFAULT_LOCALE;
          state.locale = locale;
          state.t = locales[locale];
          applyDocumentLocale(locale);
        }
      },
    }
  )
);

// 模板字符串替换函数
export function formatMessage(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

// 相对时间格式化
export function formatRelativeTime(timestamp: number, t: Locale['time']): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 5000) return t.justNow;
  if (diff < 60000) return t.secondsAgo.replace('{n}', String(Math.floor(diff / 1000)));
  if (diff < 3600000) return t.minutesAgo.replace('{n}', String(Math.floor(diff / 60000)));
  if (diff < 86400000) return t.hoursAgo.replace('{n}', String(Math.floor(diff / 3600000)));
  
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return t.today;
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return t.yesterday;
  
  return date.toLocaleDateString();
}

// 数字格式化（带单位）
export function formatNumber(value: number, t: Locale['numbers']): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return (value / 1e12).toFixed(2) + t.trillion;
  if (abs >= 1e9) return (value / 1e9).toFixed(2) + t.billion;
  if (abs >= 1e6) return (value / 1e6).toFixed(2) + t.million;
  if (abs >= 1e3) return (value / 1e3).toFixed(2) + t.thousand;
  return value.toFixed(2);
}

export { zhCN, enUS, esES, frFR, jaJP, koKR, ptBR, arSA };
export type { Locale };




