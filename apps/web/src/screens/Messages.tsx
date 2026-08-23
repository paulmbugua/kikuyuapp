import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from '@/lib/navigation';
import { Send, Search, Phone, Video, ArrowLeft, PhoneOff, PhoneIncoming, MoreVertical, Mic, Image, Smile, Check, CheckCheck, X, Loader2, MessageCircle, UserPlus, UserCheck, ChevronLeft, Paperclip } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import { toast } from 'sonner';
import axiosInstance from '@/utils/axiosConfig';
import { formatDistanceToNow } from 'date-fns';
import { io, Socket } from 'socket.io-client';

interface Conversation {
  id: string;
  type: string;
  name: string;
  other_user: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
    is_verified: boolean;
    online?: boolean;
    last_seen?: string;
  };
  last_message: {
    id: string;
    content: string;
    type: string;
    created_at: string;
    is_read: boolean;
    user_id: string;
    username: string;
  };
  unread_count: number;
  is_pinned: boolean;
  is_muted: boolean;
}

interface Message {
  id: string;
  content: string;
  type: string;
  media_url?: string;
  created_at: string;
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  is_read: boolean;
  delivery_status: {
    status: string;
    delivered_at: string | null;
    read_at: string | null;
  };
}

interface User {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  is_verified: boolean;
  is_following?: boolean;
}

const Messages = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUserStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const pendingMessagesRef = useRef<Set<string>>(new Set());

  // Connect Socket.IO
  const connectSocket = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.error('No token available for WebSocket connection');
      return;
    }
    
    const socketInstance = io('http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    socketInstance.on('connect', () => {
      console.log('Socket.IO connected');
      // Request presence for all conversations
      if (conversations.length > 0) {
        const userIds = conversations.map(c => c.other_user?.id).filter(Boolean);
        if (userIds.length > 0) {
          socketInstance.emit('presence:getMany', { userIds });
        }
      }
    });
    
    socketInstance.on('disconnect', () => {
      console.log('Socket.IO disconnected');
    });
    
    // Handle new messages - FIXED: Don't add if it's our own message that we already have
    socketInstance.on('chat:message', (data) => {
      const { message: newMessage, conversation_id } = data;
      
      // Check if this message is already in our list (prevent duplicates)
      const messageExists = messages.some(m => m.id === newMessage.id);
      
      if (conversation_id === selectedConversation?.id && !messageExists) {
        // Only add if it's not our own pending message
        const isOwnMessage = newMessage.user_id === user?.id;
        
        if (!isOwnMessage) {
          setMessages(prev => [...prev, newMessage]);
          markAsRead(conversation_id);
        } else {
          // Replace pending message with confirmed one
          setMessages(prev => prev.map(msg => 
            msg.id === newMessage.id ? newMessage : msg
          ));
        }
      }
      fetchConversations();
    });
    
    socketInstance.on('chat:read', (data) => {
      if (data.conversation_id === selectedConversation?.id) {
        setMessages(prev => prev.map(msg => 
          msg.user_id !== user?.id ? { ...msg, is_read: true, delivery_status: { ...msg.delivery_status, status: 'read', read_at: new Date().toISOString() } } : msg
        ));
      }
      fetchConversations();
    });
    
    socketInstance.on('chat:typing', (data) => {
      if (data.conversation_id === selectedConversation?.id && data.user_id !== user?.id) {
        setTyping(data.is_typing);
        setTimeout(() => setTyping(false), 2000);
      }
    });
    
    socketInstance.on('presence:updated', (data) => {
      console.log('Presence update received:', data);
      setConversations(prev => prev.map(conv => 
        conv.other_user?.id === data.user_id 
          ? { ...conv, other_user: { ...conv.other_user, online: data.status === 'online', last_seen: data.last_seen_at } }
          : conv
      ));
      if (selectedConversation?.other_user?.id === data.user_id) {
        setSelectedConversation(prev => prev ? { 
          ...prev, 
          other_user: { ...prev.other_user, online: data.status === 'online', last_seen: data.last_seen_at }
        } : null);
      }
    });
    
    socketInstance.on('presence:many', (data) => {
      console.log('Multiple presence updates received:', data.presences);
      if (data.presences) {
        setConversations(prev => prev.map(conv => {
          const presence = data.presences.find((p: any) => p.user_id === conv.other_user?.id);
          if (presence) {
            return {
              ...conv,
              other_user: {
                ...conv.other_user,
                online: presence.status === 'online',
                last_seen: presence.last_seen_at
              }
            };
          }
          return conv;
        }));
      }
    });
    
    socketInstance.on('error', (error) => {
      console.error('Socket.IO error:', error);
    });
    
    setSocket(socketInstance);
    
    return socketInstance;
  };

  // Check URL params for user to chat with
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userId = params.get('user');
    if (userId) {
      startConversationWithUser(userId);
    }
  }, [location.search]);

  useEffect(() => {
    fetchConversations();
    const socketInstance = connectSocket();
    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages();
      markAsRead(selectedConversation.id);
      joinConversationRoom(selectedConversation.id);
    }
    return () => {
      if (selectedConversation) {
        leaveConversationRoom(selectedConversation.id);
      }
    };
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch presence when conversations change
  useEffect(() => {
    if (conversations.length > 0 && socket && socket.connected) {
      const userIds = conversations.map(c => c.other_user?.id).filter(Boolean);
      if (userIds.length > 0) {
        socket.emit('presence:getMany', { userIds });
      }
    }
  }, [conversations, socket]);

  // Typing indicator
  const handleTyping = () => {
    if (!selectedConversation || !socket || !socket.connected) return;
    
    if (typingTimeout) clearTimeout(typingTimeout);
    
    socket.emit('chat:typing', {
      conversationId: selectedConversation.id,
      isTyping: true
    });
    
    const timeout = setTimeout(() => {
      if (socket && socket.connected) {
        socket.emit('chat:typing', {
          conversationId: selectedConversation.id,
          isTyping: false
        });
      }
    }, 2000);
    
    setTypingTimeout(timeout);
  };

  const fetchConversations = async () => {
    try {
      const response = await axiosInstance.get('/chat/conversations');
      console.log('Conversations response:', response.data);
      const conversationsData = response.data.data?.conversations || response.data.data || [];
      setConversations(conversationsData);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (reset = true) => {
    if (!selectedConversation) return;
    
    if (reset) {
      setMessages([]);
      setPage(1);
      setHasMore(true);
    }
    
    try {
      const response = await axiosInstance.get(`/chat/conversations/${selectedConversation.id}/messages`, {
        params: { limit: 50, page: reset ? 1 : page + 1 }
      });
      
      const newMessages = response.data.data.messages || [];
      if (reset) {
        setMessages(newMessages);
        setPage(1);
        setHasMore(newMessages.length === 50);
      } else {
        setMessages(prev => [...newMessages, ...prev]);
        setPage(prev => prev + 1);
        setHasMore(newMessages.length === 50);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const markAsRead = async (conversationId: string) => {
    try {
      await axiosInstance.post(`/chat/conversations/${conversationId}/read`);
      fetchConversations();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const joinConversationRoom = (conversationId: string) => {
    if (socket && socket.connected) {
      socket.emit('chat:join', conversationId);
    }
  };

  const leaveConversationRoom = (conversationId: string) => {
    if (socket && socket.connected) {
      socket.emit('chat:leave', conversationId);
    }
  };

  // Search users
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    
    setSearching(true);
    setShowSearchResults(true);
    try {
      const response = await axiosInstance.get(`/chat/users/search`, {
        params: { q: query }
      });
      
      console.log('Search response:', response.data);
      
      let users = [];
      if (response.data.data?.users) {
        users = response.data.data.users;
      } else if (response.data.users) {
        users = response.data.users;
      } else if (Array.isArray(response.data)) {
        users = response.data;
      }
      
      const filteredUsers = users.filter((u: any) => u.id !== user?.id);
      console.log('Filtered users:', filteredUsers);
      setSearchResults(filteredUsers);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  // Start a new conversation with a user
  const startConversationWithUser = async (userId: string) => {
    try {
      setLoading(true);
      
      // Check if conversation already exists in current state
      const existingConv = conversations.find(conv => conv.other_user?.id === userId);
      if (existingConv) {
        setSelectedConversation(existingConv);
        setShowSearchResults(false);
        setSearchQuery('');
        return;
      }

      // Create new conversation
      const response = await axiosInstance.post('/chat/conversations', {
        participants: [userId],
        type: 'direct'
      });

      const newConversation = response.data.data.conversation;
      console.log('New conversation created:', newConversation);
      
      // Refresh conversations list to get the updated list
      await fetchConversations();
      
      // Find and select the new conversation
      setTimeout(() => {
        const updatedConv = conversations.find(conv => conv.other_user?.id === userId);
        if (updatedConv) {
          setSelectedConversation(updatedConv);
        } else {
          setSelectedConversation(newConversation);
        }
      }, 100);
      
      setShowSearchResults(false);
      setSearchQuery('');
      toast.success('Conversation started!');
    } catch (error: any) {
      console.error('Error starting conversation:', error);
      toast.error(error.response?.data?.message || 'Failed to start conversation');
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Send message without duplication
  const sendMessage = async () => {
    if (!message.trim() || !selectedConversation) return;
    
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const messageContent = message;
    
    // Clear input immediately
    setMessage('');
    
    // Stop typing indicator
    if (socket && socket.connected) {
      socket.emit('chat:typing', {
        conversationId: selectedConversation.id,
        isTyping: false
      });
    }
    
    try {
      // Send via HTTP API only (not both)
      const response = await axiosInstance.post(`/chat/conversations/${selectedConversation.id}/messages`, {
        content: messageContent,
        type: 'text'
      });
      
      const sentMessage = response.data.data.message;
      
      // Add the confirmed message to UI
      setMessages(prev => [...prev, sentMessage]);
      
      // The WebSocket will also emit a 'chat:message' event from the server
      // We'll handle it in the socket listener but prevent duplicates
      
      // Refresh conversations list to update last message
      fetchConversations();
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      // Restore the message if sending failed
      setMessage(messageContent);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  };

  const formatMessageTime = (date: string) => {
    const messageDate = new Date(date);
    const now = new Date();
    const diff = now.getTime() - messageDate.getTime();
    
    if (diff < 24 * 60 * 60 * 1000) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filteredConversations = conversations.filter(conv =>
    conv.other_user?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.other_user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Chat view
  if (selectedConversation) {
    const otherUser = selectedConversation.other_user;
    const isOnline = otherUser?.online;
    
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Chat header */}
        <div className="flex items-center gap-3 p-3 bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-10">
          <button onClick={() => setSelectedConversation(null)} className="p-1 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <img 
            src={otherUser?.avatar_url || `https://ui-avatars.com/api/?name=${otherUser?.username}&background=0D9488&color=fff`} 
            alt="" 
            className="w-10 h-10 rounded-full object-cover cursor-pointer"
            onClick={() => navigate(`/profile/${otherUser?.username}`)}
          />
          <div className="flex-1 cursor-pointer" onClick={() => navigate(`/profile/${otherUser?.username}`)}>
            <p className="text-sm font-semibold text-foreground">{otherUser?.full_name || otherUser?.username}</p>
            <p className="text-xs text-muted-foreground">
              {isOnline ? 'Online' : 'Offline'}
            </p>
          </div>
          <button onClick={() => {}} className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-primary">
            <Phone className="w-5 h-5" />
          </button>
          <button onClick={() => {}} className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-primary">
            <Video className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((msg, idx) => {
            const isMine = msg.user_id === user?.id;
            const showAvatar = !isMine && (idx === 0 || messages[idx - 1]?.user_id !== msg.user_id);
            
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`flex items-end gap-2 max-w-[70%] ${isMine ? 'flex-row-reverse' : ''}`}>
                  {!isMine && showAvatar && (
                    <img 
                      src={msg.avatar_url} 
                      alt="" 
                      className="w-8 h-8 rounded-full object-cover mb-1 cursor-pointer"
                      onClick={() => navigate(`/profile/${msg.username}`)}
                    />
                  )}
                  {!isMine && !showAvatar && <div className="w-8" />}
                  <div className={`rounded-2xl px-4 py-2 ${isMine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}>
                    {!isMine && (
                      <p className="text-xs font-semibold text-primary mb-0.5">{msg.full_name || msg.username}</p>
                    )}
                    <p className="text-sm break-words">{msg.content}</p>
                    <div className={`flex items-center gap-1 mt-1 text-[10px] ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      <span>{formatMessageTime(msg.created_at)}</span>
                      {isMine && (
                        <>
                          {msg.delivery_status?.status === 'sent' && <Check className="w-3 h-3" />}
                          {msg.delivery_status?.status === 'delivered' && <CheckCheck className="w-3 h-3" />}
                          {msg.delivery_status?.status === 'read' && <CheckCheck className="w-3 h-3" />}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {typing && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="p-3 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-primary">
              <Paperclip className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-primary">
              <Image className="w-5 h-5" />
            </button>
            <input
              value={message}
              onChange={e => {
                setMessage(e.target.value);
                handleTyping();
              }}
              onKeyPress={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-muted rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button 
              onClick={sendMessage} 
              disabled={!message.trim()}
              className="thutha-gradient p-2.5 rounded-full text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main messages list view
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <h2 className="font-heading font-bold text-xl text-foreground">Chats</h2>
        </div>
        
        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                searchUsers(e.target.value);
              }}
              placeholder="Search users or chats..."
              className="w-full bg-muted rounded-full pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      {/* Search Results */}
      {showSearchResults && searchQuery && (
        <div className="flex-1 overflow-y-auto">
          {searching ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {searchResults.map(searchUser => (
                <div
                  key={searchUser.id}
                  onClick={() => startConversationWithUser(searchUser.id)}
                  className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-all duration-300"
                >
                  <img
                    src={searchUser.avatar_url || `https://ui-avatars.com/api/?name=${searchUser.username}&background=0D9488&color=fff`}
                    alt={searchUser.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{searchUser.full_name || searchUser.username}</p>
                    <p className="text-xs text-muted-foreground">@{searchUser.username}</p>
                  </div>
                  <button className="thutha-gradient text-primary-foreground px-3 py-1.5 rounded-full text-xs font-semibold">
                    Message
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Conversations List */}
      {!showSearchResults && (
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-10 h-10 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground mt-1">Search for users to start chatting</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredConversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-all duration-300 text-left"
                >
                  <div className="relative">
                    <img 
                      src={conv.other_user?.avatar_url || `https://ui-avatars.com/api/?name=${conv.other_user?.username}&background=0D9488&color=fff`} 
                      alt="" 
                      className="w-12 h-12 rounded-full object-cover" 
                    />
                    {conv.other_user?.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary rounded-full border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {conv.other_user?.full_name || conv.other_user?.username}
                      </p>
                      {conv.last_message && (
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                          {formatTime(conv.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <p className="text-xs text-muted-foreground truncate flex-1">
                        {conv.last_message?.user_id === user?.id ? 'You: ' : ''}
                        {conv.last_message?.content || 'Start a conversation'}
                      </p>
                      {conv.unread_count > 0 && (
                        <span className="ml-2 thutha-gradient text-primary-foreground text-xs font-bold min-w-5 h-5 rounded-full flex items-center justify-center px-1.5">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Messages;