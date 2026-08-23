import { useState, useEffect } from 'react';
import { useNavigate } from '@/lib/navigation';
import { 
  ArrowDownLeft, ArrowUpRight, X, CheckCircle, Wallet as WalletIcon, 
  TrendingUp, Clock, Plus, Send, Smartphone, CreditCard, Building, 
  Loader2, History, AlertCircle, Coins 
} from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import { toast } from 'sonner';
import axiosInstance from '@/utils/axiosConfig';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  token_amount: number;
  balance_before: number;
  balance_after: number;
  status: string;
  created_at: string;
  reference_type?: string;
  metadata?: any;
}

interface Withdrawal {
  id: string;
  amount: number;
  token_amount: number;
  method: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected' | 'cancelled';
  created_at: string;
  approved_at?: string;
  completed_at?: string;
  transaction_reference?: string;
  rejection_reason?: string;
}

interface TokenPackage {
  id: string;
  name: string;
  description: string;
  token_amount: number;
  price_kes: number;
  bonus_percentage: number;
  bonus_tokens: number;
  total_tokens: number;
  is_popular: boolean;
}

const Wallet = () => {
  const navigate = useNavigate();
  const { user, fetchUser } = useUserStore();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [withdrawMethod, setWithdrawMethod] = useState<'mpesa' | 'bank'>('mpesa');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [fundPhone, setFundPhone] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'in' | 'out'>('all');
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [tokenPackages, setTokenPackages] = useState<TokenPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<TokenPackage | null>(null);
  const [stats, setStats] = useState({
    balance: 0,
    total_earned: 0,
    total_purchased: 0,
    total_tips_sent: 0,
    total_tips_received: 0,
    pending_withdrawals: 0
  });

  // Bank account details
  const [bankDetails, setBankDetails] = useState({
    accountName: '',
    accountNumber: '',
    bankName: '',
    branchCode: ''
  });

  // Fetch wallet data
  useEffect(() => {
    fetchWalletData();
    fetchTokenPackages();
  }, []);

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      // Fetch user's token balance
      await fetchUser();
      
      // Fetch transactions
      const txResponse = await axiosInstance.get('/token/transactions?limit=50');
      const transactionsData = txResponse.data.data.transactions || [];
      setTransactions(transactionsData);
      
      // Fetch withdrawals
      const withdrawalResponse = await axiosInstance.get('/wallet/withdrawals?limit=50');
      const withdrawalsData = withdrawalResponse.data.data.withdrawals || [];
      setWithdrawals(withdrawalsData);
      
      // Fetch token stats
      const statsResponse = await axiosInstance.get('/token/stats');
      const tokenStats = statsResponse.data.data.stats || {};
      
      // Calculate stats from transactions
      const totalEarned = transactionsData
        .filter((tx: Transaction) => tx.type === 'tip_received')
        .reduce((sum: number, tx: Transaction) => sum + tx.token_amount, 0);
      
      const totalTipsSent = transactionsData
        .filter((tx: Transaction) => tx.type === 'tip_sent')
        .reduce((sum: number, tx: Transaction) => sum + tx.token_amount, 0);
      
      const totalPurchased = transactionsData
        .filter((tx: Transaction) => tx.type === 'purchase')
        .reduce((sum: number, tx: Transaction) => sum + tx.token_amount, 0);
      
      const pendingWithdrawals = withdrawalsData
        .filter((w: Withdrawal) => w.status === 'pending')
        .reduce((sum: number, w: Withdrawal) => sum + w.token_amount, 0);
      
      setStats({
        balance: user?.token_balance || 0,
        total_earned: tokenStats.total_tips_received || totalEarned,
        total_purchased: tokenStats.total_purchased || totalPurchased,
        total_tips_sent: tokenStats.total_tips_sent || totalTipsSent,
        total_tips_received: tokenStats.total_tips_received || totalEarned,
        pending_withdrawals: pendingWithdrawals
      });
      
    } catch (error: any) {
      console.error('Error fetching wallet data:', error);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to load wallet data');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTokenPackages = async () => {
    try {
      const response = await axiosInstance.get('/token/packages');
      setTokenPackages(response.data.data.packages || []);
    } catch (error) {
      console.error('Error fetching token packages:', error);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount);
    
    if (!amount || amount < 500) {
      toast.error('Minimum withdrawal is 500 tokens');
      return;
    }
    
    if (amount > (user?.token_balance || 0)) {
      toast.error('Insufficient token balance');
      return;
    }
    
    let accountDetails = {};
    
    if (withdrawMethod === 'mpesa') {
      if (!fundPhone) {
        toast.error('Please enter your M-Pesa phone number');
        return;
      }
      accountDetails = { phoneNumber: fundPhone };
    } else {
      if (!bankDetails.accountName || !bankDetails.accountNumber || !bankDetails.bankName) {
        toast.error('Please fill in all bank details');
        return;
      }
      accountDetails = bankDetails;
    }
    
    setShowWithdraw(false);
    const toastId = toast.loading('Processing withdrawal request...');
    
    try {
      const response = await axiosInstance.post('/wallet/withdrawals', {
        amount: amount,
        method: withdrawMethod,
        accountDetails: accountDetails
      });
      
      if (response.data.status === 'success') {
        toast.success('Withdrawal request submitted successfully!', { id: toastId });
        setSuccessMessage('Withdrawal Request Submitted!');
        setShowSuccess(true);
        setWithdrawAmount('');
        setFundPhone('');
        setBankDetails({ accountName: '', accountNumber: '', bankName: '', branchCode: '' });
        await fetchWalletData();
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error: any) {
      console.error('Error requesting withdrawal:', error);
      toast.error(error.response?.data?.message || 'Failed to submit withdrawal request', { id: toastId });
    }
  };

  const handlePurchaseTokens = async (pkg: TokenPackage) => {
    if (!fundPhone) {
      toast.error('Please enter your M-Pesa phone number');
      return;
    }
    
    setShowAddFunds(false);
    const toastId = toast.loading('Initiating M-Pesa payment...');
    
    try {
      const response = await axiosInstance.post('/token/purchase', {
        packageId: pkg.id,
        phoneNumber: fundPhone
      });
      
      if (response.data.status === 'success') {
        toast.success('STK Push sent! Check your phone for M-Pesa prompt.', { id: toastId });
        setSuccessMessage('Payment Initiated!');
        setShowSuccess(true);
        setFundPhone('');
        setSelectedPackage(null);
        setTimeout(() => setShowSuccess(false), 3000);
        
        // Poll for payment status
        const checkInterval = setInterval(async () => {
          try {
            const statusRes = await axiosInstance.get(`/token/transactions/${response.data.data.transaction.id}`);
            if (statusRes.data.data.transaction.status === 'completed') {
              clearInterval(checkInterval);
              await fetchWalletData();
              toast.success('Tokens added to your wallet!');
            }
          } catch (error) {
            console.error('Error checking payment status:', error);
          }
        }, 5000);
        
        // Stop polling after 2 minutes
        setTimeout(() => clearInterval(checkInterval), 120000);
      }
    } catch (error: any) {
      console.error('Error initiating payment:', error);
      toast.error(error.response?.data?.message || 'Failed to initiate payment', { id: toastId });
    }
  };

  const cancelWithdrawal = async (withdrawalId: string) => {
    const toastId = toast.loading('Cancelling withdrawal...');
    
    try {
      const response = await axiosInstance.post(`/wallet/withdrawals/${withdrawalId}/cancel`);
      
      if (response.data.status === 'success') {
        toast.success('Withdrawal cancelled successfully', { id: toastId });
        await fetchWalletData();
      }
    } catch (error: any) {
      console.error('Error cancelling withdrawal:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel withdrawal', { id: toastId });
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase': return <Plus className="w-5 h-5" />;
      case 'tip_sent': return <Send className="w-5 h-5" />;
      case 'tip_received': return <ArrowDownLeft className="w-5 h-5" />;
      case 'withdrawal': return <ArrowUpRight className="w-5 h-5" />;
      default: return <Coins className="w-5 h-5" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase': return 'bg-primary/10 text-primary';
      case 'tip_sent': return 'bg-warning/10 text-warning';
      case 'tip_received': return 'bg-success/10 text-success';
      case 'withdrawal': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getAmountColor = (type: string) => {
    switch (type) {
      case 'tip_sent':
      case 'withdrawal':
        return 'text-destructive';
      case 'purchase':
      case 'tip_received':
        return 'text-success';
      default:
        return 'text-foreground';
    }
  };

  const getAmountPrefix = (type: string) => {
    switch (type) {
      case 'tip_sent':
      case 'withdrawal':
        return '-';
      case 'purchase':
      case 'tip_received':
        return '+';
      default:
        return '';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success/10 text-success';
      case 'pending': return 'bg-warning/10 text-warning';
      case 'approved': return 'bg-primary/10 text-primary';
      case 'processing': return 'bg-info/10 text-info';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const quickAmounts = [500, 1000, 2500, 5000];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Combine transactions and withdrawals for display
  const allTransactions = [
    ...transactions.map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.token_amount,
      status: tx.status,
      date: tx.created_at,
      reference: tx.reference_type,
      balance_before: tx.balance_before,
      balance_after: tx.balance_after
    })),
    ...withdrawals.map(w => ({
      id: w.id,
      type: 'withdrawal',
      amount: w.token_amount,
      status: w.status,
      date: w.created_at,
      reference: w.method
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredTx = allTransactions.filter(tx => {
    if (activeTab === 'in') return ['purchase', 'tip_received'].includes(tx.type);
    if (activeTab === 'out') return ['tip_sent', 'withdrawal'].includes(tx.type);
    return true;
  });

  return (
    <div className="py-4 px-4 md:px-0 space-y-5 max-w-lg mx-auto">
      {/* Hero Balance Card */}
      <div className="relative overflow-hidden rounded-3xl p-6 shadow-xl thutha-gradient">
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-primary-foreground/10 -translate-y-10 translate-x-10" />
        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-primary-foreground/5 translate-y-8 -translate-x-8" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <WalletIcon className="w-4 h-4 text-primary-foreground/70" />
            <p className="text-sm text-primary-foreground/70 font-medium">Token Balance</p>
          </div>
          <p className="text-4xl font-heading font-bold text-primary-foreground tracking-tight">
            {stats.balance.toLocaleString()}<span className="text-2xl text-primary-foreground/60"> tokens</span>
          </p>
          <p className="text-sm text-primary-foreground/70 mt-1">
            ≈ KES {(stats.balance * 0.5).toLocaleString()}
          </p>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setShowAddFunds(true)}
              className="flex items-center gap-2 bg-primary-foreground text-primary px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-foreground/90 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" />
              Buy Tokens
            </button>
            <button
              onClick={() => setShowWithdraw(true)}
              disabled={stats.balance < 500}
              className="flex items-center gap-2 bg-primary-foreground/15 backdrop-blur text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-foreground/25 transition-all border border-primary-foreground/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Withdraw
            </button>
          </div>
          {stats.balance < 500 && (
            <p className="text-xs text-primary-foreground/60 mt-3">
              Minimum withdrawal: 500 tokens
            </p>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="thutha-card p-3.5 space-y-1.5">
          <TrendingUp className="w-5 h-5 text-success" />
          <p className="text-[13px] font-heading font-bold text-foreground">{stats.total_earned.toLocaleString()} tokens</p>
          <p className="text-[11px] text-muted-foreground">Total Earned</p>
        </div>
        <div className="thutha-card p-3.5 space-y-1.5">
          <Clock className="w-5 h-5 text-warning" />
          <p className="text-[13px] font-heading font-bold text-foreground">{stats.pending_withdrawals.toLocaleString()} tokens</p>
          <p className="text-[11px] text-muted-foreground">Pending Withdrawals</p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="thutha-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-heading font-bold text-foreground text-base">Transaction History</h3>
          {/* Tabs */}
          <div className="flex gap-1 mt-3 bg-muted rounded-xl p-1">
            {([
              { key: 'all' as const, label: 'All' },
              { key: 'in' as const, label: 'Income' },
              { key: 'out' as const, label: 'Withdrawals' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
          {filteredTx.length === 0 ? (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No transactions yet</p>
            </div>
          ) : (
            filteredTx.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getTransactionColor(tx.type)}`}>
                  {getTransactionIcon(tx.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {tx.type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[12px] text-muted-foreground">{formatDate(tx.date)}</p>
                  {tx.reference && (
                    <span className="text-[10px] text-muted-foreground capitalize">{tx.reference}</span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${getAmountColor(tx.type)}`}>
                    {getAmountPrefix(tx.type)}{tx.amount.toLocaleString()} tokens
                  </p>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${getStatusColor(tx.status)}`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Withdraw Modal */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setShowWithdraw(false)}>
          <div className="bg-card w-full max-w-sm rounded-t-3xl md:rounded-2xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-heading font-bold text-lg text-foreground">Withdraw Tokens</h3>
              <button onClick={() => setShowWithdraw(false)} className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-muted rounded-xl">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold text-foreground">{stats.balance.toLocaleString()} tokens</p>
              <p className="text-xs text-muted-foreground">≈ KES {(stats.balance * 0.5).toLocaleString()}</p>
            </div>

            <div className="flex gap-2 mb-5">
              {(['mpesa', 'bank'] as const).map(method => (
                <button
                  key={method}
                  onClick={() => setWithdrawMethod(method)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    withdrawMethod === method
                      ? 'thutha-gradient text-primary-foreground shadow-md'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {method === 'mpesa' ? 'M-Pesa' : 'Bank Transfer'}
                </button>
              ))}
            </div>

            {/* Quick Amounts */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {quickAmounts.map(amt => (
                <button
                  key={amt}
                  onClick={() => setWithdrawAmount(String(amt))}
                  className={`py-2 rounded-xl text-[13px] font-semibold transition-all ${
                    withdrawAmount === String(amt)
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {amt.toLocaleString()}
                </button>
              ))}
            </div>

            <input
              type="number"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="Enter amount (tokens)"
              className="w-full bg-muted rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4 text-base"
            />

            {withdrawMethod === 'mpesa' ? (
              <input
                value={fundPhone}
                onChange={e => setFundPhone(e.target.value)}
                placeholder="M-Pesa phone (e.g., 0712345678)"
                className="w-full bg-muted rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4 text-base"
              />
            ) : (
              <div className="space-y-3 mb-4">
                <input
                  value={bankDetails.accountName}
                  onChange={e => setBankDetails({ ...bankDetails, accountName: e.target.value })}
                  placeholder="Account holder name"
                  className="w-full bg-muted rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-base"
                />
                <input
                  value={bankDetails.accountNumber}
                  onChange={e => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                  placeholder="Account number"
                  className="w-full bg-muted rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-base"
                />
                <input
                  value={bankDetails.bankName}
                  onChange={e => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                  placeholder="Bank name"
                  className="w-full bg-muted rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-base"
                />
                <input
                  value={bankDetails.branchCode}
                  onChange={e => setBankDetails({ ...bankDetails, branchCode: e.target.value })}
                  placeholder="Branch code (optional)"
                  className="w-full bg-muted rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-base"
                />
              </div>
            )}

            <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted/50 rounded-xl">
              <p className="font-medium mb-1">Withdrawal Info:</p>
              <p className="text-xs">• Processing time: 1-3 business days</p>
              <p className="text-xs">• Minimum withdrawal: 500 tokens</p>
              <p className="text-xs">• Withdrawal fee: 5% (min 10 KES)</p>
            </div>

            <button
              onClick={handleWithdraw}
              disabled={!withdrawAmount || parseInt(withdrawAmount) < 500 || parseInt(withdrawAmount) > stats.balance}
              className="w-full thutha-gradient text-primary-foreground font-semibold py-3.5 rounded-xl shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-base"
            >
              Request Withdrawal
            </button>
          </div>
        </div>
      )}

      {/* Add Funds Modal */}
      {showAddFunds && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setShowAddFunds(false)}>
          <div className="bg-card w-full max-w-sm rounded-t-3xl md:rounded-2xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-heading font-bold text-lg text-foreground">Buy Tokens</h3>
              <button onClick={() => setShowAddFunds(false)} className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center mb-4 p-3 bg-muted rounded-xl">
              <p className="text-sm text-muted-foreground">Exchange Rate</p>
              <p className="text-xl font-bold text-foreground">1 Token = KES 0.50</p>
            </div>

            {/* Token Packages */}
            <div className="space-y-3 mb-4">
              {tokenPackages.map(pkg => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`w-full p-4 rounded-xl transition-all ${
                    selectedPackage?.id === pkg.id
                      ? 'bg-primary/10 border-2 border-primary'
                      : 'bg-muted border-2 border-transparent hover:border-primary/30'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-foreground">{pkg.name}</span>
                    {pkg.is_popular && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Popular</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-2xl font-bold text-primary">KES {pkg.price_kes.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">{pkg.token_amount.toLocaleString()} tokens</p>
                    </div>
                    {pkg.bonus_percentage > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-success">+{pkg.bonus_percentage}% bonus</p>
                        <p className="text-xs text-muted-foreground">{pkg.bonus_tokens.toLocaleString()} free</p>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <input
              value={fundPhone}
              onChange={e => setFundPhone(e.target.value)}
              placeholder="M-Pesa phone number"
              className="w-full bg-muted rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4 text-base"
            />

            <button
              onClick={() => selectedPackage && handlePurchaseTokens(selectedPackage)}
              disabled={!selectedPackage || !fundPhone}
              className="w-full thutha-gradient text-primary-foreground font-semibold py-3.5 rounded-xl shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 text-base"
            >
              Pay KES {selectedPackage?.price_kes.toLocaleString() || '0'}
            </button>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-card rounded-2xl p-8 text-center animate-scale-in shadow-xl max-w-xs mx-4">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h3 className="font-heading font-bold text-lg text-foreground">{successMessage}</h3>
            <p className="text-sm text-muted-foreground mt-1">Processing your request</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;