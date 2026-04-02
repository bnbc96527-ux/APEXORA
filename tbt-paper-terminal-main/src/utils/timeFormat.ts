const resolveLocale = (locale?: string) =>
  locale || (typeof document !== 'undefined' && document.documentElement.lang) || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');

/**
 * 格式化相对时间
 * 格式：Xs ago / Xm Ys ago / Xh Ym ago
 * 超过 1 小时显示绝对时间：HH:MM:SS
 */
export function formatRelativeTime(timestamp: number, locale?: string): string {
  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000);
  const resolvedLocale = resolveLocale(locale);
  
  if (diff < 60) {
    return new Intl.RelativeTimeFormat(resolvedLocale, { numeric: 'auto' }).format(-diff, 'second');
  }
  
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    return `${new Intl.RelativeTimeFormat(resolvedLocale, { numeric: 'auto' }).format(-m, 'minute')} ${s}s`;
  }
  
  // 超过 1 小时显示绝对时间
  return new Date(timestamp).toLocaleTimeString(resolvedLocale);
}

/**
 * 格式化时间戳为 HH:MM:SS · Xs ago 格式
 */
export function formatLastUpdateTime(timestamp: number, locale?: string): string {
  const resolvedLocale = resolveLocale(locale);
  const timeStr = new Date(timestamp).toLocaleTimeString(resolvedLocale, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const relativeStr = formatRelativeTime(timestamp, resolvedLocale);
  return `${timeStr} · ${relativeStr}`;
}

/**
 * 格式化通用时间显示 (MM-DD HH:MM:SS)
 */
export function formatTime(timestamp: number, showSeconds: boolean = true, locale?: string): string {
  const resolvedLocale = resolveLocale(locale);
  return new Date(timestamp).toLocaleString(resolvedLocale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: false,
  });
}




