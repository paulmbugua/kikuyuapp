import { useState, useEffect } from 'react';
import { useNavigate } from '@/lib/navigation';
import { ArrowLeft, CheckCircle2, Shield, Star, Zap, Crown, Loader2 } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import { toast } from 'sonner';
import axiosInstance from '@/utils/axiosConfig';

interface VerificationPlan {
  id: string;
  name: string;
  price_kes: number;
  token_price: number;
  duration_months: number;
  features: string[];
  is_popular: boolean;
  discount_percentage: number | null;
}

const VerifiedBadge = () => {
  const navigate = useNavigate();
  const { user, fetchUser } = useUserStore();
  const [selectedPlanType, setSelectedPlanType] = useState<'monthly' | 'yearly'>('monthly');
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [plans, setPlans] = useState<VerificationPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [monthlyPlan, setMonthlyPlan] = useState<VerificationPlan | null>(null);
  const [yearlyPlan, setYearlyPlan] = useState<VerificationPlan | null>(null);

  // Fetch plans from API
  useEffect(() => {
    fetchPlans();
    checkVerificationStatus();
  }, []);

  const fetchPlans = async () => {
    setLoadingPlans(true);
    try {
      const response = await axiosInstance.get('/verification/plans');
      const plansData = response.data.data.plans;
      setPlans(plansData);
      
      console.log('All plans from API:', plansData);
      
      // Find the monthly plan (duration_months = 1)
      const monthly = plansData.find((p: VerificationPlan) => p.duration_months === 1);
      // Find the yearly plan (duration_months = 12)
      const yearly = plansData.find((p: VerificationPlan) => p.duration_months === 12);
      
      setMonthlyPlan(monthly);
      setYearlyPlan(yearly);
      
      console.log('Monthly plan:', monthly);
      console.log('Yearly plan:', yearly);
      console.log('Monthly plan ID:', monthly?.id);
      console.log('Yearly plan ID:', yearly?.id);
      
      if (!monthly || !yearly) {
        console.warn('Could not find monthly or yearly plans in:', plansData);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load verification plans');
    } finally {
      setLoadingPlans(false);
    }
  };

  const checkVerificationStatus = async () => {
    setCheckingStatus(true);
    try {
      const response = await axiosInstance.get('/verification/me');
      console.log('Verification status response:', response.data);
      if (response.data.data.verification && response.data.data.verification.id) {
        setVerificationStatus(response.data.data.verification);
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    const toastId = toast.loading('Processing verification purchase...');

    try {
      // Get the selected plan based on duration_months
      const selectedPlan = selectedPlanType === 'monthly' ? monthlyPlan : yearlyPlan;
      
      console.log('Selected plan type:', selectedPlanType);
      console.log('Selected plan object:', selectedPlan);
      
      if (!selectedPlan) {
        throw new Error(`${selectedPlanType} plan not found`);
      }
      
      if (!selectedPlan.id) {
        throw new Error(`${selectedPlanType} plan ID is missing`);
      }

      console.log('Sending planId:', selectedPlan.id);
      console.log('PlanId type:', typeof selectedPlan.id);
      console.log('PlanId is UUID format?', selectedPlan.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));

      const response = await axiosInstance.post('/verification/purchase/tokens', {
        planId: selectedPlan.id
      });

      console.log('Purchase response:', response.data);

      if (response.data.status === 'success') {
        toast.success('Verification purchased successfully!', { id: toastId });
        setShowSuccess(true);
        await fetchUser();
        await checkVerificationStatus();
        
        setTimeout(() => {
          setShowSuccess(false);
          navigate('/profile');
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error purchasing verification:', error);
      console.error('Error response:', error.response?.data);
      
      // Handle specific error messages
      if (error.response?.data?.message) {
        toast.error(error.response.data.message, { id: toastId });
      } else if (error.response?.data?.errors) {
        const errorMsg = error.response.data.errors[0]?.message || 'Validation failed';
        toast.error(errorMsg, { id: toastId });
      } else {
        toast.error('Failed to purchase verification', { id: toastId });
      }
    } finally {
      setLoading(false);
    }
  };

  const getMonthlyPrice = () => monthlyPlan?.price_kes || 500;
  const getYearlyPrice = () => yearlyPlan?.price_kes || 5000;
  const getDiscountPercentage = () => yearlyPlan?.discount_percentage || 17;

  const prices = { 
    monthly: getMonthlyPrice(), 
    yearly: getYearlyPrice() 
  };
  
  const savings = getDiscountPercentage();

  const benefits = [
    { icon: CheckCircle2, title: 'Verified Badge', desc: 'Stand out with a blue checkmark on your profile' },
    { icon: Shield, title: 'Priority Support', desc: 'Get faster help from our support team' },
    { icon: Star, title: 'Boosted Visibility', desc: 'Your posts get priority in feeds and search' },
    { icon: Zap, title: 'Early Access', desc: 'Be first to try new features before everyone' },
    { icon: Crown, title: 'Exclusive Content', desc: 'Access verified-only spaces and features' },
  ];

  if (checkingStatus || loadingPlans) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isAlreadyVerified = verificationStatus && verificationStatus.is_active === true;

  return (
    <div className="py-4 px-4 md:px-0 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="font-heading font-bold text-xl text-foreground">Get Verified</h2>
      </div>

      {/* Hero */}
      <div className="thutha-gradient rounded-2xl p-6 text-center text-primary-foreground">
        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur mx-auto flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
        <h3 className="font-heading font-bold text-xl mb-2">Thutha Verified</h3>
        <p className="text-white/80 text-[15px] leading-relaxed">Join the verified community and unlock exclusive features</p>
      </div>

      {/* Already Verified Alert */}
      {isAlreadyVerified && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <p className="text-sm text-success-foreground">
              You are already verified! Your badge is active until {verificationStatus.expires_at ? new Date(verificationStatus.expires_at).toLocaleDateString() : 'forever'}
            </p>
          </div>
        </div>
      )}

      {/* Plan Toggle */}
      <div className="flex bg-muted rounded-xl p-1 gap-1">
        <button
          onClick={() => setSelectedPlanType('monthly')}
          disabled={isAlreadyVerified}
          className={`flex-1 py-3 rounded-lg text-[15px] font-semibold transition-all ${
            selectedPlanType === 'monthly' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground'
          } ${isAlreadyVerified ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Monthly
        </button>
        <button
          onClick={() => setSelectedPlanType('yearly')}
          disabled={isAlreadyVerified}
          className={`flex-1 py-3 rounded-lg text-[15px] font-semibold transition-all relative ${
            selectedPlanType === 'yearly' 
              ? 'bg-card text-foreground shadow-sm' 
              : 'text-muted-foreground'
          } ${isAlreadyVerified ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Yearly
          <span className="absolute -top-2 right-2 bg-success text-success-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            Save {savings}%
          </span>
        </button>
      </div>

      {/* Price Card */}
      <div className="thutha-card p-5 text-center">
        <p className="text-4xl font-heading font-bold text-foreground">
          KES {prices[selectedPlanType].toLocaleString()}
        </p>
        <p className="text-[15px] text-muted-foreground mt-1">
          {selectedPlanType === 'monthly' ? 'per month' : 'per year'}
        </p>
        {selectedPlanType === 'yearly' && (
          <p className="text-xs text-success mt-2">
            Save KES {(prices.monthly * 12 - prices.yearly).toLocaleString()} per year!
          </p>
        )}
      </div>

      {/* Benefits */}
      <div className="thutha-card divide-y divide-border">
        {benefits.map(b => (
          <div key={b.title} className="flex items-start gap-3 p-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <b.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-foreground">{b.title}</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Subscribe Button */}
      <button
        onClick={handleSubscribe}
        disabled={loading || isAlreadyVerified || !monthlyPlan || !yearlyPlan}
        className="w-full thutha-gradient text-primary-foreground font-heading font-semibold py-4 rounded-xl shadow-lg hover:opacity-90 transition-opacity text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </div>
        ) : isAlreadyVerified ? (
          'Already Verified'
        ) : (
          `Subscribe — KES ${prices[selectedPlanType].toLocaleString()}/${selectedPlanType === 'monthly' ? 'mo' : 'yr'}`
        )}
      </button>

      {/* Info Text */}
      <p className="text-center text-xs text-muted-foreground">
        By subscribing, you agree to our Terms of Service and Privacy Policy.
        Verification is non-refundable and subject to our verification guidelines.
      </p>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-card rounded-2xl p-8 text-center animate-scale-in shadow-xl max-w-xs mx-4">
            <div className="w-14 h-14 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h3 className="font-heading font-bold text-lg text-foreground">You're Verified! 🎉</h3>
            <p className="text-[14px] text-muted-foreground mt-1">Your badge is now active</p>
            <p className="text-xs text-muted-foreground mt-3">Redirecting to profile...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerifiedBadge;