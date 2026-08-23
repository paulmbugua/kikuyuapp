import { useState, useRef } from 'react';
import { useNavigate } from '@/lib/navigation';
import { Image, Video, Send, Hash, AtSign, X, Loader2, AlertCircle } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import { toast } from 'sonner';
import axiosInstance from '@/utils/axiosConfig';

const Create = () => {
  const navigate = useNavigate();
  const { user, fetchUser } = useUserStore();
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState<'text' | 'image' | 'video'>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [showHashtagInput, setShowHashtagInput] = useState(false);
  const [hashtagInput, setHashtagInput] = useState('');
  const [mentionInput, setMentionInput] = useState('');
  const [showMentionInput, setShowMentionInput] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract hashtags from content
  const extractHashtags = (text: string) => {
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex);
    if (matches) {
      return matches.map(tag => tag.substring(1));
    }
    return [];
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (postType === 'image' && !file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (postType === 'video' && !file.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }

    // Validate file size
    const maxSize = postType === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024; // 10MB for images, 100MB for videos
    if (file.size > maxSize) {
      toast.error(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const removeFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadMedia = async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('media', file);
    
    const response = await axiosInstance.post('/posts', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    return response.data.data.post;
  };

 // Replace the uploadMedia and handleSubmit functions in your Create component

const handleSubmit = async () => {
  // Validate content
  if (!content.trim() && !selectedFile) {
    toast.error('Please add some content or media to your post');
    return;
  }

  if (content.length > 5000) {
    toast.error('Post content cannot exceed 5000 characters');
    return;
  }

  setUploading(true);
  const toastId = toast.loading('Creating post...');

  try {
    const formData = new FormData();
    
    // Add content if present
    if (content.trim()) {
      formData.append('content', content);
    }
    
    // Add media if selected
    if (selectedFile) {
      formData.append('media', selectedFile);
      console.log('Appending file:', {
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size
      });
    }
    
    // Log formData contents (for debugging)
    for (let pair of formData.entries()) {
      console.log(pair[0], pair[1]);
    }
    
    // Make single API call with FormData
    const response = await axiosInstance.post('/posts', formData, {
      headers: { 
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (percentCompleted % 20 === 0) {
            toast.loading(`Uploading... ${percentCompleted}%`, { id: toastId });
          }
        }
      },
      timeout: 120000 // 2 minute timeout for videos
    });
    
    console.log('Response:', response.data);
    
    const post = response.data.data.post;

    toast.success('Post created successfully!', { id: toastId });
    
    // Reset form
    setContent('');
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setHashtags([]);
    setPostType('text');
    
    // Navigate to feed or profile
    setTimeout(() => {
      navigate('/feed');
    }, 1500);
    
  } catch (error: any) {
    console.error('Error creating post:', error);
    console.error('Error response:', error.response);
    console.error('Error request:', error.request);
    
    // Handle specific error messages
    if (error.response?.data?.message) {
      toast.error(error.response.data.message, { id: toastId });
    } else if (error.response?.data?.errors) {
      const errorMsg = error.response.data.errors[0]?.message || 'Failed to create post';
      toast.error(errorMsg, { id: toastId });
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Upload timeout. Please try with a smaller video.', { id: toastId });
    } else if (error.message === 'Network Error') {
      toast.error('Network error. Please check your connection.', { id: toastId });
    } else {
      toast.error(`Failed to create post: ${error.message}`, { id: toastId });
    }
  } finally {
    setUploading(false);
  }
};



  const addHashtag = () => {
    if (hashtagInput && !hashtags.includes(hashtagInput)) {
      setHashtags([...hashtags, hashtagInput]);
      setContent(content + ` #${hashtagInput}`);
      setHashtagInput('');
      setShowHashtagInput(false);
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(hashtags.filter(t => t !== tag));
    // Remove hashtag from content
    const regex = new RegExp(` #${tag}\\b`, 'g');
    setContent(content.replace(regex, ''));
  };

  return (
    <div className="py-4 px-3 sm:px-4 md:px-0 space-y-4 max-w-2xl mx-auto">
      <h2 className="font-heading font-bold text-xl text-foreground">Create Post</h2>

      {/* Content Input */}
      <div className="thutha-card p-4">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            // Auto-detect hashtags
            const newHashtags = extractHashtags(e.target.value);
            setHashtags([...new Set(newHashtags)]);
          }}
          placeholder="Ũhoro wakĩ, mũndũ wakwa? (What's on your mind?)..."
          className="w-full min-h-[120px] bg-transparent text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none"
          maxLength={5000}
          disabled={uploading}
        />
        <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
          <span>{content.length}/5000</span>
          {content.length > 4500 && (
            <span className="text-warning">Getting close to limit</span>
          )}
        </div>
      </div>

      {/* Hashtags Display */}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {hashtags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-xs">
              #{tag}
              <button onClick={() => removeHashtag(tag)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Media type toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setPostType('image')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            postType === 'image'
              ? 'thutha-gradient text-primary-foreground shadow-md'
              : 'thutha-card text-muted-foreground hover:text-foreground'
          }`}
          disabled={uploading}
        >
          <Image className="w-4 h-4" />
          Photo
        </button>
        <button
          type="button"
          onClick={() => setPostType('video')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
            postType === 'video'
              ? 'thutha-gradient text-primary-foreground shadow-md'
              : 'thutha-card text-muted-foreground hover:text-foreground'
          }`}
          disabled={uploading}
        >
          <Video className="w-4 h-4" />
          Video
        </button>
      </div>

      {/* Media Upload Area */}
      {(postType === 'image' || postType === 'video') && (
        <div 
          className="thutha-card p-4 border-2 border-dashed border-primary/30 flex flex-col items-center gap-3 cursor-pointer hover:bg-primary/5 transition-colors rounded-2xl"
          onClick={() => fileInputRef.current?.click()}
        >
          {previewUrl ? (
            <div className="relative w-full">
              {postType === 'image' ? (
                <img src={previewUrl} alt="Preview" className="max-h-96 rounded-lg mx-auto" />
              ) : (
                <video src={previewUrl} controls className="max-h-96 rounded-lg mx-auto" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile();
                }}
                className="absolute top-2 right-2 p-1 bg-destructive text-white rounded-full hover:bg-destructive/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {postType === 'image' ? (
                <Image className="w-12 h-12 text-primary" />
              ) : (
                <Video className="w-12 h-12 text-primary" />
              )}
              <p className="text-sm text-muted-foreground text-center">
                Tap to upload {postType}<br />
                <span className="text-xs">
                  {postType === 'image' ? 'Max 10MB' : 'Max 100MB'}
                </span>
              </p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={postType === 'image' ? 'image/*' : 'video/*'}
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
        </div>
      )}

      {/* Add-ons */}
      <div className="thutha-card p-4">
        <p className="text-sm text-foreground font-medium mb-3">Add to post</p>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setShowHashtagInput(!showHashtagInput)}
            className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            disabled={uploading}
          >
            <Hash className="w-5 h-5" />
            <span className="text-xs">Hashtag</span>
          </button>
          <button
            type="button"
            onClick={() => setShowMentionInput(!showMentionInput)}
            className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            disabled={uploading}
          >
            <AtSign className="w-5 h-5" />
            <span className="text-xs">Mention</span>
          </button>
        </div>

        {/* Hashtag Input */}
        {showHashtagInput && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="Enter hashtag (no #)"
              className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              onKeyPress={(e) => e.key === 'Enter' && addHashtag()}
            />
            <button
              onClick={addHashtag}
              className="thutha-gradient text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium"
            >
              Add
            </button>
          </div>
        )}

        {/* Mention Input */}
        {showMentionInput && (
          <div className="mt-3">
            <input
              type="text"
              value={mentionInput}
              onChange={(e) => setMentionInput(e.target.value)}
              placeholder="Enter username to mention"
              className="w-full bg-muted rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && mentionInput) {
                  setContent(content + ` @${mentionInput}`);
                  setMentionInput('');
                  setShowMentionInput(false);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Warning for text-only posts */}
      {postType === 'text' && !content.trim() && (
        <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-xl text-warning">
          <AlertCircle className="w-4 h-4" />
          <p className="text-xs">Your post will be text-only. Add media if you want more engagement.</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={uploading || (!content.trim() && !selectedFile)}
        className="w-full thutha-gradient text-primary-foreground font-heading font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Creating post...
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            Post
          </>
        )}
      </button>

      {/* Tips */}
      <div className="text-center text-xs text-muted-foreground">
        <p>✨ Tips for better engagement:</p>
        <p>• Use relevant hashtags • Add media when possible • Keep it authentic</p>
      </div>
    </div>
  );
};

export default Create;