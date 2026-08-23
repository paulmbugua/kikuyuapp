import { useState, useEffect } from 'react';
import { useNavigate } from '@/lib/navigation';
import { ArrowLeft, Smartphone, Plus, CheckCircle, Trash2, Loader2 } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import { toast } from 'sonner';
import axiosInstance from '@/utils/axiosConfig';

interface PaymentMethod {
  id: string;
  type: string;
  phone_number: string;
  is_default: boolean;
  created_at: string;
}

const PaymentSettings = () => {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [showAdd, setShowAdd] = useState(false);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Fetch saved payment methods
  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/payments/methods');
      setPaymentMethods(response.data.data.methods || []);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      // If endpoint doesn't exist yet, just show empty state
      setPaymentMethods([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMethod = async () => {
    if (!phone.trim()) {
      toast.error('Please enter your M-Pesa phone number');
      return;
    }

    // Validate phone number
    const phoneRegex = /^(0|254|\+254)[71]\d{8}$/;
    if (!phoneRegex.test(phone)) {
      toast.error('Please enter a valid Kenyan phone number (e.g., 0712345678)');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Saving payment method...');

    try {
      const response = await axiosInstance.post('/payments/methods', {
        type: 'mpesa',
        phone_number: phone,
        is_default: paymentMethods.length === 0 // First method becomes default
      });

      toast.success('Payment method added successfully!', { id: toastId });
      setPhone('');
      setShowAdd(false);
      await fetchPaymentMethods();
    } catch (error: any) {
      console.error('Error adding payment method:', error);
      toast.error(error.response?.data?.message || 'Failed to add payment method', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMethod = async (methodId: string) => {
    const toastId = toast.loading('Removing payment method...');
    
    try {
      await axiosInstance.delete(`/payments/methods/${methodId}`);
      toast.success('Payment method removed successfully', { id: toastId });
      await fetchPaymentMethods();
    } catch (error: any) {
      console.error('Error deleting payment method:', error);
      toast.error(error.response?.data?.message || 'Failed to remove payment method', { id: toastId });
    }
  };

  const handleSetDefault = async (methodId: string) => {
    const toastId = toast.loading('Setting default payment method...');
    
    try {
      await axiosInstance.put(`/payments/methods/${methodId}/default`);
      toast.success('Default payment method updated', { id: toastId });
      await fetchPaymentMethods();
    } catch (error: any) {
      console.error('Error setting default method:', error);
      toast.error(error.response?.data?.message || 'Failed to set default method', { id: toastId });
    }
  };

  const formatPhoneNumber = (phone: string) => {
    if (phone.startsWith('254')) {
      return '0' + phone.substring(3);
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-4 px-4 md:px-0 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="font-heading font-bold text-xl text-foreground">Payment Methods</h2>
      </div>

      {/* Saved Methods */}
      {paymentMethods.length > 0 ? (
        <div className="thutha-card divide-y divide-border">
          {paymentMethods.map(method => (
            <div key={method.id} className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-foreground">M-Pesa</p>
                <p className="text-[13px] text-muted-foreground">{formatPhoneNumber(method.phone_number)}</p>
              </div>
              {method.is_default && (
                <span className="text-[11px] font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">
                  Default
                </span>
              )}
              {!method.is_default && (
                <button
                  onClick={() => handleSetDefault(method.id)}
                  className="text-xs text-primary hover:underline"
                >
                  Set Default
                </button>
              )}
              <button
                onClick={() => handleDeleteMethod(method.id)}
                className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="thutha-card p-8 text-center">
          <Smartphone className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No payment methods added yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add your M-Pesa number to make purchases</p>
        </div>
      )}

      {/* Add New Button */}
      <button
        onClick={() => setShowAdd(true)}
        className="w-full thutha-card flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Plus className="w-5 h-5 text-primary" />
        </div>
        <span className="text-[15px] font-medium text-foreground">Add M-Pesa Number</span>
      </button>

      {/* Add Modal */}
      {showAdd && (
        <div 
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-foreground/40 backdrop-blur-sm" 
          onClick={() => setShowAdd(false)}
        >
          <div 
            className="bg-card w-full max-w-sm rounded-t-3xl md:rounded-2xl p-6 animate-slide-up" 
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-heading font-bold text-lg text-foreground mb-4">Add M-Pesa Number</h3>

            <div className="mb-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                Phone Number
              </label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g., 0712345678"
                className="w-full bg-muted rounded-xl px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-2">
                This number will be used for M-Pesa payments
              </p>
            </div>

            <button
              onClick={handleAddMethod}
              disabled={saving}
              className="w-full thutha-gradient text-primary-foreground font-semibold py-3 rounded-xl shadow-lg hover:opacity-90 transition-opacity text-[15px] disabled:opacity-50"
            >
              {saving ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </div>
              ) : (
                'Save Method'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentSettings;
