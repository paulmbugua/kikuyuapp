// src/pages/Settings.tsx
import { useState } from 'react';
import { useNavigate } from '@/lib/navigation';
import { User, Shield, Bell, Globe, DollarSign, LogOut, ChevronRight, Megaphone, CheckCircle2, CreditCard, Loader2 } from 'lucide-react';
import DarkModeToggle from '@/components/ui/DarkModeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const settingsSections = [
  { icon: User, label: 'Edit Profile', description: 'Update your name, bio, and avatar', route: '/settings/edit-profile' },
  { icon: Shield, label: 'Account Privacy', description: 'Control who can see your content', route: '/settings/privacy' },
  { icon: CheckCircle2, label: 'Verified Badge', description: 'Get verified — KES 999/mo', route: '/settings/verified' },
  { icon: CreditCard, label: 'Payment Methods', description: 'Manage M-Pesa, cards & bank', route: '/settings/payment' },
  { icon: Megaphone, label: 'Promote & Ads', description: 'Create and manage your ad campaigns', route: '/promote' },
  { icon: Bell, label: 'Notifications', description: 'Manage push and email notifications' },
  { icon: Globe, label: 'Language', description: 'Kikuyu / English' },
  { icon: DollarSign, label: 'Monetization', description: 'Ad revenue and subscription settings' },
];

const Settings = () => {
  const navigate = useNavigate();
  const { logout, user, isLoading: authLoading } = useAuth();
  const [showLogout, setShowLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      // The logout function already handles navigation and toast
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout. Please try again.');
    } finally {
      setIsLoggingOut(false);
      setShowLogout(false);
    }
  };

  return (
    <div className="py-4 px-4 md:px-0 space-y-4 max-w-2xl mx-auto">
      {/* Header with user info */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-xl text-foreground">⚙ Settings</h2>
        {user && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>{user.full_name || user.username}</span>
          </div>
        )}
      </div>

      {/* Settings Sections */}
      <div className="thutha-card divide-y divide-border overflow-hidden">
        {settingsSections.map((section, index) => (
          <button
            key={section.label}
            onClick={section.route ? () => navigate(section.route!) : undefined}
            className={`w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-all duration-300 group
              ${!section.route ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
              <section.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[15px] font-medium text-foreground">{section.label}</p>
              <p className="text-[13px] text-muted-foreground">{section.description}</p>
            </div>
            {section.route && (
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform duration-300" />
            )}
          </button>
        ))}

        {/* Dark mode row with animated toggle */}
        <div className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Globe className="w-5 h-5" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[15px] font-medium text-foreground">Dark Mode</p>
            <p className="text-[13px] text-muted-foreground">Toggle dark mode</p>
          </div>
          <DarkModeToggle />
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={() => setShowLogout(true)}
        disabled={isLoggingOut || authLoading}
        className="w-full thutha-card flex items-center gap-3 p-4 text-destructive hover:bg-destructive/5 transition-all duration-300 group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoggingOut ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
        )}
        <span className="font-medium text-[15px]">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
      </button>

      {/* Version Info */}
      <div className="text-center pt-4">
        <p className="text-xs text-muted-foreground">Thutha v1.0.0</p>
        <p className="text-xs text-muted-foreground mt-1">Voice of Agĩkũyũ</p>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogout && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" 
          onClick={() => setShowLogout(false)}
        >
          <div 
            className="bg-card rounded-2xl p-6 max-w-xs w-full mx-4 animate-scale-in shadow-2xl border border-border/50"
            onClick={e => e.stopPropagation()}
          >
            {/* Animated Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
                <LogOut className="w-8 h-8 text-destructive" />
              </div>
            </div>
            
            <h3 className="font-heading font-bold text-lg text-foreground text-center">Logout?</h3>
            <p className="text-[14px] text-muted-foreground text-center mt-2">
              Are you sure you want to logout from Thutha?
            </p>
            
            {/* User Info in Modal */}
            {user && (
              <div className="mt-3 p-2 bg-muted/30 rounded-lg flex items-center gap-2">
                <img 
                  src={user.avatar_url || '/default-avatar.png'} 
                  alt={user.username}
                  className="w-6 h-6 rounded-full"
                />
                <span className="text-xs text-muted-foreground">@{user.username}</span>
              </div>
            )}
            
            <div className="flex gap-3 mt-5">
              <button 
                onClick={() => setShowLogout(false)} 
                className="flex-1 thutha-card py-2.5 rounded-xl text-[15px] font-medium text-foreground hover:bg-muted transition-all duration-300"
                disabled={isLoggingOut}
              >
                Cancel
              </button>
              <button 
                onClick={handleLogout} 
                disabled={isLoggingOut}
                className="flex-1 bg-destructive text-destructive-foreground py-2.5 rounded-xl text-[15px] font-medium hover:bg-destructive/90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Logging out...
                  </>
                ) : (
                  'Logout'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;