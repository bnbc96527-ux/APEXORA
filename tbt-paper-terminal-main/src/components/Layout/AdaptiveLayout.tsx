import { useIsMobile } from '../../hooks/useMediaQuery';
import { MobileLayout } from './MobileLayout';
import { DesktopLayout } from './DesktopLayout';
import { useLiveTradingSync } from '../../hooks/useLiveTradingSync';
import { useWatchlistTicker } from '../../hooks/useWatchlistTicker';

/**
 * AdaptiveLayout - Root layout component that switches between Mobile and Desktop layouts
 * This component completely decouples the mobile and desktop DOM trees for optimal performance
 */
export function AdaptiveLayout() {
  const isMobile = useIsMobile();
  useLiveTradingSync();
  useWatchlistTicker();

  // Render completely different component trees for mobile vs desktop
  // This prevents unnecessary re-renders and allows for optimized layouts
  if (isMobile) {
    return <MobileLayout />;
  }

  return <DesktopLayout />;
}
