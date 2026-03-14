import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { Icon } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageToggle } from '../components/LanguageToggle';
import styles from './LandingPage.module.css';

export const LandingPage: React.FC = () => {
  const isMobile = useIsMobile();

  return (
    <div className={styles.container}>
      {/* Background Effects */}
      <div className={styles.background}>
        <div className={styles.grid} />
        <div className={styles.overlay} />
      </div>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Icon name="activity" size="xl" strokeWidth={3} />
          </div>
          <span className={styles.title}>Apexora</span>
        </div>

        <div className={styles.headerActions}>
          <LanguageToggle />
          <ThemeToggle />
          <Link to="/auth" className={styles.signInBtn}>
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className={styles.main}>
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            {/* Trust Indicators */}
            <div className={styles.trustBadges}>
              <div className={styles.trustBadge}>
                <Icon name="star" size="sm" />
                <span>4.9/5 Rating</span>
              </div>
              <div className={styles.trustBadge}>
                <Icon name="users" size="sm" />
                <span>50K+ Traders</span>
              </div>
              <div className={styles.trustBadge}>
                <Icon name="award" size="sm" />
                <span>Best Trading Platform 2024</span>
              </div>
            </div>

            <h1 className={styles.heroTitle}>
              Professional Trading
              <span className={styles.heroAccent}> Redefined</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Experience lightning-fast execution, advanced analytics, and institutional-grade
              security in the most sophisticated trading platform ever built.
            </p>

            <div className={styles.heroActions}>
              <Link to="/auth" className={styles.ctaBtn}>
                Start Trading Now
                <Icon name="arrow-right" size="sm" />
              </Link>
              <button className={styles.demoBtn}>
                <Icon name="play" size="sm" />
                Watch Demo
              </button>
            </div>

            {/* Live Market Ticker */}
            <div className={styles.marketTicker}>
              <div className={styles.tickerItem}>
                <span className={styles.tickerSymbol}>BTC/USDT</span>
                <span className={styles.tickerPrice}>$43,250.00</span>
                <span className={styles.tickerChange}>+2.34%</span>
              </div>
              <div className={styles.tickerItem}>
                <span className={styles.tickerSymbol}>ETH/USDT</span>
                <span className={styles.tickerPrice}>$2,650.00</span>
                <span className={styles.tickerChange}>+1.87%</span>
              </div>
              <div className={styles.tickerItem}>
                <span className={styles.tickerSymbol}>SOL/USDT</span>
                <span className={styles.tickerPrice}>$98.50</span>
                <span className={styles.tickerChange}>-0.45%</span>
              </div>
            </div>
          </div>

          {!isMobile && (
            <div className={styles.heroVisual}>
              <div className={styles.tradingInterface}>
                {/* Interface Header */}
                <div className={styles.interfaceHeader}>
                  <div className={styles.symbolInfo}>
                    <span className={styles.symbol}>BTC/USDT</span>
                    <span className={styles.price}>$43,250.00</span>
                    <span className={styles.change}>+2.34%</span>
                  </div>
                  <div className={styles.timeframe}>
                    <span>1H</span>
                  </div>
                </div>

                <div className={styles.chartArea}>
                  <div className={styles.priceChart}>
                    <div className={styles.chartBars}>
                      {Array.from({ length: 20 }, (_, i) => (
                        <div
                          key={i}
                          className={styles.chartBar}
                          style={{
                            height: `${30 + Math.random() * 70}%`,
                            background: `linear-gradient(180deg, ${Math.random() > 0.5 ? 'var(--neon-accent)' : 'var(--electric-blue)'}, ${Math.random() > 0.5 ? '#00D4AA' : 'var(--electric-purple)'})`,
                            animationDelay: `${i * 0.1}s`
                          }}
                        />
                      ))}
                    </div>
                    <div className={styles.priceLine}>
                      <div className={styles.line} />
                      <span className={styles.lineLabel}>$43,250</span>
                    </div>
                  </div>
                </div>
                <div className={styles.orderPanel}>
                  <div className={styles.orderButtons}>
                    <button className={`${styles.orderBtn} ${styles.buyBtn}`}>
                      <Icon name="trending-up" size="sm" />
                      Buy BTC
                    </button>
                    <button className={`${styles.orderBtn} ${styles.sellBtn}`}>
                      <Icon name="trending-down" size="sm" />
                      Sell BTC
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Section */}
        <section className={styles.stats}>
          <div className={styles.statsGrid}>
            <div className={styles.stat}>
              <div className={styles.statNumber}>$2.1T+</div>
              <div className={styles.statLabel}>Daily Trading Volume</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statNumber}>50K+</div>
              <div className={styles.statLabel}>Active Traders</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statNumber}>99.99%</div>
              <div className={styles.statLabel}>Uptime</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statNumber}>&lt; 0.1s</div>
              <div className={styles.statLabel}>Execution Speed</div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className={styles.features}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Why Choose Apexora</h2>
            <p className={styles.sectionSubtitle}>
              Built for professional traders who demand the best
            </p>
          </div>

          <div className={styles.featuresGrid}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <Icon name="zap" size="lg" />
              </div>
              <h3 className={styles.featureTitle}>Lightning Execution</h3>
              <p className={styles.featureDesc}>
                Sub-millisecond order execution with direct market access.
                Never miss an opportunity with our ultra-fast infrastructure.
              </p>
            </div>

            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <Icon name="shield" size="lg" />
              </div>
              <h3 className={styles.featureTitle}>Bank-Grade Security</h3>
              <p className={styles.featureDesc}>
                Military-grade encryption, multi-factor authentication,
                and cold storage for maximum protection of your assets.
              </p>
            </div>

            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <Icon name="bar-chart-3" size="lg" />
              </div>
              <h3 className={styles.featureTitle}>Advanced Analytics</h3>
              <p className={styles.featureDesc}>
                Real-time market data, technical indicators, and AI-powered
                insights to give you the edge in every trade.
              </p>
            </div>

            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <Icon name="brain" size="lg" />
              </div>
              <h3 className={styles.featureTitle}>AI Trading Assistant</h3>
              <p className={styles.featureDesc}>
                Machine learning algorithms analyze market patterns and
                provide intelligent trading recommendations.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerLogo}>
            <Icon name="activity" size="md" />
            <span>Apexora</span>
          </div>
          <div className={styles.footerLinks}>
            <a href="#" className={styles.footerLink}>Privacy Policy</a>
            <a href="#" className={styles.footerLink}>Terms of Service</a>
            <a href="#" className={styles.footerLink}>Support</a>
          </div>
          <p className={styles.footerText}>
            © 2024 Apexora. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};