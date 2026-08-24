import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import axiosInstance from '@/utils/axiosConfig';

type Highlight = {
  id: string;
  label: string;
  username: string;
  image: string;
};

const StoryHighlights = () => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [active, setActive] = useState<Highlight | null>(null);

  useEffect(() => {
    void axiosInstance.get('/posts/explore?limit=12').then(({ data }) => {
      const posts = Array.isArray(data.data) ? data.data : data.data?.posts || [];
      setHighlights(posts
        .filter((post: any) => post.media_type === 'image' && post.media_url)
        .map((post: any) => ({
          id: post.id,
          label: post.full_name || post.username,
          username: post.username,
          image: post.media_url
        }))
        .slice(0, 8));
    }).catch(() => setHighlights([]));
  }, []);

  if (highlights.length === 0) return null;

  return (
    <>
      <div className="flex gap-4 overflow-x-auto px-4 py-4 no-scrollbar">
        {highlights.map((highlight) => (
          <button key={highlight.id} onClick={() => setActive(highlight)} className="flex shrink-0 flex-col items-center gap-1.5">
            <div className="h-[68px] w-[68px] rounded-full bg-gradient-to-br from-accent to-primary p-[3px]">
              <div className="h-full w-full overflow-hidden rounded-full border-2 border-card"><img src={highlight.image} alt={highlight.label} className="h-full w-full object-cover" /></div>
            </div>
            <span className="max-w-[76px] truncate text-[11px] font-medium text-foreground">{highlight.label}</span>
          </button>
        ))}
      </div>

      {active && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4">
        <button onClick={() => setActive(null)} className="absolute right-4 top-4 z-30 grid h-9 w-9 place-items-center rounded-full bg-white/15"><X className="h-5 w-5 text-white" /></button>
        <div className="absolute left-4 top-5 z-30 text-white"><p className="font-bold">{active.label}</p><p className="text-xs text-white/60">@{active.username}</p></div>
        <img src={active.image} alt={active.label} className="max-h-[86vh] w-full max-w-md rounded-2xl object-contain" />
      </div>}
    </>
  );
};

export default StoryHighlights;
