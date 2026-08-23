import { useState, useEffect } from 'react';
import { useNavigate } from '@/lib/navigation';
import { ChevronLeft, ChevronRight, CheckCircle2, Flame } from 'lucide-react';
import { users, formatNumber } from '@/data/dummy';

const spotlightCreators = users.filter(u => u.isCreator && u.verified).slice(0, 5);

const CreatorSpotlight = () => {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % spotlightCreators.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  const creator = spotlightCreators[activeIndex];
  if (!creator) return null;

  const bgImages = [
    'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&h=400&fit=crop',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&h=400&fit=crop',
  ];

  return (
    <div
      className="relative overflow-hidden bg-card"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Background image with overlay */}
      <div className="relative h-52 sm:h-60">
        {spotlightCreators.map((c, i) => (
          <div
            key={c.id}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: i === activeIndex ? 1 : 0 }}
          >
            <img
              src={bgImages[i % bgImages.length]}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/40 to-transparent" />
          </div>
        ))}

        {/* Badge */}
        <div className="absolute top-3 left-4 z-10 flex items-center gap-1.5 bg-accent/90 backdrop-blur-sm text-accent-foreground px-3 py-1 rounded-full text-xs font-heading font-bold">
          <Flame className="w-3.5 h-3.5" />
          Creator of the Week
        </div>

        {/* Nav arrows */}
        <button
          onClick={() => setActiveIndex(prev => (prev - 1 + spotlightCreators.length) % spotlightCreators.length)}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-card/20 backdrop-blur-sm flex items-center justify-center text-card hover:bg-card/40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => setActiveIndex(prev => (prev + 1) % spotlightCreators.length)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-card/20 backdrop-blur-sm flex items-center justify-center text-card hover:bg-card/40 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Creator info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
          <div className="flex items-end gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-full p-[3px] spotlight-ring overflow-hidden">
                <img src={creator.avatar} alt={creator.username} className="w-full h-full rounded-full object-cover" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent-foreground" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading font-bold text-lg text-card truncate">{creator.username}</h3>
              <p className="text-card/70 text-sm truncate">{creator.bio}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-card/80 text-xs font-medium">{formatNumber(creator.followers)} followers</span>
                {creator.monthlyEarnings && (
                  <span className="text-gold text-xs font-bold">💰 Top Earner</span>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="shrink-0 thutha-gradient text-primary-foreground text-sm font-heading font-semibold px-4 py-2 rounded-xl shadow-lg hover:opacity-90 transition-opacity"
            >
              View
            </button>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 py-2.5 bg-card">
        {spotlightCreators.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === activeIndex ? 'w-6 bg-accent' : 'w-1.5 bg-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default CreatorSpotlight;
