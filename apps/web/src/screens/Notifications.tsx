import { Heart, MessageCircle, UserPlus, DollarSign, CheckCircle2, Loader2, Trash2, CheckCheck, Bell, BellRing, MessageSquare, Users, Sparkles } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@/lib/navigation';
import { toast } from 'sonner';
import axiosInstance from '@/utils/axiosConfig';
import { formatDistanceToNow } from 'date-fns';
import { useSocket } from '@/contexts/SocketContext';

interface Notification {
  id: string;
  type: string;
  user_id: string;
  actor_id: string;
  actor_name: string;
  actor_avatar_url: string;
  content: string;
  message: string;
  reference_id: string;
  reference_type: string;
  is_read: boolean;
  created_at: string;
  metadata?: {
    message_preview?: string;
    conversation_id?: string;
    conversation_name?: string;
    reaction?: string;
  };
}

const iconMap: Record<string, any> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  tip: DollarSign,
  verified: CheckCircle2,
  mention: MessageCircle,
  repost: Heart,
  new_post: Sparkles,
  new_message: MessageSquare,
  new_group_message: Users,
  comment_reply: MessageCircle,
  message_reaction: Heart,
  added_to_group: Users,
};

const colorMap: Record<string, string> = {
  like: 'bg-red-500/10 text-red-500',
  comment: 'bg-blue-500/10 text-blue-500',
  follow: 'bg-green-500/10 text-green-500',
  tip: 'bg-yellow-500/10 text-yellow-500',
  verified: 'bg-purple-500/10 text-purple-500',
  mention: 'bg-cyan-500/10 text-cyan-500',
  repost: 'bg-emerald-500/10 text-emerald-500',
  new_post: 'bg-indigo-500/10 text-indigo-500',
  new_message: 'bg-teal-500/10 text-teal-500',
  new_group_message: 'bg-orange-500/10 text-orange-500',
  comment_reply: 'bg-blue-500/10 text-blue-500',
  message_reaction: 'bg-pink-500/10 text-pink-500',
  added_to_group: 'bg-violet-500/10 text-violet-500',
};

const Notifications = () => {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showToast, setShowToast] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio for notification sound
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/notification.mp3');
      audioRef.current.volume = 0.5;
    }
  }, []);

  // Fetch initial notifications
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [filter]);

  // Setup socket listeners for real-time notifications
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen for new notifications
    const handleNewNotification = (data: any) => {
      const { notification, is_offline_delivery, message_preview, conversation_id } = data;
      
      // Add notification to the beginning of the list
      setNotifications(prev => [notification, ...prev]);
      
      // Update unread count
      setUnreadCount(prev => prev + 1);
      
      // Play sound for new notification (only if not offline delivery)
      if (!is_offline_delivery && audioRef.current && showToast) {
        audioRef.current.play().catch(console.error);
      }
      
      // Show toast notification
      if (showToast && document.visibilityState === 'visible') {
        toast.info(notification.message || notification.content, {
          description: notification.actor_name,
          duration: 5000,
          action: {
            label: 'View',
            onClick: () => handleNotificationClick(notification)
          }
        });
      }
      
      // If it's a chat message, also update chat unread count
      if (notification.type === 'new_message' || notification.type === 'new_group_message') {
        // Emit event to update chat badge
        if (socket) {
          socket.emit('notification:chat_received', {
            conversation_id: conversation_id || notification.reference_id
          });
        }
      }
    };

    // Handle badge updates
    const handleBadgeUpdate = (data: any) => {
      if (data.type === 'all') {
        setUnreadCount(data.unread_count);
      }
    };

    // Handle read status updates from other devices
    const handleNotificationRead = (data: any) => {
      const { notification_id } = data;
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notification_id ? { ...notif, is_read: true } : notif
        )
      );
    };

    // Handle bulk read updates
    const handleAllRead = (data: any) => {
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );
      setUnreadCount(0);
    };

    // Register event listeners
    socket.on('notification:new', handleNewNotification);
    socket.on('notification:badge_update', handleBadgeUpdate);
    socket.on('notification:read', handleNotificationRead);
    socket.on('notification:all_read', handleAllRead);

    // Cleanup on unmount
    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('notification:badge_update', handleBadgeUpdate);
      socket.off('notification:read', handleNotificationRead);
      socket.off('notification:all_read', handleAllRead);
    };
  }, [socket, isConnected, showToast]);

  // Listen for page visibility to refresh notifications when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Refresh unread count when tab becomes active
        fetchUnreadCount();
        // Optionally refresh notifications
        fetchNotifications(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

 const fetchNotifications = async (reset = true) => {
  if (reset) {
    setLoading(true);
    setPage(1);
  } else {
    setLoadingMore(true);
  }

  try {
    const response = await axiosInstance.get('/notifications', {
      params: {
        limit: 20,
        page: reset ? 1 : page + 1,
        filter: filter
      }
    });

    // DEBUG: Log the response structure
    console.log('Full API Response:', response.data);
    
    // FIX: Handle different response structures
    let newNotifications = [];
    let total = 0;
    let unread = 0;
    let hasMoreData = false;
    
    // Check the structure of the response
    if (response.data.data) {
      // If data is an array
      if (Array.isArray(response.data.data)) {
        newNotifications = response.data.data;
        total = newNotifications.length;
        unread = newNotifications.filter(n => !n.is_read).length;
        hasMoreData = false;
      } 
      // If data has notifications property
      else if (response.data.data.notifications) {
        newNotifications = response.data.data.notifications;
        total = response.data.data.total || 0;
        unread = response.data.data.unreadCount || 0;
        hasMoreData = response.data.data.hasMore || false;
      }
      // If data is some other object
      else {
        newNotifications = [];
        total = 0;
        unread = response.data.data.unreadCount || 0;
        hasMoreData = false;
      }
    } else if (Array.isArray(response.data)) {
      newNotifications = response.data;
      total = newNotifications.length;
      unread = newNotifications.filter(n => !n.is_read).length;
      hasMoreData = false;
    }
    
    console.log('Parsed notifications:', newNotifications);
    console.log('Number of notifications:', newNotifications.length);
    
    // Log each notification to see what's in them
    newNotifications.forEach((notif, index) => {
      console.log(`Notification ${index + 1}:`, {
        id: notif.id,
        type: notif.type,
        content: notif.content,
        message: notif.message,
        actor_name: notif.actor_name,
        created_at: notif.created_at
      });
    });
    
    setHasMore(hasMoreData);
    setUnreadCount(unread);

    if (reset) {
      setNotifications(newNotifications);
      setPage(1);
    } else {
      setNotifications(prev => [...prev, ...newNotifications]);
      setPage(prev => prev + 1);
    }
  } catch (error) {
    console.error('Error fetching notifications:', error);
    toast.error('Failed to load notifications');
  } finally {
    setLoading(false);
    setLoadingMore(false);
  }
};

  const fetchUnreadCount = async () => {
  try {
    const response = await axiosInstance.get('/notifications/unread/count');
    console.log('Unread count response:', response.data);
    
    let count = 0;
    if (response.data.data) {
      if (typeof response.data.data === 'number') {
        count = response.data.data;
      } else if (response.data.data.unreadCount) {
        count = response.data.data.unreadCount;
      } else if (response.data.data.count) {
        count = response.data.data.count;
      }
    } else if (response.data.unreadCount) {
      count = response.data.unreadCount;
    }
    
    setUnreadCount(count);
    
    // Update badge in browser tab
    updateBrowserTabBadge(count);
  } catch (error) {
    console.error('Error fetching unread count:', error);
  }
};
  const updateBrowserTabBadge = (count: number) => {
    // Update document title
    const originalTitle = document.title.replace(/^\(\d+\)\s/, '');
    if (count > 0) {
      document.title = `(${count}) ${originalTitle}`;
    } else {
      document.title = originalTitle;
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await axiosInstance.put(`/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Emit socket event for real-time update across devices
      if (socket && isConnected) {
        socket.emit('notification:mark_read', { notification_id: notificationId });
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axiosInstance.put('/notifications/read/all');
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );
      setUnreadCount(0);
      toast.success('All notifications marked as read');
      
      // Emit socket event for real-time update across devices
      if (socket && isConnected) {
        socket.emit('notification:mark_all_read');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await axiosInstance.delete(`/notifications/${notificationId}`);
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
      
      // Also update unread count if the deleted notification was unread
      const deletedNotif = notifications.find(n => n.id === notificationId);
      if (deletedNotif && !deletedNotif.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      toast.success('Notification deleted');
      
      // Emit socket event for real-time update
      if (socket && isConnected) {
        socket.emit('notification:deleted', { notification_id: notificationId });
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.reference_type === 'post' && notification.reference_id) {
      navigate(`/post/${notification.reference_id}`);
    } else if (notification.reference_type === 'user' && notification.reference_id) {
      navigate(`/profile/${notification.actor_name || notification.actor_id}`);
    } else if (notification.reference_type === 'conversation' && notification.reference_id) {
      navigate(`/chat/${notification.reference_id}`);
    } else if (notification.reference_type === 'comment' && notification.reference_id) {
      navigate(`/post/${notification.reference_id}`);
    } else if (notification.type === 'tip') {
      navigate(`/profile/${notification.actor_name || notification.actor_id}`);
    }
  };
// Auto-refresh every 10 seconds
useEffect(() => {
  const interval = setInterval(() => {
    if (document.visibilityState === 'visible') {
      console.log('Auto-refreshing notifications...');
      fetchNotifications(true);
      fetchUnreadCount();
    }
  }, 10000); // Refresh every 10 seconds
  
  return () => clearInterval(interval);
}, [filter]);
  const filters = [
    { id: 'all', label: 'All', icon: Bell },
    { id: 'like', label: 'Likes', icon: Heart },
    { id: 'comment', label: 'Comments', icon: MessageCircle },
    { id: 'follow', label: 'Follows', icon: UserPlus },
    { id: 'tip', label: 'Tips', icon: DollarSign },
    { id: 'new_message', label: 'Messages', icon: MessageSquare },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-4 px-4 md:px-0 space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-heading font-bold text-xl text-foreground">Notifications</h2>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Sound toggle button */}
          <button
            onClick={() => setShowToast(!showToast)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title={showToast ? 'Disable notification sounds' : 'Enable notification sounds'}
          >
            <BellRing className={`w-4 h-4 ${showToast ? 'text-primary' : 'text-muted-foreground'}`} />
          </button>
          
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 p-2 rounded-lg text-xs text-center">
          <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
          Connecting to real-time updates...
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {filters.map(f => {
          const Icon = f.icon;
          const count = f.id === 'all' 
            ? unreadCount 
            : notifications.filter(n => n.type === f.id && !n.is_read).length;
          
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                filter === f.id
                  ? 'thutha-gradient text-primary-foreground shadow-md'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {f.label}
              {count > 0 && filter === f.id && (
                <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="thutha-card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No notifications yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            When someone interacts with you, you'll see it here
          </p>
        </div>
      ) : (
        <div className="thutha-card divide-y divide-border">
          {notifications.map(notif => {
            const Icon = iconMap[notif.type] || Bell;
            const colorClass = colorMap[notif.type] || 'bg-primary/10 text-primary';
            const timeAgo = formatDistanceToNow(new Date(notif.created_at), { addSuffix: true });

            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`flex items-center gap-3 p-4 hover:bg-muted/30 transition-all duration-300 cursor-pointer group ${
                  !notif.is_read ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                }`}
              >
                {/* Avatar with icon */}
                <div className="relative shrink-0">
                  {notif.actor_avatar_url ? (
                    <>
                      <img
                        src={notif.actor_avatar_url}
                        alt=""
                        className="w-11 h-11 rounded-full object-cover"
                      />
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center ${colorClass} border-2 border-background`}>
                        <Icon className="w-3 h-3" />
                      </div>
                    </>
                  ) : (
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center ${colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  )}
                  {!notif.is_read && (
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{notif.actor_name || 'Thutha'}</span>{' '}
                    {notif.message || notif.content}
                  </p>
                  {notif.metadata?.message_preview && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      "{notif.metadata.message_preview}"
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">{timeAgo}</p>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notif.id);
                  }}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-destructive transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <button
          onClick={() => fetchNotifications(false)}
          disabled={loadingMore}
          className="w-full py-2 text-center text-sm text-primary hover:underline transition-colors"
        >
          {loadingMore ? (
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
          ) : (
            'Load more'
          )}
        </button>
      )}
    </div>
  );
};

export default Notifications;
