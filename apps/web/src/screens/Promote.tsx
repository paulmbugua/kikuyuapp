import { useState, useEffect } from 'react';
import { Image, Video, Send, Eye, MousePointer, BarChart3, Clock, DollarSign, CheckCircle2, XCircle, PauseCircle, TrendingUp, Loader2, CreditCard, Smartphone } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import { toast } from 'sonner';
import axiosInstance from '@/utils/axiosConfig';

const ctaOptions = ['Chat Now', 'Learn More', 'Visit Page', 'Shop Now'] as const;

interface PromotionPlan {
  id: string;
  name: string;
  description: string;
  price_kes: number;
  token_price: number;
  duration_hours: number;
  target_impressions: number;
  features: string[];
  is_popular: boolean;
}

interface Promotion {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'pending' | 'paused' | 'completed';
  impressions: number;
  clicks: number;
  spent: number;
  plan_name: string;
  ends_at: string;
  progress_percentage: number;
}

const Promote = () => {
  const { user, fetchUser } = useUserStore();
  const [tab, setTab] = useState<'create' | 'manage'>('create');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cta, setCta] = useState<typeof ctaOptions[number]>('Chat Now');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Promotion plans
  const [plans, setPlans] = useState<PromotionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PromotionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'tokens' | 'mpesa'>('tokens');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // User promotions
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loadingPromotions, setLoadingPromotions] = useState(false);
  const [stats, setStats] = useState({
    total_impressions: 0,
    total_clicks: 0,
    total_spent: 0,
    active_count: 0
  });

  // Fetch plans and promotions on mount
  useEffect(() => {
    fetchPlans();
    fetchMyPromotions();
  }, []);

  const fetchPlans = async () => {
    setLoadingPlans(true);
    try {
      const response = await axiosInstance.get('/promotion/plans');
      setPlans(response.data.data.plans);
      if (response.data.data.plans.length > 0) {
        setSelectedPlan(response.data.data.plans[0]);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load promotion plans');
    } finally {
      setLoadingPlans(false);
    }
  };

  const fetchMyPromotions = async () => {
    setLoadingPromotions(true);
    try {
      const response = await axiosInstance.get('/promotion/my-promotions?status=all');
      const promoData = response.data.data.promotions;
      setPromotions(promoData);
      
      // Calculate stats
      const totalImpressions = promoData.reduce((sum: number, p: any) => sum + (p.current_impressions || 0), 0);
      const totalClicks = promoData.reduce((sum: number, p: any) => sum + (p.current_clicks || 0), 0);
      const totalSpent = promoData.reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);
      const activeCount = promoData.filter((p: any) => p.is_active && new Date(p.ends_at) > new Date()).length;
      
      setStats({
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        total_spent: totalSpent,
        active_count: activeCount
      });
    } catch (error) {
      console.error('Error fetching promotions:', error);
    } finally {
      setLoadingPromotions(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    const toastId = toast.loading('Uploading media...');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', mediaType);
      
      const response = await axiosInstance.post('/upload/promotion-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast.success('Media uploaded successfully!', { id: toastId });
      return response.data.data.url;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload media', { id: toastId });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title || !description) {
      toast.error('Please fill in title and description');
      return;
    }

    if (!selectedPlan) {
      toast.error('Please select a promotion plan');
      return;
    }

    if (paymentMethod === 'mpesa' && !phoneNumber) {
      toast.error('Please enter your M-Pesa phone number');
      return;
    }

    if (!selectedFile && mediaType) {
      toast.error('Please upload an image or video');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading('Creating promotion...');

    try {
      // Upload media first if exists
      let mediaUrl = '';
      if (selectedFile) {
        mediaUrl = await handleFileUpload(selectedFile);
        if (!mediaUrl) {
          throw new Error('Media upload failed');
        }
      }

      const endpoint = paymentMethod === 'tokens' 
        ? '/promotion/create/tokens' 
        : '/promotion/create/mpesa';
      
      const payload: any = {
        planId: selectedPlan.id,
        content: {
          contentType: 'post',
          contentId: 'temp-' + Date.now(), // You'd replace with actual post ID after creation
          title: title,
          description: description,
          cta_text: cta,
          media_url: mediaUrl,
          media_type: mediaType,
          audience_targeting: {
            age_groups: ['18-24', '25-34', '35-44'],
            regions: ['Nairobi', 'Mombasa', 'Kisumu']
          }
        }
      };

      if (paymentMethod === 'mpesa') {
        payload.phoneNumber = phoneNumber;
      }

      const response = await axiosInstance.post(endpoint, payload);

      toast.success('Promotion created successfully!', { id: toastId });
      
      // Reset form
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      setPhoneNumber('');
      
      // Refresh promotions list
      await fetchMyPromotions();
      
      // Switch to manage tab
      setTab('manage');
      
    } catch (error: any) {
      console.error('Error creating promotion:', error);
      toast.error(error.response?.data?.message || 'Failed to create promotion', { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPromotion = async (promotionId: string) => {
    const toastId = toast.loading('Cancelling promotion...');
    
    try {
      await axiosInstance.delete(`/promotion/${promotionId}/cancel`);
      toast.success('Promotion cancelled successfully', { id: toastId });
      await fetchMyPromotions();
    } catch (error: any) {
      console.error('Error cancelling promotion:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel promotion', { id: toastId });
    }
  };

  const getStatusColor = (status: string, endsAt: string) => {
    if (status === 'active') {
      return new Date(endsAt) > new Date() ? 'text-primary' : 'text-muted-foreground';
    }
    if (status === 'pending') return 'text-warning';
    if (status === 'paused') return 'text-muted-foreground';
    return 'text-muted-foreground';
  };

  const getStatusIcon = (status: string, endsAt: string) => {
    if (status === 'active') {
      return new Date(endsAt) > new Date() ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />;
    }
    if (status === 'pending') return <Clock className="w-3 h-3" />;
    if (status === 'paused') return <PauseCircle className="w-3 h-3" />;
    return <CheckCircle2 className="w-3 h-3" />;
  };

  const getStatusLabel = (status: string, endsAt: string) => {
    if (status === 'active') {
      return new Date(endsAt) > new Date() ? 'Active' : 'Expired';
    }
    if (status === 'pending') return 'Pending';
    if (status === 'paused') return 'Paused';
    return 'Completed';
  };

  if (loadingPlans) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-4 px-3 sm:px-4 md:px-0 space-y-4">
      <h2 className="font-heading font-bold text-xl text-foreground">📢 Promote Your Story</h2>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button 
          onClick={() => setTab('create')} 
          className={`flex-1 py-2.5 text-sm font-semibold text-center relative transition-colors ${
            tab === 'create' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          Create Ad
          {tab === 'create' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />}
        </button>
        <button 
          onClick={() => setTab('manage')} 
          className={`flex-1 py-2.5 text-sm font-semibold text-center relative transition-colors ${
            tab === 'manage' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          Manage Ads ({stats.active_count})
          {tab === 'manage' && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />}
        </button>
      </div>

      {tab === 'create' ? (
        <div className="space-y-4">
          {/* Media upload */}
          <div className="flex gap-2">
            <button 
              onClick={() => setMediaType('image')} 
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                mediaType === 'image' ? 'thutha-gradient text-primary-foreground shadow-md' : 'thutha-card text-muted-foreground'
              }`}
            >
              <Image className="w-4 h-4" /> Image
            </button>
            <button 
              onClick={() => setMediaType('video')} 
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                mediaType === 'video' ? 'thutha-gradient text-primary-foreground shadow-md' : 'thutha-card text-muted-foreground'
              }`}
            >
              <Video className="w-4 h-4" /> Video
            </button>
          </div>

          <label className="thutha-card p-8 border-2 border-dashed border-primary/30 flex flex-col items-center gap-2 cursor-pointer hover:bg-primary/5 transition-colors rounded-2xl">
            {selectedFile ? (
              <>
                {mediaType === 'image' ? (
                  <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-32 h-32 object-cover rounded-lg" />
                ) : (
                  <video src={URL.createObjectURL(selectedFile)} className="w-32 h-32 object-cover rounded-lg" />
                )}
                <button 
                  onClick={(e) => { e.preventDefault(); setSelectedFile(null); }}
                  className="text-sm text-destructive"
                >
                  Remove
                </button>
              </>
            ) : (
              <>
                {mediaType === 'image' ? <Image className="w-8 h-8 text-primary" /> : <Video className="w-8 h-8 text-primary" />}
                <p className="text-sm text-muted-foreground">Tap to upload {mediaType}</p>
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
              </>
            )}
            <input
              type="file"
              accept={mediaType === 'image' ? 'image/*' : 'video/*'}
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>

          {/* Title */}
          <div className="thutha-card p-4 space-y-3">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ad title..."
              className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ad description..."
              className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none min-h-[80px]"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground text-right">{description.length}/200</p>
          </div>

          {/* CTA Selection */}
          <div className="thutha-card p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Call to Action</p>
            <div className="flex flex-wrap gap-2">
              {ctaOptions.map(option => (
                <button
                  key={option}
                  onClick={() => setCta(option)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    cta === option ? 'thutha-gradient text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Promotion Plans */}
          <div className="thutha-card p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Select Promotion Plan</p>
            <div className="space-y-2">
              {plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`w-full p-3 rounded-xl text-left transition-all ${
                    selectedPlan?.id === plan.id ? 'thutha-gradient text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-xs opacity-90">{plan.description}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] opacity-75">📊 {plan.target_impressions.toLocaleString()} impressions</span>
                        <span className="text-[10px] opacity-75">⏱️ {plan.duration_hours}h</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">KES {plan.price_kes.toLocaleString()}</p>
                      <p className="text-[10px] opacity-75">or {plan.token_price} tokens</p>
                    </div>
                  </div>
                  {plan.is_popular && (
                    <span className="inline-block mt-1 text-[10px] bg-yellow-500/20 px-2 py-0.5 rounded-full">
                      🔥 Popular
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div className="thutha-card p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Payment Method</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentMethod('tokens')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  paymentMethod === 'tokens' ? 'thutha-gradient text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Tokens ({user?.token_balance || 0} available)
              </button>
              <button
                onClick={() => setPaymentMethod('mpesa')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  paymentMethod === 'mpesa' ? 'thutha-gradient text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                M-Pesa
              </button>
            </div>

            {paymentMethod === 'mpesa' && (
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="M-Pesa phone number (e.g., 0712345678)"
                className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            )}
          </div>

          {/* Total Cost */}
          {selectedPlan && (
            <div className="thutha-card p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Cost:</span>
                <span className="text-lg font-bold text-foreground">
                  {paymentMethod === 'tokens' 
                    ? `${selectedPlan.token_price} tokens`
                    : `KES ${selectedPlan.price_kes.toLocaleString()}`
                  }
                </span>
              </div>
            </div>
          )}

          {/* Preview */}
          <button onClick={() => setShowPreview(true)} className="w-full thutha-card p-3 text-center text-sm font-medium text-primary hover:bg-muted transition-colors">
            <Eye className="w-4 h-4 inline mr-2" /> Preview Ad
          </button>

          {/* Submit */}
          <button 
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="w-full thutha-gradient text-primary-foreground font-heading font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting || uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            {submitting ? 'Creating...' : uploading ? 'Uploading...' : 'Submit for Review'}
          </button>

          {/* Preview modal */}
          {showPreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm" onClick={() => setShowPreview(false)}>
              <div className="bg-card rounded-2xl p-5 max-w-sm w-full mx-4 shadow-xl space-y-3" onClick={e => e.stopPropagation()}>
                <p className="text-xs text-muted-foreground font-medium">AD PREVIEW</p>
                <div className="bg-muted rounded-xl aspect-[4/3] flex items-center justify-center">
                  {selectedFile ? (
                    mediaType === 'image' ? (
                      <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <video src={URL.createObjectURL(selectedFile)} className="w-full h-full object-cover rounded-xl" />
                    )
                  ) : (
                    mediaType === 'image' ? <Image className="w-12 h-12 text-muted-foreground/30" /> : <Video className="w-12 h-12 text-muted-foreground/30" />
                  )}
                </div>
                <h3 className="font-heading font-bold text-foreground">{title || 'Your Ad Title'}</h3>
                <p className="text-sm text-muted-foreground">{description || 'Your ad description will appear here.'}</p>
                <button className="thutha-gradient text-primary-foreground text-sm font-semibold px-6 py-2 rounded-xl">{cta}</button>
                <button onClick={() => setShowPreview(false)} className="w-full text-sm text-muted-foreground hover:text-foreground py-2">Close</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Manage Ads Dashboard */
        <div className="space-y-4">
          {/* Stats overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {[
              { label: 'Active Ads', value: stats.active_count, icon: TrendingUp },
              { label: 'Impressions', value: stats.total_impressions.toLocaleString(), icon: Eye },
              { label: 'Clicks', value: stats.total_clicks.toLocaleString(), icon: MousePointer },
              { label: 'Spent', value: `KES ${stats.total_spent.toLocaleString()}`, icon: DollarSign },
            ].map(stat => (
              <div key={stat.label} className="thutha-card p-3 text-center">
                <stat.icon className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="font-heading font-bold text-foreground text-sm sm:text-base">{stat.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Ads list */}
          {loadingPromotions ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : promotions.length === 0 ? (
            <div className="thutha-card p-8 text-center">
              <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No promotions yet</p>
              <button 
                onClick={() => setTab('create')}
                className="mt-3 text-primary text-sm font-medium hover:underline"
              >
                Create your first ad →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {promotions.map(promo => (
                <div key={promo.id} className="thutha-card p-3 sm:p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{promo.title || promo.plan_name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`flex items-center gap-1 text-[10px] font-medium ${getStatusColor(promo.status, promo.ends_at)}`}>
                          {getStatusIcon(promo.status, promo.ends_at)}
                          {getStatusLabel(promo.status, promo.ends_at)}
                        </span>
                        {promo.progress_percentage > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            • {Math.round(promo.progress_percentage)}% complete
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {promo.status === 'active' && new Date(promo.ends_at) > new Date() && (
                        <button 
                          onClick={() => handleCancelPromotion(promo.id)}
                          className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{promo.impressions?.toLocaleString() || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Impressions</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{promo.clicks?.toLocaleString() || 0}</p>
                      <p className="text-[10px] text-muted-foreground">Clicks</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">KES {(promo.spent || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Spent</p>
                    </div>
                  </div>
                  {promo.progress_percentage > 0 && (
                    <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(promo.progress_percentage, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Promote;