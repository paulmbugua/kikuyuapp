import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from '@/lib/navigation';
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, CheckCircle2, Eye, Sparkles, Send, Zap, Award, TrendingUp, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { formatNumber } from '@/utils/format';
import CommentSection from './CommentSection';
import SupportTokenButton from './SupportTokenButton';
import LiveReactions from './LiveReactions';
import { toast } from 'sonner';
import axiosInstance from '@/utils/axiosConfig';
import { useSocket } from '@/contexts/SocketContext';

interface PostCardProps {
  post: {
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
  };
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onBookmark?: () => void;
  onView?: () => void;
}

const TEXT_LIMIT = 150;

const PostCard = ({ post, onLike, onComment, onShare, onBookmark, onView }: PostCardProps) => {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [liked, setLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.likes_count);
  const [bookmarked, setBookmarked] = useState(post.is_bookmarked);
  const [bookmarkCount, setBookmarkCount] = useState(post.bookmarks_count || 0);
  const [shareCount, setShareCount] = useState(post.shares_count || 0);
  const [viewsCount, setViewsCount] = useState(post.views_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [rippleEffect, setRippleEffect] = useState<{ x: number; y: number } | null>(null);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [videoMuted, setVideoMuted] = useState(true);

  // Track view when post becomes visible
  useEffect(() => {
    if (!cardRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisibleNow = entry.isIntersecting;
        setIsVisible(isVisibleNow);
        
        // Track view when post becomes visible (only once)
        if (isVisibleNow && !hasTrackedView && onView) {
          setHasTrackedView(true);
          onView();
          setViewsCount(prev => prev + 1);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [hasTrackedView, onView]);

  // Handle video playback
  useEffect(() => {
    if (!videoRef.current) return;
    if (isVisible) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isVisible]);

  // Real-time updates via socket
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleLikeUpdate = (data: any) => {
      if (data.post_id === post.id && data.user_id !== post.user_id) {
        setLikeCount(prev => data.liked ? prev + 1 : prev - 1);
      }
    };

    const handleCommentUpdate = (data: any) => {
      if (data.post_id === post.id) {
        onComment?.();
      }
    };

    socket.on('like:update', handleLikeUpdate);
    socket.on('comment:new', handleCommentUpdate);

    return () => {
      socket.off('like:update', handleLikeUpdate);
      socket.off('comment:new', handleCommentUpdate);
    };
  }, [socket, isConnected, post.id, post.user_id, onComment]);

  // Navigate to post detail
  const handleCardClick = () => {
    navigate(`/post/${post.id}`);
  };

  // Navigate to user profile
  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/profile/${post.username}`);
  };

  // Handle like with API call
  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRippleEffect({ x, y });
    setTimeout(() => setRippleEffect(null), 500);
    
    // Optimistic update
    setLiked(!liked);
    setLikeCount(prev => liked ? prev - 1 : prev + 1);
    
    try {
      if (liked) {
        await axiosInstance.delete(`/likes/post/${post.id}`);
      } else {
        await axiosInstance.post(`/likes/post/${post.id}`);
      }
      onLike?.();
    } catch (error) {
      // Revert on error
      setLiked(liked);
      setLikeCount(prev => liked ? prev + 1 : prev - 1);
      console.error('Error toggling like:', error);
      toast.error('Failed to like post');
    }
  };

  // Handle comment click
  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(!showComments);
    onComment?.();
  };

  // Handle share with API call
  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const postUrl = `${window.location.origin}/post/${post.id}`;
      
      // Try native share first
      if (navigator.share) {
        await navigator.share({
          title: `${post.full_name || post.username} on Thutha`,
          text: post.content?.substring(0, 100),
          url: postUrl,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(postUrl);
        toast.success('Link copied to clipboard!');
      }
      
      // Track share
      await axiosInstance.post(`/posts/${post.id}/share`);
      setShareCount(prev => prev + 1);
      onShare?.();
    } catch (error) {
      if ((error as any).name !== 'AbortError') {
        console.error('Error sharing:', error);
        toast.error('Failed to share post');
      }
    }
  };

  // Handle bookmark with API call
  const handleBookmarkClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Optimistic update
    setBookmarked(!bookmarked);
    setBookmarkCount(prev => bookmarked ? prev - 1 : prev + 1);
    
    try {
      if (bookmarked) {
        await axiosInstance.delete(`/bookmarks/${post.id}`);
        toast.success('Removed from bookmarks');
      } else {
        await axiosInstance.post(`/bookmarks/${post.id}`);
        toast.success('Saved to bookmarks');
      }
      onBookmark?.();
    } catch (error) {
      // Revert on error
      setBookmarked(bookmarked);
      setBookmarkCount(prev => bookmarked ? prev + 1 : prev - 1);
      console.error('Error toggling bookmark:', error);
      toast.error('Failed to bookmark post');
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Add menu options (report, share, etc.)
  };

  const handleReadMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const isLongText = post.content?.length > TEXT_LIMIT;
  const displayText = isLongText && !expanded ? post.content?.slice(0, TEXT_LIMIT) + '...' : post.content;

  const timeAgo = (date: string) => {
    if (!date) return 'recent';
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <article 
      ref={cardRef} 
      className={`group relative bg-gradient-to-br from-card via-card to-card/95 rounded-2xl shadow-xl transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] hover:-translate-y-1 cursor-pointer ${
        isHovered ? 'shadow-primary/10' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Animated border gradient */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/0 via-accent/0 to-primary/0 transition-all duration-700 pointer-events-none ${
        isHovered ? 'bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20' : ''
      }`} style={{ padding: '1px' }} />

      {/* Media */}
      {post.media_url && (
        <div className="relative overflow-hidden rounded-t-2xl">
          {post.media_type === 'image' ? (
            <img 
              src={post.media_url} 
              alt="Post" 
              className="w-full object-contain bg-gradient-to-br from-muted/30 to-muted/10 transition-transform duration-700 hover:scale-105" 
              loading="lazy" 
            />
          ) : post.media_type === 'video' && (
            <div onClick={(e) => e.stopPropagation()}>
              <video 
                ref={videoRef} 
                src={post.media_url} 
                loop 
                muted={videoMuted} 
                playsInline 
                className="w-full object-contain bg-gradient-to-br from-muted/30 to-muted/10" 
                controls
              />
            </div>
          )}
        </div>
      )}

      {/* Content section */}
      <div className="px-5 pt-4 pb-4">
        {/* Author row */}
        <div className="flex items-center gap-3 mb-4">
          <div 
            onClick={handleProfileClick}
            className="shrink-0 relative group/avatar cursor-pointer"
          >
            {post.avatar_url ? <img
              src={post.avatar_url}
              alt={post.username}
              className="relative w-12 h-12 rounded-full object-cover ring-3 ring-primary/20 group-hover/avatar:ring-4 transition-all duration-300"
            /> : <span className="grid h-12 w-12 place-items-center rounded-full bg-muted font-bold ring-3 ring-primary/20">{post.username.slice(0, 1).toUpperCase()}</span>}
            {post.is_verified && (
              <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-primary to-accent rounded-full p-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span 
                onClick={handleProfileClick}
                className="font-heading font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                {post.full_name || post.username}
              </span>
              {post.is_verified && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
              <span className="text-muted-foreground text-sm">·</span>
              <span className="text-muted-foreground text-sm flex items-center gap-1">
                {timeAgo(post.created_at)}
              </span>
            </div>
            <span 
              onClick={handleProfileClick}
              className="text-sm text-muted-foreground cursor-pointer hover:text-primary transition-colors"
            >
              @{post.username}
            </span>
          </div>
          
          <button 
            onClick={handleMenuClick}
            className="p-2 rounded-full hover:bg-muted transition-all duration-300 text-muted-foreground hover:text-foreground hover:scale-110"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Text content */}
        <div className="mb-4">
          <p className="text-[15px] text-foreground leading-relaxed whitespace-pre-wrap">
            {displayText?.split(/(#\w+)/g).map((part, i) =>
              part?.startsWith('#') ? (
                <span 
                  key={i} 
                  onClick={(e) => e.stopPropagation()}
                  className="text-accent font-semibold cursor-pointer hover:underline hover:text-primary transition-colors"
                >
                  {part}
                </span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
            {isLongText && (
              <button
                onClick={handleReadMoreClick}
                className="text-primary font-semibold ml-1 hover:underline transition-all hover:ml-2"
              >
                {expanded ? 'Show less' : 'Read more...'}
              </button>
            )}
          </p>
        </div>

        {/* Stats row - Views */}
        {(viewsCount > 0 || shareCount > 0 || bookmarkCount > 0) && (
          <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
            {viewsCount > 0 && (
              <div className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" />
                <span>{formatNumber(viewsCount)} views</span>
              </div>
            )}
            {shareCount > 0 && (
              <div className="flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5" />
                <span>{formatNumber(shareCount)} shares</span>
              </div>
            )}
            {bookmarkCount > 0 && (
              <div className="flex items-center gap-1">
                <Bookmark className="w-3.5 h-3.5" />
                <span>{formatNumber(bookmarkCount)} saves</span>
              </div>
            )}
          </div>
        )}

        {/* Action bar */}
        <div className="thutha-accent-bar bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 h-px mb-4" />
        
        <div className="flex items-center justify-between">
          {/* Like button */}
          <button 
            onClick={handleLikeClick} 
            className={`relative flex items-center gap-2 text-sm transition-all duration-300 group/like ${
              liked ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'
            }`}
          >
            <div className="relative">
              <Heart className={`w-5 h-5 transition-all duration-300 group-hover/like:scale-110 ${
                liked ? 'fill-current animate-bounce' : ''
              }`} />
              {rippleEffect && (
                <div 
                  className="absolute inset-0 rounded-full bg-destructive/30 animate-ping pointer-events-none"
                  style={{
                    left: rippleEffect.x - 20,
                    top: rippleEffect.y - 20,
                    width: 40,
                    height: 40,
                  }}
                />
              )}
            </div>
            <span className="font-semibold">{formatNumber(likeCount)}</span>
          </button>

          {/* Comment button */}
          <button 
            onClick={handleCommentClick} 
            className={`flex items-center gap-2 text-sm transition-all duration-300 group/comment ${
              showComments ? 'text-primary' : 'text-muted-foreground hover:text-primary'
            }`}
          >
            <MessageCircle className="w-5 h-5 transition-all duration-300 group-hover/comment:scale-110" />
            <span className="font-semibold">{formatNumber(post.comments_count)}</span>
          </button>

          {/* Share button */}
          <button 
            onClick={handleShareClick}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent transition-all duration-300 group/share"
          >
            <Share2 className="w-5 h-5 transition-all duration-300 group-hover/share:scale-110 group-hover/share:rotate-12" />
            {shareCount > 0 && <span className="text-xs">{formatNumber(shareCount)}</span>}
          </button>

          {/* Bookmark button */}
          <button 
            onClick={handleBookmarkClick} 
            className={`transition-all duration-300 group/bookmark ${
              bookmarked ? 'text-primary' : 'text-muted-foreground hover:text-primary'
            }`}
          >
            <Bookmark className={`w-5 h-5 transition-all duration-300 group-hover/bookmark:scale-110 ${
              bookmarked ? 'fill-current' : ''
            }`} />
            {bookmarkCount > 0 && <span className="text-xs ml-1">{formatNumber(bookmarkCount)}</span>}
          </button>

          {/* Support/Tip button */}
          <SupportTokenButton postId={post.id} username={post.username} />
        </div>
      </div>

      {/* Comment section */}
      <div 
        className={`transition-all duration-500 overflow-hidden ${
          showComments ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <CommentSection postId={post.id} />
      </div>
    </article>
  );
};

export default PostCard;