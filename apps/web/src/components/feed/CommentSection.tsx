// src/components/feed/CommentSection.tsx
import { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Trash2, ChevronDown, ChevronUp, Send, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useUserStore } from '@/stores/userStore';
import { toast } from 'sonner';
import axiosInstance from '@/utils/axiosConfig';
import { useSocket } from '@/contexts/SocketContext';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  is_verified: boolean;
  likes_count: number;
  replies_count: number;
  is_liked: boolean;
  parent_id: string | null;
  post_id?: string; // Add optional post_id
}

interface CommentItemProps {
  comment: Comment;
  depth?: number;
  postId?: string;
  onLike?: (commentId: string, isLiked: boolean) => void;
  onDelete?: (commentId: string) => void;
}

const CommentItem = ({ comment, depth = 0, postId, onLike, onDelete }: CommentItemProps) => {
  const { user: currentUser } = useUserStore();
  const [liked, setLiked] = useState(comment.is_liked);
  const [likeCount, setLikeCount] = useState(comment.likes_count);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const isOwn = comment.user_id === currentUser?.id;

  const fetchReplies = async () => {
    setLoadingReplies(true);
    try {
      const response = await axiosInstance.get(`/comments/${comment.id}/replies`);
      let repliesData = [];
      if (response.data.data?.replies) {
        repliesData = response.data.data.replies;
      } else if (Array.isArray(response.data.data)) {
        repliesData = response.data.data;
      } else if (Array.isArray(response.data)) {
        repliesData = response.data;
      }
      setReplies(repliesData);
    } catch (error) {
      console.error('Error fetching replies:', error);
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleToggleReplies = () => {
    if (!showReplies && replies.length === 0) {
      fetchReplies();
    }
    setShowReplies(!showReplies);
  };

  const handleLike = async () => {
    try {
      if (liked) {
        await axiosInstance.delete(`/likes/comment/${comment.id}`);
        setLikeCount(prev => prev - 1);
      } else {
        await axiosInstance.post(`/likes/comment/${comment.id}`);
        setLikeCount(prev => prev + 1);
      }
      setLiked(!liked);
      onLike?.(comment.id, !liked);
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to like comment');
    }
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim()) return;
    
    try {
      const response = await axiosInstance.post(`/posts/${postId || comment.post_id}/comments`, {
        content: replyText,
        parentId: comment.id
      });
      
      const newReply = response.data.data.comment;
      setReplies(prev => [newReply, ...prev]);
      setReplyText('');
      setReplying(false);
      toast.success('Reply added');
    } catch (error) {
      console.error('Error posting reply:', error);
      toast.error('Failed to post reply');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return;
    
    try {
      await axiosInstance.delete(`/comments/${comment.id}`);
      toast.success('Comment deleted');
      onDelete?.(comment.id);
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });
  const formatNumber = (num: number) => {
    if (!num) return '0';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className={`${depth > 0 ? 'ml-10 border-l-2 border-border pl-3' : ''}`}>
      <div className="flex gap-2.5 py-2.5">
        <img 
          src={comment.avatar_url || `https://ui-avatars.com/api/?name=${comment.username}&background=0D9488&color=fff`} 
          alt="" 
          className="w-8 h-8 rounded-full object-cover shrink-0" 
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{comment.full_name || comment.username}</span>
            {comment.is_verified && (
              <span className="text-primary text-xs">✓</span>
            )}
            <span className="text-xs text-muted-foreground">@{comment.username}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
          <p className="text-sm text-foreground mt-0.5 leading-relaxed">{comment.content}</p>
          
          <div className="flex items-center gap-4 mt-1.5">
            <button 
              onClick={handleLike} 
              className={`flex items-center gap-1 text-xs transition-colors ${liked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
            >
              <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-current' : ''}`} />
              <span>{formatNumber(likeCount)}</span>
            </button>
            
            <button 
              onClick={() => setReplying(!replying)} 
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Reply
            </button>
            
            {isOwn && (
              <button 
                onClick={handleDelete}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>

          {replying && (
            <div className="flex items-center gap-2 mt-2">
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={`Reply to ${comment.username}...`}
                className="flex-1 bg-muted rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                onKeyPress={e => e.key === 'Enter' && handleSubmitReply()}
              />
              <button 
                onClick={handleSubmitReply}
                className="text-primary hover:text-primary/80 transition-colors"
                disabled={!replyText.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}

          {(comment.replies_count > 0 || replies.length > 0) && (
            <button
              onClick={handleToggleReplies}
              className="flex items-center gap-1 text-xs text-primary font-medium mt-2 hover:underline"
            >
              {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showReplies ? 'Hide' : `View ${comment.replies_count || replies.length}`} {comment.replies_count === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      </div>

      {showReplies && (
        <div className="mt-1">
          {loadingReplies ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            replies.map(reply => (
              <CommentItem 
                key={reply.id} 
                comment={reply} 
                depth={depth + 1}
                postId={postId}
                onLike={onLike}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const CommentSection = ({ postId }: { postId: string }) => {
  const { user: currentUser } = useUserStore();
  const { socket, isConnected } = useSocket();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalComments, setTotalComments] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchComments = async (reset = true) => {
    if (reset) {
      setPage(1);
      setLoading(true);
    }
    
    try {
      const response = await axiosInstance.get(`/posts/${postId}/comments`, {
        params: { limit: 20, page: reset ? 1 : page + 1 }
      });
      
      let commentsData = [];
      let total = 0;
      
      if (response.data.data?.comments) {
        commentsData = response.data.data.comments;
        total = response.data.data.total || 0;
      } else if (Array.isArray(response.data.data)) {
        commentsData = response.data.data;
        total = commentsData.length;
      } else if (Array.isArray(response.data)) {
        commentsData = response.data;
        total = commentsData.length;
      }
      
      setTotalComments(total);
      setHasMore(commentsData.length === 20);
      
      if (reset) {
        setComments(commentsData);
        setPage(1);
      } else {
        setComments(prev => [...prev, ...commentsData]);
        setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

 // In handleSubmitComment - ensure postId is used correctly
const handleSubmitComment = async () => {
  if (!newComment.trim() || submitting) return;
  
  setSubmitting(true);
  const commentContent = newComment;
  setNewComment('');
  
  try {
    // Make sure postId is defined
    if (!postId) {
      throw new Error('Post ID is missing');
    }
    
    const response = await axiosInstance.post(`/posts/${postId}/comments`, {
      content: commentContent
    });
    
    const newCommentData = response.data.data.comment;
    setComments(prev => [newCommentData, ...prev]);
    setTotalComments(prev => prev + 1);
    
    toast.success('Comment added');
  } catch (error: any) {
    console.error('Error posting comment:', error);
    toast.error(error.response?.data?.message || 'Failed to post comment');
  } finally {
    setSubmitting(false);
  }
};

  const handleLikeComment = async (commentId: string, isLiked: boolean) => {
    // Optimistic update
    setComments(prev => prev.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          is_liked: !isLiked,
          likes_count: isLiked ? comment.likes_count - 1 : comment.likes_count + 1
        };
      }
      return comment;
    }));
  };

  const handleDeleteComment = async (commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId));
    setTotalComments(prev => prev - 1);
  };

  const loadMoreComments = () => {
    if (hasMore && !loading) {
      fetchComments(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId]);

  // Listen for real-time new comments via socket
  useEffect(() => {
    if (!socket || !isConnected) return;
    
    const handleNewComment = (data: any) => {
      if (data.post_id === postId && data.comment && !data.comment.parent_id) {
        setComments(prev => [data.comment, ...prev]);
        setTotalComments(prev => prev + 1);
      }
    };
    
    socket.on('comment:new', handleNewComment);
    
    return () => {
      socket.off('comment:new', handleNewComment);
    };
  }, [socket, isConnected, postId]);

  const formatNumber = (num: number) => {
    if (!num) return '0';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading && comments.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="px-4 pb-3">
      {/* Comment input */}
      <div className="flex items-center gap-2 mb-4 pt-2">
        <img 
          src={currentUser?.avatar_url || `https://ui-avatars.com/api/?name=${currentUser?.username || 'User'}&background=0D9488&color=fff`} 
          alt="" 
          className="w-8 h-8 rounded-full object-cover shrink-0" 
        />
        <div className="flex-1 flex items-center gap-2 bg-muted rounded-full px-3 py-1.5">
          <input
            ref={inputRef}
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSubmitComment()}
            placeholder="Add a comment..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            disabled={submitting}
          />
          <button 
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || submitting}
            className="text-primary hover:text-primary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Comments count */}
      {totalComments > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-gradient-to-b from-primary to-accent rounded-full" />
          <span className="text-xs text-muted-foreground">{formatNumber(totalComments)} comments</span>
        </div>
      )}

      {/* Comments list */}
      <div className="divide-y divide-border/50">
        {comments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">No comments yet</p>
            <p className="text-xs text-muted-foreground mt-1">Be the first to comment!</p>
          </div>
        ) : (
          comments.map(comment => (
            <CommentItem 
              key={comment.id} 
              comment={comment} 
              postId={postId}
              onLike={handleLikeComment}
              onDelete={handleDeleteComment}
            />
          ))
        )}
      </div>

      {/* Load more */}
      {hasMore && comments.length > 0 && (
        <button
          onClick={loadMoreComments}
          className="w-full mt-4 py-2 text-center text-xs text-primary hover:underline transition-colors"
        >
          Load more comments
        </button>
      )}
    </div>
  );
};

export default CommentSection;