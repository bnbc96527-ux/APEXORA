import { useState } from 'react';
import { useWalletStore, selectBalances, selectDeposits } from '../store/walletStore';
import { useI18n } from '../i18n';
import { Icon } from '../components/Icon';
import { useIsMobile } from '../hooks/useMediaQuery';
import { MobileWalletPage } from './mobile';
import {
  AccountOverviewCard,
  AssetBalancesPanel,
  LinkedMethodsPanel,
  LedgerTable,
  DepositDrawer,
  WithdrawDrawer,
  OnboardingGuide,
} from '../components/Wallet';
import styles from './WalletPage.module.css';

type WalletTab = 'overview' | 'spot' | 'funding' | 'history';

export function WalletPage() {
  // All hooks must be called before any conditional returns
  const isMobile = useIsMobile();
  const { t } = useI18n();
  const activeAccountType = useWalletStore((state) => state.activeAccountType);
  const stage = useWalletStore((state) => state.getOnboardingStage());
  const balances = useWalletStore(selectBalances);
  const deposits = useWalletStore(selectDeposits);
  const [activeTab, setActiveTab] = useState<WalletTab>('overview');
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  // Render mobile layout
  if (isMobile) {
    return <MobileWalletPage />;
  }

  const tabs: { id: WalletTab; label: string; icon: any }[] = [
    { id: 'overview', label: t.wallet?.overview || 'Overview', icon: 'layout' },
    { id: 'spot', label: t.wallet?.spot || 'Spot', icon: 'wallet' },
    { id: 'funding', label: t.wallet?.funding || 'Funding', icon: 'banknote' },
    { id: 'history', label: t.wallet?.history || 'History', icon: 'history' },
  ];

  const pendingRealDeposits = deposits.filter(
    (d) => d.accountType === 'real' && (d.status === 'pending' || d.status === 'pending_approval')
  );
  const hasApprovedBalance = balances.some((b) => Number(b.total) > 0);
  const hideBalancesAndHistory = activeAccountType === 'real' && pendingRealDeposits.length > 0 && !hasApprovedBalance;

  return (
    <div className={styles.container}>
      {/* Header with Simulated Badge */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>
            <Icon name="wallet" size="lg" />
            {t.wallet?.title || 'Wallet'}
          </h1>
          <span 
            className={styles.simulatedBadge}
            title={activeAccountType === 'real'
              ? (t.wallet?.simulatedTooltip || 'This is the live account view.')
              : (t.wallet?.simulatedTooltip || 'This is a simulated wallet for paper trading.')}
          >
            {activeAccountType === 'real'
              ? (t.wallet?.liveBadge || 'Real')
              : (t.wallet?.simulatedBadge || 'Simulated')}
          </span>
        </div>
        
        <div className={styles.headerActions}>
          {stage !== 'not_created' && (
            <>
              <button 
                className={styles.depositButton}
                onClick={() => setDepositOpen(true)}
              >
                <Icon name="download" size="sm" />
                {t.wallet?.deposit || 'Deposit'}
              </button>
              <button 
                className={styles.withdrawButton}
                onClick={() => setWithdrawOpen(true)}
              >
                <Icon name="upload" size="sm" />
                {t.wallet?.withdraw || 'Withdraw'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      {stage !== 'not_created' && (
        <div className={styles.tabsContainer}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon name={tab.icon} size="sm" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className={styles.mainContentArea}>
        {hideBalancesAndHistory && (
          <div className={styles.approvalLockPanel}>
            <div className={styles.approvalNoticeHeader}>
              <Icon name="shield" size="sm" />
              <span>{t.wallet?.depositPending || 'Pending approval'}</span>
            </div>
            <div className={styles.approvalNoticeBody}>
              {pendingRealDeposits.length === 1
                ? `${pendingRealDeposits[0]!.amount} ${pendingRealDeposits[0]!.asset} is waiting for admin or boss approval.`
                : `${pendingRealDeposits.length} deposits are waiting for admin or boss approval.`}
              {' '}
              The wallet balance and history will update only after approval.
            </div>
            <div className={styles.pendingList}>
              {pendingRealDeposits.slice(0, 3).map((deposit) => (
                <div key={deposit.depositId} className={styles.pendingItem}>
                  <span>{deposit.depositId}</span>
                  <span>{deposit.amount} {deposit.asset}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stage === 'not_created' ? (
          <div className={styles.onboardingWrapper}>
            <OnboardingGuide stage={stage} />
          </div>
        ) : (
          <>
            {/* Onboarding Banner (for stages after account creation) */}
            {(stage === 'no_payment_method' || stage === 'no_funds') && (
              <OnboardingGuide 
                stage={stage} 
                onOpenDeposit={() => setDepositOpen(true)}
              />
            )}

            <div className={styles.content}>
              {activeTab === 'overview' && !hideBalancesAndHistory && (
                <>
                  {/* Left Column */}
                  <div className={styles.leftColumn}>
                    <AccountOverviewCard />
                    <LinkedMethodsPanel highlightAdd={stage === 'no_payment_method'} />
                  </div>

                  {/* Right Column */}
                  <div className={styles.rightColumn}>
                    <AssetBalancesPanel 
                      onDeposit={() => setDepositOpen(true)}
                      onWithdraw={() => setWithdrawOpen(true)}
                    />
                  </div>
                </>
              )}

              {activeTab === 'overview' && hideBalancesAndHistory && (
                <div className={styles.fullWidthColumn}>
                  <LinkedMethodsPanel highlightAdd={stage === 'no_payment_method'} />
                </div>
              )}

              {activeTab === 'spot' && !hideBalancesAndHistory && (
                <div className={styles.fullWidthColumn}>
                  <AssetBalancesPanel 
                    onDeposit={() => setDepositOpen(true)}
                    onWithdraw={() => setWithdrawOpen(true)}
                  />
                </div>
              )}

              {activeTab === 'spot' && hideBalancesAndHistory && (
                <div className={styles.fullWidthColumn}>
                  <div className={styles.pendingHistoryPanel}>
                    <div className={styles.pendingHistoryTitle}>
                      <Icon name="history" size="sm" />
                      <span>Balance hidden during review</span>
                    </div>
                    <div className={styles.pendingHistoryBody}>
                      Approved deposits will appear here and update the total balance.
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'funding' && (
                <div className={styles.fullWidthColumn}>
                  <LinkedMethodsPanel highlightAdd={stage === 'no_payment_method'} />
                </div>
              )}

              {activeTab === 'history' && !hideBalancesAndHistory && (
                <div className={styles.fullWidthColumn}>
                  <LedgerTable />
                </div>
              )}

              {activeTab === 'history' && hideBalancesAndHistory && (
                <div className={styles.fullWidthColumn}>
                  <div className={styles.pendingHistoryPanel}>
                    <div className={styles.pendingHistoryTitle}>
                      <Icon name="history" size="sm" />
                      <span>Deposit history pending approval</span>
                    </div>
                    <div className={styles.pendingHistoryBody}>
                      Pending deposits are shown above and will move into the total balance after approval.
                    </div>
                    <div className={styles.pendingList}>
                      {pendingRealDeposits.map((deposit) => (
                        <div key={deposit.depositId} className={styles.pendingItem}>
                          <span>{deposit.depositId}</span>
                          <span>{deposit.amount} {deposit.asset}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Drawers */}
      <DepositDrawer 
        isOpen={depositOpen} 
        onClose={() => setDepositOpen(false)} 
      />
      <WithdrawDrawer 
        isOpen={withdrawOpen} 
        onClose={() => setWithdrawOpen(false)} 
      />
    </div>
  );
}
