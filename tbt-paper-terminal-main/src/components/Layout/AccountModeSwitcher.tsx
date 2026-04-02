import { useMemo } from 'react';
import { useWalletStore, selectActiveAccountType } from '../../store/walletStore';
import { useI18n } from '../../i18n';
import { Icon } from '../Icon';
import styles from './AccountModeSwitcher.module.css';

interface AccountModeSwitcherProps {
  compact?: boolean;
}

export function AccountModeSwitcher({ compact = false }: AccountModeSwitcherProps) {
  const { locale } = useI18n();
  const activeAccountType = useWalletStore(selectActiveAccountType);
  const setActiveAccountType = useWalletStore((state) => state.setActiveAccountType);
  const liveRoutingEnabled = import.meta.env.VITE_LIVE_TRADING === 'true';

  const copy = useMemo(() => {
    const isReal = activeAccountType === 'real';
    return {
      label: isReal
        ? (locale === 'zh-CN' ? '真实账户' : 'Real Account')
        : (locale === 'zh-CN' ? '模拟账户' : 'Demo Account'),
      hint: isReal
        ? (liveRoutingEnabled
          ? (locale === 'zh-CN' ? '已连接实盘通道' : 'Live routing on')
          : (locale === 'zh-CN' ? '实盘通道未开启' : 'Live routing off'))
        : (locale === 'zh-CN' ? '纸面交易' : 'Paper trading'),
    };
  }, [activeAccountType, liveRoutingEnabled, locale]);

  const switchTo = (type: 'real' | 'demo') => {
    if (type === activeAccountType) return;
    setActiveAccountType(type);
  };

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`} aria-label={locale === 'zh-CN' ? '账户模式切换' : 'Account mode switcher'}>
      <div className={styles.copy}>
        <span className={styles.label}>{copy.label}</span>
        <span className={styles.hint}>{copy.hint}</span>
      </div>
      <div className={styles.switch} role="group" aria-label={locale === 'zh-CN' ? '切换模拟或真实账户' : 'Switch demo or real account'}>
        <button
          type="button"
          className={`${styles.option} ${activeAccountType === 'demo' ? styles.active : ''}`}
          onClick={() => switchTo('demo')}
          aria-pressed={activeAccountType === 'demo'}
        >
          <Icon name="sparkles" size="xs" />
          <span>{locale === 'zh-CN' ? '模拟' : 'Demo'}</span>
        </button>
        <button
          type="button"
          className={`${styles.option} ${activeAccountType === 'real' ? styles.active : ''}`}
          onClick={() => switchTo('real')}
          aria-pressed={activeAccountType === 'real'}
        >
          <Icon name="shield" size="xs" />
          <span>{locale === 'zh-CN' ? '真实' : 'Real'}</span>
        </button>
      </div>
    </div>
  );
}
