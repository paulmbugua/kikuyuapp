import { useEffect, useState } from 'react';
import { useNavigate } from '@/lib/navigation';
import { ChevronLeft, ChevronRight, CheckCircle2, Flame } from 'lucide-react';
import axiosInstance from '@/utils/axiosConfig';
import { formatNumber } from '@/utils/format';

type Creator = {
  id: string;
  username: string;
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  cover_url?: string;
  followers_count: number;
  is_verified: boolean;
};

const CreatorSpotlight = () => {
  const navigate = useNavigate();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    void axiosInstance.get('/users/suggestions?limit=5').then(({ data }) => {
      setCreators(data.data?.suggestions || []);
    }).catch(() => setCreators([]));
  }, []);

  useEffect(() => {
    if (!isAutoPlaying || creators.length < 2) return;
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % creators.length), 4000);
    return () => window.clearInterval(timer);
  }, [creators.length, isAutoPlaying]);

  const creator = creators[activeIndex];
  if (!creator) return null;

  return (
    <div className="relative overflow-hidden bg-card" onMouseEnter={() => setIsAutoPlaying(false)} onMouseLeave={() => setIsAutoPlaying(true)}>
      <div className="relative h-52 bg-gradient-to-br from-[#071a15] via-[#123d31] to-[#e55d3d] sm:h-60">
        {creator.cover_url && <img src={creator.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
        <div className="absolute left-4 top-3 z-10 flex items-center gap-1.5 rounded-full bg-accent/90 px-3 py-1 text-xs font-heading font-bold text-accent-foreground"><Flame className="h-3.5 w-3.5" /> Community spotlight</div>
        {creators.length > 1 && <><button onClick={() => setActiveIndex((index) => (index - 1 + creators.length) % creators.length)} className="absolute left-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white backdrop-blur-sm"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => setActiveIndex((index) => (index + 1) % creators.length)} className="absolute right-2 top-1/2 z-10 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white backdrop-blur-sm"><ChevronRight className="h-4 w-4" /></button></>}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end gap-3 p-4">
          <div className="relative">{creator.avatar_url ? <img src={creator.avatar_url} alt={creator.full_name || creator.username} className="h-16 w-16 rounded-full border-2 border-white object-cover" /> : <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-white bg-[#071a15] text-xl font-bold text-white">{creator.username.slice(0, 1).toUpperCase()}</span>}{creator.is_verified && <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-accent"><CheckCircle2 className="h-3.5 w-3.5" /></span>}</div>
          <div className="min-w-0 flex-1 text-white"><h3 className="truncate font-heading text-lg font-bold">{creator.full_name || creator.username}</h3><p className="truncate text-sm text-white/70">{creator.bio || `@${creator.username}`}</p><p className="mt-1 text-xs text-white/80">{formatNumber(creator.followers_count)} followers</p></div>
          <button onClick={() => navigate(`/profile/${creator.username}`)} className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#071a15]">View</button>
        </div>
      </div>
      {creators.length > 1 && <div className="flex justify-center gap-1.5 py-2.5">{creators.map((item, index) => <button aria-label={`Show ${item.username}`} key={item.id} onClick={() => setActiveIndex(index)} className={`h-1.5 rounded-full transition-all ${index === activeIndex ? 'w-6 bg-accent' : 'w-1.5 bg-muted-foreground/30'}`} />)}</div>}
    </div>
  );
};

export default CreatorSpotlight;
