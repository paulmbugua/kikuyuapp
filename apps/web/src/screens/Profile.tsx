import { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@/lib/navigation';
import { Settings, Wallet, CheckCircle2, Grid3X3, Heart, Film, TrendingUp, Edit, Loader2, UserPlus, UserCheck, MapPin, Link as LinkIcon, X, Users } from 'lucide-react';
import { Link } from '@/lib/navigation';
import { useUserStore } from '@/stores/userStore';
import userService, { UserProfile } from '@/services/userService';
import StoryHighlights from '@/components/feed/StoryHighlights';
import PostCard from '@/components/feed/PostCard';
import axiosInstance from '@/utils/axiosConfig';
import { toast } from 'sonner';

interface Post {
  id: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  is_verified: boolean;
  is_liked: boolean;
  is_bookmarked: boolean;
  bookmarks_count?: number;
}

interface FollowUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  is_verified: boolean;
  is_following: boolean;
  followed_at: string;
}

const tabs = [
  { id: 'posts', label: 'Posts', icon: Grid3X3 },
  { id: 'media', label: 'Media', icon: Film },
  { id: 'likes', label: 'Likes', icon: Heart },
  { id: 'earnings', label: 'Earnings', icon: TrendingUp },
];

const Profile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: currentUser, fetchUser } = useUserStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  
  // Followers/Following Modal
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [followingUsers, setFollowingUsers] = useState<FollowUser[]>([]);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      let profileData;
      
      if (username) {
        profileData = await userService.getProfile(username);
        console.log('Profile data from API:', profileData);
      } else {
        profileData = currentUser;
        if (!profileData) {
          await fetchUser();
          profileData = useUserStore.getState().user;
        }
      }
      
      if (profileData) {
        setProfile(profileData);
        setFollowing(profileData.is_following || false);
        await fetchUserPosts(profileData.id);
      } else {
        setError('User not found');
      }
    } catch (err: any) {
      console.error('Error loading profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserPosts = async (userId: string) => {
    setLoadingPosts(true);
    try {
      const response = await axiosInstance.get(`/posts/user/${userId}?limit=50`);
      let posts = [];
      if (response.data.data?.posts) {
        posts = response.data.data.posts;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        posts = response.data.data;
      } else if (response.data.posts) {
        posts = response.data.posts;
      } else if (Array.isArray(response.data)) {
        posts = response.data;
      }
      
      // Format posts for PostCard component
      const formattedPosts = posts.map((post: any) => ({
        ...post,
        user_id: post.user_id || userId,
        username: post.username || profile?.username,
        full_name: post.full_name || profile?.full_name,
        avatar_url: post.avatar_url || profile?.avatar_url,
        is_verified: post.is_verified || profile?.is_verified || false,
        is_liked: post.is_liked || false,
        is_bookmarked: post.is_bookmarked || false,
        bookmarks_count: post.bookmarks_count || 0,
      }));
      
      setUserPosts(formattedPosts);
      if (profile && profile.posts_count !== posts.length) {
        setProfile({ ...profile, posts_count: posts.length });
      }
    } catch (error) {
      console.error('Error fetching user posts:', error);
    } finally {
      setLoadingPosts(false);
    }
  };

  const refreshProfileData = async () => {
    if (!profile?.username) return;
    try {
      const freshProfile = await userService.getProfile(profile.username);
      setProfile(freshProfile);
      setFollowing(freshProfile.is_following || false);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  const fetchFollowers = async () => {
    if (!profile?.username) return;
    setLoadingFollowers(true);
    try {
      const response = await axiosInstance.get(`/follows/${profile.username}/followers`);
      const followersData = response.data.data || [];
      setFollowers(followersData);
    } catch (error: any) {
      console.error('Error fetching followers:', error);
      toast.error(error.response?.data?.message || 'Failed to load followers');
    } finally {
      setLoadingFollowers(false);
    }
  };

  const fetchFollowing = async () => {
    if (!profile?.username) return;
    setLoadingFollowing(true);
    try {
      const response = await axiosInstance.get(`/follows/${profile.username}/following`);
      const followingData = response.data.data || [];
      setFollowingUsers(followingData);
    } catch (error: any) {
      console.error('Error fetching following:', error);
      toast.error(error.response?.data?.message || 'Failed to load following');
    } finally {
      setLoadingFollowing(false);
    }
  };

  const handleFollowUser = async (userId: string, isCurrentlyFollowing: boolean) => {
    try {
      if (isCurrentlyFollowing) {
        await axiosInstance.delete(`/follows/${userId}/unfollow`);
        setFollowers(prev => prev.map(f => 
          f.id === userId ? { ...f, is_following: false } : f
        ));
        setFollowingUsers(prev => prev.map(f => 
          f.id === userId ? { ...f, is_following: false } : f
        ));
        toast.success('Unfollowed user');
        
        if (profile && userId === profile.id) {
          setProfile(prev => prev ? { ...prev, followers_count: (prev.followers_count || 0) - 1 } : null);
        }
      } else {
        await axiosInstance.post(`/follows/${userId}/follow`);
        setFollowers(prev => prev.map(f => 
          f.id === userId ? { ...f, is_following: true } : f
        ));
        setFollowingUsers(prev => prev.map(f => 
          f.id === userId ? { ...f, is_following: true } : f
        ));
        toast.success('Following user');
        
        if (profile && userId === profile.id) {
          setProfile(prev => prev ? { ...prev, followers_count: (prev.followers_count || 0) + 1 } : null);
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
    }
  };

  const handleFollow = async () => {
    if (!profile) return;
    setIsFollowLoading(true);
    
    try {
      if (following) {
        await axiosInstance.delete(`/follows/${profile.id}/unfollow`);
        setFollowing(false);
        setProfile(prev => prev ? { 
          ...prev, 
          followers_count: (prev.followers_count || 0) - 1 
        } : null);
        toast.success(`Unfollowed @${profile.username}`);
      } else {
        await axiosInstance.post(`/follows/${profile.id}/follow`);
        setFollowing(true);
        setProfile(prev => prev ? { 
          ...prev, 
          followers_count: (prev.followers_count || 0) + 1 
        } : null);
        toast.success(`Following @${profile.username}`);
      }
      
      await refreshProfileData();
      
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      toast.error(error.response?.data?.message || 'Failed to follow/unfollow user');
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handlePostView = async (postId: string) => {
    try {
      await axiosInstance.post(`/posts/${postId}/view`);
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  const handlePostLike = () => {
    fetchUserPosts(profile?.id || '');
  };

  const handlePostComment = () => {
    fetchUserPosts(profile?.id || '');
  };

  const handlePostShare = () => {
    fetchUserPosts(profile?.id || '');
  };

  const handlePostBookmark = () => {
    fetchUserPosts(profile?.id || '');
  };

  const openFollowersModal = async () => {
    setShowFollowersModal(true);
    await fetchFollowers();
    await refreshProfileData();
  };

  const openFollowingModal = async () => {
    setShowFollowingModal(true);
    await fetchFollowing();
    await refreshProfileData();
  };

  const formatNumber = (num: number) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getDisplayName = () => {
    if (profile?.full_name && profile.full_name.trim()) {
      return profile.full_name;
    }
    if (profile?.username) {
      return profile.username;
    }
    return 'User';
  };

  const getAvatarUrl = () => {
    if (profile?.avatar_url) {
      return profile.avatar_url;
    }
    const name = profile?.full_name || profile?.username || 'User';
    return `https://ui-avatars.com/api/?background=0D9488&color=fff&name=${encodeURIComponent(name)}&length=2`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-red-500 mb-4">{error || 'User not found'}</p>
        <button
          onClick={() => navigate(-1)}
          className="thutha-gradient text-primary-foreground px-6 py-2 rounded-xl"
        >
          Go Back
        </button>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.id;
  const displayPostsCount = profile.posts_count || userPosts.length;

  return (
    <div className="pb-4 max-w-2xl mx-auto">
      {/* Cover */}
      <div className="relative">
        {profile.cover_url ? (
          <img 
            src={profile.cover_url} 
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
                alt={profile.username}
                className="w-full h-full rounded-full object-cover border-3 border-card shadow-lg"
                onError={(e) => {
                  const name = profile?.full_name || profile?.username || 'User';
                  e.currentTarget.src = `https://ui-avatars.com/api/?background=0D9488&color=fff&name=${encodeURIComponent(name)}&length=2`;
                }}
              />
            </div>
          </div>
          <div className="flex gap-2 mb-1">
            {isOwnProfile && (
              <>
                <Link to="/wallet" className="thutha-card p-2.5 rounded-xl text-muted-foreground hover:text-primary transition-colors">
                  <Wallet className="w-5 h-5" />
                </Link>
                <Link to="/settings" className="thutha-card p-2.5 rounded-xl text-muted-foreground hover:text-primary transition-colors">
                  <Settings className="w-5 h-5" />
                </Link>
                <button 
                  onClick={() => navigate('/profile/edit')}
                  className="thutha-gradient text-primary-foreground font-medium text-sm px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              </>
            )}
            {!isOwnProfile && (
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
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <h2 className="font-heading font-bold text-xl text-foreground">{getDisplayName()}</h2>
            {profile.is_verified && <CheckCircle2 className="w-5 h-5 text-primary" />}
          </div>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio && <p className="text-sm text-foreground">{profile.bio}</p>}
          
          {/* Location, Website */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {profile.location && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>{profile.location}</span>
              </div>
            )}
            {profile.website && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <LinkIcon className="w-3 h-3" />
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {profile.website.replace(/^https?:\/\//, '').replace(/^www\./, '')}
                </a>
              </div>
            )}
          </div>
          
          {/* Clickable Stats */}
          <div className="flex gap-4 pt-1">
            <span className="text-sm">
              <strong className="text-foreground">{displayPostsCount}</strong> <span className="text-muted-foreground">Posts</span>
            </span>
            <button 
              onClick={openFollowersModal}
              className="text-sm hover:underline flex items-center gap-1"
            >
              <Users className="w-3 h-3" />
              <strong className="text-foreground">{formatNumber(profile.followers_count || 0)}</strong> <span className="text-muted-foreground">Followers</span>
            </button>
            <button 
              onClick={openFollowingModal}
              className="text-sm hover:underline"
            >
              <strong className="text-foreground">{formatNumber(profile.following_count || 0)}</strong> <span className="text-muted-foreground">Following</span>
            </button>
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
        {activeTab === 'posts' && (
          <>
            {loadingPosts ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : userPosts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No posts yet</p>
                {isOwnProfile && (
                  <button 
                    onClick={() => navigate('/create')}
                    className="mt-4 text-primary text-sm font-medium hover:underline"
                  >
                    Create your first post →
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {userPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={handlePostLike}
                    onComment={handlePostComment}
                    onShare={handlePostShare}
                    onBookmark={handlePostBookmark}
                    onView={() => handlePostView(post.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'media' && (
          <div className="grid grid-cols-3 gap-2">
            {userPosts
              .filter(post => post.media_url && post.media_type === 'image')
              .map(post => (
                <div 
                  key={post.id}
                  onClick={() => navigate(`/post/${post.id}`)}
                  className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <img 
                    src={post.media_url!} 
                    alt="Post" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            {userPosts.filter(post => post.media_url && post.media_type === 'image').length === 0 && (
              <div className="col-span-3 text-center text-muted-foreground py-8">
                No media posts yet
              </div>
            )}
          </div>
        )}

        {activeTab === 'likes' && (
          <div className="text-center text-muted-foreground py-8">
            Likes feature coming soon
          </div>
        )}

        {activeTab === 'earnings' && profile.is_creator && (
          <div className="space-y-4">
            <div className="thutha-card p-5 text-center">
              <p className="text-sm text-muted-foreground mb-1">Monthly Earnings</p>
              <p className="text-3xl font-heading font-bold thutha-gradient-text">
                KES {profile.monthly_earnings?.toLocaleString() || '0'}
              </p>
            </div>
            <Link to="/wallet" className="block w-full thutha-gradient text-primary-foreground font-medium text-center py-3 rounded-xl shadow-md hover:opacity-90 transition-opacity">
              View Wallet →
            </Link>
          </div>
        )}
      </div>

      {/* Followers Modal */}
      {showFollowersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowFollowersModal(false)}>
          <div className="bg-card rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-heading font-bold text-lg text-foreground">Followers</h3>
              <button onClick={() => setShowFollowersModal(false)} className="p-1 rounded-full hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3 max-h-[calc(80vh-70px)]">
              {loadingFollowers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : followers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No followers yet</p>
              ) : (
                followers.map(follower => (
                  <div key={follower.id} className="flex items-center gap-3">
                    <img 
                      src={follower.avatar_url} 
                      alt={follower.username} 
                      className="w-10 h-10 rounded-full object-cover cursor-pointer"
                      onClick={() => {
                        setShowFollowersModal(false);
                        navigate(`/profile/${follower.username}`);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p 
                        className="text-sm font-semibold text-foreground cursor-pointer hover:underline"
                        onClick={() => {
                          setShowFollowersModal(false);
                          navigate(`/profile/${follower.username}`);
                        }}
                      >
                        {follower.full_name || follower.username}
                      </p>
                      <p className="text-xs text-muted-foreground">@{follower.username}</p>
                    </div>
                    {!isOwnProfile && currentUser?.id !== follower.id && (
                      <button
                        onClick={() => handleFollowUser(follower.id, follower.is_following)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                          follower.is_following 
                            ? 'bg-muted text-foreground border border-border'
                            : 'thutha-gradient text-primary-foreground'
                        }`}
                      >
                        {follower.is_following ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Following Modal */}
      {showFollowingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowFollowingModal(false)}>
          <div className="bg-card rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-heading font-bold text-lg text-foreground">Following</h3>
              <button onClick={() => setShowFollowingModal(false)} className="p-1 rounded-full hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-3 max-h-[calc(80vh-70px)]">
              {loadingFollowing ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : followingUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Not following anyone yet</p>
              ) : (
                followingUsers.map(user => (
                  <div key={user.id} className="flex items-center gap-3">
                    <img 
                      src={user.avatar_url} 
                      alt={user.username} 
                      className="w-10 h-10 rounded-full object-cover cursor-pointer"
                      onClick={() => {
                        setShowFollowingModal(false);
                        navigate(`/profile/${user.username}`);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p 
                        className="text-sm font-semibold text-foreground cursor-pointer hover:underline"
                        onClick={() => {
                          setShowFollowingModal(false);
                          navigate(`/profile/${user.username}`);
                        }}
                      >
                        {user.full_name || user.username}
                      </p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                    {!isOwnProfile && currentUser?.id !== user.id && (
                      <button
                        onClick={() => handleFollowUser(user.id, user.is_following)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                          user.is_following 
                            ? 'bg-muted text-foreground border border-border'
                            : 'thutha-gradient text-primary-foreground'
                        }`}
                      >
                        {user.is_following ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;