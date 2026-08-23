import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from '@/lib/navigation';
import {
  ArrowLeft, Heart, MessageCircle, Share2, Bookmark, Download,
  CheckCircle2, Music2, Play, Pause, Volume2, VolumeX,
  Maximize2, Minimize2, X, MoreHorizontal, UserPlus, TrendingUp,
  Sparkles, Clock, Send, ThumbsUp, ChevronUp, ChevronDown,
  Repeat, Info, Share as ShareIcon, Flag, Copy, Twitter, Instagram,
  Link as LinkIcon, MessageSquare,
} from 'lucide-react';
import { reels, type Reel } from '@/data/reels';
import { formatNumber } from '@/data/dummy';
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
  const [bookmarked, setBookmarked] = useState(reel.bookmarked);
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

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) {
        setLiked(true);
        setLikeCount(c => c + 1);
      }
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
  }, [liked]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
  };

  const handleComment = () => {
    if (!commentText.trim()) return;
    const newComment = {
      id: Date.now().toString(),
      username: 'Current User',
      handle: '@current_user',
      text: commentText,
      likes: 0,
      timestamp: new Date(),
    };
    setCommentsList(prev => [newComment, ...prev]);
    setCommentText('');
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
          <img 
            src={reel.user.avatar} 
            alt="" 
            className="relative w-12 h-12 rounded-full object-cover ring-2 ring-white/30 group-hover:scale-105 transition-transform duration-200" 
          />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center shadow-lg">
            <UserPlus className="w-3 h-3 text-white" />
          </div>
        </div>

        <ActionButton icon={Heart} count={likeCount} active={liked} onClick={() => setLiked(!liked)} activeColor="text-rose-500" />
        <ActionButton icon={MessageCircle} count={reel.comments + commentsList.length} onClick={() => setShowComments(!showComments)} />
        <ActionButton icon={Share2} count={reel.shares} onClick={() => setShowShareModal(true)} />
        <ActionButton icon={Bookmark} active={bookmarked} onClick={() => setBookmarked(!bookmarked)} activeColor="text-gold" />

        {/* Music Disc */}
        <div className="relative group cursor-pointer">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-accent blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative w-11 h-11 rounded-full border-2 border-white/40 overflow-hidden animate-spin-slow shadow-lg">
            <img src={reel.user.avatar} alt="" className="w-full h-full object-cover" />
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
            <button className="ml-2 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-all backdrop-blur-sm">
              Follow
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
              <span className="text-white/50 text-xs">({reel.comments + commentsList.length})</span>
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
// RIGHT SIDEBAR (Trending & Creators)
// ============================================================================
const RightSidebar = () => {
  const [activeTab, setActiveTab] = useState<'trending' | 'creators'>('trending');

  const trendingTopics = useMemo(() => [
    { tag: '#ThuthaVibes', posts: '12.4K', category: 'Music', trend: '+47%', icon: TrendingUp },
    { tag: '#KikuyuCulture', posts: '8.2K', category: 'Culture', trend: '+32%', icon: Sparkles },
    { tag: '#AgikuyuPride', posts: '6.1K', category: 'Community', trend: '+28%', icon: Heart },
    { tag: '#KenyanMusic', posts: '5.4K', category: 'Music', trend: '+21%', icon: Music2 },
    { tag: '#ThuthaStories', posts: '4.8K', category: 'Story', trend: '+18%', icon: Clock },
  ], []);

  const creators = useMemo(() => [
    { name: 'Wanjiku Karanja', handle: '@wanjiku_k', followers: '45.2K', avatar: '', isVerified: true, category: 'Storyteller' },
    { name: 'Mbugua Mwangi', handle: '@mbugua_m', followers: '32.1K', avatar: '', isVerified: false, category: 'Comedy' },
    { name: 'Nyokabi Gachoka', handle: '@nyokabi_g', followers: '28.7K', avatar: '', isVerified: true, category: 'Music' },
    { name: 'Kamau Njoroge', handle: '@kamau_n', followers: '21.3K', avatar: '', isVerified: false, category: 'Education' },
    { name: 'Wambui Kimani', handle: '@wambui_k', followers: '18.9K', avatar: '', isVerified: false, category: 'Food' },
  ], []);

  return (
    <aside className="hidden xl:block w-96 fixed right-0 top-0 bottom-0 bg-gradient-to-b from-gray-900 to-black overflow-y-auto no-scrollbar border-l border-white/10">
      <div className="sticky top-0 bg-black/80 backdrop-blur-xl z-10 px-6 pt-8 pb-4 border-b border-white/10">
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl mb-4">
          {[
            { id: 'trending', label: 'Trending', icon: TrendingUp },
            { id: 'creators', label: 'Creators', icon: UserPlus },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-primary/20 to-primary/10 text-primary font-semibold'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Proverb Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-5 border border-primary/20">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-primary font-semibold uppercase tracking-wider text-xs">
                Proverb of the Day
              </span>
            </div>
            <h3 className="text-white text-xl font-bold italic mb-2 leading-relaxed">
              "Mũndũ ũtathiĩ nĩ aũragwo nĩ ngʼombe."
            </h3>
            <p className="text-white/60 text-sm">
              "One who does not travel is killed by cows." — Embrace exploration and new experiences.
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {activeTab === 'trending' ? (
          <div className="space-y-4">
            {trendingTopics.map((topic, i) => {
              const Icon = topic.icon;
              return (
                <div
                  key={i}
                  className="group relative p-3 rounded-xl hover:bg-white/5 transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white font-semibold text-base">
                          {topic.tag}
                        </h4>
                        <span className="text-[10px] font-semibold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                          {topic.trend}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/50 text-xs">{topic.posts} posts</span>
                        <span className="w-1 h-1 rounded-full bg-white/30" />
                        <span className="text-white/50 text-xs">{topic.category}</span>
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white/10 group-hover:text-white/20 transition-colors">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {creators.map((creator, i) => (
              <div
                key={i}
                className="group p-3 rounded-xl hover:bg-white/5 transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent p-[2px]">
                      <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {creator.name[0]}
                        </span>
                      </div>
                    </div>
                    {creator.isVerified && (
                      <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 w-4 h-4 text-primary fill-black" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="text-white font-semibold text-sm">
                        {creator.name}
                      </h4>
                      {creator.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <span className="text-white/50 text-xs">{creator.handle}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-primary text-xs font-medium">{creator.followers}</span>
                      <span className="w-1 h-1 rounded-full bg-white/30" />
                      <span className="text-white/50 text-xs">{creator.category}</span>
                    </div>
                  </div>
                  <button className="px-4 py-1.5 rounded-full bg-primary/20 hover:bg-primary/30 text-primary text-xs font-semibold transition-all duration-200">
                    Follow
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sponsored Card */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="rounded-2xl bg-gradient-to-br from-white/5 to-white/0 p-5 border border-white/10">
            <span className="text-white/40 uppercase tracking-wider text-[10px] mb-3 block">
              Sponsored
            </span>
            <h4 className="text-white font-semibold mb-2">
              Reach 1M+ Agĩkũyũ users
            </h4>
            <p className="text-white/60 text-sm mb-4">
              Promote your brand with Thutha Ads and connect with Kenya's most vibrant community.
            </p>
            <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/20 transition-all duration-200">
              Start Promoting →
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

// ============================================================================
// MAIN VIDEO REELS PAGE
// ============================================================================
const VideoReels = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startId = searchParams.get('start');
  const [activeIndex, setActiveIndex] = useState(() => {
    if (startId) {
      const idx = reels.findIndex(r => r.id === startId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && activeIndex > 0) {
      containerRef.current.children[activeIndex]?.scrollIntoView({ behavior: 'instant' as any });
    }
  }, []);

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
  }, []);

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

      <RightSidebar />
    </div>
  );
};

export default VideoReels;