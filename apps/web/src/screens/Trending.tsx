import { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@/lib/navigation';
import { Search, Mic, Users, Radio, X, UserPlus, UserCheck, Hash, TrendingUp, Clock, Hand, DollarSign, Volume2, VolumeX, MicOff, Plus, Globe, Lock, Loader2, LogOut, Crown, CheckCircle } from 'lucide-react';
import { formatNumber } from '@/data/dummy';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import PostCard from '@/components/feed/PostCard';
import SupportTokenButton from '@/components/feed/SupportTokenButton';
import { useUserStore } from '@/stores/userStore';
import { toast } from 'sonner';
import axiosInstance from '@/utils/axiosConfig';

interface VoiceSpace {
  id: string;
  title: string;
  topic: string;
  description: string;
  is_live: boolean;
  is_private: boolean;
  status: string;
  listener_count: number;
  speaker_count: number;
  host_id: string;
  host_username: string;
  host_name: string;
  host_avatar: string;
  host_verified: boolean;
  participants: Array<{
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
    role: string;
    is_muted: boolean;
    has_hand_raised: boolean;
  }>;
  is_participant: boolean;
  participant_role: string;
  started_at: string;
  scheduled_for: string;
}

interface TrendingTopic {
  id: string;
  tag: string;
  posts: number;
  category: string;
}

interface SearchUser {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  handle: string;
  followers: number;
  is_following: boolean;
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  full_name: string;
  avatar_url: string;
  message: string;
  createdAt: string;
}

const Rugano = () => {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'spaces' | 'trending' | 'posts'>('spaces');
  const [activeSpace, setActiveSpace] = useState<VoiceSpace | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveSpaces, setLiveSpaces] = useState<VoiceSpace[]>([]);
  const [upcomingSpaces, setUpcomingSpaces] = useState<VoiceSpace[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<SearchUser[]>([]);
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [newSpaceTitle, setNewSpaceTitle] = useState('');
  const [newSpaceTopic, setNewSpaceTopic] = useState('');
  const [newSpacePrivate, setNewSpacePrivate] = useState(false);
  const [isHosting, setIsHosting] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [muted, setMuted] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [participants, setParticipants] = useState<any[]>([]);

  useEffect(() => {
    fetchLiveSpaces();
    fetchTrendingTopics();
    fetchSuggestedUsers();
  }, []);

  useEffect(() => {
    if (activeSpace && activeSpace.is_live) {
      connectWebSocket(activeSpace.id);
      fetchMessages(activeSpace.id);
    }
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, [activeSpace]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchLiveSpaces = async () => {
    try {
      const response = await axiosInstance.get('/rugano/live');
      setLiveSpaces(response.data.data.spaces || []);
    } catch (error) {
      console.error('Error fetching live spaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingSpaces = async () => {
    try {
      const response = await axiosInstance.get('/rugano/upcoming');
      setUpcomingSpaces(response.data.data.spaces || []);
    } catch (error) {
      console.error('Error fetching upcoming spaces:', error);
    }
  };

  const fetchTrendingTopics = async () => {
    try {
      const response = await axiosInstance.get('/trending/topics');
      setTrendingTopics(response.data.data.topics || []);
    } catch (error) {
      console.error('Error fetching trending topics:', error);
    }
  };

  const fetchSuggestedUsers = async () => {
    try {
      const response = await axiosInstance.get('/users/suggestions');
      setSuggestedUsers(response.data.data.suggestions || []);
    } catch (error) {
      console.error('Error fetching suggested users:', error);
    }
  };

  const fetchMessages = async (spaceId: string) => {
    try {
      const response = await axiosInstance.get(`/rugano/${spaceId}/messages`);
      const msgs = response.data.data.messages || [];
      setMessages(msgs.map((msg: any) => ({
        id: msg.id,
        userId: msg.user_id,
        username: msg.username,
        full_name: msg.full_name,
        avatar_url: msg.avatar_url,
        message: msg.message,
        createdAt: msg.created_at
      })));
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const connectWebSocket = (spaceId: string) => {
    const token = localStorage.getItem('accessToken');
    const ws = new WebSocket(`ws://localhost:5000?token=${token}`);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      ws.send(JSON.stringify({ 
        type: 'voice-space:join', 
        spaceId,
        role: activeSpace?.participant_role || 'listener'
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message:', data);
      
      switch (data.type) {
        case 'voice-space:participants':
          setParticipants(data.participants);
          setActiveSpace(prev => prev ? { ...prev, participants: data.participants } : prev);
          break;
        case 'voice-space:user-joined':
          toast.success(`${data.username} joined the space`);
          setParticipants(prev => [...prev, data]);
          setActiveSpace(prev => prev ? { 
            ...prev, 
            participants: [...(prev.participants || []), data],
            listener_count: (prev.listener_count || 0) + 1
          } : prev);
          break;
        case 'voice-space:user-left':
          toast.info(`${data.username} left the space`);
          setParticipants(prev => prev.filter(p => p.userId !== data.userId));
          setActiveSpace(prev => prev ? {
            ...prev,
            participants: (prev.participants || []).filter(p => p.id !== data.userId),
            listener_count: (prev.listener_count || 0) - 1
          } : prev);
          break;
        case 'voice-space:hand-raised':
          toast.info(`${data.username} raised their hand`);
          setParticipants(prev => prev.map(p => 
            p.userId === data.userId ? { ...p, hasHandRaised: true } : p
          ));
          setActiveSpace(prev => prev ? {
            ...prev,
            participants: (prev.participants || []).map(p => 
              p.id === data.userId ? { ...p, has_hand_raised: true } : p
            )
          } : prev);
          break;
        case 'voice-space:hand-lowered':
          setParticipants(prev => prev.map(p => 
            p.userId === data.userId ? { ...p, hasHandRaised: false } : p
          ));
          setActiveSpace(prev => prev ? {
            ...prev,
            participants: (prev.participants || []).map(p => 
              p.id === data.userId ? { ...p, has_hand_raised: false } : p
            )
          } : prev);
          break;
        case 'voice-space:speaker-approved':
          toast.success(`${data.username} is now a speaker`);
          setParticipants(prev => prev.map(p => 
            p.userId === data.userId ? { ...p, role: 'speaker', hasHandRaised: false } : p
          ));
          setActiveSpace(prev => prev ? {
            ...prev,
            participants: (prev.participants || []).map(p => 
              p.id === data.userId ? { ...p, role: 'speaker', has_hand_raised: false } : p
            )
          } : prev);
          break;
        case 'voice-space:become-speaker':
          toast.success('You are now a speaker!');
          setHandRaised(false);
          break;
        case 'voice-space:new-message':
          setMessages(prev => [...prev, {
            id: data.id,
            userId: data.userId,
            username: data.username,
            full_name: data.fullName,
            avatar_url: data.avatarUrl,
            message: data.message,
            createdAt: data.createdAt
          }]);
          break;
        case 'voice-space:muted':
          if (data.userId === user?.id) {
            setMuted(data.isMuted);
            toast.info(data.isMuted ? 'You have been muted' : 'You have been unmuted');
          }
          setParticipants(prev => prev.map(p => 
            p.userId === data.userId ? { ...p, isMuted: data.isMuted } : p
          ));
          break;
        case 'voice-space:user-removed':
          if (data.userId === user?.id) {
            toast.error('You have been removed from the space');
            setActiveSpace(null);
            setIsHosting(false);
          } else {
            toast.info(`User was removed from the space`);
          }
          break;
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast.error('Connection error. Please refresh the page.');
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    setWsConnection(ws);
  };

  const fetchSpaceDetails = async (spaceId: string) => {
    try {
      const response = await axiosInstance.get(`/rugano/${spaceId}`);
      setActiveSpace(response.data.data.space);
    } catch (error) {
      console.error('Error fetching space details:', error);
    }
  };

  const createSpace = async () => {
    if (!newSpaceTitle.trim()) {
      toast.error('Please enter a space title');
      return;
    }

    try {
      const response = await axiosInstance.post('/rugano', {
        title: newSpaceTitle,
        topic: newSpaceTopic,
        isPrivate: newSpacePrivate
      });

      const space = response.data.data.space;
      toast.success('Space created!');
      setShowCreateSpace(false);
      setNewSpaceTitle('');
      setNewSpaceTopic('');
      
      // Start the space immediately
      await axiosInstance.post(`/rugano/${space.id}/start`);
      await fetchSpaceDetails(space.id);
      setIsHosting(true);
    } catch (error: any) {
      console.error('Error creating space:', error);
      toast.error(error.response?.data?.message || 'Failed to create space');
    }
  };

  const joinSpace = async (spaceId: string) => {
    try {
      await axiosInstance.post(`/rugano/${spaceId}/join`);
      await fetchSpaceDetails(spaceId);
      toast.success('Joined space!');
    } catch (error: any) {
      console.error('Error joining space:', error);
      toast.error(error.response?.data?.message || 'Failed to join space');
    }
  };

  const leaveSpace = async () => {
    if (!activeSpace) return;
    
    try {
      await axiosInstance.post(`/rugano/${activeSpace.id}/leave`);
      if (wsConnection) {
        wsConnection.send(JSON.stringify({ 
          type: 'voice-space:leave', 
          spaceId: activeSpace.id 
        }));
        wsConnection.close();
      }
      setActiveSpace(null);
      setIsHosting(false);
      setHandRaised(false);
      setMessages([]);
      setParticipants([]);
      toast.success('Left space');
    } catch (error) {
      console.error('Error leaving space:', error);
      toast.error('Failed to leave space');
    }
  };

  const endSpace = async () => {
    if (!activeSpace) return;
    
    try {
      await axiosInstance.post(`/rugano/${activeSpace.id}/end`);
      if (wsConnection) {
        wsConnection.send(JSON.stringify({ 
          type: 'voice-space:leave', 
          spaceId: activeSpace.id 
        }));
        wsConnection.close();
      }
      setActiveSpace(null);
      setIsHosting(false);
      toast.success('Space ended');
    } catch (error) {
      console.error('Error ending space:', error);
      toast.error('Failed to end space');
    }
  };

  const raiseHand = async () => {
    if (!activeSpace) return;
    
    try {
      if (handRaised) {
        await axiosInstance.post(`/rugano/${activeSpace.id}/lower-hand`);
        if (wsConnection) {
          wsConnection.send(JSON.stringify({ 
            type: 'voice-space:lower-hand', 
            spaceId: activeSpace.id 
          }));
        }
        setHandRaised(false);
        toast.success('Hand lowered');
      } else {
        await axiosInstance.post(`/rugano/${activeSpace.id}/raise-hand`);
        if (wsConnection) {
          wsConnection.send(JSON.stringify({ 
            type: 'voice-space:raise-hand', 
            spaceId: activeSpace.id 
          }));
        }
        setHandRaised(true);
        toast.success('Hand raised! Host has been notified');
      }
    } catch (error) {
      console.error('Error toggling hand:', error);
      toast.error('Failed to raise/lower hand');
    }
  };

  const toggleMute = async () => {
    setMuted(!muted);
    toast.info(muted ? 'Microphone enabled' : 'Microphone muted');
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeSpace) return;
    
    try {
      await axiosInstance.post(`/rugano/${activeSpace.id}/messages`, {
        message: newMessage
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const approveSpeaker = async (targetUserId: string) => {
    if (!activeSpace) return;
    
    try {
      await axiosInstance.post(`/rugano/${activeSpace.id}/approve-speaker/${targetUserId}`);
      if (wsConnection) {
        wsConnection.send(JSON.stringify({ 
          type: 'voice-space:approve-speaker', 
          spaceId: activeSpace.id,
          targetUserId
        }));
      }
      toast.success('Speaker approved');
    } catch (error) {
      console.error('Error approving speaker:', error);
      toast.error('Failed to approve speaker');
    }
  };

  const followUser = async (userId: string, isFollowing: boolean) => {
    try {
      if (isFollowing) {
        await axiosInstance.delete(`/follows/${userId}`);
      } else {
        await axiosInstance.post(`/follows/${userId}`);
      }
      fetchSuggestedUsers();
      toast.success(isFollowing ? 'Unfollowed' : 'Followed');
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to follow/unfollow user');
    }
  };

  const VoiceSpaceCard = ({ space }: { space: VoiceSpace }) => (
    <div className="thutha-card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {space.is_live && (
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              <Radio className="w-3 h-3 animate-pulse" /> Live
            </span>
          )}
          <span className="text-[12px] font-medium text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">{space.topic || 'General'}</span>
        </div>
        <div className="flex items-center gap-1 text-[13px] text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{formatNumber(space.listener_count)}</span>
        </div>
      </div>

      <h3 className="font-heading font-bold text-[15px] text-foreground leading-snug line-clamp-2">{space.title}</h3>

      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {space.participants?.filter(p => p.role === 'speaker' || p.role === 'host').slice(0, 3).map(speaker => (
            <Avatar key={speaker.id} className="w-7 h-7 border-2 border-card">
              <AvatarImage src={speaker.avatar_url} alt={speaker.username} />
              <AvatarFallback className="text-[10px]">{speaker.username?.[0]}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <p className="text-[13px] text-muted-foreground truncate">
          <span className="font-medium text-foreground">{space.host_username}</span>
        </p>
      </div>

      <button
        onClick={() => joinSpace(space.id)}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[14px] font-semibold transition-all ${
          space.is_live ? 'thutha-gradient text-primary-foreground shadow-md hover:opacity-90' : 'bg-muted text-muted-foreground hover:bg-muted/80'
        }`}
      >
        <Mic className="w-4 h-4" />
        {space.is_live ? 'Join Space' : 'Set Reminder'}
      </button>
    </div>
  );

  const UserResult = ({ user: searchUser }: { user: SearchUser }) => {
    const [isFollowing, setIsFollowing] = useState(searchUser.is_following);
    
    return (
      <div className="flex items-center gap-3 py-3">
        <img src={searchUser.avatar_url} alt={searchUser.username} className="w-11 h-11 rounded-full object-cover flex-shrink-0 ring-2 ring-border" />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-foreground truncate">{searchUser.full_name || searchUser.username}</p>
          <p className="text-[13px] text-muted-foreground truncate">@{searchUser.username} · {formatNumber(searchUser.followers)} followers</p>
        </div>
        <button
          onClick={() => {
            followUser(searchUser.id, isFollowing);
            setIsFollowing(!isFollowing);
          }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all flex-shrink-0 ${
            isFollowing ? 'bg-muted text-muted-foreground' : 'thutha-gradient text-primary-foreground'
          }`}
        >
          {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      </div>
    );
  };

  const VoiceSpaceRoom = () => {
    if (!activeSpace) return null;
    
    const isHost = activeSpace.participant_role === 'host';
    const speakers = activeSpace.participants?.filter(p => p.role === 'speaker' || p.role === 'host') || [];
    const listeners = activeSpace.participants?.filter(p => p.role === 'listener') || [];
    const host = activeSpace.participants?.find(p => p.role === 'host');

    return (
      <div className="thutha-card overflow-hidden">
        <div className="thutha-gradient p-5 text-primary-foreground">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> Live Now
            </span>
            <div className="flex gap-2">
              {isHost && (
                <button onClick={endSpace} className="px-3.5 py-1.5 rounded-full bg-red-500/20 text-red-500 text-[13px] font-semibold hover:bg-red-500/30 transition-colors">
                  End Space
                </button>
              )}
              <button onClick={leaveSpace} className="px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur text-[13px] font-semibold hover:bg-white/30 transition-colors">
                Leave
              </button>
            </div>
          </div>
          <h3 className="font-heading font-bold text-lg leading-snug">{activeSpace.title}</h3>
          <p className="text-white/70 text-[13px] mt-1">{activeSpace.topic || 'General'} · {activeSpace.listener_count} listening</p>
        </div>

        <div className="p-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Host */}
          <div>
            <p className="text-[12px] text-muted-foreground font-semibold uppercase tracking-wider mb-3">🎙 Host</p>
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={host?.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover ring-3 ring-primary" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                  <Crown className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-[15px] text-foreground">{host?.full_name || host?.username}</p>
                <p className="text-[13px] text-muted-foreground">@{host?.username}</p>
              </div>
              <SupportTokenButton postId={activeSpace.id} username={host?.username || ''} />
            </div>
          </div>

          {/* Speakers */}
          {speakers.filter(s => s.role !== 'host').length > 0 && (
            <div>
              <p className="text-[12px] text-muted-foreground font-semibold uppercase tracking-wider mb-3">🗣 Speakers</p>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
                {speakers.filter(s => s.role !== 'host').map(speaker => (
                  <div key={speaker.id} className="flex flex-col items-center gap-1.5">
                    <div className="relative">
                      <img src={speaker.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover ring-2 ring-border" />
                      {speaker.is_muted && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
                          <MicOff className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-[12px] text-foreground font-medium truncate w-full text-center">{speaker.username?.split('_')[0]}</p>
                    {isHost && (
                      <button
                        onClick={() => approveSpeaker(speaker.id)}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Make speaker
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hand Raises (Host Only) */}
          {isHost && participants.filter(p => p.hasHandRaised && p.role !== 'host').length > 0 && (
            <div>
              <p className="text-[12px] text-muted-foreground font-semibold uppercase tracking-wider mb-3">🙋 Hand Raises</p>
              <div className="space-y-2">
                {participants.filter(p => p.hasHandRaised && p.role !== 'host').map(participant => (
                  <div key={participant.userId} className="flex items-center justify-between p-2 bg-warning/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <img src={participant.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      <span className="text-sm text-foreground">{participant.fullName || participant.username}</span>
                    </div>
                    <button
                      onClick={() => approveSpeaker(participant.userId)}
                      className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                    >
                      Approve
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Listeners */}
          {listeners.length > 0 && (
            <div>
              <p className="text-[12px] text-muted-foreground font-semibold uppercase tracking-wider mb-3">👂 Listeners ({listeners.length})</p>
              <div className="flex flex-wrap gap-2">
                {listeners.slice(0, 20).map(listener => (
                  <div key={listener.id} className="relative group">
                    <img src={listener.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover opacity-70 ring-1 ring-border" />
                    {listener.has_hand_raised && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-warning rounded-full animate-pulse" />
                    )}
                  </div>
                ))}
                {listeners.length > 20 && (
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-[11px] text-muted-foreground font-semibold">
                    +{listeners.length - 20}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div>
            <p className="text-[12px] text-muted-foreground font-semibold uppercase tracking-wider mb-3">💬 Chat</p>
            <div className="space-y-2 max-h-48 overflow-y-auto bg-muted/20 rounded-xl p-3">
              {messages.map((msg, idx) => (
                <div key={idx} className="text-sm">
                  <span className="font-semibold text-primary">@{msg.username}</span>
                  <span className="text-foreground ml-2">{msg.message}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Send a message..."
                  className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button onClick={sendMessage} className="px-4 py-2 rounded-xl thutha-gradient text-primary-foreground text-sm font-semibold">
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 pt-3 border-t border-border">
            <button
              onClick={toggleMute}
              className={`p-3.5 rounded-full transition-all ${muted ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}
            >
              {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={raiseHand}
              className={`p-3.5 rounded-full transition-all ${handRaised ? 'bg-warning/20 text-warning animate-pulse' : 'bg-muted text-muted-foreground'}`}
            >
              <Hand className="w-5 h-5" />
            </button>
            <button className="p-3.5 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <DollarSign className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-4 space-y-4 px-3 sm:px-4 md:px-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="font-heading font-bold text-xl text-foreground flex-1">🗣 Rũgano</h2>
        <button
          onClick={() => setShowCreateSpace(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full thutha-gradient text-primary-foreground text-[13px] font-semibold shadow-md hover:opacity-90 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Start Space</span>
        </button>
        <button onClick={() => setSearchOpen(!searchOpen)} className="p-2.5 rounded-full hover:bg-muted transition-colors text-muted-foreground">
          <Search className="w-5 h-5" />
        </button>
      </div>

      {/* Create Space Modal */}
      {showCreateSpace && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm px-4 pb-4">
          <div className="thutha-card w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="thutha-gradient p-5 text-primary-foreground">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-bold text-lg">Start a Voice Space</h3>
                <button onClick={() => setShowCreateSpace(false)} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-white/70 text-[13px] mt-1">Go live and invite others to join your conversation</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Space Title</label>
                <input
                  value={newSpaceTitle}
                  onChange={e => setNewSpaceTitle(e.target.value)}
                  placeholder="What do you want to talk about?"
                  className="w-full bg-muted rounded-xl px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-[13px] font-semibold text-foreground mb-1.5 block">Topic</label>
                <input
                  value={newSpaceTopic}
                  onChange={e => setNewSpaceTopic(e.target.value)}
                  placeholder="e.g. Music, Culture, Tech..."
                  className="w-full bg-muted rounded-xl px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  {newSpacePrivate ? <Lock className="w-4 h-4 text-muted-foreground" /> : <Globe className="w-4 h-4 text-primary" />}
                  <span className="text-[14px] text-foreground font-medium">{newSpacePrivate ? 'Private Space' : 'Public Space'}</span>
                </div>
                <button
                  onClick={() => setNewSpacePrivate(!newSpacePrivate)}
                  className={`w-11 h-6 rounded-full transition-all relative ${newSpacePrivate ? 'bg-muted' : 'thutha-gradient'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all ${newSpacePrivate ? 'left-0.5' : 'left-[22px]'}`} />
                </button>
              </div>
              <button
                onClick={createSpace}
                disabled={!newSpaceTitle.trim()}
                className="w-full py-3 rounded-xl thutha-gradient text-primary-foreground font-semibold text-[15px] shadow-md hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4" />
                Go Live
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search overlay */}
      {searchOpen && (
        <div className="thutha-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search users, hashtags, spaces..."
                autoFocus
                className="w-full bg-muted rounded-xl pl-10 pr-4 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {searchQuery.length === 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-semibold uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" /> Recent Searches
              </div>
              <div className="flex flex-wrap gap-2">
                {['#Tech', 'Music', '#Culture'].map(term => (
                  <button key={term} onClick={() => setSearchQuery(term)} className="bg-muted px-3 py-1.5 rounded-full text-[13px] text-foreground hover:bg-muted/80 transition-colors">
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {suggestedUsers.length > 0 && (
                <div>
                  <p className="text-[12px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Users</p>
                  {suggestedUsers.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5).map(user => (
                    <UserResult key={user.id} user={user} />
                  ))}
                </div>
              )}
              {trendingTopics.filter(t => t.tag.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 && (
                <div>
                  <p className="text-[12px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Hashtags</p>
                  {trendingTopics.filter(t => t.tag.toLowerCase().includes(searchQuery.toLowerCase())).map(topic => (
                    <div key={topic.id} className="flex items-center gap-2 py-2.5">
                      <Hash className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="text-[15px] font-medium text-foreground truncate">{topic.tag}</span>
                      <span className="text-[13px] text-muted-foreground ml-auto flex-shrink-0">{formatNumber(topic.posts)} posts</span>
                    </div>
                  ))}
                </div>
              )}
              {suggestedUsers.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && 
               trendingTopics.filter(t => t.tag.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <p className="text-[15px] text-muted-foreground text-center py-6">No results found</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Active Voice Space Room */}
      {activeSpace && <VoiceSpaceRoom />}

      {/* Tabs */}
      {!activeSpace && (
        <>
          <div className="flex bg-muted rounded-xl p-1 gap-1">
            {([
              { key: 'spaces' as const, label: '🎙 Spaces' },
              { key: 'trending' as const, label: '🔥 Trending' },
              { key: 'posts' as const, label: '📝 Posts' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2.5 rounded-lg text-[14px] font-semibold text-center transition-all ${
                  activeTab === tab.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'spaces' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Live Now</h3>
                {liveSpaces.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No live spaces at the moment</p>
                ) : (
                  liveSpaces.map(space => <VoiceSpaceCard key={space.id} space={space} />)
                )}
              </div>
              {upcomingSpaces.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Upcoming</h3>
                  {upcomingSpaces.map(space => <VoiceSpaceCard key={space.id} space={space} />)}
                </div>
              )}
            </div>
          )}

          {activeTab === 'trending' && (
            <div className="space-y-3">
              <div className="thutha-card p-4 space-y-1">
                <h4 className="text-[15px] font-semibold text-foreground mb-2">Suggested for you</h4>
                {suggestedUsers.slice(0, 5).map(user => (
                  <UserResult key={user.id} user={user} />
                ))}
              </div>

              <div className="thutha-card p-4">
                <h4 className="text-[15px] font-semibold text-foreground mb-3">Trending Topics</h4>
                <div className="space-y-1">
                  {trendingTopics.slice(0, 10).map((topic, i) => (
                    <div key={topic.id} className="flex items-center gap-3 py-2.5 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors">
                      <span className="text-[15px] font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-primary truncate">{topic.tag}</p>
                        <p className="text-[13px] text-muted-foreground">{formatNumber(topic.posts)} posts</p>
                      </div>
                      <TrendingUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'posts' && (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground py-8">Posts feed coming soon</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Rugano;
