import { useState, useRef, useCallback, type ReactNode } from 'react';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
}

const PullToRefresh = ({ children, onRefresh }: PullToRefreshProps) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const threshold = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || isRefreshing) return;
    const delta = Math.max(0, (e.touches[0].clientY - startY.current) * 0.5);
    setPullDistance(Math.min(delta, 120));
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(60);
      await onRefresh();
      setIsRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 720 + (isRefreshing ? 360 : 0);

  return (
    <div
      ref={containerRef}
      className="relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all"
        style={{ height: pullDistance > 0 || isRefreshing ? `${pullDistance}px` : 0 }}
      >
        <div className="flex flex-col items-center gap-1">
          <div
            className="transition-transform"
            style={{ transform: `rotate(${rotation}deg)`, opacity: progress }}
          >
            <span className={`text-3xl ${isRefreshing ? 'animate-dove-spin' : ''}`}>🕊️</span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {isRefreshing ? 'Refreshing...' : progress >= 1 ? 'Release to refresh' : 'Pull down'}
          </span>
        </div>
      </div>

      {children}
    </div>
  );
};

export default PullToRefresh;
