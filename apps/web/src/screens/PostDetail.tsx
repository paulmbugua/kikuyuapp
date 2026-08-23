import { useParams, useNavigate } from '@/lib/navigation';
import { 
  ArrowLeft, Heart, MessageCircle, Share2, Bookmark, CheckCircle2, Eye, 
  Mail, Loader2, MapPin, Calendar, Link as LinkIcon, Users, MoreHorizontal,
  Repeat2, BarChart3, TrendingUp, Grid3X3, Film, Settings, Wallet,
  UserCheck, UserPlus
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { Link } from '@/lib/navigation';
import { useUserStore } from '@/stores/userStore';
import { toast } from 'sonner';
import axiosInstance from '@/utils/axiosConfig';
import CommentSection from '@/components/feed/CommentSection';
import StoryHighlights from '@/components/feed/StoryHighlights';
import PostCard from '@/components/feed/PostCard'; // Import PostCard

interface Post {
  id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  user_id: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  bookmarks_count: number;
  username: string;
  full_name: string;
  avatar_url: string;
  is_verified: boolean;
  is_liked: boolean;
  is_bookmarked: boolean;
  is_following?: boolean;
  followers_count?: number;
  following_count?: number;
}

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  cover_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  is_verified: boolean;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_following: boolean;
}

const tabs = [
  { id: 'post', label: 'Post', icon: Grid3X3 },
  { id: 'replies', label: 'Replies', icon: MessageCircle },
  { id: 'media', label: 'Media', icon: Film },
];

const PostDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useUserStore();
  const [post, setPost] = useState<Post | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [showFullBio, setShowFullBio] = useState(false);
  const [activeTab, setActiveTab] = useState('post');
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/posts/${id}`);
      const postData = response.data.data.post;
      setPost(postData);
      setLiked(postData.is_liked);
      setLikeCount(postData.likes_count);
      setBookmarked(postData.is_bookmarked);
      setFollowersCount(postData.followers_count || 0);
      setFollowingCount(postData.following_count || 0);
      
      if (postData.user_id) {
        await fetchUserProfile(postData.user_id);
        await fetchUserPosts(postData.user_id, postData.id);
        if (currentUser?.id !== postData.user_id) {
          await fetchFollowStatus(postData.user_id);
        }
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      toast.error('Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowStatus = async (userId: string) => {
    try {
      const response = await axiosInstance.get(`/follows/${userId}/status`);
      setFollowing(response.data.data.is_following);
    } catch (error) {
      console.error('Error fetching follow status:', error);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      const response = await axiosInstance.get(`/users/${userId}`);
      const profileData = response.data.data.profile;
      setUserProfile(profileData);
      setFollowersCount(profileData.followers_count || 0);
      setFollowingCount(profileData.following_count || 0);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchUserPosts = async (userId: string, currentPostId: string) => {
    try {
      const response = await axiosInstance.get(`/posts/user/${userId}?limit=20`);
      let postsData = [];
      if (response.data.data?.posts) {
        postsData = response.data.data.posts;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        postsData = response.data.data;
      } else if (response.data.posts) {
        postsData = response.data.posts;
      } else if (Array.isArray(response.data)) {
        postsData = response.data;
      }
      
      const filteredPosts = postsData.filter((p: Post) => p.id !== currentPostId);
      setUserPosts(filteredPosts);
    } catch (error) {
      console.error('Error fetching user posts:', error);
    }
  };

  const handleLike = async () => {
    try {
      if (liked) {
        await axiosInstance.delete(`/likes/post/${post?.id}`);
        setLikeCount(prev => prev - 1);
      } else {
        await axiosInstance.post(`/likes/post/${post?.id}`);
        setLikeCount(prev => prev + 1);
      }
      setLiked(!liked);
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to like post');
    }
  };

  const handleBookmark = async () => {
    try {
      if (bookmarked) {
        await axiosInstance.delete(`/bookmarks/${post?.id}`);
        toast.success('Removed from bookmarks');
      } else {
        await axiosInstance.post(`/bookmarks/${post?.id}`);
        toast.success('Saved to bookmarks');
      }
      setBookmarked(!bookmarked);
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast.error('Failed to save post');
    }
  };

  const handleShare = async () => {
    try {
      const postUrl = `${window.location.origin}/post/${post?.id}`;
      if (navigator.share) {
        await navigator.share({
          title: `${post?.full_name || post?.username} on Thutha`,
          text: post?.content?.substring(0, 100),
          url: postUrl,
        });
      } else {
        await navigator.clipboard.writeText(postUrl);
        toast.success('Link copied to clipboard!');
      }
      
      // Track share
      await axiosInstance.post(`/posts/${post?.id}/share`);
    } catch (error) {
      if ((error as any).name !== 'AbortError') {
        console.error('Error sharing:', error);
        toast.error('Failed to share post');
      }
    }
  };

  const handleFollow = async () => {
    if (!post) return;
    setIsFollowLoading(true);
    
    try {
      if (following) {
        await axiosInstance.delete(`/follows/${post.user_id}/unfollow`);
        setFollowing(false);
        setFollowersCount(prev => prev - 1);
        toast.success(`Unfollowed @${post.username}`);
        await fetchFollowStatus(post.user_id);
      } else {
        await axiosInstance.post(`/follows/${post.user_id}/follow`);
        setFollowing(true);
        setFollowersCount(prev => prev + 1);
        toast.success(`Following @${post.username}`);
        await fetchFollowStatus(post.user_id);
      }
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      toast.error(error.response?.data?.message || 'Failed to follow/unfollow user');
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleMessage = () => {
    navigate(`/messages?user=${post?.user_id}`);
  };

  const formatNumber = (num: number) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getAvatarUrl = () => {
    if (userProfile?.avatar_url) return userProfile.avatar_url;
    if (post?.avatar_url) return post.avatar_url;
    const name = userProfile?.full_name || post?.full_name || post?.username || 'User';
    return `https://ui-avatars.com/api/?background=0D9488&color=fff&name=${encodeURIComponent(name)}&length=2`;
  };

  const getCoverUrl = () => {
    return userProfile?.cover_url || null;
  };

  const getBio = () => {
    return userProfile?.bio || null;
  };

  const getLocation = () => {
    return userProfile?.location || null;
  };

  const getWebsite = () => {
    return userProfile?.website || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-red-500 mb-4">Post not found</p>
        <button
          onClick={() => navigate(-1)}
          className="thutha-gradient text-primary-foreground px-6 py-2 rounded-xl"
        >
          Go Back
        </button>
      </div>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const isOwnProfile = currentUser?.id === post.user_id;
  const displayName = userProfile?.full_name || post.full_name || post.username;
  const username = userProfile?.username || post.username;
  const isVerified = userProfile?.is_verified || post.is_verified;
  const displayPostsCount = userProfile?.posts_count || userPosts.length + 1;

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="font-heading font-bold text-lg text-foreground">Post</h1>
            <p className="text-xs text-muted-foreground">View full discussion</p>
          </div>
          {isOwnProfile && (
            <Link to="/settings" className="thutha-card p-2 rounded-xl text-muted-foreground hover:text-primary transition-colors">
              <Settings className="w-5 h-5" />
            </Link>
          )}
        </div>
      </div>

      {/* Cover Image */}
      <div className="relative">
        {getCoverUrl() ? (
          <img 
            src={getCoverUrl()} 
            alt="Cover" 
            className="h-36 w-full object-cover"
          />
        ) : (
          <div className="h-36 thutha-gradient" />
        )}
      </div>

      {/* Avatar + Info */}
      <div className="px-4 -mt-12 relative z-10">
        <div className="flex items-end justify-between mb-3">
          <div className="relative">
            <div className="w-24 h-24 rounded-full p-[3px] spotlight-ring overflow-hidden">
              <img
                src={getAvatarUrl()}
                alt={username}
                className="w-full h-full rounded-full object-cover border-3 border-card shadow-lg"
                onError={(e) => {
                  const name = displayName || username || 'User';
                  e.currentTarget.src = `https://ui-avatars.com/api/?background=0D9488&color=fff&name=${encodeURIComponent(name)}&length=2`;
                }}
              />
            </div>
          </div>
          <div className="flex gap-2 mb-1">
            {!isOwnProfile && (
              <>
                <button
                  onClick={handleMessage}
                  className="thutha-card p-2.5 rounded-xl text-muted-foreground hover:text-primary transition-colors"
                  title="Send message"
                >
                  <Mail className="w-5 h-5" />
                </button>
                <button
                  onClick={handleFollow}
                  disabled={isFollowLoading}
                  className={`font-medium text-sm px-6 py-2 rounded-xl shadow-md flex items-center gap-2 ${
                    following 
                      ? 'bg-muted text-foreground border border-border hover:bg-muted/80'
                      : 'thutha-gradient text-primary-foreground hover:opacity-90'
                  } ${isFollowLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isFollowLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : following ? (
                    <>
                      <UserCheck className="w-4 h-4" />
                      Following
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Follow
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <h2 className="font-heading font-bold text-xl text-foreground">
              {displayName}
            </h2>
            {isVerified && <CheckCircle2 className="w-5 h-5 text-primary" />}
          </div>
          <p className="text-sm text-muted-foreground">@{username}</p>
          
          {getBio() && (
            <p className="text-sm text-foreground">
              {showFullBio || getBio()!.length <= 150 ? getBio() : `${getBio()!.slice(0, 150)}...`}
              {getBio()!.length > 150 && (
                <button 
                  onClick={() => setShowFullBio(!showFullBio)} 
                  className="text-primary text-xs ml-1 hover:underline"
                >
                  {showFullBio ? 'Show less' : 'Read more'}
                </button>
              )}
            </p>
          )}
          
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {getLocation() && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>{getLocation()}</span>
              </div>
            )}
            {getWebsite() && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <LinkIcon className="w-3 h-3" />
                <a href={getWebsite()} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {getWebsite()!.replace(/^https?:\/\//, '').replace(/^www\./, '')}
                </a>
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>Joined {post.created_at ? format(new Date(post.created_at), 'MMMM yyyy') : 'recently'}</span>
            </div>
          </div>
          
          <div className="flex gap-4 pt-1">
            <span className="text-sm">
              <strong className="text-foreground">{displayPostsCount}</strong> <span className="text-muted-foreground">Posts</span>
            </span>
            <span className="text-sm">
              <strong className="text-foreground">{formatNumber(followersCount)}</strong> <span className="text-muted-foreground">Followers</span>
            </span>
            <span className="text-sm">
              <strong className="text-foreground">{formatNumber(followingCount)}</strong> <span className="text-muted-foreground">Following</span>
            </span>
          </div>
        </div>
      </div>

      {/* Story Highlights */}
      <div className="border-b border-border mt-4">
        <StoryHighlights />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-primary border-primary'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="px-4 pt-4 space-y-4">
        {activeTab === 'post' && (
          <>
            {/* Current Post - Using PostCard for consistent UI */}
            <PostCard 
              post={{
                ...post,
                bookmarks_count: post.bookmarks_count || 0,
                shares_count: post.shares_count || 0,
                views_count: post.views_count || 0
              }}
              onLike={handleLike}
              onComment={() => {}}
              onShare={handleShare}
              onBookmark={handleBookmark}
            />

            {/* Comments Section */}
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-6 bg-gradient-to-b from-primary to-accent rounded-full" />
                <h3 className="text-base font-heading font-bold text-foreground">
                  Comments ({post.comments_count || 0})
                </h3>
              </div>
              <CommentSection postId={post.id} />
            </div>

            {/* More from this user */}
            {userPosts.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <h3 className="text-base font-heading font-bold text-foreground">
                    More from @{username} ({userPosts.length} more posts)
                  </h3>
                </div>
                
                <div className="space-y-3">
                  {userPosts.map(userPost => (
                    <PostCard 
                      key={userPost.id}
                      post={{
                        ...userPost,
                        bookmarks_count: userPost.bookmarks_count || 0,
                        shares_count: userPost.shares_count || 0,
                        views_count: userPost.views_count || 0
                      }}
                      onLike={() => {}}
                      onComment={() => navigate(`/post/${userPost.id}`)}
                      onShare={() => {}}
                      onBookmark={() => {}}
                    />
                  ))}
                </div>
                
                <button 
                  onClick={() => navigate(`/profile/${username}`)}
                  className="w-full mt-4 py-2 text-center text-primary text-sm font-medium hover:bg-primary/10 rounded-xl transition-all duration-300"
                >
                  View all {displayPostsCount} posts from @{username} →
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'replies' && (
          <div className="text-center text-muted-foreground py-8">
            Replies feature coming soon
          </div>
        )}

        {activeTab === 'media' && (
          <div className="text-center text-muted-foreground py-8">
            Media feature coming soon
          </div>
        )}
      </div>
    </div>
  );
};

export default PostDetail;