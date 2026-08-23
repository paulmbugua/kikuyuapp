import { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

interface ScrollWheelColumnProps {
  items: { value: number; label: string }[];
  selected: number;
  onSelect: (value: number) => void;
  label: string;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

const ScrollWheelColumn = ({ items, selected, onSelect, label }: ScrollWheelColumnProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScroll = useRef(0);
  const velocity = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const animFrame = useRef<number | undefined>(undefined);
  const [isScrolling, setIsScrolling] = useState(false);

  const selectedIndex = items.findIndex(i => i.value === selected);

  useEffect(() => {
    if (containerRef.current && !isDragging.current) {
      const targetScroll = selectedIndex * ITEM_HEIGHT;
      containerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const snapToNearest = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const index = Math.round(scrollTop / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
    containerRef.current.scrollTo({ top: clampedIndex * ITEM_HEIGHT, behavior: 'smooth' });
    onSelect(items[clampedIndex].value);
    setTimeout(() => setIsScrolling(false), 200);
  }, [items, onSelect]);

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    setIsScrolling(true);
    startY.current = e.touches[0].clientY;
    startScroll.current = containerRef.current?.scrollTop || 0;
    lastY.current = e.touches[0].clientY;
    lastTime.current = Date.now();
    velocity.current = 0;
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const currentY = e.touches[0].clientY;
    const diff = startY.current - currentY;
    containerRef.current.scrollTop = startScroll.current + diff;

    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 0) {
      velocity.current = (lastY.current - currentY) / dt;
    }
    lastY.current = currentY;
    lastTime.current = now;
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (Math.abs(velocity.current) > 0.5 && containerRef.current) {
      const momentum = velocity.current * 150;
      containerRef.current.scrollBy({ top: momentum, behavior: 'smooth' });
      setTimeout(snapToNearest, 300);
    } else {
      snapToNearest();
    }
  };

  const handleScroll = () => {
    if (!isDragging.current) {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      animFrame.current = requestAnimationFrame(() => {
        snapToNearest();
      });
    }
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="relative" style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
        {/* Selection highlight */}
        <div
          className="absolute left-0 right-0 rounded-xl bg-accent/15 border border-accent/30 pointer-events-none z-10 transition-colors"
          style={{ top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT }}
        />
        {/* Gradient masks */}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-card to-transparent z-20 pointer-events-none rounded-t-xl" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent z-20 pointer-events-none rounded-b-xl" />

        <div
          ref={containerRef}
          className="h-full overflow-y-auto no-scrollbar"
          style={{ scrollSnapType: 'y mandatory', paddingTop: ITEM_HEIGHT * 2, paddingBottom: ITEM_HEIGHT * 2 }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onScroll={handleScroll}
        >
          {items.map((item, index) => {
            const isSelected = item.value === selected;
            return (
              <div
                key={item.value}
                className={cn(
                  'flex items-center justify-center cursor-pointer transition-all duration-200',
                  isSelected
                    ? 'text-foreground font-bold scale-110'
                    : 'text-muted-foreground/60 scale-95'
                )}
                style={{ height: ITEM_HEIGHT, scrollSnapAlign: 'center' }}
                onClick={() => {
                  onSelect(item.value);
                  if (containerRef.current) {
                    containerRef.current.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' });
                  }
                }}
              >
                <span className={cn(
                  'text-lg transition-all duration-200',
                  isSelected && 'text-xl'
                )}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface ScrollWheelDatePickerProps {
  value?: Date;
  onChange: (date: Date) => void;
  minYear?: number;
  maxYear?: number;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const ScrollWheelDatePicker = ({
  value,
  onChange,
  minYear = 1940,
  maxYear = new Date().getFullYear() - 13,
}: ScrollWheelDatePickerProps) => {
  const now = new Date();
  const [day, setDay] = useState(value?.getDate() || 1);
  const [month, setMonth] = useState(value ? value.getMonth() + 1 : 1);
  const [year, setYear] = useState(value?.getFullYear() || 2000);

  const daysInMonth = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(day, daysInMonth);

  useEffect(() => {
    if (clampedDay !== day) setDay(clampedDay);
  }, [clampedDay, day]);

  useEffect(() => {
    const newDate = new Date(year, month - 1, clampedDay);
    if (newDate <= now) {
      onChange(newDate);
    }
  }, [clampedDay, month, year]);

  const dayItems = Array.from({ length: daysInMonth }, (_, i) => ({
    value: i + 1,
    label: String(i + 1).padStart(2, '0'),
  }));

  const monthItems = MONTHS.map((m, i) => ({
    value: i + 1,
    label: m,
  }));

  const yearItems = Array.from({ length: maxYear - minYear + 1 }, (_, i) => ({
    value: maxYear - i,
    label: String(maxYear - i),
  }));

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <ScrollWheelColumn items={dayItems} selected={clampedDay} onSelect={setDay} label="Day" />
      <div className="text-muted-foreground/30 text-2xl font-light self-center mt-6">·</div>
      <ScrollWheelColumn items={monthItems} selected={month} onSelect={setMonth} label="Month" />
      <div className="text-muted-foreground/30 text-2xl font-light self-center mt-6">·</div>
      <ScrollWheelColumn items={yearItems} selected={year} onSelect={setYear} label="Year" />
    </div>
  );
};

export default ScrollWheelDatePicker;
