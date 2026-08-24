import { useState, useEffect } from 'react';
import { useNavigate } from '@/lib/navigation';
import { ArrowLeft, Camera, X, Loader2, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import { toast } from 'sonner'; // Make sure you have sonner installed: npm install sonner

const EditProfile = () => {
  const navigate = useNavigate();
  const { user, updateProfile, uploadAvatar, uploadCover, fetchUser } = useUserStore();
  
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [location, setLocation] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Image upload states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [coverLoadFailed, setCoverLoadFailed] = useState(false);
  
  // Load user data
  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [avatarPreview, coverPreview]);

  const loadUserData = async () => {
    setLoading(true);
    const toastId = toast.loading('Loading profile data...');
    
    try {
      // If user not in store, fetch it
      let currentUser = user;
      if (!currentUser) {
        await fetchUser();
        currentUser = useUserStore.getState().user;
      }
      
      if (currentUser) {
        setUsername(currentUser.username || '');
        setFullName(currentUser.full_name || '');
        setBio(currentUser.bio || '');
        setIsPrivate(currentUser.is_private || false);
       
        
        toast.success('Profile loaded successfully', { id: toastId });
      } else {
        toast.error('Failed to load profile data', { id: toastId });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Failed to load profile data', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    const toastId = toast.loading('Uploading avatar...');
    setUploadingAvatar(true);
    
    try {
      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
      setAvatarLoadFailed(false);
      
      // Upload to server
      const result = await uploadAvatar(file);
      console.log('Avatar uploaded:', result);
      
      toast.success('Avatar uploaded successfully!', { id: toastId });
      // Keep the local preview visible until navigation.
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error.response?.data?.message || 'Failed to upload avatar. Please try again.', { id: toastId });
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 10MB for cover)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Cover image must be less than 10MB');
      return;
    }

    const toastId = toast.loading('Uploading cover photo...');
    setUploadingCover(true);
    
    try {
      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setCoverPreview(previewUrl);
      setCoverLoadFailed(false);
      
      // Upload to server
      const result = await uploadCover(file);
      console.log('Cover uploaded:', result);
      
      toast.success('Cover photo uploaded successfully!', { id: toastId });
      // Keep the local preview visible until navigation.
    } catch (error: any) {
      console.error('Error uploading cover:', error);
      toast.error(error.response?.data?.message || 'Failed to upload cover. Please try again.', { id: toastId });
      setCoverPreview(null);
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!username.trim()) {
      toast.error('Username is required');
      return;
    }

    if (!fullName.trim()) {
      toast.error('Full name is required');
      return;
    }

    const toastId = toast.loading('Saving profile changes...');
    setSaving(true);
    
    try {
      await updateProfile({
        full_name: fullName,
        bio: bio,
        username: username,
        is_private: isPrivate,
      });
      
      toast.success('Profile updated successfully!', { id: toastId });
      
      // Navigate back to profile after short delay
      setTimeout(() => {
        navigate(`/profile/${username}`);
      }, 1500);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast.error(error.response?.data?.message || 'Failed to save profile. Please try again.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const getCurrentAvatarUrl = () => {
    // Show preview first if uploading
    if (avatarPreview) return avatarPreview;
    // Show existing avatar from user data
    if (user?.avatar_url && !avatarLoadFailed) return user.avatar_url;
    // Fallback to avatar with initials
    const name = fullName || username || 'User';
    return `https://ui-avatars.com/api/?background=0D9488&color=fff&name=${encodeURIComponent(name)}&length=2`;
  };

  const getCurrentCoverUrl = () => {
    // Show preview first if uploading
    if (coverPreview) return coverPreview;
    // Show existing cover from user data
    if (user?.cover_url && !coverLoadFailed) return user.cover_url;
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-4 px-4 md:px-0 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate(-1)} 
          className="p-1.5 rounded-full hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="font-heading font-bold text-xl text-foreground flex-1">Edit Profile</h2>
        <button
          onClick={handleSave}
          disabled={saving || uploadingAvatar || uploadingCover}
          className="thutha-gradient text-primary-foreground px-5 py-2 rounded-xl text-sm font-semibold shadow-md hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Cover photo */}
      <div className="relative rounded-2xl overflow-hidden group">
        <div className="h-32 sm:h-40 bg-gradient-to-r from-primary/30 to-accent/30">
          {getCurrentCoverUrl() ? (
            <img
              src={getCurrentCoverUrl()!}
              alt="Cover"
              className="w-full h-full object-cover"
              onError={() => setCoverLoadFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Camera className="w-8 h-8 opacity-50" />
            </div>
          )}
        </div>
        
        {/* Upload overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <label className="cursor-pointer bg-white/20 backdrop-blur rounded-full p-3 hover:bg-white/30 transition-colors">
            {uploadingCover ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Camera className="w-6 h-6 text-white" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              className="hidden"
              disabled={uploadingCover}
            />
          </label>
        </div>
        
        {uploadingCover && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            Uploading...
          </div>
        )}
      </div>

      {/* Profile photo */}
      <div className="flex justify-center -mt-12 relative z-10">
        <div className="relative group">
          <img
            src={getCurrentAvatarUrl()}
            alt="Profile"
            className="w-24 h-24 rounded-full object-cover border-4 border-card shadow-lg"
            onError={() => setAvatarLoadFailed(true)}
          />
          
          {/* Upload overlay on hover */}
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <label className="cursor-pointer">
              {uploadingAvatar ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploadingAvatar}
              />
            </label>
          </div>
          
          {uploadingAvatar && (
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              Uploading...
            </div>
          )}
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        <div className="thutha-card p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Full Name</label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full bg-muted rounded-xl px-4 py-3 mt-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username"
              className="w-full bg-muted rounded-xl px-4 py-3 mt-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground mt-1">Your unique username</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              placeholder="Tell us about yourself..."
              className="w-full bg-muted rounded-xl px-4 py-3 mt-1.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-muted-foreground mt-1">{bio.length}/160</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Website</label>
            <input
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://yourwebsite.com"
              className="w-full bg-muted rounded-xl px-4 py-3 mt-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Nairobi, Kenya"
              className="w-full bg-muted rounded-xl px-4 py-3 mt-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Private Account</label>
              <p className="text-xs text-muted-foreground mt-0.5">Only approved followers can see your posts</p>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                isPrivate ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isPrivate ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;