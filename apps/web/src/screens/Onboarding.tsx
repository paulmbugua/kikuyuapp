import { useState } from 'react';
import { useNavigate } from '@/lib/navigation';
import { format } from 'date-fns';
import { User, Sparkles, Cake } from 'lucide-react';
const doveLogo = '/dove-logo.png';
import ScrollWheelDatePicker from '@/components/ui/ScrollWheelPicker';

const Onboarding = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState<Date>();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (step === 1) {
      const trimmed = username.trim();
      if (!trimmed) { setError('Please enter a username'); return; }
      if (trimmed.length < 3) { setError('Username must be at least 3 characters'); return; }
      if (trimmed.length > 30) { setError('Username must be less than 30 characters'); return; }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { setError('Only letters, numbers, and underscores allowed'); return; }
      setError('');
      setStep(2);
    } else {
      if (!dob) { setError('Please select your date of birth'); return; }
      const profile = {
        username: username.trim(),
        dob: dob.toISOString(),
        onboardingComplete: true,
      };
      localStorage.setItem('thutha_onboarding', JSON.stringify(profile));
      navigate('/feed');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo & Welcome */}
        <div className="flex flex-col items-center mb-8 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <img src={doveLogo} alt="Thutha" className="w-16 h-16 mb-3" />
          <h1 className="text-2xl font-heading font-bold text-foreground">
            {step === 1 ? 'Choose your name' : 'When were you born?'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 text-center">
            {step === 1
              ? 'This is how others will know you on Thutha'
              : 'Scroll to select your date of birth'}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mb-6">
          <div className={`h-1.5 rounded-full transition-all duration-500 ${step >= 1 ? 'w-10 bg-accent' : 'w-6 bg-muted'}`} />
          <div className={`h-1.5 rounded-full transition-all duration-500 ${step >= 2 ? 'w-10 bg-accent' : 'w-6 bg-muted'}`} />
        </div>

        {/* Card */}
        <div className="thutha-card rounded-2xl p-6 space-y-5 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          {step === 1 ? (
            <div className="space-y-3">
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  placeholder="e.g. mwangi_ke"
                  maxLength={30}
                  className="w-full bg-muted rounded-xl pl-12 pr-4 py-3.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/40 transition-all"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                />
              </div>
              <p className="text-xs text-muted-foreground px-1">
                {username.length}/30 characters • letters, numbers, underscores
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Selected date display */}
              <div className="flex items-center gap-3 bg-muted rounded-xl px-4 py-3">
                <Cake className="w-5 h-5 text-accent flex-shrink-0" />
                <span className="text-foreground font-medium">
                  {dob ? format(dob, 'MMMM d, yyyy') : 'Scroll below to pick a date'}
                </span>
              </div>

              {/* Scroll wheel picker */}
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <ScrollWheelDatePicker
                  value={dob}
                  onChange={(d) => { setDob(d); setError(''); }}
                />
              </div>

              <p className="text-xs text-muted-foreground px-1">
                You must be at least 13 years old to use Thutha
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive font-medium px-1">{error}</p>
          )}

          <button
            onClick={handleContinue}
            className="w-full thutha-gradient text-primary-foreground rounded-xl px-4 py-3.5 font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md"
          >
            {step === 2 && <Sparkles className="w-4 h-4" />}
            {step === 1 ? 'Continue' : 'Get Started'}
          </button>

          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="w-full text-center text-muted-foreground text-sm hover:text-foreground transition-colors"
            >
              ← Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
