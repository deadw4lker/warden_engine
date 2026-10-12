import React, { useState } from 'react';
import { api, setCurrentUser } from '../api';
import { Shield, Loader2 } from 'lucide-react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('demo123');
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const demoRoles = [
    { label: 'Admin', username: 'admin' },
    { label: 'Risk lead', username: 'risklead' },
    { label: 'Approver', username: 'approver' },
    { label: 'Executive', username: 'exec' },
    { label: 'Auditor', username: 'auditor' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setFieldErrors({});

    const errors = {};
    if (!username.trim()) errors.username = 'Enter your username';
    if (!password) errors.password = 'Enter your password';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const data = await api.login(username, password);
      setCurrentUser(data.user);
      onLogin(data.user);
    } catch (err) {
      if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      } else {
        setGeneralError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (hasError) =>
    `w-full bg-white border rounded-md px-3 py-2 text-[13px] text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-900 transition ${
      hasError ? 'border-red-500' : 'border-stone-300'
    }`;

  return (
    <div className="min-h-screen bg-[#F2EFE9] flex items-center justify-center p-4">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center space-x-2.5 mb-6">
          <div className="w-8 h-8 rounded-md bg-stone-900 flex items-center justify-center text-white">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-tight text-stone-900 leading-none">Warden</h1>
            <p className="text-[12px] text-stone-500 mt-0.5">Agent governance console</p>
          </div>
        </div>

        <div className="bg-white border border-[#E6E0D3] rounded-lg p-6">
          <h2 className="text-[14px] font-semibold text-stone-900">Sign in</h2>
          <p className="text-[12px] text-stone-500 mt-0.5 mb-5">Use your console credentials to continue.</p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[12px] font-medium text-stone-700 mb-1">
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  if (fieldErrors.username) setFieldErrors(prev => ({ ...prev, username: null }));
                }}
                className={inputCls(fieldErrors.username)}
                placeholder="username"
              />
              {fieldErrors.username && (
                <p className="text-[12px] text-red-700 mt-1">{fieldErrors.username}</p>
              )}
            </div>
            <div>
              <label className="block text-[12px] font-medium text-stone-700 mb-1">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: null }));
                }}
                className={inputCls(fieldErrors.password)}
                placeholder="••••••••"
              />
              {fieldErrors.password && (
                <p className="text-[12px] text-red-700 mt-1">{fieldErrors.password}</p>
              )}
            </div>

            {generalError && (
              <div className="text-[12px] text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {generalError}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-md transition flex items-center justify-center space-x-2 text-[13px]"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? 'Signing in...' : 'Sign in'}</span>
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-stone-200">
            <p className="text-[11px] text-stone-500 mb-2">Demo accounts — password: demo123</p>
            <div className="flex gap-1.5 flex-wrap">
              {demoRoles.map(r => (
                <button
                  key={r.username}
                  onClick={() => { setUsername(r.username); setPassword('demo123'); }}
                  className="text-[12px] px-2.5 py-1 rounded-md border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 transition"
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-stone-400 mt-4">
          Pre-execution control &amp; audit trail
        </p>
      </div>
    </div>
  );
}
