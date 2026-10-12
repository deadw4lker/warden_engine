import React, { useState } from 'react';
import { api, setCurrentUser } from '../api';
import { ArrowRight, Loader2 } from 'lucide-react';
import Logo from '../components/Logo';

/**
 * Signup flow ported from warden-frontend-main.zip:
 * Step 1 Company -> Step 2 Manager account -> creates real user via /auth/signup.
 * Styled to match CODEX-3.0 Login.jsx (paper bg, white card, stone-900 button).
 */
export default function Signup({ onLogin, onSignupDone, onBack }) {
  const [step, setStep] = useState(1);
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('');
  const [size, setSize] = useState('');
  const [country, setCountry] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const inputCls =
    'w-full bg-white border rounded-md px-3 py-2 text-[13px] text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-900 transition border-stone-300';
  const labelCls = 'block text-[12px] font-medium text-stone-700 mb-1';
  const selectCls = inputCls;

  const handleStep1 = (e) => {
    e.preventDefault();
    setError('');
    if (!company.trim()) return setError('Enter your company name.');
    if (!country.trim()) return setError('Enter your country.');
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) return setError('Enter your full name.');
    if (!username.trim() || username.trim().length < 3) return setError('Username must be at least 3 characters.');
    if (!email.includes('@')) return setError('Enter a valid work email.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');

    setLoading(true);
    try {
      const data = await api.signup({
        username: username.trim(),
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        company: company.trim(),
        role: 'auditor',
      });
      setCurrentUser(data.user);
      onSignupDone(data.user);
    } catch (err) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2EFE9] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px]">
        <button onClick={onBack} className="flex items-center justify-center mx-auto mb-6" aria-label="WARDEN home">
          <Logo height={30} />
        </button>

        <div className="bg-white border border-[#E6E0D3] rounded-lg p-6">
          <h2 className="text-[14px] font-semibold text-stone-900">Create your workspace</h2>
          <p className="text-[12px] text-stone-500 mt-0.5 mb-5">Start with the basics. You can change these later.</p>

          <div className="flex items-center gap-2 mb-6 text-[10px] font-bold tracking-widest uppercase">
            <span className={step >= 1 ? 'text-stone-900' : 'text-stone-400'}>01 Company</span>
            <span className="w-6 border-t border-stone-300" />
            <span className={step >= 2 ? 'text-stone-900' : 'text-stone-400'}>02 Manager account</span>
          </div>

          {step === 1 ? (
            <form onSubmit={handleStep1} className="space-y-3.5">
              <div>
                <label className={labelCls}>Company name</label>
                <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} placeholder="Acme Inc." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Industry</label>
                  <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={selectCls}>
                    <option value="">Select</option>
                    <option>Technology</option>
                    <option>Financial services</option>
                    <option>Healthcare</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Company size</label>
                  <select value={size} onChange={(e) => setSize(e.target.value)} className={selectCls}>
                    <option value="">Select</option>
                    <option>1–50</option>
                    <option>51–250</option>
                    <option>251–1,000</option>
                    <option>1,000+</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Country</label>
                <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} placeholder="India" />
              </div>
              {error && <div className="text-[12px] text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
              <button type="submit" className="w-full bg-stone-900 hover:bg-stone-800 text-white font-medium py-2 px-4 rounded-md transition flex items-center justify-center gap-2 text-[13px]">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className={labelCls}>Full name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="Alex Morgan" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Username</label>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} placeholder="alexm" />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Min 8 characters" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Work email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@company.com" />
              </div>
              {error && <div className="text-[12px] text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-md transition flex items-center justify-center gap-2 text-[13px]">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{loading ? 'Creating workspace...' : 'Create workspace'}</span>
              </button>
              <button type="button" onClick={() => setStep(1)} className="w-full text-[12px] text-stone-500 hover:text-stone-900 transition">
                Back to company details
              </button>
            </form>
          )}

          <p className="text-[12px] text-stone-500 text-center mt-5">
            Already have an account?{' '}
            <button onClick={onLogin} className="text-stone-900 font-semibold hover:underline">
              Log in
            </button>
          </p>
        </div>

        <button onClick={onBack} className="block mx-auto text-[12px] font-semibold text-stone-900 mt-4 hover:underline">
          Back to home
        </button>
        <p className="text-center text-[11px] text-stone-400 mt-2">Pre-execution control &amp; audit trail</p>
      </div>
    </div>
  );
}
