import { useEffect, useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { useAuth, type OAuthLoginResult } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const doveLogo = '/dove-logo.png';
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');
const apiOrigin = new URL(apiBaseUrl).origin;

type OAuthMessage = { type: 'kikuyu:google-oauth'; ok: boolean; data?: OAuthLoginResult; error?: string };
type Mode = 'login' | 'register' | 'forgot';

const decodeOAuthFragment = (encoded: string): OAuthMessage => {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const bytes = Uint8Array.from(window.atob(padded), character => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as OAuthMessage;
};

const openGoogleOAuth = () => new Promise<OAuthLoginResult>((resolve, reject) => {
  const width = 520;
  const height = 680;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  const url = new URL(`${apiBaseUrl}/auth/google`);
  url.searchParams.set('origin', window.location.origin);
  const popup = window.open(url.toString(), 'kikuyu-google-oauth', `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
  if (!popup) { reject(new Error('Please allow popups to continue with Google')); return; }
  let completed = false;
  let watcher = 0;
  let timeout = 0;
  const cleanup = () => { window.removeEventListener('message', handleMessage); window.clearInterval(watcher); window.clearTimeout(timeout); };
  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== apiOrigin || event.data?.type !== 'kikuyu:google-oauth') return;
    completed = true; cleanup();
    if (event.data.ok) resolve(event.data.data as OAuthLoginResult); else reject(new Error(event.data.error || 'Google sign-in failed'));
  };
  window.addEventListener('message', handleMessage);
  watcher = window.setInterval(() => { if (popup.closed && !completed) { cleanup(); reject(new Error('Google sign-in was cancelled')); } }, 500);
  timeout = window.setTimeout(() => { cleanup(); popup.close(); reject(new Error('Google sign-in timed out. Please try again.')); }, 2 * 60 * 1000);
});

const Login = () => {
  const { login, isLoading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const encodedPayload = new URLSearchParams(window.location.hash.slice(1)).get('oauth');
    if (!encodedPayload) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    void (async () => {
      setIsLoading(true);
      try {
        const payload = decodeOAuthFragment(encodedPayload);
        if (!payload.ok || !payload.data) throw new Error(payload.error || 'Google sign-in failed');
        await login(payload.data);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Failed to complete Google sign-in';
        setError(message); toast.error(message);
      } finally { setIsLoading(false); }
    })();
  }, [login]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setIsLoading(true);
    try {
      const endpoint = mode === 'register' ? 'register' : 'login';
      const body = mode === 'register' ? { email, password, confirmPassword, fullName } : { email, password };
      const response = await fetch(`${apiBaseUrl}/auth/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || 'Authentication failed');
      await login(payload.data);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Authentication failed';
      setError(message); toast.error(message);
    } finally { setIsLoading(false); }
  };

  const handleForgot = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to request password reset');
      toast.success('If that email has an account, a reset link is on its way.'); setMode('login');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to request password reset'); }
    finally { setIsLoading(false); }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true); setError('');
    try { await login(await openGoogleOAuth()); }
    catch (caught) { const message = caught instanceof Error ? caught.message : 'Failed to login with Google'; setError(message); toast.error(message); }
    finally { setIsLoading(false); }
  };

  const busy = isLoading || authLoading;
  return (
    <main className="min-h-screen bg-[#f7f4ec] text-[#092019] lg:grid lg:grid-cols-2">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#08251c] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <img src="/login-kikuyu-hero.png" alt="Kikuyu community gathered in the Kenyan highlands" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#071a15]/95 via-[#071a15]/65 to-[#071a15]/20" />
        <div className="relative z-10 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f3c969]"><img src={doveLogo} alt="" className="h-9 w-9 object-contain mix-blend-multiply" /></span><span><strong className="block font-heading text-3xl text-white">Thutha</strong><span className="text-[10px] font-bold uppercase tracking-[.28em] text-[#f3c969]">Tũgĩe hamwe</span></span></div>
        <div className="relative z-10 max-w-xl pb-8"><p className="mb-5 text-sm font-bold uppercase tracking-[.22em] text-[#f3c969]">Voice of Agĩkũyũ</p><h1 className="max-w-lg font-heading text-5xl font-bold leading-[1.02] text-white xl:text-6xl">Where our stories meet, grow and travel.</h1><p className="mt-6 max-w-md text-base leading-7 text-white/75">Connect with Kikuyu people everywhere. Share stories, celebrate culture, discover talent, build community and support one another.</p><div className="mt-8 flex flex-wrap gap-2 text-xs font-semibold text-white/85"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">Stories & voices</span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">Community circles</span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-2">Creators & culture</span></div></div>
        <p className="relative z-10 text-xs text-white/45">A digital home for connection, heritage and possibility.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><img src={doveLogo} alt="Thutha" className="h-12 w-12" /><div><h1 className="font-heading text-2xl font-bold">Thutha</h1><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9a6b12]">Tũgĩe hamwe</p></div></div>
          <div className="mb-8"><p className="mb-2 text-sm font-bold uppercase tracking-[.18em] text-[#c45b3e]">{mode === 'forgot' ? 'Account recovery' : mode === 'register' ? 'Join the circle' : 'Welcome home'}</p><h2 className="font-heading text-4xl font-bold tracking-tight text-[#092019]">{mode === 'forgot' ? 'Reset your password' : mode === 'register' ? 'Create your Thutha' : 'Come on in.'}</h2><p className="mt-3 text-sm leading-6 text-[#5f6e67]">{mode === 'forgot' ? 'Enter your email and we’ll send a secure reset link.' : 'A modern social home for Kikuyu stories, people and possibilities.'}</p></div>
          {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {mode === 'forgot' ? <form onSubmit={handleForgot} className="space-y-4"><label className="block text-sm font-semibold">Email address<input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="you@example.com" className="mt-2 w-full rounded-2xl border border-[#d9ded7] bg-white px-4 py-3.5 outline-none transition focus:border-[#c45b3e] focus:ring-4 focus:ring-[#c45b3e]/10" /></label><button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e55d3d] px-4 py-3.5 font-bold text-white shadow-lg shadow-[#e55d3d]/20 disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />} Send reset link</button><button type="button" onClick={() => { setMode('login'); setError(''); }} className="w-full text-sm font-bold text-[#28624c]">Back to login</button></form> : <>
            <button onClick={handleGoogleLogin} disabled={busy} className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#d9ded7] bg-white px-4 py-3.5 font-bold text-[#25352e] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="grid h-5 w-5 place-items-center rounded-full text-sm font-black text-[#4285F4]">G</span>} Continue with Google</button>
            <div className="my-5 flex items-center gap-3 text-xs font-semibold text-[#91a097]"><span className="h-px flex-1 bg-[#dfe4dc]" />or use email<span className="h-px flex-1 bg-[#dfe4dc]" /></div>
            <form onSubmit={submit} className="space-y-4">
              {mode === 'register' && <label className="block text-sm font-semibold">Full name<input value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Your full name" className="mt-2 w-full rounded-2xl border border-[#d9ded7] bg-white px-4 py-3.5 outline-none focus:border-[#c45b3e] focus:ring-4 focus:ring-[#c45b3e]/10" /></label>}
              <label className="block text-sm font-semibold">Email address<input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="you@example.com" className="mt-2 w-full rounded-2xl border border-[#d9ded7] bg-white px-4 py-3.5 outline-none focus:border-[#c45b3e] focus:ring-4 focus:ring-[#c45b3e]/10" /></label>
              <label className="block text-sm font-semibold">Password<span className="relative mt-2 block"><input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} required minLength={8} placeholder="At least 8 characters" className="w-full rounded-2xl border border-[#d9ded7] bg-white px-4 py-3.5 pr-12 outline-none focus:border-[#c45b3e] focus:ring-4 focus:ring-[#c45b3e]/10" /><button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718078]" aria-label="Toggle password visibility">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></span></label>
              {mode === 'register' && <label className="block text-sm font-semibold">Confirm password<input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type={showPassword ? 'text' : 'password'} required minLength={8} placeholder="Repeat your password" className="mt-2 w-full rounded-2xl border border-[#d9ded7] bg-white px-4 py-3.5 outline-none focus:border-[#c45b3e] focus:ring-4 focus:ring-[#c45b3e]/10" /></label>}
              <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#092019] px-4 py-3.5 font-bold text-white shadow-lg shadow-[#092019]/15 transition hover:-translate-y-0.5 disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />} {mode === 'register' ? 'Create account' : 'Log in'}</button>
            </form>
            <div className="mt-5 flex items-center justify-between text-sm"><button type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }} className="font-bold text-[#28624c]">{mode === 'register' ? 'Already have an account? Log in' : 'Create an account'}</button>{mode === 'login' && <button type="button" onClick={() => { setMode('forgot'); setError(''); }} className="font-semibold text-[#718078] hover:text-[#c45b3e]">Forgot password?</button>}</div>
          </>}
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-[#e5e8e1] bg-white/60 p-4 text-xs leading-5 text-[#718078]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#28624c]" /><span>Your account is protected with secure authentication and encrypted sessions.</span><Check className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-[#28624c]" /></div>
          <p className="mt-6 text-center text-xs text-[#91a097]">By continuing, you agree to our <span className="font-semibold text-[#28624c]">Terms of Service</span> and <span className="font-semibold text-[#28624c]">Privacy Policy</span>.</p>
        </div>
      </section>
    </main>
  );
};

export default Login;
