import { useEffect, useRef, useState, type FC } from 'react';

declare global {
  interface Window {
    grecaptcha?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => number;
      reset: (widgetId?: number) => void;
      ready: (cb: () => void) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

const loadRecaptchaScript = () => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.grecaptcha) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-recaptcha="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load reCAPTCHA script')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.recaptcha = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load reCAPTCHA script'));
    document.head.appendChild(script);
  });

  return scriptPromise;
};

interface GoogleRecaptchaProps {
  siteKey: string;
  onToken: (token: string) => void;
  onExpired?: () => void;
  onError?: () => void;
  className?: string;
}

export const GoogleRecaptcha: FC<GoogleRecaptchaProps> = ({
  siteKey,
  onToken,
  onExpired,
  onError,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const mount = async () => {
      if (!siteKey || !containerRef.current) return;
      try {
        await loadRecaptchaScript();
        if (cancelled || !window.grecaptcha || !containerRef.current) return;

        window.grecaptcha.ready(() => {
          if (cancelled || !window.grecaptcha || !containerRef.current) return;
          if (widgetIdRef.current !== null) return;

          widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
            sitekey: siteKey,
            callback: onToken,
            'expired-callback': onExpired,
            'error-callback': onError,
            theme: 'dark',
            size: 'normal',
          });
          setReady(true);
        });
      } catch {
        onError?.();
      }
    };

    void mount();

    return () => {
      cancelled = true;
      if (window.grecaptcha && widgetIdRef.current !== null) {
        try {
          window.grecaptcha.reset(widgetIdRef.current);
        } catch {
          // ignore cleanup failures
        }
      }
      widgetIdRef.current = null;
      setReady(false);
    };
  }, [siteKey, onError, onExpired, onToken]);

  return (
    <div className={className}>
      <div ref={containerRef} />
      {!ready && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>
          Loading secure verification...
        </div>
      )}
    </div>
  );
};

export default GoogleRecaptcha;
