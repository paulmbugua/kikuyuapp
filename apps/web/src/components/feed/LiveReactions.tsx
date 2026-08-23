import { useState, useEffect, useCallback } from 'react';

const REACTIONS = ['🔥', '❤️', '👏', '😂', '😍', '🙌', '💯'];

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
  delay: number;
}

interface LiveReactionsProps {
  postId: string;
}

let emojiCounter = 0;

const LiveReactions = ({ postId }: LiveReactionsProps) => {
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  // Simulate random reactions from other users
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const emoji = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
        addFloatingEmoji(emoji);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const addFloatingEmoji = useCallback((emoji: string) => {
    const id = ++emojiCounter;
    const newEmoji: FloatingEmoji = {
      id,
      emoji,
      x: 10 + Math.random() * 80,
      delay: Math.random() * 0.3,
    };
    setFloatingEmojis(prev => [...prev, newEmoji]);
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 2500);
  }, []);

  const handleReact = (emoji: string) => {
    addFloatingEmoji(emoji);
    setShowPicker(false);
  };

  return (
    <div className="relative">
      {/* Floating emojis */}
      <div className="absolute bottom-full right-0 w-20 h-40 pointer-events-none overflow-hidden">
        {floatingEmojis.map(e => (
          <span
            key={e.id}
            className="absolute text-2xl animate-float-up"
            style={{
              left: `${e.x}%`,
              animationDelay: `${e.delay}s`,
              bottom: 0,
            }}
          >
            {e.emoji}
          </span>
        ))}
      </div>

      {/* Reaction trigger */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="text-lg hover:scale-125 transition-transform"
        title="React"
      >
        🔥
      </button>

      {/* Picker */}
      {showPicker && (
        <div className="absolute bottom-full right-0 mb-2 flex gap-1 bg-card border border-border rounded-full px-2 py-1.5 shadow-xl z-20 animate-scale-in">
          {REACTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleReact(emoji)}
              className="text-xl hover:scale-150 transition-transform p-1"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveReactions;
