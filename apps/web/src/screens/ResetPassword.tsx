import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useNavigate } from '@/lib/navigation';
import { toast } from 'sonner';

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');

export default function ResetPassword() {
  const navigate = useNavigate();
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
  const email = params.get('email') || '';
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/auth/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, token, password, confirmPassword }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to reset password');
      toast.success('Password reset. You can now log in.'); navigate('/login');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to reset password'); }
    finally { setLoading(false); }
  };

  return <main className="flex min-h-screen items-center justify-center bg-[#f7f4ec] px-5 py-10"><div className="w-full max-w-md rounded-3xl border border-[#e2e6de] bg-white p-7 shadow-xl shadow-[#092019]/5"><p className="mb-2 text-sm font-bold uppercase tracking-[.18em] text-[#c45b3e]">Account recovery</p><h1 className="font-heading text-3xl font-bold text-[#092019]">Choose a new password</h1><p className="mt-3 text-sm leading-6 text-[#718078]">Use at least 8 characters with uppercase, lowercase, a number and a symbol.</p>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{!email || !token ? <p className="mt-6 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">This reset link is incomplete or expired.</p> : <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-semibold">New password<span className="relative mt-2 block"><input value={password} onChange={e => setPassword(e.target.value)} type={show ? 'text' : 'password'} minLength={8} required className="w-full rounded-2xl border border-[#d9ded7] px-4 py-3.5 pr-12 outline-none focus:border-[#c45b3e]" /><button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718078]">{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></span></label><label className="block text-sm font-semibold">Confirm password<input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type={show ? 'text' : 'password'} minLength={8} required className="mt-2 w-full rounded-2xl border border-[#d9ded7] px-4 py-3.5 outline-none focus:border-[#c45b3e]" /></label><button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#092019] px-4 py-3.5 font-bold text-white disabled:opacity-50">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />} Reset password</button></form>}<button onClick={() => navigate('/login')} className="mt-5 w-full text-sm font-bold text-[#28624c]">Back to login</button></div></main>;
}
