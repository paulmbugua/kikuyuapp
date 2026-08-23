import { useState, useRef, useCallback, type ReactNode } from 'react';
import { Bookmark, Share2 } from 'lucide-react';

interface SwipeablePostCardProps {
  children: ReactNode;
  onBookmark: () => void;
  onShare: () => void;
}

const SwipeablePostCard = ({ children, onBookmark, onShare }: SwipeablePostCardProps) => {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontal = useRef<boolean | null>(null);
  const isInteractive = useRef(false); // Track if starting on interactive element

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Check if touch started on an interactive element
    const isInteractiveElement = target.closest('button, a, [role="button"], .interactive');
    
    if (isInteractiveElement) {
      isInteractive.current = true;
      return; // Don't start swipe on interactive elements
    }
    
    isInteractive.current = false;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontal.current = null;
    setSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isInteractive.current) return; // Don't swipe if started on interactive element
    
    if (!swiping) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (isHorizontal.current === null) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }

    if (!isHorizontal.current) return;

    // Prevent default to stop scrolling while swiping
    e.preventDefault();
    setOffsetX(dx * 0.6);
  }, [swiping]);

  const handleTouchEnd = useCallback(() => {
    if (isInteractive.current) {
      isInteractive.current = false;
      return;
    }
    
    setSwiping(false);
    if (offsetX < -80) {
      onBookmark();
    } else if (offsetX > 80) {
      onShare();
    }
    setOffsetX(0);
    isHorizontal.current = null;
  }, [offsetX, onBookmark, onShare]);

  // Mouse events for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Check if click started on an interactive element
    const isInteractiveElement = target.closest('button, a, [role="button"], .interactive');
    
    if (isInteractiveElement) {
      isInteractive.current = true;
      return;
    }
    
    isInteractive.current = false;
    startX.current = e.clientX;
    startY.current = e.clientY;
    isHorizontal.current = null;
    setSwiping(true);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isInteractive.current) return;
    if (!swiping) return;
    
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (isHorizontal.current === null) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }

    if (!isHorizontal.current) return;

    setOffsetX(dx * 0.6);
  }, [swiping]);

  const handleMouseUp = useCallback(() => {
    if (isInteractive.current) {
      isInteractive.current = false;
      return;
    }
    
    setSwiping(false);
    if (offsetX < -80) {
      onBookmark();
    } else if (offsetX > 80) {
      onShare();
    }
    setOffsetX(0);
    isHorizontal.current = null;
  }, [offsetX, onBookmark, onShare]);

  const leftReveal = offsetX > 20;
  const rightReveal = offsetX < -20;

  return (
    <div className="relative overflow-hidden">
      {/* Left action (share) */}
      <div
        className={`absolute inset-y-0 left-0 w-20 flex items-center justify-center transition-opacity pointer-events-none ${leftReveal ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))' }}
      >
        <div className="flex flex-col items-center gap-1">
          <Share2 className="w-6 h-6 text-primary-foreground" />
          <span className="text-[10px] text-primary-foreground font-bold">Share</span>
        </div>
      </div>

      {/* Right action (bookmark) */}
      <div
        className={`absolute inset-y-0 right-0 w-20 flex items-center justify-center transition-opacity pointer-events-none ${rightReveal ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'linear-gradient(270deg, hsl(var(--gold)), hsl(var(--gold) / 0.7))' }}
      >
        <div className="flex flex-col items-center gap-1">
          <Bookmark className="w-6 h-6 text-gold-foreground" />
          <span className="text-[10px] text-gold-foreground font-bold">Save</span>
        </div>
      </div>

      {/* Swipeable content */}
      <div
        className="relative z-10 bg-card"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? 'none' : 'transform 0.3s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeablePostCard;