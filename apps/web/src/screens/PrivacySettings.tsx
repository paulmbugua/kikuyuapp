import { useState } from 'react';
import { useNavigate } from '@/lib/navigation';
import { ArrowLeft, Shield, Eye, MessageCircle, Share2, Lock, Globe, Users, UserCheck } from 'lucide-react';

type Visibility = 'everyone' | 'followers' | 'close_friends';

const PrivacySettings = () => {
  const navigate = useNavigate();
  const [isPrivate, setIsPrivate] = useState(false);
  const [viewPosts, setViewPosts] = useState<Visibility>('everyone');
  const [canComment, setCanComment] = useState<Visibility>('everyone');
  const [canMessage, setCanMessage] = useState<Visibility>('followers');
  const [canShare, setCanShare] = useState<Visibility>('everyone');

  const VisibilitySelector = ({
    label,
    icon: Icon,
    value,
    onChange,
  }: {
    label: string;
    icon: typeof Eye;
    value: Visibility;
    onChange: (v: Visibility) => void;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-[15px] font-medium text-foreground">{label}</span>
      </div>
      <div className="flex gap-2">
        {([
          { val: 'everyone' as const, label: 'Everyone', icon: Globe },
          { val: 'followers' as const, label: 'Followers', icon: Users },
          { val: 'close_friends' as const, label: 'Close Friends', icon: UserCheck },
        ]).map(opt => (
          <button
            key={opt.val}
            onClick={() => onChange(opt.val)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
              value === opt.val
                ? 'thutha-gradient text-primary-foreground shadow-md'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <opt.icon className="w-3.5 h-3.5" />
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="py-4 px-4 md:px-0 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="font-heading font-bold text-xl text-foreground">Privacy Settings</h2>
      </div>

      {/* Account Privacy */}
      <div className="thutha-card p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-medium text-foreground">Private Account</p>
            <p className="text-[13px] text-muted-foreground">Only followers can see your content</p>
          </div>
          <button
            onClick={() => setIsPrivate(!isPrivate)}
            className={`w-12 h-7 rounded-full p-1 transition-colors ${isPrivate ? 'bg-primary' : 'bg-muted'}`}
          >
            <div className={`w-5 h-5 rounded-full bg-card transition-transform shadow-sm ${isPrivate ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content Visibility */}
      <div className="thutha-card p-4 space-y-5">
        <h3 className="font-heading font-semibold text-[15px] text-foreground flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" /> Content Visibility
        </h3>
        <VisibilitySelector label="Who can view my posts" icon={Eye} value={viewPosts} onChange={setViewPosts} />
        <VisibilitySelector label="Who can comment" icon={MessageCircle} value={canComment} onChange={setCanComment} />
        <VisibilitySelector label="Who can message me" icon={MessageCircle} value={canMessage} onChange={setCanMessage} />
        <VisibilitySelector label="Who can share my content" icon={Share2} value={canShare} onChange={setCanShare} />
      </div>

      <button
        onClick={() => navigate(-1)}
        className="w-full thutha-gradient text-primary-foreground font-heading font-semibold py-3.5 rounded-xl shadow-lg hover:opacity-90 transition-opacity text-[15px]"
      >
        Save Changes
      </button>
    </div>
  );
};

export default PrivacySettings;
