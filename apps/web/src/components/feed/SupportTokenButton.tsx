import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Coins, X, Trophy, TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import axiosInstance from '@/utils/axiosConfig';
import { toast } from 'sonner';

const TOKEN_AMOUNTS = [10, 50, 100, 500];

interface SupportTokenButtonProps {
  postId: string;
  username: string;
  authorId?: string;
}

const SupportTokenButton = ({ postId, username, authorId }: SupportTokenButtonProps) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const { user, fetchUser } = useUserStore();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const fetchUserBalance = async () => {
    setLoadingBalance(true);
    try {
      await fetchUser();
      setUserBalance(user?.token_balance || 0);
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleOpenModal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await fetchUserBalance();
    setShowModal(true);
    document.body.style.overflow = 'hidden';
  };

  const handleCloseModal = () => {
    setShowModal(false);
    document.body.style.overflow = '';
    setTimeout(() => {
      setSelectedAmount(null);
    }, 300);
  };

  const handleSendTip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!selectedAmount) {
      toast.error('Please select an amount');
      return;
    }
    
    if (selectedAmount > userBalance) {
      toast.error(`Insufficient balance. You have ${userBalance} tokens`);
      return;
    }
    
    setSending(true);
    const toastId = toast.loading(`Sending ${selectedAmount} tokens to @${username}...`);
    
    try {
      const response = await axiosInstance.post('/tips', {
        postId: postId,
        amount: selectedAmount
      });
      
      if (response.data.status === 'success') {
        toast.success(`Successfully sent ${selectedAmount} tokens to @${username}!`, { id: toastId });
        await fetchUserBalance();
        
        // Show success in modal
        setTimeout(() => {
          handleCloseModal();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error sending tip:', error);
      toast.error(error.response?.data?.message || 'Failed to send tokens', { id: toastId });
    } finally {
      setSending(false);
    }
  };

  const getAmountColor = (amount: number) => {
    if (selectedAmount === amount) return 'bg-gradient-to-r from-primary to-accent text-white shadow-lg scale-105';
    if (userBalance < amount) return 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed';
    return 'bg-muted text-foreground hover:bg-muted/80';
  };

  const modalContent = showModal ? (
    <div 
      className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={handleCloseModal}
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <div
        className="bg-card w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {sending ? (
          <div className="text-center py-8 px-6 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <h3 className="font-heading font-bold text-xl text-foreground">Sending Tokens...</h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we process your transaction
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-lg text-foreground">
                  Support @{username}
                </h3>
              </div>
              <button 
                onClick={handleCloseModal} 
                className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl p-4 border border-primary/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Your balance</span>
                  </div>
                  {loadingBalance ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : (
                    <span className="text-lg font-bold text-foreground">{userBalance.toLocaleString()} tokens</span>
                  )}
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((userBalance / 1000) * 100, 100)}%` }}
                  />
                </div>
                {userBalance < 50 && (
                  <p className="text-xs text-warning mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Low balance. Buy more tokens to support creators.
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-foreground mb-3">Select tip amount</p>
                <div className="grid grid-cols-4 gap-2">
                  {TOKEN_AMOUNTS.map(amount => (
                    <button
                      key={amount}
                      onClick={() => setSelectedAmount(amount)}
                      disabled={userBalance < amount}
                      className={`py-3 rounded-xl text-sm font-semibold transition-all ${getAmountColor(amount)}`}
                    >
                      {amount}
                    </button>
                  ))}
                </div>
              </div>

              {selectedAmount && (
                <div className="bg-primary/5 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground">You're about to send</p>
                  <p className="text-xl font-bold text-primary">{selectedAmount} tokens</p>
                  <p className="text-xs text-muted-foreground">≈ KES {(selectedAmount * 0.5).toLocaleString()}</p>
                </div>
              )}

              <button
                onClick={handleSendTip}
                disabled={!selectedAmount || sending || selectedAmount > userBalance}
                className="w-full bg-gradient-to-r from-primary to-accent text-white py-3.5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-lg active:scale-[0.98]"
              >
                {!selectedAmount ? 'Select an amount' : `Send ${selectedAmount} Tokens`}
              </button>

              <p className="text-xs text-center text-muted-foreground">
                Tokens will be sent to @{username}'s wallet<br />
                Transaction is final and cannot be reversed
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={handleOpenModal}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors relative z-10"
      >
        <Coins className="w-5 h-5" />
        <span>Support</span>
      </button>
      
      {mounted && createPortal(modalContent, document.body)}
    </>
  );
};

export default SupportTokenButton;
