import { useEffect, useRef, useState } from 'react';
import { useI18n, LOCALE_OPTIONS, getLocaleOption, type LocaleKey } from '../../i18n';
import { Icon } from '../Icon';
import styles from './LanguageToggle.module.css';

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const current = getLocaleOption(locale);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        className={styles.toggle}
        onClick={() => setIsOpen((value) => !value)}
        title={t.language.label}
        aria-label={t.language.label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Icon name="globe" size="sm" className={styles.icon} />
        <span className={styles.text}>
          {current.nativeLabel}
        </span>
        <Icon name="chevron-down" size="xs" className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.menu} role="menu" aria-label={t.language.label}>
          {LOCALE_OPTIONS.map((option) => (
            <button
              key={option.key}
              className={`${styles.menuItem} ${option.key === locale ? styles.active : ''}`}
              onClick={() => {
                const next: LocaleKey = option.key;
                setLocale(next);
                setIsOpen(false);
              }}
              role="menuitem"
            >
              <span className={styles.flag}>{option.flag}</span>
              <span className={styles.labels}>
                <span className={styles.labelMain}>{option.nativeLabel}</span>
                <span className={styles.labelSub}>{option.label}</span>
              </span>
              {option.key === locale && <Icon name="check" size="xs" className={styles.check} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}




