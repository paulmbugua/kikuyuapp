import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from '@/lib/navigation';
import { X, ChevronLeft, ChevronRight, MessageCircle, ExternalLink, Play, Sparkles, TrendingUp, Flame, Clock, Star, Eye, Loader2 } from 'lucide-react';
import PostCard from '@/components/feed/PostCard';
import CreatorSpotlight from '@/components/feed/CreatorSpotlight';
import PullToRefresh from '@/components/feed/PullToRefresh';
import SwipeablePostCard from '@/components/feed/SwipeablePostCard';
import { useUserStore } from '@/stores/userStore';
import { toast } from 'sonner';
import axiosInstance from '@/utils/axiosConfig';
import { useSocket } from '@/contexts/SocketContext';

interface Post {
  id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  user_id: string;
  likes_count: number;
  comments_count: number;
  bookmarks_count?: number;
  shares_count?: number;
  views_count?: number;
  username: string;
  full_name: string;
  avatar_url: string;
  is_verified: boolean;
  is_liked: boolean;
  is_bookmarked: boolean;
}

interface SponsoredAd {
  id: string;
  title: string;
  description: string;
  image: string;
  videoUrl?: string;
  cta: string;
  advertiser: {
    name: string;
    logo?: string;
  };
}

/* ── Animated Gradient Skeleton ── */
const FeedSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-52 bg-gradient-to-r from-muted via-muted/50 to-muted shimmer-bg relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
    </div>
    
    <div className="flex gap-4 overflow-hidden px-4 py-6 border-b border-border/50">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex flex-col items-center gap-2 shrink-0 animate-float" style={{ animationDelay: `${i * 0.1}s` }}>
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-muted to-muted/80 shimmer-bg" />
          <div className="w-12 h-2 rounded bg-muted shimmer-bg" />
        </div>
      ))}
    </div>
    
    {[1, 2].map((i, idx) => (
      <div key={i} className="border-b border-border/50 animate-slide-up" style={{ animationDelay: `${idx * 0.15}s` }}>
        <div className="w-full aspect-video bg-gradient-to-br from-muted to-muted/60 shimmer-bg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted shimmer-bg" />
            <div className="space-y-2 flex-1">
              <div className="w-32 h-3.5 rounded bg-muted shimmer-bg" />
              <div className="w-20 h-3 rounded bg-muted shimmer-bg" />
            </div>
          </div>
          <div className="w-full h-3 rounded bg-muted shimmer-bg" />
          <div className="w-2/3 h-3 rounded bg-muted shimmer-bg" />
          <div className="thutha-accent-bar bg-gradient-to-r from-primary to-accent" />
        </div>
      </div>
    ))}
  </div>
);

const Feed = () => {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { socket, isConnected } = useSocket();
  const [posts, setPosts] = useState<Post[]>([]);
  const [sponsoredAds, setSponsoredAds] = useState<SponsoredAd[]>([]);
  const [viewingAd, setViewingAd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('for-you');
  const [hoveredStory, setHoveredStory] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastPostRef = useRef<HTMLDivElement | null>(null);
  const viewTrackedRef = useRef<Set<string>>(new Set());

  const categories = [
    { id: 'for-you', label: 'For You', icon: Sparkles, endpoint: '/feed' },
    { id: 'trending', label: 'Trending', icon: Flame, endpoint: '/feed/trending' },
    { id: 'latest', label: 'Latest', icon: Clock, endpoint: '/feed/latest' },
    { id: 'following', label: 'Following', icon: Star, endpoint: '/feed/following' },
  ];

  // Track view for a post
  const trackView = async (postId: string) => {
    if (viewTrackedRef.current.has(postId)) return;
    viewTrackedRef.current.add(postId);
    
    try {
      await axiosInstance.post(`/posts/${postId}/view`);
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, views_count: (post.views_count || 0) + 1 }
          : post
      ));
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  // Handle like post
  const handleLike = async (postId: string, isLiked: boolean) => {
    try {
      if (isLiked) {
        await axiosInstance.delete(`/likes/post/${postId}`);
      } else {
        await axiosInstance.post(`/likes/post/${postId}`);
      }
      
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              is_liked: !isLiked,
              likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1
            }
          : post
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to like post');
    }
  };

  // Handle bookmark
 // Handle bookmark
const handleBookmark = async (postId: string, isBookmarked: boolean) => {
  try {
    if (isBookmarked) {
      await axiosInstance.delete(`/bookmarks/${postId}`);
    } else {
      // Add collection in the request body
      await axiosInstance.post(`/bookmarks/${postId}`, { collection: 'Saved' });
    }
    
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { 
            ...post, 
            is_bookmarked: !isBookmarked,
            bookmarks_count: isBookmarked ? (post.bookmarks_count || 0) - 1 : (post.bookmarks_count || 0) + 1
          }
        : post
    ));
    
    toast.success(isBookmarked ? 'Removed from bookmarks' : 'Saved to bookmarks');
  } catch (error: any) {
    console.error('Error toggling bookmark:', error);
    toast.error(error.response?.data?.message || 'Failed to bookmark post');
  }
};

  // Handle share
  const handleShare = async (postId: string, content: string, username: string) => {
    try {
      const postUrl = `${window.location.origin}/post/${postId}`;
      
      if (navigator.share) {
        await navigator.share({
          title: `${username} on Thutha`,
          text: content?.substring(0, 100),
          url: postUrl,
        });
      } else {
        await navigator.clipboard.writeText(postUrl);
        toast.success('Link copied to clipboard!');
      }
      
      // Track share
      await axiosInstance.post(`/posts/${postId}/share`);
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, shares_count: (post.shares_count || 0) + 1 }
          : post
      ));
    } catch (error) {
      if ((error as any).name !== 'AbortError') {
        console.error('Error sharing:', error);
        toast.error('Failed to share post');
      }
    }
  };

  // Fetch feed data
  const fetchFeed = async (reset = true, categoryId = activeCategory) => {
    if (reset) {
      setLoading(true);
      setPage(1);
    } else {
      setLoadingMore(true);
    }

    try {
      const category = categories.find(c => c.id === categoryId);
      const endpoint = category?.endpoint || '/feed';
      const response = await axiosInstance.get(endpoint, {
        params: {
          limit: 10,
          page: reset ? 1 : page + 1
        }
      });

      let newPosts = [];
      if (response.data.data?.posts) {
        newPosts = response.data.data.posts;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        newPosts = response.data.data;
      } else if (Array.isArray(response.data)) {
        newPosts = response.data;
      } else {
        console.error('Unexpected response structure:', response.data);
        newPosts = [];
      }
      
      // Add missing fields
      newPosts = newPosts.map(post => ({
        ...post,
        bookmarks_count: post.bookmarks_count || 0,
        shares_count: post.shares_count || 0,
        views_count: post.views_count || 0
      }));
      
      if (reset) {
        setPosts(newPosts);
        setPage(1);
        setHasMore(newPosts.length === 10);
        viewTrackedRef.current.clear();
      } else {
        setPosts(prev => [...prev, ...newPosts]);
        setPage(prev => prev + 1);
        setHasMore(newPosts.length === 10);
      }
    } catch (error) {
      console.error('Error fetching feed:', error);
      toast.error('Failed to load feed');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Fetch sponsored ads
  const fetchSponsoredAds = async () => {
    try {
      const response = await axiosInstance.get('/promotions/active');
      const ads = response.data.data.promotions || [];
      
      const formattedAds = ads
        .filter((ad: any) => ad.content_data?.media_url || ad.content_data?.thumbnail_url)
        .map((ad: any) => ({
        id: ad.id,
        title: ad.content_data?.title || 'Sponsored Content',
        description: ad.content_data?.content || '',
        image: ad.content_data.media_url || ad.content_data.thumbnail_url,
        videoUrl: ad.content_data?.video_url || null,
        cta: ad.content_data?.cta_text || 'Learn More',
        advertiser: {
          name: ad.full_name || 'Sponsor',
          logo: ad.avatar_url || undefined
        }
      }));
      
      setSponsoredAds(formattedAds);
    } catch (error) {
      console.error('Error fetching sponsored ads:', error);
      setSponsoredAds([]);
    }
  };

  // Handle refresh (pull to refresh)
  const handleRefresh = useCallback(async () => {
    await fetchFeed(true, activeCategory);
    await fetchSponsoredAds();
  }, [activeCategory]);

  // Handle category change
  const handleCategoryChange = async (categoryId: string) => {
    setActiveCategory(categoryId);
    await fetchFeed(true, categoryId);
  };

  // Setup view tracking with IntersectionObserver
  useEffect(() => {
    const viewObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const postId = entry.target.getAttribute('data-post-id');
            if (postId) {
              trackView(postId);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    // Observe all post elements
    const postElements = document.querySelectorAll('[data-post-id]');
    postElements.forEach(el => viewObserver.observe(el));

    return () => viewObserver.disconnect();
  }, [posts]);

  // Setup infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchFeed(false, activeCategory);
        }
      },
      { threshold: 0.1 }
    );

    if (lastPostRef.current) {
      observerRef.current.observe(lastPostRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore, loading, activeCategory, posts.length]);

  // Listen for real-time updates via socket
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewLike = (data: any) => {
      if (data.post_id) {
        setPosts(prev => prev.map(post => 
          post.id === data.post_id && post.user_id !== user?.id
            ? { ...post, likes_count: post.likes_count + 1 }
            : post
        ));
      }
    };

    const handleNewComment = (data: any) => {
      if (data.post_id) {
        setPosts(prev => prev.map(post => 
          post.id === data.post_id
            ? { ...post, comments_count: post.comments_count + 1 }
            : post
        ));
      }
    };

    socket.on('like:new', handleNewLike);
    socket.on('comment:new', handleNewComment);

    return () => {
      socket.off('like:new', handleNewLike);
      socket.off('comment:new', handleNewComment);
    };
  }, [socket, isConnected, user?.id]);

  // Initial load
  useEffect(() => {
    fetchFeed(true, activeCategory);
    fetchSponsoredAds();
  }, []);

  const currentAd = viewingAd !== null ? sponsoredAds[viewingAd] : null;

  if (loading && posts.length === 0) {
    return <FeedSkeleton />;
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="relative bg-gradient-to-b from-background via-background to-background/95">
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/5 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        {/* Category Tabs */}
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="flex gap-1 p-2 px-4 overflow-x-auto no-scrollbar">
            {categories.map(cat => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                    activeCategory === cat.id
                      ? 'text-primary-foreground bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-transform duration-300 ${activeCategory === cat.id ? 'scale-110' : ''}`} />
                  {cat.label}
                  {activeCategory === cat.id && (
                    <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-accent rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Creator Spotlight */}
        <div className="relative px-4 pt-4">
          <CreatorSpotlight />
        </div>

        {/* Sponsored Stories */}
        {sponsoredAds.length > 0 && (
          <div className="relative px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-primary to-accent rounded-full" />
                <h2 className="text-lg font-heading font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Featured Stories
                </h2>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="w-3 h-3" />
                <span>Sponsored</span>
              </div>
            </div>
            
            <div className="flex gap-5 overflow-x-auto no-scrollbar pb-4 -mx-1 px-1">
              {sponsoredAds.map((ad, i) => (
                <button
                  key={ad.id}
                  onClick={() => setViewingAd(i)}
                  onMouseEnter={() => setHoveredStory(i)}
                  onMouseLeave={() => setHoveredStory(null)}
                  className="group flex flex-col items-center gap-2 shrink-0 transition-all duration-500 transform hover:scale-105"
                >
                  <div className="relative">
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent transition-opacity duration-300 ${
                      hoveredStory === i ? 'opacity-100 scale-110 blur-md' : 'opacity-0'
                    }`} />
                    <div className="relative w-20 h-20 rounded-full p-[2px] bg-gradient-to-br from-primary via-accent to-primary">
                      <div className="w-full h-full rounded-full bg-background p-0.5">
                        <div className="w-full h-full rounded-full bg-muted flex items-center justify-center overflow-hidden relative group-hover:scale-110 transition-transform duration-300">
                          <img src={ad.image} alt={ad.advertiser.name} className="w-full h-full object-cover" />
                          {ad.videoUrl && (
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              <Play className="w-6 h-6 text-white fill-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {hoveredStory === i && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-ping" />
                    )}
                  </div>
                  <div className="text-center">
                    <span className="text-[11px] font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                      Sponsored
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section label */}
        <div className="px-4 pt-2 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-widest">
                {activeCategory === 'for-you' ? 'For You' : activeCategory === 'trending' ? 'Trending Now' : activeCategory === 'latest' ? 'Latest Stories' : 'From People You Follow'}
              </span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
          </div>
        </div>

        {/* Feed posts */}
        {posts.length === 0 && !loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No posts to show</p>
            <button 
              onClick={() => fetchFeed(true)}
              className="mt-4 text-primary text-sm font-medium hover:underline"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {posts.map((post, index) => (
              <div
                key={post.id}
                ref={index === posts.length - 1 ? lastPostRef : null}
                data-post-id={post.id}
                className="animate-slide-up opacity-0 [animation-fill-mode:forwards]"
                style={{ animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
              >
                <SwipeablePostCard
                  onBookmark={() => handleBookmark(post.id, post.is_bookmarked)}
                  onShare={() => handleShare(post.id, post.content, post.username)}
                >
                  <PostCard 
                    post={post}
                    onLike={() => handleLike(post.id, post.is_liked)}
                    onComment={() => navigate(`/post/${post.id}`)}
                    onBookmark={() => handleBookmark(post.id, post.is_bookmarked)}
                    onShare={() => handleShare(post.id, post.content, post.username)}
                    onView={() => trackView(post.id)}
                  />
                </SwipeablePostCard>
              </div>
            ))}
          </div>
        )}

        {/* Loading more indicator */}
        {loadingMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {/* End of feed message */}
        {!hasMore && posts.length > 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground">You've seen all posts</p>
          </div>
        )}

        {/* Full-screen Ad Viewer */}
        {viewingAd !== null && currentAd && (
          <div className="fixed inset-0 z-[100] bg-gradient-to-br from-black/95 via-black/98 to-black/95 backdrop-blur-2xl flex items-center justify-center animate-fade-in">
            <button 
              onClick={() => setViewingAd(null)} 
              className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center transition-all duration-300 hover:bg-white/20 hover:scale-110 active:scale-95"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Progress bars */}
            <div className="absolute top-2 left-4 right-4 flex gap-1.5 z-30">
              {sponsoredAds.map((_, i) => (
                <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-white/10">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      i === viewingAd 
                        ? 'bg-gradient-to-r from-primary via-accent to-primary w-full' 
                        : i < viewingAd 
                          ? 'bg-gradient-to-r from-primary to-accent w-full' 
                          : 'w-0'
                    }`} 
                  />
                </div>
              ))}
            </div>

            {/* Navigation buttons */}
            <button 
              onClick={() => setViewingAd(Math.max(0, viewingAd - 1))} 
              className="absolute left-0 top-0 bottom-0 w-1/4 z-20 group flex items-center justify-start pl-4"
            >
              <div className="bg-white/10 backdrop-blur-xl rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-2">
                <ChevronLeft className="w-6 h-6 text-white" />
              </div>
            </button>
            
            <button 
              onClick={() => {
                if (viewingAd < sponsoredAds.length - 1) setViewingAd(viewingAd + 1);
                else setViewingAd(null);
              }} 
              className="absolute right-0 top-0 bottom-0 w-1/4 z-20 group flex items-center justify-end pr-4"
            >
              <div className="bg-white/10 backdrop-blur-xl rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-[-2px]">
                <ChevronRight className="w-6 h-6 text-white" />
              </div>
            </button>

            {/* Ad Content */}
            <div className="w-full max-w-md mx-auto px-4 z-10 relative">
              <div className="flex items-center gap-3 mb-6 bg-white/5 backdrop-blur-xl rounded-2xl p-3 border border-white/10">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-accent blur-md opacity-50" />
                  {currentAd.advertiser.logo ? <img src={currentAd.advertiser.logo} alt={currentAd.advertiser.name} className="relative h-12 w-12 rounded-full border-2 border-white/20 object-cover" /> : <span className="relative grid h-12 w-12 place-items-center rounded-full border-2 border-white/20 bg-black/40 font-bold text-white">{currentAd.advertiser.name.slice(0, 1).toUpperCase()}</span>}
                </div>
                <div className="flex-1">
                  <p className="text-white font-heading font-bold text-sm">{currentAd.advertiser.name}</p>
                  <p className="text-white/40 text-[11px] flex items-center gap-1">
                    <span className="w-1 h-1 bg-white/40 rounded-full" />
                    Sponsored
                  </p>
                </div>
              </div>

              <div className="relative group mb-6 rounded-2xl overflow-hidden shadow-2xl">
                {currentAd.videoUrl ? (
                  <video 
                    ref={el => { videoRefs.current[viewingAd] = el; }}
                    src={currentAd.videoUrl} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="w-full aspect-[4/3] object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <img 
                    src={currentAd.image} 
                    alt={currentAd.title} 
                    className="w-full aspect-[4/3] object-cover transition-transform duration-700 group-hover:scale-105" 
                  />
                )}
              </div>

              <h3 className="text-white font-heading font-bold text-2xl text-center mb-3">
                {currentAd.title}
              </h3>
              <p className="text-white/60 text-sm text-center leading-relaxed mb-8 max-w-sm mx-auto">
                {currentAd.description}
              </p>

              <button
                onClick={() => { 
                  setViewingAd(null); 
                  if (currentAd.cta === 'Chat Now') {
                    navigate('/messages');
                  } else {
                    window.open('/explore', '_blank');
                  }
                }}
                className="group relative w-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-heading font-semibold px-8 py-4 rounded-2xl flex items-center justify-center gap-2 shadow-2xl hover:shadow-primary/25 transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                {currentAd.cta === 'Chat Now' ? (
                  <MessageCircle className="w-5 h-5 transition-transform group-hover:rotate-12" />
                ) : (
                  <ExternalLink className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                )}
                <span className="relative">{currentAd.cta}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
};

export default Feed