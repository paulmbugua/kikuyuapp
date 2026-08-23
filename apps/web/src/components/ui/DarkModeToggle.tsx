import { useState, useEffect } from 'react';

const DarkModeToggle = () => {
  const [isDark, setIsDark] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const toggle = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsDark(prev => {
        const next = !prev;
        document.documentElement.classList.toggle('dark', next);
        return next;
      });
      setTimeout(() => setIsAnimating(false), 500);
    }, 300);
  };

  return (
    <button
      onClick={toggle}
      className={`relative w-16 h-8 rounded-full transition-colors duration-500 ${
        isDark ? 'bg-[hsl(220,20%,15%)]' : 'bg-[hsl(var(--sky-light))]'
      } overflow-hidden border border-border`}
    >
      {/* Stars (dark mode) */}
      <div className={`absolute inset-0 transition-opacity duration-500 ${isDark ? 'opacity-100' : 'opacity-0'}`}>
        <span className="absolute top-1.5 left-2 w-1 h-1 rounded-full bg-card/60" />
        <span className="absolute top-3 left-5 w-0.5 h-0.5 rounded-full bg-card/40" />
        <span className="absolute bottom-2 left-3 w-0.5 h-0.5 rounded-full bg-card/50" />
      </div>

      {/* Clouds (light mode) */}
      <div className={`absolute inset-0 transition-opacity duration-500 ${isDark ? 'opacity-0' : 'opacity-100'}`}>
        <span className="absolute bottom-1 right-6 w-3 h-1.5 rounded-full bg-card/40" />
        <span className="absolute bottom-2 right-4 w-2 h-1 rounded-full bg-card/30" />
      </div>

      {/* Orb (sun/moon) */}
      <div
        className={`absolute top-1 w-6 h-6 rounded-full transition-all duration-500 ${
          isAnimating ? 'scale-0' : 'scale-100'
        } ${isDark ? 'left-9 bg-[hsl(45,10%,85%)]' : 'left-1'}`}
        style={{
          background: isDark
            ? 'radial-gradient(circle at 35% 35%, hsl(45 10% 88%), hsl(45 10% 75%))'
            : 'radial-gradient(circle at 35% 35%, hsl(45 100% 70%), hsl(38 92% 50%))',
          boxShadow: isDark
            ? '0 0 8px hsl(45 10% 85% / 0.3), inset -3px -2px 0 hsl(45 10% 65%)'
            : '0 0 12px hsl(38 92% 50% / 0.5)',
        }}
      >
        {/* Sun rays */}
        {!isDark && !isAnimating && (
          <div className="absolute inset-0 animate-spin-slow">
            {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
              <span
                key={deg}
                className="absolute w-0.5 h-1.5 bg-gold/60 rounded-full left-1/2 -translate-x-1/2"
                style={{
                  transform: `translateX(-50%) rotate(${deg}deg)`,
                  transformOrigin: '50% 14px',
                  top: '-4px',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </button>
  );
};

export default DarkModeToggle;
