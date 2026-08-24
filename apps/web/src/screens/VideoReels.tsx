import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import {
  ArrowLeft, Heart, MessageCircle, Share2, Download,
  CheckCircle2, Music2, Play, Pause, Volume2, VolumeX,
  Maximize2, Minimize2, X, MoreHorizontal, UserPlus, TrendingUp,
  Sparkles, Clock, Send, ThumbsUp, ChevronUp, ChevronDown,
  Repeat, Info, Share as ShareIcon, Flag, Copy, Twitter, Instagram,
  Link as LinkIcon, MessageSquare,
} from 'lucide-react';
import axiosInstance from '@/utils/axiosConfig';
import { formatNumber } from '@/utils/format';
import AppRightSidebar from '@/components/layout/RightSidebar';

interface Reel {
  id: string;
  user: { id: string; username: string; handle: string; avatar: string; verified: boolean; followers: number };
  videoUrl: string;
  caption: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  liked: boolean;
  music?: string;
}
import SupportTokenButton from '@/components/feed/SupportTokenButton';
import DesktopSidebar from '@/components/layout/DesktopSidebar';

// ============================================================================
// PREMIUM DESIGN SYSTEM
// ============================================================================
const DESIGN = {
  colors: {
    primary: '#F97316',
    secondary: '#8B5CF6',
    accent: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F97316 0%, #F59E0B 50%, #8B5CF6 100%)',
    surface: {
      dark: 'rgba(0, 0, 0, 0.75)',
      darker: 'rgba(0, 0, 0, 0.85)',
      glass: 'rgba(255, 255, 255, 0.1)',
      glassStrong: 'rgba(255, 255, 255, 0.15)',
    }
  },
  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.15)',
    md: '0 4px 16px rgba(0, 0, 0, 0.2)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.25)',
    xl: '0 16px 48px rgba(0, 0, 0, 0.3)',
  }
};

// ============================================================================
// SHARE MODAL COMPONENT
// ============================================================================
const ShareModal = ({ isOpen, onClose, reel }: { isOpen: boolean; onClose: () => void; reel: Reel }) => {
  if (!isOpen) return null;

  const shareUrl = window.location.href;
  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    // Show toast notification here
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-gradient-to-b from-gray-900 to-black rounded-t-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white text-xl font-bold">Share</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { icon: ShareIcon, label: 'Share', color: '#F97316' },
              { icon: Twitter, label: 'Twitter', color: '#1DA1F2' },
              { icon: Instagram, label: 'Instagram', color: '#E4405F' },
              { icon: MessageCircle, label: 'WhatsApp', color: '#25D366' },
            ].map((item, i) => (
              <button key={i} className="flex flex-col items-center gap-2 group">
                <div className="w-12 h-12 rounded-full bg-white/10 group-hover:bg-white/20 transition flex items-center justify-center">
                  <item.icon className="w-6 h-6 text-white" style={{ color: item.color }} />
                </div>
                <span className="text-white/60 text-xs">{item.label}</span>
              </button>
            ))}
          </div>
          
          <div className="flex gap-2 p-2 bg-white/5 rounded-xl">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 bg-transparent text-white text-sm px-3 py-2 outline-none"
            />
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-accent rounded-lg text-white text-sm font-semibold hover:bg-accent/80 transition"
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// ACTION BUTTON COMPONENT
// ============================================================================
const ActionButton = ({ icon: Icon, label, count, active, onClick, activeColor = 'text-rose-500' }: any) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 group">
    <div className={`
      w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
      ${active 
        ? `${activeColor} bg-white/15 scale-110` 
        : 'bg-white/10 backdrop-blur-sm group-hover:bg-white/20 group-hover:scale-105'
      }
    `}>
      <Icon className={`
        w-5.5 h-5.5 transition-all duration-200
        ${active ? activeColor : 'text-white group-hover:text-white/90'}
      `} />
    </div>
    {label && (
      <span className="text-[10px] font-medium text-white/80">{label}</span>
    )}
    {count !== undefined && (
      <span className="text-[11px] font-semibold text-white/90 -mt-0.5">
        {formatNumber(count)}
      </span>
    )}
  </button>
);

// ============================================================================
// REEL CARD COMPONENT
// ============================================================================
interface ReelCardProps {
  reel: Reel;
  isActive: boolean;
  onBack: () => void;
}

const ReelCard = ({ reel, isActive, onBack }: ReelCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(reel.liked);
  const [likeCount, setLikeCount] = useState(reel.likes);
  const [following, setFollowing] = useState(false);
  const [shareCount, setShareCount] = useState(reel.shares);
  const [commentCount, setCommentCount] = useState(reel.comments);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false); // Default unmuted for better UX
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentsList, setCommentsList] = useState<Array<any>>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const lastTap = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive && !paused) {
      v.play().catch(() => console.log('Autoplay prevented'));
    } else {
      v.pause();
    }
  }, [isActive, paused]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const update = () => setProgress((v.currentTime / (v.duration || 1)) * 100);
    v.addEventListener('timeupdate', update);
    return () => v.removeEventListener('timeupdate', update);
  }, []);

  const toggleLike = useCallback(async () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((count) => Math.max(0, count + (nextLiked ? 1 : -1)));
    try {
      if (nextLiked) await axiosInstance.post(`/uhoro/${reel.id}/like`);
      else await axiosInstance.delete(`/uhoro/${reel.id}/unlike`);
    } catch (error) {
      setLiked(!nextLiked);
      setLikeCount((count) => Math.max(0, count + (nextLiked ? -1 : 1)));
      console.error('Unable to persist video like:', error);
    }
  }, [liked, reel.id]);

  const toggleFollow = async () => {
    const nextFollowing = !following;
    setFollowing(nextFollowing);
    try {
      if (nextFollowing) await axiosInstance.post(`/follows/${reel.user.id}`);
      else await axiosInstance.delete(`/follows/${reel.user.id}`);
    } catch (error) {
      setFollowing(!nextFollowing);
      console.error('Unable to persist follow:', error);
    }
  };

  const openComments = async () => {
    const opening = !showComments;
    setShowComments(opening);
    if (!opening || commentsLoaded) return;
    try {
      const { data } = await axiosInstance.get(`/uhoro/${reel.id}/comments?sort=popular&limit=50`);
      const comments = Array.isArray(data.data) ? data.data : [];
      setCommentsList(comments.map((comment: any) => ({
        id: comment.id,
        username: comment.full_name || comment.username,
        handle: `@${comment.username}`,
        text: comment.content,
        likes: Number(comment.likes_count || 0),
        timestamp: new Date(comment.created_at)
      })));
      setCommentCount(Number(data.pagination?.total || comments.length));
      setCommentsLoaded(true);
    } catch (error) {
      console.error('Unable to load comments:', error);
    }
  };

  const handleShare = async () => {
    setShowShareModal(true);
    try {
      const { data } = await axiosInstance.post(`/uhoro/${reel.id}/share`);
      setShareCount(Number(data.data?.shares_count || shareCount + 1));
    } catch (error) {
      console.error('Unable to record share:', error);
    }
  };

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) void toggleLike();
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
    } else {
      setTimeout(() => {
        if (Date.now() - lastTap.current >= 300) {
          setPaused(p => !p);
        }
      }, 300);
    }
    lastTap.current = now;
  }, [liked, toggleLike]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
  };

  const handleComment = async () => {
    const content = commentText.trim();
    if (!content) return;
    try {
      const { data } = await axiosInstance.post(`/uhoro/${reel.id}/comments`, { content });
      const comment = data.data.comment;
      setCommentsList((current) => [{
        id: comment.id,
        username: comment.full_name || comment.username,
        handle: `@${comment.username}`,
        text: comment.content,
        likes: Number(comment.likes_count || 0),
        timestamp: new Date(comment.created_at)
      }, ...current]);
      setCommentCount((count) => count + 1);
      setCommentText('');
    } catch (error) {
      console.error('Unable to publish comment:', error);
    }
  };

  return (
    <div className="relative w-full h-full snap-start snap-always flex-shrink-0 bg-black overflow-hidden">
      {/* Video Background */}
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-accent animate-spin" />
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        src={reel.videoUrl}
        loop
        muted={muted}
        playsInline
        preload="auto"
        onLoadedData={() => setLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none z-[1]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-transparent pointer-events-none z-[1]" />

      {/* Tap Area */}
      <div className="absolute inset-0 z-[2]" onClick={handleTap} />

      {/* Double Tap Heart Animation */}
      {showHeart && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
          <div className="animate-float">
            <Heart className="w-32 h-32 text-rose-500 fill-current drop-shadow-2xl animate-heart-burst" />
          </div>
        </div>
      )}

      {/* Pause Indicator */}
      {paused && isActive && (
        <div className="absolute inset-0 z-[3] flex items-center justify-center pointer-events-none backdrop-blur-sm animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-xl flex items-center justify-center shadow-2xl border-2 border-white/30">
            <Play className="w-10 h-10 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-[6] px-5 pt-12 pb-6 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack} 
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 transition-all flex items-center justify-center group"
          >
            <ArrowLeft className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          </button>
          
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md">
            <span className="text-white font-semibold text-sm tracking-wide">Shorts</span>
            <div className="w-1 h-1 rounded-full bg-white/60" />
            <span className="text-white/80 text-xs">For You</span>
          </div>

          <button 
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 transition-all flex items-center justify-center"
          >
            <MoreHorizontal className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* More Options Menu */}
      {showMoreOptions && (
        <div className="absolute top-24 right-5 z-[10] bg-black/90 backdrop-blur-xl rounded-2xl py-2 min-w-[200px] border border-white/10 shadow-xl animate-fade-in-down">
          {[
            { icon: Info, label: 'About this video' },
            { icon: Flag, label: 'Report' },
            { icon: Copy, label: 'Copy link' },
            { icon: Download, label: 'Save video' },
          ].map((option, i) => (
            <button
              key={i}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors"
              onClick={() => setShowMoreOptions(false)}
            >
              <option.icon className="w-4 h-4 text-white/70" />
              <span className="text-white/90 text-sm">{option.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Right Action Bar */}
      <div className="absolute right-3 bottom-28 z-[6] flex flex-col items-center gap-5">
        {/* Profile */}
        <div className="relative group cursor-pointer" onClick={() => navigate(`/profile/${reel.user.id}`)}>
          <div className="absolute -inset-0.5 bg-gradient-to-tr from-accent via-primary to-secondary rounded-full opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-300" />
          {reel.user.avatar ? <img
            src={reel.user.avatar}
            alt={reel.user.username}
            className="relative h-12 w-12 rounded-full object-cover ring-2 ring-white/30 transition-transform duration-200 group-hover:scale-105"
          /> : <span className="relative grid h-12 w-12 place-items-center rounded-full bg-black font-bold text-white ring-2 ring-white/30">{reel.user.username.slice(0, 1).toUpperCase()}</span>}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center shadow-lg">
            <UserPlus className="w-3 h-3 text-white" />
          </div>
        </div>

        <ActionButton icon={Heart} count={likeCount} active={liked} onClick={() => void toggleLike()} activeColor="text-rose-500" />
        <ActionButton icon={MessageCircle} count={commentCount} onClick={() => void openComments()} />
        <ActionButton icon={Share2} count={shareCount} onClick={() => void handleShare()} />

        {/* Music Disc */}
        <div className="relative group cursor-pointer">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-accent blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative w-11 h-11 rounded-full border-2 border-white/40 overflow-hidden animate-spin-slow shadow-lg">
            {reel.user.avatar ? <img src={reel.user.avatar} alt={reel.user.username} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center bg-black text-xs font-bold text-white">{reel.user.username.slice(0, 1).toUpperCase()}</span>}
          </div>
        </div>
      </div>

      {/* Bottom Info Area */}
      <div className="absolute bottom-0 left-0 right-0 z-[6] px-4 pb-6">
        {/* Caption and User Info */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white font-bold text-base hover:underline cursor-pointer">
              {reel.user.username}
            </span>
            {reel.user.verified && <CheckCircle2 className="w-4 h-4 text-primary" />}
            <span className="text-white/50 text-xs">{reel.user.handle}</span>
            <button onClick={() => void toggleFollow()} className="ml-2 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-all backdrop-blur-sm">
              {following ? 'Following' : 'Follow'}
            </button>
          </div>
          
          <p className="text-white/90 text-sm leading-relaxed mb-2">
            {reel.caption.split(/(#\w+)/g).map((part, i) =>
              part.startsWith('#') ? (
                <span key={i} className="text-primary font-semibold hover:underline cursor-pointer">{part}</span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
        </div>

        {/* Music */}
        {reel.music && (
          <div className="flex items-center gap-2 mb-3 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 w-fit hover:bg-white/20 transition-all cursor-pointer group">
            <Music2 className="w-3.5 h-3.5 text-primary shrink-0 animate-pulse" />
            <div className="overflow-hidden flex-1 max-w-[200px]">
              <p className="text-white/90 text-xs whitespace-nowrap group-hover:animate-marquee">
                {reel.music}
              </p>
            </div>
          </div>
        )}

        {/* Support Button */}
        {reel.user.followers >= 1000 && (
          <div className="mb-3">
            <SupportTokenButton postId={reel.id} username={reel.user.username} />
          </div>
        )}

        {/* Action Row */}
        <div className="flex items-center gap-4">
          <button
            onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
            className="inline-flex items-center gap-2 text-white/80 text-xs bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-white/20 transition-all"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{muted ? 'Unmute' : 'Mute'}</span>
          </button>
          
          <div className="flex items-center gap-1 text-white/60 text-xs">
            <Repeat className="w-3.5 h-3.5" />
            <span>Loop</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        className="absolute bottom-0 left-0 right-0 z-[7] h-1.5 group cursor-pointer"
        onClick={handleSeek}
      >
        <div className="absolute inset-0 bg-white/30">
          <div
            className="h-full transition-all duration-100 relative"
            style={{
              width: `${progress}%`,
              background: DESIGN.colors.gradient,
            }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
          </div>
        </div>
      </div>

      {/* Comments Panel */}
      {showComments && (
        <div className="absolute inset-y-0 right-0 w-96 bg-black/95 backdrop-blur-xl z-20 border-l border-white/10 shadow-2xl flex flex-col animate-slide-in-right">
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              <h3 className="text-white font-semibold">Comments</h3>
              <span className="text-white/50 text-xs">({commentCount})</span>
            </div>
            <button onClick={() => setShowComments(false)} className="p-2 hover:bg-white/10 rounded-full transition-all">
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {commentsList.map((comment, i) => (
              <div key={i} className="flex gap-3 animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {comment.username[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm font-semibold">{comment.username}</span>
                    <span className="text-white/40 text-xs">{comment.handle}</span>
                    <span className="text-white/40 text-xs">· 2m</span>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed">{comment.text}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <button className="text-white/40 text-xs hover:text-white/70 transition-colors">Like</button>
                    <button className="text-white/40 text-xs hover:text-white/70 transition-colors">Reply</button>
                  </div>
                </div>
                <ThumbsUp className="w-4 h-4 text-white/40 hover:text-white/70 transition-colors cursor-pointer" />
              </div>
            ))}
          </div>
          
          <div className="p-5 border-t border-white/10">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                U
              </div>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full bg-white/10 rounded-full px-5 py-2.5 text-white text-sm placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-primary transition-all pr-12"
                  onKeyPress={(e) => e.key === 'Enter' && handleComment()}
                />
                <button 
                  onClick={handleComment}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-primary hover:bg-primary/10 rounded-full transition-all disabled:opacity-50"
                  disabled={!commentText.trim()}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} reel={reel} />
    </div>
  );
};

// ============================================================================
// MAIN VIDEO REELS PAGE
// ============================================================================
const VideoReels = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startId = searchParams.get('start');
  const [reels, setReels] = useState<Reel[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingReels, setLoadingReels] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void axiosInstance.get('/uhoro/feed?type=for-you&limit=20').then(({ data }) => {
      const videos = Array.isArray(data.data) ? data.data : [];
      const liveReels: Reel[] = videos.map((video: any) => ({
        id: video.id,
        user: {
          id: video.user_id,
          username: video.full_name || video.username,
          handle: `@${video.username}`,
          avatar: video.avatar_url || '',
          verified: Boolean(video.is_verified),
          followers: Number(video.followers_count || 0)
        },
        videoUrl: video.video_url,
        caption: video.description || video.title || '',
        likes: Number(video.likes_count || 0),
        comments: Number(video.comments_count || 0),
        shares: Number(video.shares_count || 0),
        views: Number(video.views_count || 0),
        liked: Boolean(video.liked || video.is_liked),
        music: video.audio_title || undefined
      }));
      setReels(liveReels);
      if (startId) {
        const index = liveReels.findIndex((reel) => reel.id === startId);
        if (index >= 0) setActiveIndex(index);
      }
    }).finally(() => setLoadingReels(false));
  }, [startId]);

  useEffect(() => {
    if (containerRef.current && activeIndex > 0) {
      containerRef.current.children[activeIndex]?.scrollIntoView({ behavior: 'instant' as any });
    }
  }, [activeIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = Array.from(container.children).indexOf(entry.target as HTMLElement);
            if (idx >= 0) setActiveIndex(idx);
          }
        });
      },
      { root: container, threshold: 0.7 }
    );

    Array.from(container.children).forEach(child => observer.observe(child));
    return () => observer.disconnect();
  }, [reels.length]);

  return (
    <div className="flex min-h-screen bg-black">
      <DesktopSidebar />
      
      <div className="flex-1 lg:ml-60 xl:mr-96 flex justify-center items-center min-h-screen bg-black">
        <div className="w-full max-w-[420px] h-[85vh] mx-auto my-auto rounded-2xl overflow-hidden shadow-2xl">
          <div
            ref={containerRef}
            className="relative w-full h-full snap-y snap-mandatory overflow-y-auto no-scrollbar rounded-2xl"
            style={{ scrollBehavior: 'smooth' }}
          >
            {loadingReels && <div className="grid h-full place-items-center text-sm text-white/60">Loading community videos…</div>}
            {!loadingReels && reels.length === 0 && <div className="grid h-full place-items-center px-8 text-center text-sm text-white/60">No community videos have been published yet.</div>}
            {reels.map((reel, index) => (
              <ReelCard
                key={reel.id}
                reel={reel}
                isActive={index === activeIndex}
                onBack={() => navigate(-1)}
              />
            ))}
          </div>
        </div>
      </div>

      <AppRightSidebar />
    </div>
  );
};

export default VideoReels;