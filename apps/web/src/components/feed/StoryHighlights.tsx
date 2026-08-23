import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface Highlight {
  id: string;
  label: string;
  emoji: string;
  images: string[];
  color: string;
}

const highlights: Highlight[] = [
  {
    id: '1',
    label: 'Culture',
    emoji: '🥁',
    images: ['https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=300&h=300&fit=crop'],
    color: 'from-accent to-gold',
  },
  {
    id: '2',
    label: 'Travel',
    emoji: '✈️',
    images: ['https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=300&h=300&fit=crop'],
    color: 'from-primary to-sky-400',
  },
  {
    id: '3',
    label: 'Food',
    emoji: '🍲',
    images: ['https://images.unsplash.com/photo-1547592180-85f173990554?w=300&h=300&fit=crop'],
    color: 'from-gold to-accent',
  },
  {
    id: '4',
    label: 'Fashion',
    emoji: '👗',
    images: ['https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=300&h=300&fit=crop'],
    color: 'from-destructive to-accent',
  },
  {
    id: '5',
    label: 'Poetry',
    emoji: '🎤',
    images: ['https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=300&h=300&fit=crop'],
    color: 'from-primary to-accent',
  },
];

const StoryHighlights = () => {
  const [viewingHighlight, setViewingHighlight] = useState<Highlight | null>(null);
  const [viewIndex, setViewIndex] = useState(0);

  return (
    <>
      <div className="flex gap-4 overflow-x-auto no-scrollbar px-4 py-4">
        {/* Add new */}
        <button className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="w-[68px] h-[68px] rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center bg-muted/30">
            <Plus className="w-5 h-5 text-muted-foreground" />
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">New</span>
        </button>

        {highlights.map(h => (
          <button
            key={h.id}
            onClick={() => { setViewingHighlight(h); setViewIndex(0); }}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <div className={`w-[68px] h-[68px] rounded-full p-[3px] bg-gradient-to-br ${h.color} highlight-ring-spin`}>
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-card">
                <img src={h.images[0]} alt={h.label} className="w-full h-full object-cover" />
              </div>
            </div>
            <span className="text-[11px] text-foreground font-medium">{h.emoji} {h.label}</span>
          </button>
        ))}
      </div>

      {/* Fullscreen highlight viewer */}
      {viewingHighlight && (
        <div className="fixed inset-0 z-[100] bg-foreground/95 flex items-center justify-center">
          <button onClick={() => setViewingHighlight(null)} className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full bg-card/20 backdrop-blur flex items-center justify-center">
            <X className="w-5 h-5 text-card" />
          </button>

          {/* Progress */}
          <div className="absolute top-2 left-4 right-4 flex gap-1 z-30">
            {viewingHighlight.images.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-card/20">
                <div className={`h-full rounded-full transition-all duration-500 ${i <= viewIndex ? 'bg-card w-full' : 'w-0'}`} />
              </div>
            ))}
          </div>

          <div className="absolute top-10 left-4 flex items-center gap-2 z-30">
            <span className="text-card text-lg">{viewingHighlight.emoji}</span>
            <span className="text-card font-heading font-bold text-sm">{viewingHighlight.label}</span>
          </div>

          <img
            src={viewingHighlight.images[viewIndex]}
            alt=""
            className="w-full max-w-md aspect-[9/16] object-cover rounded-2xl"
          />

          {/* Tap areas */}
          <button
            onClick={() => viewIndex > 0 ? setViewIndex(viewIndex - 1) : setViewingHighlight(null)}
            className="absolute left-0 top-0 bottom-0 w-1/3 z-20"
          />
          <button
            onClick={() => {
              if (viewIndex < viewingHighlight.images.length - 1) setViewIndex(viewIndex + 1);
              else setViewingHighlight(null);
            }}
            className="absolute right-0 top-0 bottom-0 w-1/3 z-20"
          />
        </div>
      )}
    </>
  );
};

export default StoryHighlights;
