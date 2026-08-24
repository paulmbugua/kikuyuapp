import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth, type OAuthLoginResult } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const doveLogo = '/dove-logo.png';
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');
const apiOrigin = new URL(apiBaseUrl).origin;

type OAuthMessage = {
  type: 'kikuyu:google-oauth';
  ok: boolean;
  data?: OAuthLoginResult;
  error?: string;
};

const decodeOAuthFragment = (encoded: string): OAuthMessage => {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const bytes = Uint8Array.from(window.atob(padded), (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as OAuthMessage;
};

const openGoogleOAuth = () => new Promise<OAuthLoginResult>((resolve, reject) => {
  const width = 520;
  const height = 680;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  const popup = window.open(
    `${apiBaseUrl}/auth/google`,
    'kikuyu-google-oauth',
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`
  );

  if (!popup) {
    reject(new Error('Please allow popups to continue with Google'));
    return;
  }

  let completed = false;
  let closedWatcher = 0;
  let timeout = 0;
  const cleanup = () => {
    window.removeEventListener('message', handleMessage);
    window.clearInterval(closedWatcher);
    window.clearTimeout(timeout);
  };
  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== apiOrigin || event.data?.type !== 'kikuyu:google-oauth') return;
    completed = true;
    cleanup();
    if (event.data.ok) resolve(event.data.data as OAuthLoginResult);
    else reject(new Error(event.data.error || 'Google sign-in failed'));
  };

  window.addEventListener('message', handleMessage);
  closedWatcher = window.setInterval(() => {
    if (popup.closed && !completed) {
      cleanup();
      reject(new Error('Google sign-in was cancelled'));
    }
  }, 500);
  timeout = window.setTimeout(() => {
    cleanup();
    popup.close();
    reject(new Error('Google sign-in timed out. Please try again.'));
  }, 2 * 60 * 1000);
});

const Login = () => {
  const { login, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const encodedPayload = new URLSearchParams(window.location.hash.slice(1)).get('oauth');
    if (!encodedPayload) return;

    // Remove the short-lived token payload from the address bar before doing any async work.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    const completeRedirectLogin = async () => {
      setIsLoading(true);
      setError('');

      try {
        const payload = decodeOAuthFragment(encodedPayload);
        if (payload.type !== 'kikuyu:google-oauth' || !payload.ok || !payload.data) {
          throw new Error(payload.error || 'Google sign-in failed');
        }

        await login(payload.data);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Failed to complete Google sign-in';
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };

    void completeRedirectLogin();
  }, [login]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    toast.loading('Opening Google securely…', { id: 'auth-loading' });

    try {
      const result = await openGoogleOAuth();
      await login(result);
      toast.dismiss('auth-loading');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Failed to login with Google';
      setError(message);
      toast.dismiss('auth-loading');
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full blur-2xl opacity-20 animate-pulse" />
            <img src={doveLogo} alt="Thutha" className="relative w-24 h-24 mb-4 animate-float" />
          </div>
          <h1 className="text-3xl font-heading font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Thutha
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Voice of Agĩkũyũ</p>
        </div>

        <div className="thutha-card p-6 space-y-4 animate-fade-up backdrop-blur-sm bg-card/80" style={{ animationDelay: '0.3s' }}>
          <h2 className="text-lg font-heading font-semibold text-center text-foreground">Welcome back</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 animate-shake">
              <p className="text-red-500 text-sm text-center">{error}</p>
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading || authLoading}
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transform hover:-translate-y-0.5"
          >
            {(isLoading || authLoading) ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {(isLoading || authLoading) ? 'Signing in…' : 'Continue with Google'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">Secure authentication</span>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Secured by Google OAuth and the Kikuyu backend
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 animate-fade-up" style={{ animationDelay: '0.5s' }}>
          By continuing, you agree to our{' '}
          <span className="text-primary cursor-pointer hover:underline">Terms of Service</span> and{' '}
          <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
};

export default Login;
